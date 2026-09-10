/**
 * Le regole del flusso di approvazione, in un posto solo e senza React.
 *
 * Il problema che risolvono: `completed` da solo vuol dire due cose diverse.
 * Per un task normale vuol dire "finito"; per un task che richiede
 * un'approvazione vuol dire soltanto "l'assegnatario dice di aver finito", e
 * finche' un responsabile non guarda, non e' chiuso. Se questa differenza vive
 * sparsa nei componenti, ogni conteggio (quanti aperti, quanti in ritardo,
 * quanti chiusi questo mese) la interpreta a modo suo e i numeri smettono di
 * tornare fra una schermata e l'altra.
 *
 * Qui la differenza ha un nome — `statoApprovazione` — e le tre risposte sono
 * esaustive. Le funzioni sono pure e prendono solo i campi che leggono, cosi'
 * possono essere usate tanto dall'interfaccia quanto da un calcolo statistico
 * senza trascinarsi dietro un componente.
 */

import type { Employee, Task } from '@/lib/types';
import { canPerformAction } from '@/lib/permissions';

/**
 * Il permesso usato per approvare.
 *
 * Non ne viene aggiunto uno nuovo: `tasks.edit_any` esiste gia', significa
 * "puo' intervenire sul lavoro altrui" ed e' assegnato ad admin e manager,
 * cioe' esattamente le persone che devono poter chiudere il lavoro di un
 * altro. L'alternativa disponibile, `tasks.change_status`, ce l'ha anche un
 * member su un task proprio: usarla renderebbe l'approvazione un timbro che
 * chiunque puo' apporre, e il meccanismo non filtrerebbe piu' niente.
 */
const PERMESSO_APPROVAZIONE = { categoria: 'tasks', azione: 'edit_any' } as const;

/**
 * Lo stato di un task rispetto all'approvazione.
 *
 * - `non-richiesta`: nessuno ha chiesto un'approvazione per questo task.
 * - `in-attesa`: l'assegnatario l'ha portato a `completed`, manca il visto.
 * - `approvata`: qualcuno ha dato il visto, ed e' registrato chi e quando.
 */
export type StatoApprovazione = 'non-richiesta' | 'in-attesa' | 'approvata';

/**
 * I campi che bastano per rispondere a tutte le domande di questo file.
 *
 * `assigneeId` e' facoltativo di proposito: serve solo a `valutaApprovazione`,
 * e chiederlo sempre costringerebbe un badge — che vuole sapere soltanto in
 * che stato e' il task — a farsi passare un dato che non usa.
 */
export type TaskApprovabile = Pick<
  Task,
  'status' | 'requiresApproval' | 'approvedBy' | 'approvedAt'
> &
  Partial<Pick<Task, 'assigneeId'>>;

/** Perche' l'approvazione non e' possibile, quando non lo e'. */
export type MotivoBlocco =
  | 'non-in-attesa'
  | 'senza-utente'
  | 'e-assegnatario'
  | 'senza-permesso';

export interface EsitoApprovazione {
  puo: boolean;
  /** Presente solo quando `puo` e' falso: dice a chi legge il perche'. */
  motivo?: MotivoBlocco;
}

export function richiedeApprovazione(task: Pick<Task, 'requiresApproval'>): boolean {
  return task?.requiresApproval === true;
}

/**
 * Il visto e' stato dato, e si sa da chi e quando.
 *
 * Servono ENTRAMBI i campi. Un `approvedAt` senza `approvedBy` — riga
 * migrata, scrittura andata a meta' — sarebbe un'approvazione senza nessuno
 * che se ne assume la responsabilita', che e' il contrario di cio' per cui il
 * meccanismo esiste: meglio tornare a chiedere il visto che darne per buono
 * uno anonimo.
 */
export function eApprovato(task: Pick<Task, 'approvedBy' | 'approvedAt'>): boolean {
  return Boolean(task?.approvedBy) && Boolean(task?.approvedAt);
}

export function statoApprovazione(task: TaskApprovabile): StatoApprovazione {
  if (!richiedeApprovazione(task)) return 'non-richiesta';
  if (eApprovato(task)) return 'approvata';
  return 'in-attesa';
}

/**
 * Il task aspetta un visto ADESSO.
 *
 * Diverso da `statoApprovazione === 'in-attesa'`: un task che richiede
 * approvazione ma su cui si sta ancora lavorando non aspetta niente da
 * nessuno. L'attesa comincia quando l'assegnatario dichiara di aver finito,
 * cioe' quando lo stato e' `completed`.
 */
export function inAttesaDiApprovazione(task: TaskApprovabile): boolean {
  return task?.status === 'completed' && statoApprovazione(task) === 'in-attesa';
}

/**
 * Il task e' chiuso davvero.
 *
 * E' la domanda che devono fare i conteggi, i grafici e i filtri "attivi", al
 * posto di `status === 'completed'`. Un task in attesa di approvazione e'
 * ancora lavoro aperto per l'organizzazione, anche se per l'assegnatario e'
 * finito: contarlo fra i chiusi significa dichiarare completato del lavoro
 * che nessuno ha ancora guardato.
 */
export function eChiusoDavvero(task: TaskApprovabile): boolean {
  if (task?.status !== 'completed') return false;
  return !richiedeApprovazione(task) || eApprovato(task);
}

/**
 * Chi puo' dare o negare il visto su questo task.
 *
 * L'unica regola che rende il meccanismo sensato e' che l'assegnatario non
 * approva se stesso: senza di essa un manager assegnatario del proprio task
 * lo chiuderebbe con due clic invece di uno, e l'approvazione sarebbe solo un
 * passaggio in piu' senza alcun controllo. Vale anche per un admin — il
 * permesso dice cosa una persona puo' fare sul lavoro ALTRUI, non che il suo
 * lavoro non vada guardato da nessuno.
 *
 * Restituisce anche il motivo perche' l'interfaccia possa distinguere fra
 * "non ti riguarda" (niente da mostrare) e "non puoi" (vale la pena dirlo).
 */
export function valutaApprovazione(
  task: TaskApprovabile,
  utente: Employee | null | undefined
): EsitoApprovazione {
  if (!inAttesaDiApprovazione(task)) return { puo: false, motivo: 'non-in-attesa' };
  if (!utente) return { puo: false, motivo: 'senza-utente' };
  if (task.assigneeId && task.assigneeId === utente.id) {
    return { puo: false, motivo: 'e-assegnatario' };
  }
  if (!canPerformAction(utente, PERMESSO_APPROVAZIONE.categoria, PERMESSO_APPROVAZIONE.azione)) {
    return { puo: false, motivo: 'senza-permesso' };
  }
  return { puo: true };
}

/** La sola risposta booleana, per chi non ha bisogno del motivo. */
export function puoApprovare(
  task: TaskApprovabile,
  utente: Employee | null | undefined
): boolean {
  return valutaApprovazione(task, utente).puo;
}

/**
 * I campi da scrivere quando si approva.
 *
 * Restituisce una modifica invece di applicarla: chi salva (il gestore in
 * `App.tsx`) sa gia' come si aggiorna un task, e una funzione pura che
 * descrive il risultato si puo' verificare senza database.
 *
 * `ora` e' un parametro con un valore predefinito per la stessa ragione: un
 * test deve poter fissare l'istante.
 */
export function campiApprovazione(
  approvatoreId: string,
  ora: Date = new Date()
): Pick<Task, 'status' | 'approvedBy' | 'approvedAt'> {
  return {
    // Lo stato resta `completed`: l'approvazione non sposta il task, toglie
    // la riserva che pendeva su di lui.
    status: 'completed',
    approvedBy: approvatoreId,
    approvedAt: ora.toISOString(),
  };
}

/**
 * I campi da scrivere quando si rifiuta.
 *
 * Si torna a `in-progress` e non a `not-started`: il lavoro e' stato fatto,
 * va corretto, non ricominciato — e chi guarda la propria lista deve
 * ritrovare il task fra quelli su cui sta lavorando.
 *
 * `approvedBy`/`approvedAt` vengono azzerati esplicitamente. Su un rifiuto
 * dopo un'approvazione (ripensamento, approvazione data per errore) lasciarli
 * com'erano manterrebbe il task "approvato" pur essendo tornato aperto, cioe'
 * proprio la combinazione che `eChiusoDavvero` non saprebbe leggere.
 */
export function campiRifiuto(): Pick<Task, 'status' | 'approvedBy' | 'approvedAt'> {
  return {
    status: 'in-progress',
    approvedBy: null,
    approvedAt: null,
  };
}

/**
 * Cosa deve succedere quando qualcuno porta un task a uno stato.
 *
 * Il caso che conta e' `completed` su un task che richiede approvazione: il
 * task ci va davvero (l'assegnatario ha finito e deve poterlo dichiarare) ma
 * senza approvazione, quindi ogni visto precedente va tolto. Senza questo
 * azzeramento un task approvato, riaperto e richiuso resterebbe approvato
 * dalla volta prima, e nessuno lo guarderebbe piu'.
 */
export function campiCambioStato(
  task: TaskApprovabile,
  nuovoStato: Task['status']
): Pick<Task, 'status' | 'approvedBy' | 'approvedAt'> {
  if (!richiedeApprovazione(task)) {
    return { status: nuovoStato, approvedBy: task.approvedBy ?? null, approvedAt: task.approvedAt ?? null };
  }
  return { status: nuovoStato, approvedBy: null, approvedAt: null };
}

/**
 * Il nome di chi ha approvato, se lo conosciamo.
 *
 * Null e non "Sconosciuto": chi ha approvato puo' aver lasciato l'azienda e
 * non essere piu' nell'elenco, e in quel caso l'interfaccia deve poter
 * mostrare la sola data invece di una frase con un buco dentro.
 */
export function nomeApprovatore(
  task: Pick<Task, 'approvedBy'>,
  employees: Employee[] | null | undefined
): string | null {
  if (!task?.approvedBy) return null;
  const trovato = (employees ?? []).find((e) => e.id === task.approvedBy);
  return trovato?.name ?? null;
}
