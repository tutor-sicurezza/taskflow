import { describe, it, expect } from 'vitest';
import {
  MAX_LUNGHEZZA_PASSO,
  MAX_SOTTOATTIVITA,
  aggiungiSottoattivita,
  avanzamento,
  elencoPieno,
  eliminaSottoattivita,
  normalizzaPasso,
  rinominaSottoattivita,
  sottoattivitaValide,
  spostaSottoattivita,
  spuntaSottoattivita,
} from '@/lib/sottoattivita';
import type { Sottoattivita } from '@/lib/types';

const ORA = '2025-01-01T10:00:00.000Z';

/** Un passo ridotto all'osso: i test che non parlano di date non le scrivono. */
const passo = (id: string, parti: Partial<Sottoattivita> = {}): Sottoattivita => ({
  id,
  title: `Passo ${id}`,
  done: false,
  createdAt: ORA,
  ...parti,
});

describe('sottoattivitaValide', () => {
  /**
   * I passi arrivano da una colonna JSONB: quello che torna non e' garantito
   * essere quello che ci abbiamo scritto. Nessuno di questi casi deve lanciare.
   */
  it('rifiuta tutto cio che non e un array, senza lanciare', () => {
    expect(sottoattivitaValide(null)).toEqual([]);
    expect(sottoattivitaValide(undefined)).toEqual([]);
    expect(sottoattivitaValide('compila il modulo')).toEqual([]);
    expect(sottoattivitaValide(42)).toEqual([]);
    expect(sottoattivitaValide({ 0: passo('a') })).toEqual([]);
  });

  it('scarta le voci che non sono passi e tiene le altre', () => {
    const risultato = sottoattivitaValide([
      null,
      'compila il modulo',
      7,
      [],
      { id: 'a', title: 'Compila il modulo', done: false, createdAt: ORA },
    ]);

    expect(risultato).toHaveLength(1);
    expect(risultato[0].id).toBe('a');
  });

  it('scarta un passo senza id o senza testo', () => {
    expect(sottoattivitaValide([{ title: 'Senza id', done: false, createdAt: ORA }])).toEqual([]);
    expect(sottoattivitaValide([{ id: 'a', done: false, createdAt: ORA }])).toEqual([]);
    // Un testo di soli spazi non e' un testo: sarebbe una riga che si puo'
    // spuntare senza sapere cosa si sta dichiarando fatto.
    expect(sottoattivitaValide([{ id: 'a', title: '   ', done: false, createdAt: ORA }])).toEqual([]);
    expect(sottoattivitaValide([{ id: 42, title: 'Numerico', done: false, createdAt: ORA }])).toEqual([]);
  });

  it('tiene il primo di due passi con lo stesso id e scarta il doppione', () => {
    const risultato = sottoattivitaValide([
      { id: 'a', title: 'Primo', done: false, createdAt: ORA },
      { id: 'a', title: 'Doppione', done: true, createdAt: ORA },
      { id: 'b', title: 'Secondo', done: false, createdAt: ORA },
    ]);

    expect(risultato.map((p) => p.id)).toEqual(['a', 'b']);
    expect(risultato[0].title).toBe('Primo');
  });

  it('considera non fatto tutto cio che non e done: true', () => {
    const risultato = sottoattivitaValide([
      { id: 'a', title: 'Uno', done: 'si', createdAt: ORA },
      { id: 'b', title: 'Due', createdAt: ORA },
      { id: 'c', title: 'Tre', done: 1, createdAt: ORA },
      { id: 'd', title: 'Quattro', done: true, createdAt: ORA },
    ]);

    expect(risultato.map((p) => p.done)).toEqual([false, false, false, true]);
  });

  it('non lascia chi e quando su un passo non spuntato', () => {
    const risultato = sottoattivitaValide([
      { id: 'a', title: 'Uno', done: false, createdAt: ORA, doneAt: ORA, doneBy: 'u1' },
    ]);

    expect(risultato[0].doneAt).toBeUndefined();
    expect(risultato[0].doneBy).toBeUndefined();
  });

  it('azzera le date non interpretabili invece di inventarne una', () => {
    const risultato = sottoattivitaValide([
      { id: 'a', title: 'Uno', done: true, createdAt: 'ieri', doneAt: 'mai', doneBy: 12 },
    ]);

    expect(risultato[0].createdAt).toBe('');
    expect(risultato[0].doneAt).toBeNull();
    expect(risultato[0].doneBy).toBeNull();
  });

  it('normalizza e taglia il testo letto dal database', () => {
    const lungo = 'x'.repeat(MAX_LUNGHEZZA_PASSO + 50);
    const risultato = sottoattivitaValide([
      { id: 'a', title: '  compila   il  modulo  ', done: false, createdAt: ORA },
      { id: 'b', title: lungo, done: false, createdAt: ORA },
    ]);

    expect(risultato[0].title).toBe('compila il modulo');
    expect(risultato[1].title).toHaveLength(MAX_LUNGHEZZA_PASSO);
  });

  it('NON tronca un elenco arrivato piu lungo del tetto', () => {
    // Il tetto vale in scrittura. Troncare qui perderebbe passi che nessuno ha
    // tolto, e li perderebbe per sempre al primo salvataggio successivo.
    const troppi = Array.from({ length: MAX_SOTTOATTIVITA + 10 }, (_, i) => ({
      id: `p${i}`,
      title: `Passo ${i}`,
      done: false,
      createdAt: ORA,
    }));

    expect(sottoattivitaValide(troppi)).toHaveLength(MAX_SOTTOATTIVITA + 10);
  });

  it('mantiene l ordine, che nei passi e informazione', () => {
    const risultato = sottoattivitaValide([passo('c'), passo('a'), passo('b')]);
    expect(risultato.map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('normalizzaPasso', () => {
  it('comprime gli spazi interni e taglia i bordi', () => {
    expect(normalizzaPasso('  compila   il  modulo ')).toBe('compila il modulo');
  });

  it('tiene le maiuscole: qui il testo e una frase, non un vocabolario', () => {
    expect(normalizzaPasso('Chiama ACME')).toBe('Chiama ACME');
  });

  it('non lascia uno spazio in coda quando il taglio ci cade sopra', () => {
    const testo = `${'x'.repeat(MAX_LUNGHEZZA_PASSO - 1)} ancora`;
    expect(normalizzaPasso(testo)).toBe('x'.repeat(MAX_LUNGHEZZA_PASSO - 1));
  });

  it('regge un valore che non e una stringa', () => {
    expect(normalizzaPasso(undefined as unknown as string)).toBe('');
    expect(normalizzaPasso(null as unknown as string)).toBe('');
  });
});

describe('avanzamento', () => {
  /**
   * Il caso che questo modulo esiste per rendere distinguibile: nessun passo
   * non e' zero per cento.
   */
  it('dice nessun passo, non zero per cento', () => {
    expect(avanzamento([])).toEqual({ fatte: 0, totale: 0, percentuale: null });
    expect(avanzamento(null)).toEqual({ fatte: 0, totale: 0, percentuale: null });
    expect(avanzamento(undefined)).toEqual({ fatte: 0, totale: 0, percentuale: null });
  });

  it('conta le fatte sul totale', () => {
    const elenco = [passo('a', { done: true }), passo('b'), passo('c', { done: true }), passo('d')];
    expect(avanzamento(elenco)).toEqual({ fatte: 2, totale: 4, percentuale: 50 });
  });

  it('da 0 solo quando non e fatto niente e 100 solo quando e fatto tutto', () => {
    const cento = Array.from({ length: 200 }, (_, i) => passo(`p${i}`, { done: i < 1 }));
    // Con duecento passi e uno solo fatto l'arrotondamento darebbe 0: una
    // barra vuota su un lavoro iniziato.
    expect(avanzamento(cento).percentuale).toBe(1);

    const quasi = Array.from({ length: 200 }, (_, i) => passo(`p${i}`, { done: i < 199 }));
    expect(avanzamento(quasi).percentuale).toBe(99);

    const tutti = [passo('a', { done: true })];
    expect(avanzamento(tutti).percentuale).toBe(100);

    const nessuno = [passo('a'), passo('b')];
    expect(avanzamento(nessuno).percentuale).toBe(0);
  });
});

describe('aggiungiSottoattivita', () => {
  it('mette il passo nuovo in fondo', () => {
    const elenco = [passo('a')];
    const nuovo = aggiungiSottoattivita(elenco, 'Chiama il cliente', { id: 'b', adesso: ORA });

    expect(nuovo.map((p) => p.id)).toEqual(['a', 'b']);
    expect(nuovo[1]).toEqual({ id: 'b', title: 'Chiama il cliente', done: false, createdAt: ORA });
  });

  it('non modifica l elenco ricevuto', () => {
    const elenco = [passo('a')];
    aggiungiSottoattivita(elenco, 'Chiama il cliente', { id: 'b' });
    expect(elenco).toHaveLength(1);
  });

  it('ignora un testo vuoto o di soli spazi', () => {
    const elenco = [passo('a')];
    expect(aggiungiSottoattivita(elenco, '')).toBe(elenco);
    expect(aggiungiSottoattivita(elenco, '    ')).toBe(elenco);
  });

  it('si ferma al tetto invece di crescere all infinito', () => {
    const pieno = Array.from({ length: MAX_SOTTOATTIVITA }, (_, i) => passo(`p${i}`));
    expect(elencoPieno(pieno)).toBe(true);
    expect(aggiungiSottoattivita(pieno, 'Uno di troppo')).toBe(pieno);
  });

  it('genera un id anche senza che glielo si passi', () => {
    const nuovo = aggiungiSottoattivita([], 'Chiama il cliente');
    expect(nuovo[0].id).toBeTruthy();
    expect(aggiungiSottoattivita([], 'Chiama il cliente')[0].id).not.toBe(nuovo[0].id);
  });
});

describe('rinominaSottoattivita', () => {
  it('cambia solo il passo indicato', () => {
    const elenco = [passo('a'), passo('b')];
    const nuovo = rinominaSottoattivita(elenco, 'b', '  Nuovo   testo ');

    expect(nuovo[1].title).toBe('Nuovo testo');
    expect(nuovo[0]).toBe(elenco[0]);
  });

  it('non cancella il passo quando si svuota il testo', () => {
    const elenco = [passo('a')];
    expect(rinominaSottoattivita(elenco, 'a', '   ')).toBe(elenco);
    expect(rinominaSottoattivita(elenco, 'a', '')).toBe(elenco);
  });

  it('non cambia niente per un id che non esiste o per lo stesso testo', () => {
    const elenco = [passo('a')];
    expect(rinominaSottoattivita(elenco, 'zzz', 'Altro')).toBe(elenco);
    expect(rinominaSottoattivita(elenco, 'a', 'Passo a')).toBe(elenco);
  });
});

describe('spuntaSottoattivita', () => {
  it('registra chi e quando quando si spunta', () => {
    const elenco = [passo('a')];
    const nuovo = spuntaSottoattivita(elenco, 'a', true, 'u1', ORA);

    expect(nuovo[0]).toEqual({
      id: 'a',
      title: 'Passo a',
      done: true,
      createdAt: ORA,
      doneAt: ORA,
      doneBy: 'u1',
    });
  });

  it('registra il quando anche senza sapere il chi', () => {
    const nuovo = spuntaSottoattivita([passo('a')], 'a', true, null, ORA);
    expect(nuovo[0].doneAt).toBe(ORA);
    expect(nuovo[0].doneBy).toBeNull();
  });

  it('despuntando toglie chi e quando', () => {
    const elenco = [passo('a', { done: true, doneAt: ORA, doneBy: 'u1' })];
    const nuovo = spuntaSottoattivita(elenco, 'a', false, 'u2', ORA);

    expect(nuovo[0].done).toBe(false);
    expect(nuovo[0].doneAt).toBeNull();
    expect(nuovo[0].doneBy).toBeNull();
  });

  it('non cambia niente se il passo e gia in quello stato', () => {
    const elenco = [passo('a', { done: true, doneAt: ORA, doneBy: 'u1' })];
    expect(spuntaSottoattivita(elenco, 'a', true, 'u2', ORA)).toBe(elenco);
    expect(spuntaSottoattivita(elenco, 'zzz', false)).toBe(elenco);
  });
});

describe('eliminaSottoattivita', () => {
  it('toglie il passo indicato e lascia gli altri intatti', () => {
    const elenco = [passo('a'), passo('b'), passo('c')];
    const nuovo = eliminaSottoattivita(elenco, 'b');

    expect(nuovo.map((p) => p.id)).toEqual(['a', 'c']);
    expect(elenco).toHaveLength(3);
  });

  it('un id che non esiste non e un errore', () => {
    const elenco = [passo('a')];
    expect(eliminaSottoattivita(elenco, 'zzz')).toBe(elenco);
  });
});

describe('spostaSottoattivita', () => {
  const elenco = [passo('a'), passo('b'), passo('c')];

  it('sposta in su e in giu', () => {
    expect(spostaSottoattivita(elenco, 2, 1).map((p) => p.id)).toEqual(['a', 'c', 'b']);
    expect(spostaSottoattivita(elenco, 0, 2).map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('non modifica l elenco ricevuto', () => {
    spostaSottoattivita(elenco, 0, 2);
    expect(elenco.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  /**
   * Fuori dai limiti non si avvicina al bordo: chi chiede di salire sopra il
   * primo sta premendo un pulsante che non doveva essere premibile, e
   * riordinare comunque sarebbe la sorpresa peggiore.
   */
  it('non fa niente per indici fuori dai limiti', () => {
    expect(spostaSottoattivita(elenco, -1, 0)).toBe(elenco);
    expect(spostaSottoattivita(elenco, 0, -1)).toBe(elenco);
    expect(spostaSottoattivita(elenco, 3, 0)).toBe(elenco);
    expect(spostaSottoattivita(elenco, 0, 3)).toBe(elenco);
    expect(spostaSottoattivita(elenco, 0.5, 1)).toBe(elenco);
    expect(spostaSottoattivita([], 0, 0)).toEqual([]);
  });

  it('non fa niente se la posizione e la stessa', () => {
    expect(spostaSottoattivita(elenco, 1, 1)).toBe(elenco);
  });
});
