export const runtime = 'edge';

import { createSupabaseAdminClient, jsonResponse, withErrors } from '../_lib/supabase.js';
import {
  GIORNI_LOG_EMAIL,
  GIORNI_NOTIFICHE_LETTE,
  TETTO_RIGHE_PER_ESECUZIONE,
  TETTO_VOCI_AUDIT,
  limiteConservazione,
} from '../_lib/pulizia.js';

/**
 * Pulizia periodica dei dati che crescono senza limite.
 *
 * Tre insiemi crescevano per sempre e nessuno li cancellava: i log di consegna
 * email, le notifiche gia' lette e il registro di audit. I primi due sono
 * tabelle e si potano con una DELETE per data; il terzo e' un array JSON
 * dentro `app_state` e si pota riscrivendolo (vedi piu' sotto).
 *
 * Le politiche di conservazione — quanti giorni, quante voci, e perche' quei
 * numeri — stanno tutte in `_lib/pulizia.ts`: qui c'e' solo l'esecuzione.
 * Invocata dallo scheduler di Vercel, vedi la sezione `crons` in vercel.json.
 */

export const fetch = withErrors(async (request: Request) => {
  /**
   * Autenticazione dello scheduler, identica a quella dei promemoria ma qui
   * vale ancora di piu': quella rotta, se lasciata aperta, spediva posta di
   * troppo; questa CANCELLA. Senza CRON_SECRET configurata la rotta si rifiuta
   * di funzionare invece di restare un pulsante "svuota l'archivio" esposto su
   * internet.
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

  const admin = createSupabaseAdminClient();
  const adesso = new Date();

  const limiteLogEmail = limiteConservazione(adesso, GIORNI_LOG_EMAIL);
  const limiteNotifiche = limiteConservazione(adesso, GIORNI_NOTIFICHE_LETTE);

  const conteggi = {
    logEmail: { cancellate: 0, piuVecchieDi: limiteLogEmail },
    notificheLette: { cancellate: 0, piuVecchieDi: limiteNotifiche },
    audit: { organizzazioni: 0, vociRimosse: 0, tetto: TETTO_VOCI_AUDIT },
    tettoRaggiunto: false,
    tetto: TETTO_RIGHE_PER_ESECUZIONE,
  };

  /**
   * Cancella a blocchi, entro il residuo del tetto comune alle due tabelle.
   *
   * Due passaggi (prima gli id, poi la DELETE) e non una DELETE con `where`
   * diretta perche' PostgREST non applica `limit` a una DELETE: senza questo
   * giro il tetto non esisterebbe e una data sbagliata svuoterebbe la tabella
   * in un colpo solo. `order by created_at` crescente fa uscire per prime le
   * righe piu' vecchie, cosi' se il tetto morde si e' comunque fatto il lavoro
   * che conta di piu' e il resto se ne va alla prossima esecuzione.
   */
  async function cancellaVecchie(
    tabella: 'email_delivery_logs' | 'notifications',
    limite: string,
    soloLette: boolean
  ): Promise<{ cancellate: number; error?: string }> {
    const residuo = TETTO_RIGHE_PER_ESECUZIONE - conteggi.logEmail.cancellate - conteggi.notificheLette.cancellate;
    if (residuo <= 0) return { cancellate: 0 };

    let query = admin
      .from(tabella)
      .select('id')
      .lt('created_at', limite)
      .order('created_at', { ascending: true })
      .limit(residuo);

    /**
     * Le notifiche NON lette non si toccano, a nessuna eta'.
     *
     * Non e' un dettaglio di prudenza: cancellare una notifica che nessuno ha
     * aperto significa nascondere un fatto alla persona a cui era destinato —
     * un task assegnato, una scadenza mancata — e farlo in modo che non se ne
     * accorga mai. Una notifica vecchia e non letta e' un problema da
     * guardare, non da far sparire.
     */
    if (soloLette) query = query.eq('read', true);

    const { data, error } = await query;
    if (error) return { cancellate: 0, error: error.message };

    const ids = (data ?? []).map((riga) => riga.id as string);
    if (ids.length === 0) return { cancellate: 0 };

    const { error: erroreDelete } = await admin.from(tabella).delete().in('id', ids);
    if (erroreDelete) return { cancellate: 0, error: erroreDelete.message };

    // Se abbiamo riempito il residuo, ce n'erano almeno altrettante: lo si
    // dice nella risposta, altrimenti "cancellate: 5000" sembra un successo
    // pieno anche quando l'arretrato e' dieci volte tanto.
    if (ids.length >= residuo) conteggi.tettoRaggiunto = true;

    return { cancellate: ids.length };
  }

  const errori: string[] = [];

  const logEmail = await cancellaVecchie('email_delivery_logs', limiteLogEmail, false);
  conteggi.logEmail.cancellate = logEmail.cancellate;
  if (logEmail.error) errori.push(`email_delivery_logs: ${logEmail.error}`);

  const notifiche = await cancellaVecchie('notifications', limiteNotifiche, true);
  conteggi.notificheLette.cancellate = notifiche.cancellate;
  if (notifiche.error) errori.push(`notifications: ${notifiche.error}`);

  /**
   * Il registro di audit, potato in SQL.
   *
   * E' un array JSON dentro `app_state`, non una tabella, quindi non c'e' una
   * DELETE possibile: l'unico modo di accorciarlo e' riscrivere il valore. Il
   * lavoro lo fa `public.pota_registro_audit` (migrazione 0019) e non questo
   * codice, per due motivi che non sono di stile:
   *
   *   1. leggere il blob qui dentro significherebbe trasferire i megabyte del
   *      registro fino alla funzione edge e rispedirli indietro — cioe' fare
   *      una volta al giorno esattamente lo spreco che stiamo cercando di
   *      eliminare;
   *   2. fra la lettura e la riscrittura un amministratore puo' appendere una
   *      voce, che verrebbe silenziosamente sovrascritta. In SQL lettura e
   *      scrittura sono la stessa istruzione e quella corsa non esiste.
   *
   * La regola su QUALE estremo tenere (le voci recenti stanno in coda) e'
   * enunciata in modo leggibile e verificato in `potaAudit`, in
   * `_lib/pulizia.ts`: e' la specifica che la funzione SQL implementa.
   */
  const { data: potate, error: erroreAudit } = await admin.rpc('pota_registro_audit', {
    tetto: TETTO_VOCI_AUDIT,
  });

  if (erroreAudit) {
    errori.push(`audit-log: ${erroreAudit.message}`);
  } else {
    const righe = (potate ?? []) as { rimosse: number }[];
    conteggi.audit.organizzazioni = righe.length;
    conteggi.audit.vociRimosse = righe.reduce((somma, riga) => somma + (riga.rimosse ?? 0), 0);
  }

  /**
   * Un guasto su un insieme non annulla il lavoro fatto sugli altri: si
   * risponde 500 perche' qualcosa e' andato storto davvero — cosi' lo
   * scheduler lo segna come fallito e qualcuno lo vede — ma con dentro i
   * conteggi di cio' che e' comunque riuscito.
   */
  if (errori.length > 0) {
    return jsonResponse({ ...conteggi, errori }, { status: 500 });
  }

  return jsonResponse(conteggi);
});
