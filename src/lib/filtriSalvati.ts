/**
 * I filtri salvati: cosa sono, quando due coincidono, come si raccontano.
 *
 * Ricostruire "i miei in ritardo" o "i non assegnati del reparto tecnico" e' il
 * gesto piu' ripetuto di chi usa l'elenco dei task tutti i giorni. Salvare quei
 * filtri e' facile; il difficile e' tutto qui dentro, ed e' di due tipi.
 *
 * Il primo e' la FIDUCIA nel dato: i filtri vivono in una colonna JSONB, quindi
 * quello che torna dal database non e' garantito essere quello che ci abbiamo
 * scritto — una versione precedente dell'app, un import, una modifica a mano.
 * `filtroValido` e' l'unica porta d'ingresso e non lancia mai: al massimo dice
 * di no.
 *
 * Il secondo e' che l'utente non pensa in termini di campi. Per lui "nessun
 * filtro sullo stato" e "filtro su tutti gli stati" sono la stessa identica
 * cosa, mentre nel dato sono `undefined` e `'all'`. Se il confronto non lo
 * sapesse, l'interfaccia offrirebbe di salvare un doppione di un filtro che sta
 * gia' applicando. Da qui `normalizza`, che riporta entrambi a "vuoto" prima di
 * qualsiasi paragone.
 */

import { traduci, type Lingua } from '@/lib/i18n';
import type { Employee } from '@/lib/types';

export interface Filtro {
  id: string;
  nome: string;
  stato?: string;
  priorita?: string;
  reparto?: string;
  assegnatario?: string;   // 'all' | 'unassigned' | <id persona>
  ordine?: string;
  ricerca?: string;
}

/** I campi che descrivono una vista; `id` e `nome` sono l'etichetta, non il filtro. */
const CAMPI = ['stato', 'priorita', 'reparto', 'assegnatario', 'ordine', 'ricerca'] as const;

/**
 * Tetto alla lunghezza dei campi letti dal database.
 *
 * Non e' paranoia sul contenuto — quello lo sanifica chi lo mostra — ma sulla
 * DIMENSIONE: un JSONB puo' contenere una stringa da un megabyte, e finirebbe
 * dentro un nome di filtro largo quanto lo schermo.
 */
const MAX_LUNGHEZZA = 200;

/**
 * Riporta a `undefined` tutti i modi di dire "nessun filtro".
 *
 * `'all'` e' il valore che i menu a tendina usano per "tutti": nel dato e'
 * presente, per l'utente e' assente. Anche la stringa vuota e il solo spazio
 * bianco valgono come assenza — una ricerca fatta di spazi non filtra nulla.
 */
function normalizza(valore: string | undefined): string | undefined {
  if (typeof valore !== 'string') return undefined;
  const pulito = valore.trim();
  if (pulito === '' || pulito === 'all') return undefined;
  return pulito;
}

/** Una stringa non vuota e di lunghezza ragionevole, oppure `undefined`. */
function testo(valore: unknown): string | undefined {
  if (typeof valore !== 'string') return undefined;
  const pulito = valore.trim().slice(0, MAX_LUNGHEZZA);
  return pulito === '' ? undefined : pulito;
}

/**
 * Il filtro se e' un filtro, altrimenti null. Non lancia mai.
 *
 * Serve `id` e `nome`, perche' senza non e' applicabile ne' mostrabile. Tutto
 * il resto e' facoltativo e i campi di tipo sbagliato vengono lasciati cadere
 * uno per uno: un `priorita: 42` scritto da chissa' chi non deve buttare via
 * anche lo stato e il reparto, che erano validi.
 */
export function filtroValido(valore: unknown): Filtro | null {
  if (typeof valore !== 'object' || valore === null || Array.isArray(valore)) return null;

  const grezzo = valore as Record<string, unknown>;
  const id = testo(grezzo.id);
  const nome = testo(grezzo.nome);
  if (id === undefined || nome === undefined) return null;

  const filtro: Filtro = { id, nome };
  for (const campo of CAMPI) {
    const v = testo(grezzo[campo]);
    if (v !== undefined) filtro[campo] = v;
  }
  return filtro;
}

/**
 * Vero se i due filtri guardano lo stesso lavoro.
 *
 * Ignora `id` e `nome` di proposito: quello che conta e' cosa mostrano, non
 * come si chiamano. `b` e' parziale perche' dall'altra parte ci sono i filtri
 * attualmente attivi, che un nome non ce l'hanno ancora.
 */
export function stessoFiltro(a: Filtro, b: Partial<Filtro>): boolean {
  return CAMPI.every((campo) => normalizza(a[campo]) === normalizza(b[campo]));
}

/** Le etichette degli stati, con gli stessi valori usati dai menu dell'elenco. */
const STATI: Record<string, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed': 'Completed',
};

/** Le priorita' si dicono per esteso: "Alta" da sola non si capisce cos'e'. */
const PRIORITA: Record<string, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

const ORDINI: Record<string, string> = {
  dueDate: 'By due date',
  priority: 'By priority',
  status: 'By status',
};

/**
 * I pezzi leggibili di un filtro, nell'ordine in cui una persona li direbbe.
 *
 * Un valore sconosciuto (uno stato di una versione futura, un reparto
 * rinominato) viene mostrato com'e' invece di sparire: meglio una parola strana
 * che un filtro che sembra vuoto e invece nasconde meta' dei task.
 */
function pezzi(
  filtro: Partial<Filtro>,
  employees: Employee[],
  lingua: Lingua,
  includiOrdine: boolean
): string[] {
  const t = (chiave: string, parametri?: Record<string, string>) =>
    traduci(lingua, chiave, parametri);
  const elenco: string[] = [];

  const stato = normalizza(filtro.stato);
  if (stato) elenco.push(STATI[stato] ? t(STATI[stato]) : stato);

  const priorita = normalizza(filtro.priorita);
  if (priorita) elenco.push(PRIORITA[priorita] ? t(PRIORITA[priorita]) : priorita);

  // Il reparto e' un nome scelto dall'azienda: si mostra tale e quale.
  const reparto = normalizza(filtro.reparto);
  if (reparto) elenco.push(reparto);

  const assegnatario = normalizza(filtro.assegnatario);
  if (assegnatario === 'unassigned') {
    elenco.push(t('Unassigned'));
  } else if (assegnatario) {
    const persona = employees.find((e) => e.id === assegnatario);
    // Chi ha lasciato l'azienda sparisce dall'elenco dei dipendenti ma resta
    // dentro i filtri salvati mesi fa. Dire "persona rimossa" e' l'unico modo
    // di spiegare perche' quel filtro ora non trova piu' niente; mostrare l'id
    // grezzo non direbbe nulla a nessuno.
    elenco.push(persona ? persona.name : t('Removed member'));
  }

  if (includiOrdine) {
    const ordine = normalizza(filtro.ordine);
    if (ordine) elenco.push(ORDINI[ordine] ? t(ORDINI[ordine]) : ordine);
  }

  const ricerca = normalizza(filtro.ricerca);
  if (ricerca) elenco.push(t('Search: {testo}', { testo: ricerca }));

  return elenco;
}

/** Il separatore fra i pezzi: si legge come un respiro, non come un elenco puntato. */
const SEPARATORE = ' · ';

/**
 * Il filtro in una frase, per mostrarlo sotto al suo nome.
 *
 * Qui l'ordinamento c'e': la descrizione serve a capire cosa si sta per
 * applicare, e l'ordinamento fa parte di cosa si vedra'.
 */
export function descriviFiltro(filtro: Filtro, employees: Employee[], lingua: string): string {
  const l = lingua as Lingua;
  const elenco = pezzi(filtro, employees, l, true);
  return elenco.length > 0 ? elenco.join(SEPARATORE) : traduci(l, 'All tasks');
}

/** Oltre tre pezzi il nome smette di essere un nome e diventa una frase. */
const MAX_PEZZI_NOME = 3;

/**
 * Un nome gia' pronto per i filtri attivi.
 *
 * Chiedere di inventare un nome a ogni salvataggio e' il modo piu' rapido per
 * far smettere la gente di usare la funzione: il gesto deve essere uno solo, e
 * il nome resta comunque modificabile dopo.
 *
 * L'ordinamento e' escluso di proposito: "Ordina per scadenza" dentro il nome
 * di una vista occupa spazio senza distinguerla da nessun'altra.
 */
export function nomeSuggerito(
  filtro: Partial<Filtro>,
  employees: Employee[],
  lingua: string
): string {
  const l = lingua as Lingua;
  const elenco = pezzi(filtro, employees, l, false);
  if (elenco.length === 0) return traduci(l, 'All tasks');

  const mostrati = elenco.slice(0, MAX_PEZZI_NOME).join(SEPARATORE);
  const restanti = elenco.length - MAX_PEZZI_NOME;
  // Il "+2" non passa da `t()` di proposito: e' un segno, non una frase, e si
  // legge uguale in tutte le lingue dell'applicazione.
  return restanti > 0 ? `${mostrati} +${restanti}` : mostrati;
}
