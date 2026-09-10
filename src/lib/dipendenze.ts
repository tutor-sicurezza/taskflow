/**
 * Le regole delle dipendenze fra task, in un posto solo e senza React.
 *
 * `blockedBy` contiene gli id dei task che devono chiudersi PRIMA di questo.
 * La direzione e' quella e non l'opposta perche' e' la domanda che si fa chi
 * guarda un lavoro fermo — "perche' non posso andare avanti?" — e la risposta
 * sta tutta dentro la riga che si sta gia' leggendo. Girata ("quali task blocco
 * io") avrebbe richiesto di scorrere tutti gli altri anche solo per mostrare un
 * badge.
 *
 * Due cose che il database non puo' fare, e che quindi vivono qui:
 *
 * - i CICLI. Il CHECK in `0022` ferma solo il caso "un task blocca se stesso":
 *   per accorgersi di A->B->C->A servirebbe una ricorsione a ogni scrittura.
 *   L'applicazione, invece, al momento di aggiungere un legame ha in mano tutti
 *   i task e puo' cercare il ciclo prima di crearlo — vedi `creerebbeCiclo`.
 *   Ne segue anche il contrario: dati gia' ciclici POSSONO esistere (import,
 *   scritture fatte da fuori, una versione precedente), quindi ogni percorrenza
 *   qui dentro tiene un insieme di visitati e non si fida della forma del grafo.
 * - i riferimenti ROTTI. Il trigger toglie l'id di un task cancellato dai
 *   `blocked_by` altrui, ma una lista letta un istante prima del trigger, o
 *   arrivata da un import, puo' contenerne. Un task bloccato per sempre da
 *   qualcosa che non si vede e' impossibile da sbloccare per chi lo guarda:
 *   `riferimentiValidi` decide che quegli id non bloccano.
 *
 * "Chiuso" non e' `status === 'completed'`: un task che richiede
 * un'approvazione e la sta aspettando e' lavoro ancora aperto. La domanda
 * giusta ha gia' un nome — `eChiusoDavvero` in `approvazione.ts` — e viene
 * riusata qui, altrimenti sbloccare un task dipenderebbe da una definizione di
 * "finito" diversa da quella di tutti i conteggi dell'applicazione.
 */

import type { Task } from '@/lib/types';
import { eChiusoDavvero, type TaskApprovabile } from '@/lib/approvazione';

/**
 * I campi che bastano a rispondere alle domande di questo file.
 *
 * Volutamente minimo: un badge che vuole sapere se un task e' bloccato non
 * deve trascinarsi dietro commenti, allegati e cronologia solo per chiamare
 * una funzione.
 */
export type TaskDipendente = Pick<Task, 'id' | 'blockedBy'> & TaskApprovabile;

/** Un riferimento a un task, valido o no. */
type Elenco<T extends TaskDipendente> = readonly T[] | null | undefined;

/** Gli id in `blockedBy`, senza doppioni e senza il proprio. */
function idBloccanti(task: Pick<Task, 'id' | 'blockedBy'> | null | undefined): string[] {
  if (!task) return [];
  const visti = new Set<string>();
  for (const id of task.blockedBy ?? []) {
    // L'auto-blocco non arriva dal database (c'e' un CHECK) ma puo' arrivare
    // da un import o da uno stato in memoria non ancora salvato: scartarlo qui
    // evita che un task risulti bloccato da se stesso, cioe' per sempre.
    if (typeof id === 'string' && id.length > 0 && id !== task.id) visti.add(id);
  }
  return [...visti];
}

/** Indice id -> task, per non rifare una `find` dentro ogni ciclo. */
function perId<T extends TaskDipendente>(tuttiITask: Elenco<T>): Map<string, T> {
  const mappa = new Map<string, T>();
  for (const t of tuttiITask ?? []) {
    if (t?.id) mappa.set(t.id, t);
  }
  return mappa;
}

/**
 * Gli id di `blockedBy` che corrispondono a un task che esiste davvero.
 *
 * Un id orfano NON deve bloccare. Il trigger in `0022` li ripulisce, ma fra la
 * lettura e il trigger — o dopo un import — la lista puo' contenerne, e in quel
 * caso l'interfaccia mostrerebbe "bloccato" senza poter dire da cosa e senza
 * dare modo di toglierlo.
 */
export function riferimentiValidi<T extends TaskDipendente>(
  task: Pick<Task, 'id' | 'blockedBy'> | null | undefined,
  tuttiITask: Elenco<T>
): string[] {
  const mappa = perId(tuttiITask);
  return idBloccanti(task).filter((id) => mappa.has(id));
}

/**
 * I task che bloccano questo e non sono ancora chiusi.
 *
 * Restituisce i task interi e non gli id perche' chi chiama deve poterne
 * mostrare il titolo e l'assegnatario senza una seconda ricerca.
 */
export function bloccantiAperti<T extends TaskDipendente>(
  task: Pick<Task, 'id' | 'blockedBy'> | null | undefined,
  tuttiITask: Elenco<T>
): T[] {
  /*
    Uscita immediata quando non ci sono dipendenze, che e' il caso della
    quasi totalita' dei task.

    Senza, ogni scheda dell'elenco costruiva una `Map` di TUTTI i task solo per
    scoprire di non avere niente da cercarci dentro: con cento schede a schermo
    e mille task in archivio sono centomila inserimenti a ogni modifica, anche
    quella arrivata dal collega dall'altra parte dell'ufficio.
  */
  const ids = idBloccanti(task);
  if (ids.length === 0) return [];

  const mappa = perId(tuttiITask);
  const aperti: T[] = [];
  for (const id of ids) {
    const bloccante = mappa.get(id);
    // `!bloccante` = riferimento rotto: non blocca, vedi `riferimentiValidi`.
    if (!bloccante) continue;
    if (!eChiusoDavvero(bloccante)) aperti.push(bloccante);
  }
  return aperti;
}

/** Vero se almeno un bloccante e' ancora aperto. */
export function eBloccato<T extends TaskDipendente>(
  task: Pick<Task, 'id' | 'blockedBy'> | null | undefined,
  tuttiITask: Elenco<T>
): boolean {
  return bloccantiAperti(task, tuttiITask).length > 0;
}

/**
 * I task che QUESTO blocca: la direzione inversa.
 *
 * E' l'informazione che rende utile chiudere un task ("chiudendo questo,
 * ripartono quegli altri") e va cercata dentro gli array altrui, perche' la
 * colonna dice solo il contrario. Sul database la stessa domanda passa per
 * l'indice GIN; qui i task sono gia' tutti in memoria.
 */
export function bloccati<T extends TaskDipendente>(
  task: Pick<Task, 'id'> | null | undefined,
  tuttiITask: Elenco<T>
): T[] {
  const id = task?.id;
  if (!id) return [];
  return (tuttiITask ?? []).filter((altro) => altro?.id !== id && idBloccanti(altro).includes(id));
}

/**
 * Aggiungere `idBloccante` fra i bloccanti di `idTask` creerebbe un ciclo?
 *
 * Il legame nuovo dice "idBloccante viene prima di idTask". E' un ciclo se
 * idTask viene GIA' prima di idBloccante, cioe' se risalendo la catena dei
 * bloccanti di idBloccante si arriva a idTask. Si risale da idBloccante e non
 * si scende da idTask perche' la colonna e' quella: ogni passo e' una lettura
 * di `blockedBy`, senza dover cercare chi contiene cosa.
 *
 * Trova i cicli di QUALUNQUE lunghezza — A->B->C->A come A->B->A — perche'
 * percorre la catena fino in fondo invece di guardare il solo passo diretto.
 *
 * L'insieme `visitati` non e' un'ottimizzazione: senza, un grafo GIA' ciclico
 * (che il database non impedisce) manderebbe la funzione in ricorsione
 * infinita, cioe' bloccherebbe la scheda proprio nel momento in cui si sta
 * cercando di riparare quei dati. Per la stessa ragione la percorrenza e'
 * iterativa: una pila esplicita non ha un limite di profondita' oltre il quale
 * l'interfaccia muore.
 */
export function creerebbeCiclo<T extends TaskDipendente>(
  idTask: string | null | undefined,
  idBloccante: string | null | undefined,
  tuttiITask: Elenco<T>
): boolean {
  if (!idTask || !idBloccante) return false;
  // Un task che blocca se stesso e' il ciclo di lunghezza uno: e' l'unico che
  // il database sa fermare da solo, ma va detto anche qui, perche' chi chiama
  // vuole una risposta prima di scrivere, non un errore dopo.
  if (idTask === idBloccante) return true;

  const mappa = perId(tuttiITask);
  const visitati = new Set<string>([idBloccante]);
  const daVisitare: string[] = [idBloccante];

  while (daVisitare.length > 0) {
    const corrente = daVisitare.pop() as string;
    for (const id of idBloccanti(mappa.get(corrente))) {
      if (id === idTask) return true;
      if (visitati.has(id)) continue;
      visitati.add(id);
      daVisitare.push(id);
    }
  }

  return false;
}

/** Perche' un task non puo' essere portato a "completato". */
export type MotivoNonCompletabile = 'bloccanti-aperti';

export interface EsitoCompletamento<T extends TaskDipendente> {
  puo: boolean;
  /** Presente solo quando `puo` e' falso. */
  motivo?: MotivoNonCompletabile;
  /** I bloccanti ancora aperti: vuoto quando `puo` e' vero. */
  bloccanti: T[];
}

/**
 * Se un task possa essere dichiarato completato, e in caso contrario perche'.
 *
 * Restituisce anche l'elenco dei bloccanti e non il solo booleano: chi mostra
 * il rifiuto deve poter dire QUALI lavori si stanno aspettando, altrimenti
 * "non puoi completare" e' un vicolo cieco. Le dipendenze non impediscono di
 * lavorare a un task — si puo' portare a `in-progress`, o a `blocked`, che
 * esiste apposta — impediscono solo di dichiararlo finito.
 */
export function puoCompletare<T extends TaskDipendente>(
  task: Pick<Task, 'id' | 'blockedBy'> | null | undefined,
  tuttiITask: Elenco<T>
): EsitoCompletamento<T> {
  const bloccanti = bloccantiAperti(task, tuttiITask);
  if (bloccanti.length === 0) return { puo: true, bloccanti: [] };
  return { puo: false, motivo: 'bloccanti-aperti', bloccanti };
}
