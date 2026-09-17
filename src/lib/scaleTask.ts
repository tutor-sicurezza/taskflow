/**
 * Le due scale chiuse di un'attivita': priorita' e stato.
 *
 * Sono chiuse — i valori possibili sono noti e uguali per tutti — quindi hanno
 * una parola tradotta per ciascuno. Le etichette libere, che invece descrivono
 * di COSA si tratta, stanno in `etichette.ts` e non c'entrano con questo file.
 *
 * Stava in due posti che non erano d'accordo. `TaskCard` mostrava
 * `task.priority.toUpperCase()`, cioe' "HIGH"/"MEDIUM"/"LOW" **in inglese
 * qualunque lingua avesse scelto chi guarda**, con una tavolozza sua;
 * `TaskDetailsDialog` traduceva davvero e ne usava un'altra. La stessa
 * attivita' cambiava parola e colore a seconda di dove la si guardava.
 *
 * I colori non sono una scelta estetica rifatta da capo: sono quelli che
 * `TaskDetailsDialog` gia' usava, perche' erano gia' gli unici due leggibili.
 * Misurati su fondo chiaro, testo piccolo (serve 4,5:1 — WCAG 2.1 SC 1.4.3):
 *
 *   alta    red-100    su red-700      5,30:1
 *   media   amber-100  su amber-800    6,37:1
 *   bassa   slate-100  su slate-700    9,45:1
 *
 * Quelli di `TaskCard` stavano a 2,15:1 (`bg-amber-500` con testo bianco) e
 * 2,56:1 (`bg-slate-400`): meno della meta' di quel che serve. La sua
 * targhetta "alta" invece passava (5,13:1 con `bg-accent`), ma restare da sola
 * in una tavolozza diversa dalle altre due l'avrebbe fatta leggere come un
 * livello di un'altra scala.
 *
 * Le varianti `dark:` sono ereditate dalla mappa di `TaskDetailsDialog` e oggi
 * non si attivano mai: nessuno mette la classe `dark` sul documento. Restano
 * perche' sono gia' corrette, non perche' servano adesso.
 */

import type { TaskPriority, TaskStatus } from '@/lib/types';

/**
 * La chiave di traduzione, non il testo.
 *
 * In questo progetto la chiave E' il testo inglese, quindi passarla a `t()` da'
 * "High" in inglese e "Alta" in italiano. Scriverla maiuscola a mano, come si
 * faceva, salta la traduzione: `toUpperCase()` su una stringa gia' tradotta
 * produrrebbe comunque "ALTA", ma su `task.priority` produce l'inglese sempre.
 */
export const ETICHETTA_PRIORITA: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const COLORE_PRIORITA: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

/**
 * Sia l'etichetta sia i colori, per chi deve solo disegnare una targhetta.
 *
 * `valore` e' `string` e non `TaskPriority` perche' i dati arrivano anche dal
 * database e da importazioni: una priorita' sconosciuta deve mostrarsi com'e'
 * scritta, con i colori neutri, invece di far sparire la targhetta.
 */
export function targhettaPriorita(valore: string | undefined): {
  chiave: string;
  colore: string;
} {
  const p = valore as TaskPriority;
  return {
    chiave: ETICHETTA_PRIORITA[p] ?? valore ?? '',
    colore: COLORE_PRIORITA[p] ?? COLORE_PRIORITA.low,
  };
}

/**
 * Lo stato, stessa storia della priorita'.
 *
 * `TaskDetailsDialog` mostrava `task.status.replace('-', ' ').toUpperCase()`,
 * una riga sotto la targhetta della priorita': stesso difetto, stessa riga di
 * codice, stesso risultato — "IN PROGRESS" a chi ha scelto l'italiano. E in
 * piu' la sostituzione del trattino produceva "NOT STARTED", che non e'
 * nemmeno una chiave del dizionario: non c'era proprio niente da tradurre.
 */
export const ETICHETTA_STATO: Record<TaskStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
};
