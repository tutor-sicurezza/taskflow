/**
 * Composizione di un'email di notifica per un destinatario preciso.
 *
 * Tutto quello che serve per decidere COSA spedire a QUALCUNO sta qui, in un
 * posto solo: la sua lingua, le sue preferenze, il modello scelto
 * dall'organizzazione o quello predefinito, e il riempimento dei segnaposto.
 *
 * Sta sul server e non nel client per una ragione di permessi, non di
 * organizzazione: lingua e preferenze vivono in `user_state`, che le policy
 * RLS rendono leggibile solo al proprietario. Chi assegna un task non puo'
 * conoscerle, e il lavoro pianificato dei promemoria non ha nemmeno un utente
 * collegato. Con il service role, qui, si puo'.
 *
 * Lo usano due percorsi: la rotta /api/email/send, quando qualcuno compie
 * un'azione, e il lavoro pianificato che avvisa delle scadenze. Prima la
 * logica stava dentro la rotta, quindi il secondo percorso avrebbe dovuto
 * riscriverla — e sarebbe bastato un ritocco a un modello per far divergere i
 * due tipi di email.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formattaData,
  linguaValida,
  traduciPriorita,
  type LinguaEmail,
} from "./emailTemplates.js";
import { modelloPredefinito, type TipoNotifica } from "./modelliEmail.js";
import { rendiModello, scegliModello } from "./modelliOrganizzazione.js";
import { chiavePreferenze, puoRicevereEmail } from "./preferenzeNotifiche.js";

/** I dati dell'evento, gia' estratti e normalizzati dal chiamante. */
export interface DatiNotifica {
  recipientName?: string;
  recipientEmail: string;
  actionBy?: string;
  taskTitle?: string;
  taskDescription?: string;
  /** Valore grezzo (`low`/`medium`/`high`): la traduzione avviene qui. */
  priority?: string;
  /** Data ISO: la formattazione per lingua avviene qui. */
  dueDate?: string;
  taskStatus?: string;
  taskUrl?: string;
  commentText?: string;
  applicationName?: string;
}

/**
 * La lingua compare in ENTRAMBI gli esiti, anche quando non si spedisce.
 *
 * Serve a chi deve comunque avvisare il destinatario per un'altra via: il
 * lavoro pianificato scrive una notifica in applicazione anche quando l'email
 * e' stata spenta dalle preferenze, e quella notifica va scritta nella lingua
 * di chi la legge.
 */
export type EsitoComposizione =
  | { spedibile: false; motivo: string; lingua: LinguaEmail }
  | {
      spedibile: true;
      lingua: LinguaEmail;
      subject: string;
      htmlContent: string;
      textContent: string;
    };

/** Accetta un indirizzo solo se e' http o https; altrimenti niente link. */
export function urlSicuro(valore: unknown): string | undefined {
  if (typeof valore !== "string" || !valore) return undefined;
  try {
    const schema = new URL(valore).protocol;
    return schema === "http:" || schema === "https:" ? valore : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Il nome dell'applicazione salvato nelle impostazioni di sistema.
 *
 * Il valore arriva da una colonna JSONB scritta dall'interfaccia: puo' essere
 * qualunque cosa, e in caso di dubbio si torna al nome di serie invece di
 * mandare un'email con un oggetto vuoto al posto del nome.
 */
function nomeApplicazione(valore: unknown): string {
  if (!valore || typeof valore !== "object") return "TaskFlow";
  const generali = (valore as Record<string, unknown>).general;
  if (!generali || typeof generali !== "object") return "TaskFlow";
  const nome = (generali as Record<string, unknown>).applicationName;
  return typeof nome === "string" && nome.trim() ? nome.trim() : "TaskFlow";
}

export async function componiPerDestinatario(
  admin: SupabaseClient,
  parametri: {
    tenantId: string;
    destinatarioId: string;
    tipo: TipoNotifica;
    dati: DatiNotifica;
  },
): Promise<EsitoComposizione> {
  const { tenantId, destinatarioId, tipo, dati } = parametri;

  // Le letture non dipendono l'una dall'altra: farle in fila moltiplicherebbe
  // l'attesa su un percorso che sta gia' dentro una richiesta.
  const [
    preferenzaLingua,
    rigaPreferenze,
    rigaModelli,
    organizzazione,
    rigaImpostazioni,
  ] = await Promise.all([
    admin
      .from("user_state")
      .select("value")
      .eq("user_id", destinatarioId)
      .eq("key", "lingua")
      .maybeSingle(),
    admin
      .from("user_state")
      .select("value")
      .eq("user_id", destinatarioId)
      .eq("key", chiavePreferenze(destinatarioId))
      .maybeSingle(),
    admin
      .from("app_state")
      .select("value")
      .eq("organization_id", tenantId)
      .eq("key", "email-templates")
      .maybeSingle(),
    admin.from("organizations").select("name").eq("id", tenantId).maybeSingle(),
    // Il nome scelto dall'organizzazione. Lo legge la composizione e non il
    // chiamante perche' i promemoria pianificati non hanno un'interfaccia da
    // cui prenderlo: senza questa lettura le loro email direbbero "TaskFlow"
    // anche a chi l'applicazione l'ha rinominata.
    admin
      .from("app_state")
      .select("value")
      .eq("organization_id", tenantId)
      .eq("key", "system-settings")
      .maybeSingle(),
  ]);

  const lingua = linguaValida(preferenzaLingua.data?.value);

  /**
   * Il destinatario puo' aver spento queste email.
   *
   * Il controllo sta PRIMA della composizione: comporre e poi buttare via
   * sarebbe lavoro sprecato, ma soprattutto e' qui che si decide, e mescolarlo
   * con la resa del testo renderebbe piu' facile, un domani, spostare per
   * sbaglio l'invio prima del controllo.
   */
  const esito = puoRicevereEmail(rigaPreferenze.data?.value, tipo);
  if (!esito.consentito) {
    return { spedibile: false, motivo: esito.motivo ?? "preferenze", lingua };
  }

  /**
   * Il modello dell'organizzazione se c'e', altrimenti quello predefinito
   * nella lingua del destinatario.
   *
   * Un modello personalizzato vince sulla lingua: e' un testo libero scritto
   * in una lingua sola e non c'e' modo di tradurlo. La lingua continua pero' a
   * decidere il formato della data e il nome della priorita', che il modello
   * riceve gia' pronti.
   */
  const modello =
    scegliModello(rigaModelli.data?.value, tipo) ??
    modelloPredefinito(lingua, tipo);

  const adesso = new Date();
  const composta = rendiModello(modello, {
    recipientName: dati.recipientName,
    recipientEmail: dati.recipientEmail,
    actionBy: dati.actionBy,
    taskTitle: dati.taskTitle,
    taskDescription: dati.taskDescription,
    taskPriority: dati.priority
      ? traduciPriorita(lingua, dati.priority)
      : undefined,
    taskDueDate: dati.dueDate ? formattaData(lingua, dati.dueDate) : undefined,
    taskStatus: dati.taskStatus,
    taskUrl: urlSicuro(dati.taskUrl),
    commentText: dati.commentText,
    applicationName:
      dati.applicationName || nomeApplicazione(rigaImpostazioni.data?.value),
    companyName: organizzazione.data?.name ?? undefined,
    currentDate: formattaData(lingua, adesso.toISOString()),
    currentYear: String(adesso.getFullYear()),
  });

  if (!composta.subject || (!composta.htmlContent && !composta.textContent)) {
    return { spedibile: false, motivo: "modello vuoto", lingua };
  }

  return { spedibile: true, lingua, ...composta };
}
