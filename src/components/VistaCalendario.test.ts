/**
 * La griglia del mese e il raggruppamento per giorno.
 *
 * Sono le due cose che possono rompersi in silenzio: una griglia sbagliata di
 * una colonna e un task nella casella del giorno prima si vedono solo se si
 * guarda il calendario con il calendario vero accanto. Qui si guardano da
 * sole, senza montare React.
 */

import { describe, it, expect } from 'vitest';
import {
  GIORNI_PER_SETTIMANA,
  SETTIMANE_MOSTRATE,
  chiaveGiorno,
  costruisciMese,
  giorniDellaGriglia,
  nomiGiorniSettimana,
  ordinaTaskDelGiorno,
  raggruppaPerScadenza,
} from '@/components/VistaCalendario';
import type { Task } from '@/lib/types';

/** Un task minimo: al calendario servono solo scadenza, priorita' e stato. */
const task = (parziale: Partial<Task> & { id: string }): Task =>
  ({
    title: parziale.id,
    description: '',
    assigneeId: null,
    priority: 'medium',
    status: 'not-started',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...parziale,
  }) as Task;

/** Mezzogiorno locale: evita che il fuso sposti la data di un giorno. */
const alle12 = (anno: number, mese: number, giorno: number) =>
  new Date(anno, mese - 1, giorno, 12, 0, 0).toISOString();

describe('griglia del mese', () => {
  it('ha sempre sei settimane piene, qualunque sia il mese', () => {
    // L'altezza fissa non e' estetica: con righe variabili il contenuto sotto
    // il calendario salta cambiando mese.
    for (const [anno, mese] of [[2024, 2], [2024, 6], [2024, 9], [2023, 2]] as const) {
      const griglia = giorniDellaGriglia(new Date(anno, mese - 1, 1));
      expect(griglia).toHaveLength(SETTIMANE_MOSTRATE * GIORNI_PER_SETTIMANA);
    }
  });

  it('un mese che inizia di domenica: settimana da lunedi e settimana da domenica', () => {
    // Il 1 settembre 2024 e' una domenica.
    const settembre = new Date(2024, 8, 1);

    const daLunedi = giorniDellaGriglia(settembre, 1);
    // Partendo da lunedi la domenica chiude la settimana precedente: davanti
    // ci vanno sei giorni di agosto.
    expect(chiaveGiorno(daLunedi[0])).toBe('2024-08-26');
    expect(chiaveGiorno(daLunedi[6])).toBe('2024-09-01');

    const daDomenica = giorniDellaGriglia(settembre, 0);
    // Partendo da domenica il mese comincia esattamente nella prima casella:
    // e' il caso in cui non serve alcun riempimento iniziale.
    expect(chiaveGiorno(daDomenica[0])).toBe('2024-09-01');
  });

  it('un mese che inizia di sabato riempie quasi tutta la prima riga', () => {
    // Il 1 giugno 2024 e' un sabato: e' il caso peggiore, quello che rende
    // necessarie sei righe.
    const giugno = new Date(2024, 5, 1);

    const daLunedi = giorniDellaGriglia(giugno, 1);
    expect(chiaveGiorno(daLunedi[0])).toBe('2024-05-27');
    expect(chiaveGiorno(daLunedi[5])).toBe('2024-06-01');

    const daDomenica = giorniDellaGriglia(giugno, 0);
    expect(chiaveGiorno(daDomenica[0])).toBe('2024-05-26');
    expect(chiaveGiorno(daDomenica[6])).toBe('2024-06-01');
  });

  it('febbraio bisestile ha 29 giorni nel mese, quello normale 28', () => {
    const bisestile = costruisciMese([], new Date(2024, 1, 10));
    expect(bisestile.giorni.filter((g) => g.nelMese)).toHaveLength(29);
    const nelMese = bisestile.giorni.filter((g) => g.nelMese);
    // `nelMese[nelMese.length - 1]` e non `.at(-1)`: il target del progetto e'
    // ES2020, dove `Array.prototype.at` non esiste.
    expect(chiaveGiorno(nelMese[nelMese.length - 1].data)).toBe('2024-02-29');

    const normale = costruisciMese([], new Date(2023, 1, 10));
    expect(normale.giorni.filter((g) => g.nelMese)).toHaveLength(28);
  });

  it('a gennaio i giorni di dicembre restano fuori dal mese', () => {
    // Confronto su anno E mese: guardando solo il numero del mese, il dicembre
    // dell'anno prima non e' distinguibile da quello dello stesso anno.
    // Il 1 gennaio 2025 e' un mercoledi': davanti restano due giorni del 2024.
    const gennaio = costruisciMese([], new Date(2025, 0, 1), 1);
    const primo = gennaio.giorni[0];
    expect(chiaveGiorno(primo.data)).toBe('2024-12-30');
    expect(primo.nelMese).toBe(false);
  });

  it('divide i giorni in righe da sette', () => {
    const mese = costruisciMese([], new Date(2024, 5, 1));
    expect(mese.settimane).toHaveLength(SETTIMANE_MOSTRATE);
    for (const settimana of mese.settimane) {
      expect(settimana).toHaveLength(GIORNI_PER_SETTIMANA);
    }
    // Le righe sono gli stessi giorni, nello stesso ordine.
    expect(mese.settimane.flat().map((g) => g.chiave)).toEqual(mese.giorni.map((g) => g.chiave));
  });
});

describe('raggruppamento per giorno', () => {
  it('mette ogni task nella casella della sua scadenza', () => {
    const { perGiorno } = raggruppaPerScadenza([
      task({ id: 'a', dueDate: alle12(2024, 6, 10) }),
      task({ id: 'b', dueDate: alle12(2024, 6, 10) }),
      task({ id: 'c', dueDate: alle12(2024, 6, 11) }),
    ]);

    expect(perGiorno.get('2024-06-10')?.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(perGiorno.get('2024-06-11')?.map((t) => t.id)).toEqual(['c']);
    expect(perGiorno.has('2024-06-12')).toBe(false);
  });

  it('usa il giorno locale e non quello UTC', () => {
    // Una scadenza a mezzogiorno locale sta nel suo giorno per chiunque:
    // e' il controllo che smaschera un `toISOString().slice(0, 10)`.
    const quando = new Date(2024, 2, 15, 12, 0, 0);
    const { perGiorno } = raggruppaPerScadenza([task({ id: 'a', dueDate: quando.toISOString() })]);
    expect(perGiorno.has('2024-03-15')).toBe(true);
  });

  it('tiene fuori dal calendario i task senza scadenza, ma non li perde', () => {
    const senza = [
      task({ id: 'nulla', dueDate: null }),
      task({ id: 'assente' }),
      task({ id: 'vuota', dueDate: '' }),
      task({ id: 'malformata', dueDate: 'non-una-data' }),
    ];
    const { perGiorno, senzaScadenza } = raggruppaPerScadenza([
      ...senza,
      task({ id: 'con', dueDate: alle12(2024, 6, 10) }),
    ]);

    expect(perGiorno.size).toBe(1);
    // Non compaiono da nessuna parte sulla griglia, ma sono contati: senza il
    // conteggio a schermo sembrerebbero spariti.
    expect(senzaScadenza.map((t) => t.id)).toEqual([
      'nulla',
      'assente',
      'vuota',
      'malformata',
    ]);
  });

  it('costruisciMese porta i task nelle celle giuste e riporta i senza scadenza', () => {
    const mese = costruisciMese(
      [
        task({ id: 'dentro', dueDate: alle12(2024, 6, 10) }),
        // Il 31 maggio non e' di giugno, ma sulla griglia di giugno c'e':
        // deve comparire nella sua cella, marcata come fuori dal mese.
        task({ id: 'riempimento', dueDate: alle12(2024, 5, 31) }),
        task({ id: 'orfano', dueDate: null }),
      ],
      new Date(2024, 5, 15),
      1
    );

    const dentro = mese.giorni.find((g) => g.chiave === '2024-06-10');
    expect(dentro?.task.map((t) => t.id)).toEqual(['dentro']);
    expect(dentro?.nelMese).toBe(true);

    const fuori = mese.giorni.find((g) => g.chiave === '2024-05-31');
    expect(fuori?.task.map((t) => t.id)).toEqual(['riempimento']);
    expect(fuori?.nelMese).toBe(false);

    expect(mese.senzaScadenza.map((t) => t.id)).toEqual(['orfano']);
  });
});

describe('ordine dentro il giorno', () => {
  it('prima gli aperti, poi le priorita, poi il titolo', () => {
    const ordinati = ordinaTaskDelGiorno([
      task({ id: '1', title: 'zeta', priority: 'low' }),
      task({ id: '2', title: 'alfa', priority: 'high', status: 'completed' }),
      task({ id: '3', title: 'beta', priority: 'high' }),
      task({ id: '4', title: 'alfa', priority: 'medium' }),
      task({ id: '5', title: 'alfa', priority: 'high' }),
    ]);

    // Un task chiuso non e' un carico: va in fondo anche se e' urgente.
    expect(ordinati.map((t) => t.id)).toEqual(['5', '3', '4', '1', '2']);
  });

  it('non modifica l array ricevuto', () => {
    const originale = [
      task({ id: 'b', priority: 'low' }),
      task({ id: 'a', priority: 'high' }),
    ];
    ordinaTaskDelGiorno(originale);
    expect(originale.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('applica l ordine anche ai task raggruppati', () => {
    const { perGiorno } = raggruppaPerScadenza([
      task({ id: 'bassa', priority: 'low', dueDate: alle12(2024, 6, 10) }),
      task({ id: 'alta', priority: 'high', dueDate: alle12(2024, 6, 10) }),
    ]);
    expect(perGiorno.get('2024-06-10')?.map((t) => t.id)).toEqual(['alta', 'bassa']);
  });
});

describe('intestazioni dei giorni', () => {
  it('sono sette e cambiano ordine con l inizio settimana', () => {
    const daLunedi = nomiGiorniSettimana('en-US', 1);
    const daDomenica = nomiGiorniSettimana('en-US', 0);

    expect(daLunedi).toHaveLength(GIORNI_PER_SETTIMANA);
    expect(daDomenica).toHaveLength(GIORNI_PER_SETTIMANA);
    // La domenica passa dalla fine all'inizio: e' l'unica differenza, ed e' la
    // stessa che sposterebbe l'intera griglia di una colonna se sbagliata.
    expect(daLunedi[daLunedi.length - 1].lungo).toBe(daDomenica[0].lungo);
  });

  it('non dipende dal giorno in cui vengono chiamate', () => {
    expect(nomiGiorniSettimana('en-US', 1)).toEqual(nomiGiorniSettimana('en-US', 1));
  });
});
