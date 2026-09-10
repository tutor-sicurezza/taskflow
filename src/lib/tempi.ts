/**
 * Stime e tempi di lavoro, in un posto solo.
 *
 * Il conteggio dei task per persona che l'applicazione mostra oggi risponde
 * alla domanda sbagliata: dieci task da mezz'ora e dieci da tre giorni fanno
 * la stessa colonna, e su quella colonna nessuno puo' decidere a chi dare il
 * lavoro successivo. Le stime servono a questo, e servono solo se il codice
 * che le somma e' onesto su cio' che NON sa.
 *
 * Da qui le due regole che governano tutto il file: "non lo so" e' un valore a
 * se' (`null`), mai zero; e una somma che ignora i task senza stima deve dire
 * quanti ne ha ignorati, altrimenti mostra quattro ore di carico dove il
 * carico vero e' ignoto.
 *
 * Il ritardo non si ricalcola qui: `eInRitardo` in `scadenze.ts` conosce gia'
 * il caso "senza scadenza", e due definizioni di ritardo nello stesso prodotto
 * finiscono sempre per divergere.
 */

import { eInRitardo } from '@/lib/scadenze';
import type { Task } from '@/lib/types';

/** Cio' che si mostra al posto di un tempo che non e' stato misurato. */
export const SEGNO_IGNOTO = '—';

const MINUTI_PER_ORA = 60;

/** Un numero di minuti utilizzabile: niente null, NaN, infiniti o negativi. */
function minutiValidi(minuti: number | null | undefined): number | null {
  if (typeof minuti !== 'number' || !Number.isFinite(minuti) || minuti < 0) return null;
  return minuti;
}

/**
 * Minuti in forma leggibile: `—`, `45m`, `2h`, `2h 30m`.
 *
 * `null` non diventa "0m". Zero e' un tempo — un task su cui non e' stato
 * ancora speso nulla — mentre "non lo so" non lo e', e mostrarli uguali fa
 * sparire dalla vista proprio i task che andrebbero stimati.
 *
 * La lingua serve per i separatori delle migliaia: un carico di 1200 ore si
 * legge "1.200h" in italiano e "1,200h" in inglese, e sbagliare quel punto
 * significa mostrare un numero mille volte diverso da quello vero.
 */
export function formattaMinuti(minuti: number | null | undefined, lingua: string): string {
  if (typeof minuti !== 'number' || !Number.isFinite(minuti)) return SEGNO_IGNOTO;

  const segno = minuti < 0 ? '-' : '';
  const totale = Math.round(Math.abs(minuti));
  const ore = Math.floor(totale / MINUTI_PER_ORA);
  const resto = totale % MINUTI_PER_ORA;

  const numero = (n: number) => new Intl.NumberFormat(lingua).format(n);

  if (ore === 0) return `${segno}${numero(resto)}m`;
  if (resto === 0) return `${segno}${numero(ore)}h`;
  return `${segno}${numero(ore)}h ${numero(resto)}m`;
}

// Le tre forme in cui una persona scrive una durata. Sono deliberatamente
// ancorate a inizio e fine stringa: qualcosa che assomiglia a una durata in
// mezzo ad altro testo non e' una durata, e interpretarlo a meta' e' peggio
// che rifiutarlo.
const ORE_E_MINUTI = /^(\d+(?:\.\d+)?)\s*h(?:\s*(\d+(?:\.\d+)?)\s*(?:m|min)?)?$/;
const SOLO_MINUTI = /^(\d+(?:\.\d+)?)\s*(?:m|min)$/;
const NUDO = /^\d+$/;

/**
 * Legge una durata come la scrive una persona, o restituisce null.
 *
 * Accetta: `90` (minuti nudi), `45m`, `45 min`, `1.5h`, `1,5h`, `2h30`,
 * `2h 30m`, `2H30M`. La virgola decimale non e' un vezzo: l'interfaccia parla
 * anche italiano, francese, tedesco e spagnolo, dove `1,5` e' il modo normale
 * di scrivere un'ora e mezza, e rifiutarla farebbe sembrare rotto il campo.
 *
 * Cio' che non rientra in queste forme torna `null` invece di essere indovinato.
 * Il caso che decide la regola e' il decimale nudo: `1,5` da solo puo' valere
 * un'ora e mezza o un minuto e mezzo, e sceglierne una vuol dire salvare in
 * silenzio un numero che l'utente non ha scritto. Meglio chiedergli l'unita'.
 */
export function analizzaDurata(testo: string): number | null {
  if (typeof testo !== 'string') return null;

  // La virgola diventa punto prima di ogni confronto, cosi' le regole restano
  // una sola invece di due varianti da tenere allineate.
  const pulito = testo.trim().toLowerCase().replace(',', '.');
  if (!pulito) return null;

  const oreEMinuti = ORE_E_MINUTI.exec(pulito);
  if (oreEMinuti) {
    const ore = Number(oreEMinuti[1]);
    const minuti = oreEMinuti[2] === undefined ? 0 : Number(oreEMinuti[2]);
    return arrotonda(ore * MINUTI_PER_ORA + minuti);
  }

  const soloMinuti = SOLO_MINUTI.exec(pulito);
  if (soloMinuti) return arrotonda(Number(soloMinuti[1]));

  if (NUDO.test(pulito)) return arrotonda(Number(pulito));

  return null;
}

/** I minuti si salvano interi: mezzo minuto non e' una quantita' che qualcuno intende. */
function arrotonda(minuti: number): number | null {
  if (!Number.isFinite(minuti)) return null;
  return Math.round(minuti);
}

export interface CaricoPersona {
  /** Task assegnati e non ancora chiusi. */
  taskAperti: number;
  /** Somma delle stime dei soli task aperti che ne hanno una. */
  minutiStimati: number;
  /** Quanti task aperti sono senza stima: la parte di carico che non si conosce. */
  minutiSenzaStima: number;
  /** Task aperti gia' oltre la scadenza. */
  inRitardo: number;
}

/**
 * Il carico di una persona, con dichiarato cio' che non si sa.
 *
 * `minutiStimati` da solo mentirebbe: sommando i quattro task stimati e
 * tacendo i sei senza stima direbbe "quattro ore" di una persona che potrebbe
 * averne davanti quaranta. Per questo esce sempre accompagnato dal numero di
 * task non stimati — chi guarda deve poter distinguere "poco lavoro" da "non
 * lo sappiamo", che sono la stessa cifra e decisioni opposte.
 *
 * I task chiusi restano fuori: il carico e' cio' che una persona ha ancora da
 * fare, non cio' che ha fatto.
 */
export function caricoPersona(tasks: Task[], employeeId: string): CaricoPersona {
  const aperti = (tasks ?? []).filter(
    (task) => task.assigneeId === employeeId && task.status !== 'completed'
  );

  let minutiStimati = 0;
  let minutiSenzaStima = 0;

  for (const task of aperti) {
    const stima = minutiValidi(task.estimateMinutes);
    if (stima === null) minutiSenzaStima += 1;
    else minutiStimati += stima;
  }

  return {
    taskAperti: aperti.length,
    minutiStimati,
    minutiSenzaStima,
    inRitardo: aperti.filter((task) => eInRitardo(task)).length,
  };
}

/**
 * Quanto il tempo impiegato si discosta dalla stima: positivo se e' andato
 * oltre, negativo se e' bastato meno. Null se manca uno dei due valori.
 *
 * Null e non zero, di nuovo: zero significa "ci ha preso", e un task senza
 * stima non ha preso ne' sbagliato niente. Trattarli allo stesso modo e' il
 * modo piu' rapido per trasformare un dato mancante in un giudizio.
 */
export function scostamentoStima(task: Pick<Task, 'estimateMinutes' | 'spentMinutes'>): number | null {
  const stima = minutiValidi(task.estimateMinutes);
  const impiegato = minutiValidi(task.spentMinutes);
  if (stima === null || impiegato === null) return null;
  return impiegato - stima;
}
