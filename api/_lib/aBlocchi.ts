/**
 * Leggere e cancellare a blocchi, invece che con un `in (...)` sterminato.
 *
 * `supabase-js` manda i `select` come GET con i filtri nella query string, e un
 * `in (...)` non lo spezza da solo: con duemila uuid l'indirizzo supera i 70 kB
 * e il gateway rifiuta la richiesta molto prima. Lo stesso vale per il `delete`
 * con cinquemila id.
 *
 * Il guasto che ne viene non e' un errore isolato, ed e' questo il punto: la
 * rotta pianificata risponde 500 e non fa NIENTE. In `pulizia` l'arretrato non
 * si riduce, quindi la stessa richiesta troppo lunga si ripresenta la notte
 * dopo, e quella dopo ancora, per sempre. In `promemoria` bastano un paio di
 * centinaia di attivita' aperte e scadute perche' non parta piu' nessun
 * promemoria, a nessuno.
 *
 * E si vede solo in produzione: a regime i numeri sono piccoli e tutto passa.
 * Il giorno in cui morde e' il primo giorno di esercizio vero, o il giorno in
 * cui si attivano questi lavori su un'installazione che ha gia' uno storico.
 *
 * La precauzione esisteva gia' in `api/cron/manutenzione.ts`, per l'UPDATE di
 * archiviazione, con il commento giusto accanto. Era applicata in un punto su
 * cinque; qui diventa una cosa sola, con un numero solo.
 */

/**
 * Cento e non mille: un uuid con la sua virgola pesa 37 caratteri, quindi un
 * blocco occupa circa 3,7 kB di indirizzo. Sta largamente sotto il limite di
 * qualunque gateway, e lascia spazio al resto della query.
 */
export const DIMENSIONE_BLOCCO = 100;

export function aBlocchi<T>(elementi: readonly T[], dimensione = DIMENSIONE_BLOCCO): T[][] {
  if (elementi.length === 0) return [];
  const blocchi: T[][] = [];
  for (let i = 0; i < elementi.length; i += dimensione) {
    blocchi.push(elementi.slice(i, i + dimensione));
  }
  return blocchi;
}

interface EsitoSupabase<R> {
  data: R[] | null;
  error: { message: string } | null;
}

/**
 * Esegue la stessa operazione su ogni blocco e unisce cio' che torna.
 *
 * Al primo errore si ferma e lo restituisce, insieme a cio' che era gia' stato
 * raccolto: un blocco andato a buon fine e' lavoro fatto, e chi chiama decide
 * se tenerlo. In `pulizia` si tiene — le righe cancellate sono cancellate — e
 * questa e' proprio la differenza fra "l'arretrato non si smaltisce mai" e "si
 * smaltisce un pezzo per volta".
 */
export async function perBlocchi<R>(
  elementi: readonly string[],
  esegui: (blocco: string[]) => PromiseLike<EsitoSupabase<R>>,
  dimensione = DIMENSIONE_BLOCCO
): Promise<{ data: R[]; error: string | null }> {
  const raccolto: R[] = [];

  for (const blocco of aBlocchi(elementi, dimensione)) {
    const { data, error } = await esegui(blocco);
    if (error) return { data: raccolto, error: error.message };
    if (data) raccolto.push(...data);
  }

  return { data: raccolto, error: null };
}
