export const runtime = 'edge';

import { createSupabaseAdminClient, jsonResponse, withErrors } from '../_lib/supabase.js';
import { getRequiredEnv } from '../_lib/env.js';
import { linguaValida } from '../_lib/emailTemplates.js';
import { spedisci } from '../_lib/invio.js';
import {
  CHIAVE_ULTIMO_INVIO,
  FINESTRA_DIGEST_MS,
  MAX_PREFERENZE_LETTE,
  MAX_VOCI_PER_EMAIL,
  TETTO_DIGEST_PER_ESECUZIONE,
  componiRiepilogo,
  eOraDelRiepilogo,
  finestraDigest,
  fusoRiepilogo,
  preferisceRiepilogo,
  ultimaFinestraInviata,
  type ConteggiDigest,
  type VoceRiepilogo,
} from '../_lib/digest.js';

/**
 * Riepilogo giornaliero delle notifiche, spedito da un lavoro pianificato.
 *
 * Il problema che risolve: oggi ogni evento fa partire un'email, e in un team
 * attivo diventano decine di messaggi al giorno. Chi sceglie il riepilogo smette
 * di riceverle una per una (il filtro sta in `preferenzeNotifiche.ts`) e ne
 * riceve una sola, all'ora che ha indicato, con dentro cio' che non ha ancora
 * letto.
 *
 * Le NOTIFICHE IN APPLICAZIONE non c'entrano e restano immediate in ogni caso:
 * il riepilogo riguarda solo la posta. La campanella e' il canale che non si puo'
 * perdere, e rallentarla sarebbe un peggioramento travestito da preferenza.
 *
 * Gira OGNI ORA (vedi `crons` in vercel.json), non una volta al giorno: le ore
 * scelte dalle persone sono ventiquattro, e un'esecuzione sola ne servirebbe una.
 * A ogni passata si sceglie chi ha indicato proprio quest'ora, nel proprio fuso.
 *
 * Le regole — chi vuole il riepilogo, a chi tocca adesso, cosa c'e' scritto
 * dentro — stanno tutte in `_lib/digest.ts`, dove sono provabili senza database.
 * Qui c'e' solo l'esecuzione.
 */

/**
 * Quante notifiche leggere in tutto per esecuzione.
 *
 * Alto abbastanza da coprire un'ora di destinatari con l'arretrato pieno, ma non
 * illimitato: un solo `select` senza tetto, su una tabella che cresce, e' il modo
 * classico in cui una funzione edge va in timeout. Se il tetto morde, i riepiloghi
 * elencano meno voci delle reali — mai piu' di quante ne mostrerebbero comunque,
 * visto che l'email si ferma a MAX_VOCI_PER_EMAIL.
 */
const MAX_NOTIFICHE_LETTE = 5000;

export const fetch = withErrors(async (request: Request) => {
  /**
   * Autenticazione dello scheduler, identica a quella dei promemoria e per lo
   * stesso motivo: senza CRON_SECRET questa rotta sarebbe un endpoint pubblico
   * capace di spedire posta a chiunque abbia il riepilogo attivo. Rifiutare e non
   * funzionare e' preferibile.
   */
  const segreto = process.env.CRON_SECRET;
  if (!segreto) {
    return jsonResponse(
      { error: 'CRON_SECRET non configurata: il lavoro pianificato resta disabilitato' },
      { status: 503 }
    );
  }

  const atteso = `Bearer ${segreto}`;
  if (request.headers.get('authorization') !== atteso) {
    return jsonResponse({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { appUrl } = getRequiredEnv();
  const admin = createSupabaseAdminClient();
  const adesso = new Date();
  const finestra = finestraDigest(adesso);
  const inizio = new Date(adesso.getTime() - FINESTRA_DIGEST_MS).toISOString();

  const conteggi: ConteggiDigest = {
    esaminati: 0,
    conRiepilogo: 0,
    dovutiOra: 0,
    spediti: 0,
    saltati: {
      giaSpedito: 0,
      nienteDiNuovo: 0,
      senzaEmail: 0,
      invioFallito: 0,
    },
    tettoRaggiunto: false,
  };

  /**
   * Le preferenze di tutti, filtrate qui e non in SQL.
   *
   * Un filtro JSONB su `digestEnabled` sembrerebbe piu' efficiente, ma
   * risponderebbe alla domanda sbagliata: `preferisceRiepilogo` deve dire di no
   * anche a un `digestEnabled: true` con un orario inservibile, e quella regola
   * — con i suoi casi limite — vive in una funzione provata. Duplicarla in una
   * espressione PostgREST significherebbe due versioni della stessa decisione,
   * che prima o poi divergono.
   */
  const { data: righePreferenze, error: errorePreferenze } = await admin
    .from('user_state')
    .select('user_id, value')
    .like('key', 'notification-preferences-%')
    .limit(MAX_PREFERENZE_LETTE);

  if (errorePreferenze) {
    return jsonResponse({ error: errorePreferenze.message }, { status: 500 });
  }

  const preferenze = righePreferenze ?? [];
  conteggi.esaminati = preferenze.length;

  const candidati: { userId: string; valore: unknown }[] = [];
  for (const riga of preferenze) {
    if (!preferisceRiepilogo(riga.value)) continue;
    conteggi.conRiepilogo += 1;
    if (!eOraDelRiepilogo(riga.value, adesso)) continue;
    candidati.push({ userId: riga.user_id as string, valore: riga.value });
  }

  conteggi.dovutiOra = candidati.length;
  if (candidati.length === 0) {
    return jsonResponse(conteggi);
  }

  const idCandidati = candidati.map((voce) => voce.userId);

  /**
   * Tutte le letture di contorno in una volta sola.
   *
   * Una query per destinatario moltiplicherebbe per il numero di persone la
   * durata dell'esecuzione — e' lo stesso motivo per cui i promemoria leggono in
   * blocco. Le quattro letture non dipendono l'una dall'altra, quindi partono
   * insieme.
   */
  const [segni, lingue, profili, notifiche] = await Promise.all([
    admin
      .from('user_state')
      .select('user_id, value')
      .eq('key', CHIAVE_ULTIMO_INVIO)
      .in('user_id', idCandidati),
    admin
      .from('user_state')
      .select('user_id, value')
      .eq('key', 'lingua')
      .in('user_id', idCandidati),
    admin.from('profiles').select('id, email, full_name').in('id', idCandidati),
    admin
      .from('notifications')
      .select('user_id, organization_id, message, task_title, created_at')
      .in('user_id', idCandidati)
      .eq('read', false)
      .gte('created_at', inizio)
      // Le piu' recenti per prime: se l'email si ferma a MAX_VOCI_PER_EMAIL, e'
      // meglio che le voci mostrate siano quelle appena arrivate.
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFICHE_LETTE),
  ]);

  if (notifiche.error) {
    return jsonResponse({ error: notifiche.error.message }, { status: 500 });
  }

  const finestraPerUtente = new Map(
    (segni.data ?? []).map((riga) => [riga.user_id as string, ultimaFinestraInviata(riga.value)])
  );
  const linguaPerUtente = new Map(
    (lingue.data ?? []).map((riga) => [riga.user_id as string, linguaValida(riga.value)])
  );
  const profiloPerUtente = new Map((profili.data ?? []).map((riga) => [riga.id as string, riga]));

  type RigaNotifica = {
    user_id: string;
    organization_id: string;
    message: string;
    task_title: string | null;
    created_at: string | null;
  };

  const perUtente = new Map<string, RigaNotifica[]>();
  for (const riga of (notifiche.data ?? []) as RigaNotifica[]) {
    const elenco = perUtente.get(riga.user_id);
    if (elenco) elenco.push(riga);
    else perUtente.set(riga.user_id, [riga]);
  }

  /**
   * Il nome dato all'applicazione, per organizzazione.
   *
   * Firma il riepilogo. Senza questa lettura l'email direbbe "TaskFlow" anche a
   * chi l'applicazione l'ha rinominata — lo stesso motivo per cui lo legge
   * `composizione.ts` per le email evento per evento.
   */
  const idOrganizzazioni = Array.from(
    new Set(
      Array.from(perUtente.values())
        .map((righe) => righe[0]?.organization_id)
        .filter((valore): valore is string => Boolean(valore))
    )
  );

  const nomePerOrganizzazione = new Map<string, string>();
  if (idOrganizzazioni.length > 0) {
    const { data: impostazioni } = await admin
      .from('app_state')
      .select('organization_id, value')
      .eq('key', 'system-settings')
      .in('organization_id', idOrganizzazioni);

    for (const riga of impostazioni ?? []) {
      const valore = riga.value as Record<string, unknown> | null;
      const generali = valore && typeof valore === 'object' ? valore.general : null;
      const nome =
        generali && typeof generali === 'object'
          ? (generali as Record<string, unknown>).applicationName
          : null;
      if (typeof nome === 'string' && nome.trim()) {
        nomePerOrganizzazione.set(riga.organization_id as string, nome.trim());
      }
    }
  }

  for (const candidato of candidati) {
    if (conteggi.spediti >= TETTO_DIGEST_PER_ESECUZIONE) {
      conteggi.tettoRaggiunto = true;
      break;
    }

    // Il segno dell'ultimo invio: se porta gia' questa finestra, il riepilogo e'
    // partito e una seconda passata dello scheduler non deve rifarlo.
    if (finestraPerUtente.get(candidato.userId) === finestra) {
      conteggi.saltati.giaSpedito += 1;
      continue;
    }

    const righe = perUtente.get(candidato.userId) ?? [];
    if (righe.length === 0) {
      /**
       * Nessuna notifica nuova, nessuna email.
       *
       * Un messaggio che dice "nessuna novita'" e' il modo piu' rapido per
       * insegnare a chi lo riceve a non aprire piu' nemmeno quelli che
       * contengono qualcosa. E non si scrive nemmeno il segno: non c'e' nulla da
       * non ripetere.
       */
      conteggi.saltati.nienteDiNuovo += 1;
      continue;
    }

    const profilo = profiloPerUtente.get(candidato.userId);
    if (!profilo?.email) {
      conteggi.saltati.senzaEmail += 1;
      continue;
    }

    /**
     * L'organizzazione e' quella della notifica piu' recente.
     *
     * Serve per il registro degli invii e per il nome dell'applicazione. Chi
     * appartiene a piu' organizzazioni riceve comunque UN riepilogo con dentro
     * tutto: spezzarlo per organizzazione riporterebbe esattamente la moltiplicazione
     * di email che questo lavoro esiste per togliere.
     */
    const organizzazione = righe[0].organization_id;
    const lingua = linguaPerUtente.get(candidato.userId) ?? 'it';

    const voci: VoceRiepilogo[] = righe.slice(0, MAX_VOCI_PER_EMAIL).map((riga) => ({
      message: riga.message,
      task_title: riga.task_title,
      created_at: riga.created_at,
    }));

    /**
     * Un destinatario che va storto non deve fermare gli altri: un errore del
     * provider su un solo indirizzo lascerebbe senza riepilogo tutti quelli in
     * coda, ogni giorno, finche' qualcuno non se ne accorge.
     */
    try {
      const composto = componiRiepilogo(lingua, {
        nomeDestinatario: profilo.full_name ?? undefined,
        voci,
        totale: righe.length,
        appUrl,
        nomeApplicazione: nomePerOrganizzazione.get(organizzazione) ?? 'TaskFlow',
        fuso: fusoRiepilogo(candidato.valore),
      });

      const esito = await spedisci({
        to: profilo.email as string,
        subject: composto.subject,
        html: composto.htmlContent,
        text: composto.textContent,
        tenantId: organizzazione,
        // Nessun utente ha agito: e' l'orologio ad aver deciso. `invio.ts`
        // registra comunque l'esito in email_delivery_logs.
        userId: null,
        destinatarioId: candidato.userId,
      });

      if (!esito.ok) {
        conteggi.saltati.invioFallito += 1;
        continue;
      }

      /**
       * Il segno si scrive DOPO l'invio riuscito: un fallimento del provider deve
       * poter essere ritentato alla prossima esecuzione, non restare zittito da un
       * segno messo in anticipo. Vedi `finestraDigest` per il meccanismo completo.
       */
      await admin.from('user_state').upsert(
        {
          user_id: candidato.userId,
          key: CHIAVE_ULTIMO_INVIO,
          value: { finestra, inviatoIl: adesso.toISOString(), voci: righe.length },
          updated_at: adesso.toISOString(),
        },
        { onConflict: 'user_id,key' }
      );

      conteggi.spediti += 1;
    } catch {
      conteggi.saltati.invioFallito += 1;
    }
  }

  return jsonResponse(conteggi);
});
