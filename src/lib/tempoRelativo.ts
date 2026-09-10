/**
 * "2 ore fa", "fra 3 giorni", e le date brevi — nella lingua di chi guarda.
 *
 * Prima queste stringhe venivano da `formatDistanceToNow` di date-fns, che
 * senza un `locale` esplicito parla SEMPRE inglese: in un'interfaccia
 * interamente tradotta comparivano "2 hours ago" sotto i commenti, "in 3 days"
 * sugli annunci e "Sep 23" nei grafici. Non era un difetto di traduzione — la
 * stringa non passava proprio da `t()` — ed e' il motivo per cui non si vedeva
 * cercando le chiavi mancanti.
 *
 * La correzione non passa da date-fns. Collegare i suoi locale avrebbe voluto
 * dire imbarcare cinque dizionari di date (un centinaio di kilobyte) per
 * ottenere quello che il browser fa da solo: `Intl.RelativeTimeFormat` e
 * `toLocaleDateString` sono nella piattaforma da anni, conoscono tutte e cinque
 * le lingue, e costano zero byte. date-fns resta dov'e' utile davvero — i
 * calcoli sulle date (`addDays`, `startOfMonth`), che di lingua non ne hanno.
 *
 * Il codice di lingua del progetto (it/en/fr/de/es) e' gia' un tag BCP-47
 * valido, quindi si passa cosi' com'e'.
 */

/** Le soglie, dalla piu' grande alla piu' piccola. */
const SCAGLIONI: { unita: Intl.RelativeTimeFormatUnit; secondi: number }[] = [
  { unita: 'year', secondi: 365 * 24 * 60 * 60 },
  { unita: 'month', secondi: 30 * 24 * 60 * 60 },
  { unita: 'week', secondi: 7 * 24 * 60 * 60 },
  { unita: 'day', secondi: 24 * 60 * 60 },
  { unita: 'hour', secondi: 60 * 60 },
  { unita: 'minute', secondi: 60 },
];

/**
 * Da quanto e' successo, o fra quanto succedera'.
 *
 * Restituisce stringa vuota su una data non interpretabile invece di "Invalid
 * Date": una data storta arrivata da un import non deve comparire a schermo
 * come un errore di programma.
 *
 * Sotto il minuto si dice "adesso" e non "0 minuti fa": e' cio' che direbbe
 * una persona, ed e' l'unico scaglione in cui il numero non aggiunge niente.
 * `Intl` sceglie da solo la forma giusta per il plurale di ogni lingua, che e'
 * esattamente il motivo per cui il progetto non ha (e non deve avere) un
 * sistema di pluralizzazione fatto in casa.
 */
export function tempoRelativo(data: Date | string | number, lingua: string): string {
  const quando = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(quando.getTime())) return '';

  const differenza = (quando.getTime() - Date.now()) / 1000;
  const formato = new Intl.RelativeTimeFormat(lingua, { numeric: 'auto' });

  for (const { unita, secondi } of SCAGLIONI) {
    if (Math.abs(differenza) >= secondi) {
      return formato.format(Math.round(differenza / secondi), unita);
    }
  }

  return formato.format(0, 'second');
}

/** Data breve — "23 set" — per assi dei grafici ed elenchi fitti. */
export function dataBreve(data: Date | string | number, lingua: string): string {
  const quando = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(quando.getTime())) return '';
  return quando.toLocaleDateString(lingua, { month: 'short', day: 'numeric' });
}

/** Data estesa — "23 settembre 2026" — dove c'e' spazio e conta la chiarezza. */
export function dataEstesa(data: Date | string | number, lingua: string): string {
  const quando = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(quando.getTime())) return '';
  return quando.toLocaleDateString(lingua, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Data e ora brevi — "23 set, 14:05" — per i registri. */
export function dataOra(data: Date | string | number, lingua: string): string {
  const quando = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(quando.getTime())) return '';
  return quando.toLocaleString(lingua, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
