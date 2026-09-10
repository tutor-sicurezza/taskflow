/**
 * Le regole dei promemoria di scadenza, senza database attorno.
 *
 * Stanno in `_lib` e non accanto alla rotta per un motivo pratico: `api/cron/`
 * e' una cartella instradata da Vercel, dove ogni file diventa un endpoint
 * pubblico. Un test li' accanto sarebbe diventato la rotta
 * `/api/cron/promemoria.test`, per giunta con un import di vitest — che in
 * produzione non esiste. Il trattino basso di `_lib` esclude invece la
 * cartella dall'instradamento.
 */

import type { LinguaModello, TipoNotifica } from './modelliEmail.js';

/** Quanto in anticipo si avvisa. Cambiare qui cambia anche i test. */
export const FINESTRA_DUE_SOON_MS = 24 * 60 * 60 * 1000;

/**
 * Tetto agli invii per esecuzione.
 *
 * Non e' una quota di prodotto ma una cintura di sicurezza: una migrazione che
 * sbaglia le date, o un import che scrive migliaia di task scaduti, qui
 * diventerebbe una campagna di posta involontaria a nome del dominio
 * verificato. Meglio fermarsi, dirlo nella risposta e far intervenire una
 * persona.
 */
export const TETTO_EMAIL_PER_ESECUZIONE = 200;

/**
 * Quanti task leggere al massimo. Piu' alto del tetto perche' molti candidati
 * verranno scartati (gia' avvisati, preferenze spente): fermarsi a 200 righe
 * lette significherebbe non arrivare mai ai task in fondo alla lista.
 */
export const MAX_TASK_LETTI = 2000;

/** Il minimo che serve per classificare un task; il resto non entra in gioco. */
export interface TaskDaClassificare {
  status?: string | null;
  due_date?: string | null;
  assignee_id?: string | null;
}

export type Promemoria = Extract<TipoNotifica, 'task_due_soon' | 'task_overdue'>;

/**
 * Decide se un task merita un promemoria, e quale.
 *
 * E' una funzione pura e separata dalla rotta apposta: e' l'unica parte con
 * delle regole vere (finestra, stato, assegnatario) e senza database attorno
 * puo' essere provata sui casi limite, a partire da quello delle 24 ore
 * esatte.
 */
export function classificaTask(
  task: TaskDaClassificare,
  adesso: Date
): Promemoria | null {
  // Senza destinatario non c'e' nessuno da avvisare: il task esiste ma non e'
  // di nessuno, e ripiegare su chi l'ha creato sarebbe un'altra notifica.
  if (!task.assignee_id) return null;

  // 'completed' e' l'unico stato terminale in TaskStatus (src/lib/types.ts):
  // gli altri due, 'not-started' e 'in-progress', vanno entrambi avvisati.
  if (task.status === 'completed') return null;

  if (!task.due_date) return null;
  const scadenza = new Date(task.due_date).getTime();
  if (Number.isNaN(scadenza)) return null;

  const ora = adesso.getTime();
  if (scadenza < ora) return 'task_overdue';

  // Il confine delle 24 ore e' incluso: una scadenza esattamente al limite e'
  // "entro le prossime 24 ore". Escluderlo aprirebbe una fessura in cui un
  // task puo' passare da "troppo presto" a "gia' scaduto" senza che il
  // promemoria di preavviso venga mai emesso.
  if (scadenza <= ora + FINESTRA_DUE_SOON_MS) return 'task_due_soon';

  return null;
}

/**
 * Link con cui si apre il task dall'email.
 *
 * Stesso formato usato dal client (`src/lib/taskEmail.ts`) e dalle notifiche
 * di sistema. Qui l'origine non si puo' leggere da `window`: arriva da
 * APP_URL/VERCEL_URL tramite `getRequiredEnv().appUrl`. Se non e' configurata
 * si restituisce `undefined` e il modello resta senza link, che e' meglio di
 * un link rotto dentro un'email vera.
 */
export function costruisciTaskUrl(
  origine: string | undefined,
  taskId: string
): string | undefined {
  if (!origine) return undefined;
  return `${origine.replace(/\/+$/, '')}/#task-${taskId}`;
}

export interface Conteggi {
  esaminati: number;
  spediti: number;
  /**
   * Notifiche in applicazione scritte. Contate a parte dalle email perche' i
   * due canali possono divergere: chi ha spento la posta riceve comunque
   * l'avviso nella campanella, ed e' proprio il caso che questo numero rende
   * visibile dall'esterno.
   */
  notificheCreate: number;
  saltati: {
    nienteDaFare: number;
    giaAvvisati: number;
    senzaEmail: number;
    preferenzeOModello: number;
    invioFallito: number;
  };
  tettoRaggiunto: boolean;
}

/**
 * Il testo della notifica in applicazione per un promemoria.
 *
 * I promemoria di scadenza esistevano solo come email: chi aveva spento la
 * posta — o chi semplicemente non la guarda — non riceveva NESSUN avviso, in
 * nessuna forma. La campanella e' il canale che non si puo' perdere, ed e'
 * quello che deve esserci sempre.
 *
 * Il messaggio si scrive qui e non nel client perche' lo genera il server:
 * viene salvato come testo nella riga della notifica e mostrato cosi' com'e',
 * quindi va composto nella lingua di chi lo legge.
 */
const MESSAGGI: Record<
  LinguaModello,
  Record<Promemoria, (titolo: string) => string>
> = {
  it: {
    task_due_soon: (t) => `"${t}" scade entro 24 ore`,
    task_overdue: (t) => `"${t}" e' scaduta`,
  },
  en: {
    task_due_soon: (t) => `"${t}" is due within 24 hours`,
    task_overdue: (t) => `"${t}" is overdue`,
  },
  fr: {
    task_due_soon: (t) => `« ${t} » arrive à échéance sous 24 heures`,
    task_overdue: (t) => `« ${t} » est en retard`,
  },
  de: {
    task_due_soon: (t) => `„${t}" wird in den nächsten 24 Stunden fällig`,
    task_overdue: (t) => `„${t}" ist überfällig`,
  },
  es: {
    task_due_soon: (t) => `«${t}» vence en 24 horas`,
    task_overdue: (t) => `«${t}» ha vencido`,
  },
};

export function messaggioPromemoria(
  lingua: string,
  tipo: Promemoria,
  titolo: string
): string {
  const per = MESSAGGI[lingua as LinguaModello] ?? MESSAGGI.it;
  return per[tipo](titolo || "");
}
