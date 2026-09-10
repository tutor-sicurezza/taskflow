/**
 * Le regole di conservazione dei dati, senza database attorno.
 *
 * Stanno in `_lib` per lo stesso motivo di `promemoriaLogica.ts`: `api/cron/`
 * e' instradata da Vercel e ogni file li' dentro diventa un endpoint pubblico,
 * test compresi. Il trattino basso esclude questa cartella dall'instradamento.
 *
 * Qui c'e' solo cio' che si puo' sbagliare in silenzio — di quanti giorni si
 * torna indietro, e quale estremo dell'array di audit va tenuto — proprio
 * perche' un errore in queste due decisioni non produce nessun messaggio a
 * schermo: produce dati cancellati che nessuno rivedra' mai.
 */

/**
 * Log di consegna email: 90 giorni.
 *
 * Tre ragioni, in ordine di peso:
 *
 *   1. RISERVATEZZA. Ogni riga contiene `recipient_email` e `subject`: e' un
 *      archivio di chi scrive a chi e di cosa. Tenerlo per sempre significa
 *      conservare dati personali oltre lo scopo per cui sono stati raccolti,
 *      che e' diagnosticare i recapiti. Meno se ne tiene, meno se ne perde.
 *   2. USO REALE. Il pannello EmailDeliveryAnalytics legge le 500 righe piu'
 *      recenti (indice `email_delivery_logs_org_created_at_idx`, 0016): un
 *      log di sei mesi fa non e' mai stato guardato da nessuno. I bounce e i
 *      fallimenti di provider si indagano entro giorni, non entro anni.
 *   3. VOLUME. E' la tabella che cresce piu' in fretta e l'unica che finora
 *      nessuno cancellava.
 *
 * Novanta e non trenta perche' un trimestre copre comodamente sia un ciclo di
 * fatturazione del provider sia una contestazione tardiva del tipo "non mi e'
 * mai arrivata quella notifica".
 */
export const GIORNI_LOG_EMAIL = 90;

/**
 * Notifiche gia' lette: 30 giorni.
 *
 * Una notifica letta ha gia' fatto il suo lavoro: ha attirato l'attenzione una
 * volta. Da li' in poi e' storia, e la storia autorevole sta nei task, non
 * nella campanella. L'elenco a schermo (`src/hooks/useNotifications.ts`) ne
 * mostra comunque solo le 200 piu' recenti, quindi tutto cio' che e' piu'
 * vecchio di qualche settimana e' peso che nessuno vede.
 *
 * Le NON lette non si toccano mai, a nessuna eta': vedi `pulizia.ts` la rotta.
 */
export const GIORNI_NOTIFICHE_LETTE = 30;

/**
 * Registro di audit: 1000 voci.
 *
 * Un tetto sul NUMERO e non sull'eta', al contrario degli altri due, perche'
 * questo non e' una tabella: e' un array JSON dentro `app_state` e cio' che fa
 * male e' la sua DIMENSIONE, non l'anzianita' delle voci. Ogni append riscrive
 * il blob intero (`setAuditLog((cur) => [...cur, voce])` in
 * SuperAdminSettings.tsx), quindi il costo di ogni singola azione
 * amministrativa e' proporzionale a quante voci ci sono gia' dentro.
 * Un tetto fisso rende quel costo costante e prevedibile.
 *
 * Mille perche' il pannello ne mostra dieci: mille sono gia' due ordini di
 * grandezza piu' di quanto qualcuno legga, restano qualche centinaio di
 * kilobyte, e a venti voci al giorno coprono circa sette settimane di
 * attivita' amministrativa.
 */
export const TETTO_VOCI_AUDIT = 1000;

/**
 * Tetto alle righe cancellate per esecuzione.
 *
 * Stessa cintura di sicurezza di TETTO_EMAIL_PER_ESECUZIONE: se una data
 * sbagliata — un import con `created_at` a zero, un fuso interpretato male —
 * rendesse improvvisamente "vecchio" tutto l'archivio, un lavoro senza tetto
 * lo svuoterebbe in un colpo solo e in silenzio. Fermarsi, dirlo nella
 * risposta e far guardare una persona costa un giorno di ritardo nella
 * pulizia; non fermarsi costa i dati.
 *
 * Il tetto vale per le due tabelle messe insieme, ed e' anche cio' che tiene
 * l'esecuzione dentro il tempo massimo di una funzione.
 */
export const TETTO_RIGHE_PER_ESECUZIONE = 5000;

/**
 * L'istante prima del quale un dato e' considerato vecchio.
 *
 * Pura e separata perche' e' il punto in cui si sbaglia di un fattore mille
 * (secondi al posto di millisecondi) o di segno, e in entrambi i casi il
 * risultato e' una DELETE che parte comunque: o non cancella nulla per sempre,
 * o cancella tutto subito. Restituisce ISO 8601 in UTC, che e' il formato che
 * PostgREST confronta con `timestamptz` senza ambiguita' di fuso.
 */
export function limiteConservazione(adesso: Date, giorni: number): string {
  return new Date(adesso.getTime() - giorni * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Pota il registro di audit tenendo le voci PIU' RECENTI.
 *
 * QUALE ESTREMO. Le voci si appendono in CODA:
 *
 *     setAuditLog((currentLog) => [...(currentLog || []), entry]);
 *     (src/components/SuperAdminSettings.tsx)
 *
 * e il pannello le rilegge con `.slice(-10).reverse()`, cioe' prende le ultime
 * dieci e le mostra dalla piu' nuova. Quindi le recenti stanno in FONDO e la
 * potatura deve tagliare dalla TESTA. Invertire i due estremi qui non
 * romperebbe niente in modo visibile: il pannello continuerebbe a mostrare
 * dieci righe, solo che sarebbero le dieci piu' vecchie e tutto il resto
 * sarebbe perso. Per questo la regola sta in una funzione con dei test sopra e
 * non dentro una query.
 *
 * @param valore  il contenuto grezzo di `app_state.value`, di cui non ci si
 *                fida: e' JSON scritto dal client.
 * @param tetto   quante voci tenere.
 * @returns l'array potato, oppure `null` se `valore` non e' un array. `null`
 *          significa "non toccare": normalizzare a vuoto un valore inatteso
 *          vorrebbe dire cancellare un registro che forse non abbiamo capito.
 */
export function potaAudit(valore: unknown, tetto: number): unknown[] | null {
  if (!Array.isArray(valore)) return null;

  // `<=` e non `<`: esattamente al tetto non c'e' niente da fare, e restituire
  // lo stesso array evita al chiamante una riscrittura inutile del blob.
  if (valore.length <= tetto) return valore;

  return valore.slice(valore.length - tetto);
}
