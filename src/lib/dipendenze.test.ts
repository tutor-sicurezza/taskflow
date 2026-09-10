import { describe, it, expect } from 'vitest';
import {
  bloccantiAperti,
  bloccati,
  creerebbeCiclo,
  eBloccato,
  puoCompletare,
  riferimentiValidi,
} from '@/lib/dipendenze';
import type { Task } from '@/lib/types';

/**
 * Dipendenze fra task.
 *
 * Due cose meritano davvero un test, ed e' su quelle che insiste questo file:
 * la ricerca dei cicli (che il database non fa, e che se sbagliata o blocca
 * l'interfaccia o lascia creare una catena chiusa) e la definizione di
 * "chiuso", che qui NON e' `status === 'completed'`.
 */

const task = (id: string, parziale: Partial<Task> = {}): Task =>
  ({
    id,
    title: id,
    description: '',
    assigneeId: null,
    priority: 'medium',
    status: 'not-started',
    createdAt: '2026-01-01T00:00:00.000Z',
    blockedBy: [],
    ...parziale,
  }) as Task;

/** Un task finito davvero: nessuna approvazione richiesta. */
const chiuso = (id: string, parziale: Partial<Task> = {}) =>
  task(id, { status: 'completed', requiresApproval: false, ...parziale });

/** Completato dall'assegnatario, ma il visto non e' ancora arrivato. */
const inAttesa = (id: string) =>
  task(id, {
    status: 'completed',
    requiresApproval: true,
    approvedBy: null,
    approvedAt: null,
  });

describe('bloccantiAperti / eBloccato', () => {
  it('elenca solo i bloccanti non ancora chiusi', () => {
    const a = chiuso('a');
    const b = task('b', { status: 'in-progress' });
    const c = task('c', { blockedBy: ['a', 'b'] });

    expect(bloccantiAperti(c, [a, b, c]).map((t) => t.id)).toEqual(['b']);
    expect(eBloccato(c, [a, b, c])).toBe(true);
  });

  it('un task senza dipendenze non e mai bloccato', () => {
    const a = task('a');
    expect(bloccantiAperti(a, [a])).toEqual([]);
    expect(eBloccato(a, [a])).toBe(false);
    // `blockedBy` assente e non solo vuoto: e' cosi' che arrivano i task
    // creati prima della migrazione.
    const vecchio = task('v', { blockedBy: undefined });
    expect(eBloccato(vecchio, [vecchio])).toBe(false);
  });

  it('un bloccante completato ma in attesa di approvazione NON sblocca', () => {
    // Il caso che distingue questa libreria da un confronto con 'completed':
    // per l'assegnatario il lavoro e' finito, per l'organizzazione no, e far
    // ripartire cio' che aspetta significherebbe dare per buono un lavoro che
    // nessuno ha ancora guardato.
    const a = inAttesa('a');
    const b = task('b', { blockedBy: ['a'] });
    expect(eBloccato(b, [a, b])).toBe(true);
    expect(bloccantiAperti(b, [a, b]).map((t) => t.id)).toEqual(['a']);
  });

  it('lo stesso bloccante, una volta approvato, sblocca', () => {
    const a = task('a', {
      status: 'completed',
      requiresApproval: true,
      approvedBy: 'capo',
      approvedAt: '2026-01-02T10:00:00.000Z',
    });
    const b = task('b', { blockedBy: ['a'] });
    expect(eBloccato(b, [a, b])).toBe(false);
  });

  it('ignora i doppioni dentro blockedBy', () => {
    const a = task('a', { status: 'in-progress' });
    const b = task('b', { blockedBy: ['a', 'a'] });
    expect(bloccantiAperti(b, [a, b])).toHaveLength(1);
  });
});

describe('riferimenti a task inesistenti', () => {
  it('un id che non corrisponde a nessun task non blocca', () => {
    // Il trigger del database li ripulisce, ma una lettura fatta prima del
    // trigger o un import possono contenerne: un task bloccato da qualcosa di
    // invisibile non sarebbe sbloccabile da nessuno.
    const b = task('b', { blockedBy: ['fantasma'] });
    expect(eBloccato(b, [b])).toBe(false);
    expect(riferimentiValidi(b, [b])).toEqual([]);
    expect(puoCompletare(b, [b]).puo).toBe(true);
  });

  it('riferimentiValidi tiene solo gli id esistenti, nell ordine originale', () => {
    const a = task('a');
    const c = task('c');
    const b = task('b', { blockedBy: ['a', 'fantasma', 'c'] });
    expect(riferimentiValidi(b, [a, b, c])).toEqual(['a', 'c']);
  });

  it('un task che blocca se stesso non blocca niente', () => {
    // Il CHECK sul database lo impedisce, ma i dati in memoria non ancora
    // salvati e gli import no: se contasse, quel task sarebbe fermo per
    // sempre e nemmeno chiudendolo si sbloccherebbe.
    const a = task('a', { blockedBy: ['a'] });
    expect(eBloccato(a, [a])).toBe(false);
    expect(riferimentiValidi(a, [a])).toEqual([]);
  });
});

describe('bloccati — la direzione inversa', () => {
  it('trova i task che questo blocca', () => {
    const a = task('a');
    const b = task('b', { blockedBy: ['a'] });
    const c = task('c', { blockedBy: ['a', 'b'] });
    const d = task('d');

    expect(bloccati(a, [a, b, c, d]).map((t) => t.id)).toEqual(['b', 'c']);
    expect(bloccati(d, [a, b, c, d])).toEqual([]);
  });

  it('non conta un task fra quelli che blocca se stesso', () => {
    const a = task('a', { blockedBy: ['a'] });
    expect(bloccati(a, [a])).toEqual([]);
  });
});

describe('creerebbeCiclo', () => {
  it('ferma il ciclo di lunghezza uno: un task su se stesso', () => {
    const a = task('a');
    expect(creerebbeCiclo('a', 'a', [a])).toBe(true);
  });

  it('ferma il ciclo a due nodi', () => {
    // b aspetta a; far aspettare b ad a chiuderebbe l'anello.
    const a = task('a');
    const b = task('b', { blockedBy: ['a'] });
    expect(creerebbeCiclo('a', 'b', [a, b])).toBe(true);
    // Il legame che esiste gia', ripetuto, resta lecito: non aggiunge nulla.
    expect(creerebbeCiclo('b', 'a', [a, b])).toBe(false);
  });

  it('ferma il ciclo a tre nodi', () => {
    // a <- b <- c: aggiungere "a aspetta c" chiude A->B->C->A.
    const a = task('a');
    const b = task('b', { blockedBy: ['a'] });
    const c = task('c', { blockedBy: ['b'] });
    expect(creerebbeCiclo('a', 'c', [a, b, c])).toBe(true);
  });

  it('ferma il ciclo a quattro nodi', () => {
    const a = task('a');
    const b = task('b', { blockedBy: ['a'] });
    const c = task('c', { blockedBy: ['b'] });
    const d = task('d', { blockedBy: ['c'] });
    expect(creerebbeCiclo('a', 'd', [a, b, c, d])).toBe(true);
    // Lo stesso grafo, il verso giusto: d puo' aspettare a senza chiudere niente.
    expect(creerebbeCiclo('d', 'a', [a, b, c, d])).toBe(false);
  });

  it('lascia passare i legami che non chiudono un anello', () => {
    const a = task('a');
    const b = task('b', { blockedBy: ['a'] });
    const c = task('c');
    // Un diamante (b e c aspettano a, d aspetta entrambi) non e' un ciclo,
    // anche se lo stesso nodo si incontra due volte percorrendolo.
    const d = task('d', { blockedBy: ['b'] });
    expect(creerebbeCiclo('c', 'a', [a, b, c, d])).toBe(false);
    expect(creerebbeCiclo('d', 'c', [a, b, c, d])).toBe(false);
  });

  it('non entra in ricorsione infinita su dati gia ciclici', () => {
    // Il database non impedisce questo grafo: se arrivasse da un import,
    // aprire la scheda per ripararlo non deve bloccare l'interfaccia.
    const a = task('a', { blockedBy: ['c'] });
    const b = task('b', { blockedBy: ['a'] });
    const c = task('c', { blockedBy: ['b'] });
    const d = task('d');

    expect(creerebbeCiclo('a', 'b', [a, b, c, d])).toBe(true);
    // Anche una domanda su un nodo esterno deve terminare, pur attraversando
    // l'anello esistente.
    expect(creerebbeCiclo('d', 'a', [a, b, c, d])).toBe(false);
    expect(creerebbeCiclo('a', 'd', [a, b, c, d])).toBe(false);
  });

  it('non entra in ricorsione infinita su un anello che il task tocca due volte', () => {
    // Anello a due nodi gia' presente piu' un terzo appeso: la percorrenza
    // incontra lo stesso nodo da due strade diverse.
    const a = task('a', { blockedBy: ['b'] });
    const b = task('b', { blockedBy: ['a'] });
    const c = task('c', { blockedBy: ['a', 'b'] });
    expect(creerebbeCiclo('c', 'a', [a, b, c])).toBe(false);
    expect(creerebbeCiclo('a', 'c', [a, b, c])).toBe(true);
  });

  it('regge una catena lunga senza esaurire la pila', () => {
    // Mille task in fila: una versione ricorsiva si romperebbe qui.
    const catena: Task[] = [];
    for (let i = 0; i < 1000; i++) {
      catena.push(task(`t${i}`, { blockedBy: i === 0 ? [] : [`t${i - 1}`] }));
    }
    expect(creerebbeCiclo('t0', 't999', catena)).toBe(true);
    expect(creerebbeCiclo('t999', 't0', catena)).toBe(false);
  });

  it('ignora gli id mancanti e i task che non esistono', () => {
    const a = task('a');
    expect(creerebbeCiclo(null, 'a', [a])).toBe(false);
    expect(creerebbeCiclo('a', undefined, [a])).toBe(false);
    // Un bloccante che non esiste piu' non puo' chiudere nessun anello.
    expect(creerebbeCiclo('a', 'fantasma', [a])).toBe(false);
  });
});

describe('puoCompletare', () => {
  it('dice di no e dice quali lavori si stanno aspettando', () => {
    const a = task('a', { status: 'in-progress' });
    const b = task('b', { blockedBy: ['a'] });
    const esito = puoCompletare(b, [a, b]);
    expect(esito.puo).toBe(false);
    expect(esito.motivo).toBe('bloccanti-aperti');
    expect(esito.bloccanti.map((t) => t.id)).toEqual(['a']);
  });

  it('dice di si quando tutti i bloccanti sono chiusi davvero', () => {
    const a = chiuso('a');
    const b = task('b', { blockedBy: ['a'] });
    const esito = puoCompletare(b, [a, b]);
    expect(esito.puo).toBe(true);
    expect(esito.bloccanti).toEqual([]);
  });

  it('un bloccante in attesa di approvazione tiene chiusa la strada', () => {
    const a = inAttesa('a');
    const b = task('b', { blockedBy: ['a'] });
    expect(puoCompletare(b, [a, b]).puo).toBe(false);
  });
});
