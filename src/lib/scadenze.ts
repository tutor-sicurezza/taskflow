/**
 * Le regole sulla scadenza di un task, in un posto solo.
 *
 * La scadenza e' diventata facoltativa, e da quel momento ogni `new
 * Date(task.dueDate)` sparso per il codice e' un potenziale `Invalid Date`
 * mostrato a schermo. Il compilatore ne ha trovati trentatre': rattopparli uno
 * per uno con un punto esclamativo avrebbe spostato il difetto dal tipo al
 * comportamento, che e' peggio — l'errore sarebbe ricomparso a runtime, e solo
 * per gli utenti.
 *
 * Qui le tre domande che il codice fa davvero — "ce l'ha?", "quando?", "e' in
 * ritardo?" — hanno una risposta unica, e il caso "senza scadenza" e' gestito
 * in modo esplicito invece di dipendere da cosa fa `new Date(undefined)`.
 */

import type { Task, TaskStatus } from '@/lib/types';

/** Gli stati in cui un task e' considerato chiuso. */
const CHIUSI: TaskStatus[] = ['completed'];

/** Un task con una scadenza vera, per il compilatore e per chi legge. */
export type TaskConScadenza = Task & { dueDate: string };

export function haScadenza(task: Pick<Task, 'dueDate'>): boolean {
  return typeof task.dueDate === 'string' && task.dueDate.length > 0;
}

/**
 * La scadenza come data, oppure null.
 *
 * Restituisce null anche per una stringa non interpretabile: una data
 * malformata scritta da un import o da una versione precedente non deve
 * diventare "Invalid Date" in mezzo all'interfaccia.
 */
export function dataScadenza(task: Pick<Task, 'dueDate'>): Date | null {
  if (!haScadenza(task)) return null;
  const data = new Date(task.dueDate as string);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Un task e' in ritardo se ha una scadenza passata e non e' chiuso.
 *
 * Senza scadenza non e' MAI in ritardo: e' il motivo per cui la scadenza e'
 * diventata facoltativa. Prima chi non ne aveva una se la inventava, e quella
 * data finta faceva comparire il task fra quelli in ritardo.
 */
export function eInRitardo(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  const data = dataScadenza(task);
  if (!data) return false;
  return data.getTime() < Date.now() && !CHIUSI.includes(task.status);
}

/** La scadenza formattata nella lingua indicata, o null se non c'e'. */
export function scadenzaFormattata(
  task: Pick<Task, 'dueDate'>,
  lingua: string,
  opzioni: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string | null {
  const data = dataScadenza(task);
  return data ? data.toLocaleDateString(lingua, opzioni) : null;
}

/**
 * Ordinamento per scadenza: i task senza vanno in fondo.
 *
 * Non e' un dettaglio estetico. Trattando "nessuna scadenza" come data zero
 * finirebbero tutti in cima, davanti a quelli che scadono domani, cioe'
 * esattamente al contrario di cio' che serve a chi ordina per scadenza.
 */
export function confrontaScadenze(
  a: Pick<Task, 'dueDate'>,
  b: Pick<Task, 'dueDate'>
): number {
  const da = dataScadenza(a);
  const db = dataScadenza(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.getTime() - db.getTime();
}

/** Quanti giorni mancano alla scadenza; negativo se e' passata. Null se non c'e'. */
export function giorniAllaScadenza(task: Pick<Task, 'dueDate'>): number | null {
  const data = dataScadenza(task);
  if (!data) return null;
  return Math.ceil((data.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Quando un task e' stato davvero completato, secondo la sua cronologia.
 *
 * Serve a distinguere la durata REALE del lavoro dalla durata pianificata. Le
 * analisi calcolavano "tempo medio di completamento" come scadenza meno
 * creazione: un task chiuso in un'ora e uno chiuso con tre settimane di
 * ritardo davano lo stesso numero, purche' avessero la stessa scadenza. Quel
 * valore finiva anche negli export e nella scheda per persona, dove diventava
 * un giudizio su un collega basato su un dato che non aveva misurato niente.
 *
 * La data giusta e' nell'attivita' di passaggio a 'completed', che il codice
 * gia' registra. Chi non ce l'ha — task migrati, o chiusi prima che la
 * cronologia esistesse — restituisce null e va ESCLUSO dalla media, non
 * incluso con un valore surrogato.
 */
export function dataCompletamento(task: Pick<Task, 'status' | 'activities'>): Date | null {
  if (task.status !== 'completed') return null;

  const attivita = (task.activities ?? [])
    .filter((a) => a.type === 'status_changed' && a.newValue === 'completed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!attivita) return null;
  const data = new Date(attivita.createdAt);
  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Giorni impiegati per completare un task, o null se non e' misurabile.
 *
 * Null e non zero: zero e' un tempo, "non lo so" non lo e', e mediarli
 * insieme e' il modo in cui una media smette di significare qualcosa.
 */
export function giorniPerCompletare(
  task: Pick<Task, 'status' | 'activities' | 'createdAt'>
): number | null {
  const fine = dataCompletamento(task);
  if (!fine) return null;
  const inizio = new Date(task.createdAt);
  if (Number.isNaN(inizio.getTime())) return null;
  return Math.max(0, (fine.getTime() - inizio.getTime()) / (24 * 60 * 60 * 1000));
}
