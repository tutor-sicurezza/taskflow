import { describe, it, expect } from 'vitest';
import {
  descriviFiltro, filtroValido, nomeSuggerito, stessoFiltro, type Filtro,
} from '@/lib/filtriSalvati';
import type { Employee } from '@/lib/types';

/** Un dipendente ridotto all'osso: qui contano solo id e nome. */
const dip = (id: string, name: string) => ({ id, name }) as Employee;

const SQUADRA: Employee[] = [dip('u1', 'Anna Rossi'), dip('u2', 'Marco Bianchi')];

/**
 * I test parlano inglese perche' in inglese la CHIAVE e' gia' il testo (vedi
 * `traduzioni.ts`): cosi' verificano come i pezzi vengono scelti e composti,
 * non cosa c'e' scritto nel dizionario italiano — che puo' cambiare senza che
 * questo modulo abbia sbagliato niente.
 */
const LINGUA = 'en';

const filtro = (parti: Partial<Filtro> = {}): Filtro =>
  ({ id: 'f1', nome: 'Vista', ...parti });

describe('filtroValido', () => {
  /**
   * I filtri arrivano da una colonna JSONB: quello che torna non e' garantito
   * essere quello che ci abbiamo scritto. Nessuno di questi casi deve lanciare.
   */
  it('rifiuta tutto cio che non e un filtro, senza lanciare', () => {
    expect(filtroValido(null)).toBeNull();
    expect(filtroValido(undefined)).toBeNull();
    expect(filtroValido('in ritardo')).toBeNull();
    expect(filtroValido(42)).toBeNull();
    expect(filtroValido([])).toBeNull();
    expect(filtroValido([{ id: 'f1', nome: 'Vista' }])).toBeNull();
  });

  it('rifiuta un oggetto senza id o senza nome', () => {
    expect(filtroValido({ nome: 'Vista' })).toBeNull();
    expect(filtroValido({ id: 'f1' })).toBeNull();
    // Un nome fatto di soli spazi non e' un nome: sarebbe una riga vuota
    // nell'elenco, impossibile da distinguere dalle altre.
    expect(filtroValido({ id: 'f1', nome: '   ' })).toBeNull();
    expect(filtroValido({ id: 42, nome: 'Vista' })).toBeNull();
  });

  it('scarta i singoli campi di tipo sbagliato e tiene il resto', () => {
    // Un campo corrotto non deve portarsi via anche quelli buoni: il filtro
    // resta usabile, solo un po piu largo.
    const risultato = filtroValido({
      id: 'f1',
      nome: 'Vista',
      stato: 'in-progress',
      priorita: 42,
      reparto: null,
      assegnatario: { id: 'u1' },
      ricerca: ['a'],
    });

    expect(risultato).toEqual({ id: 'f1', nome: 'Vista', stato: 'in-progress' });
  });

  it('accetta un filtro completo e ne restituisce una copia normalizzata', () => {
    const risultato = filtroValido({
      id: ' f1 ',
      nome: ' In ritardo ',
      stato: 'not-started',
      priorita: 'high',
      reparto: 'Tecnico',
      assegnatario: 'unassigned',
      ordine: 'dueDate',
      ricerca: 'server',
    });

    expect(risultato).toEqual({
      id: 'f1',
      nome: 'In ritardo',
      stato: 'not-started',
      priorita: 'high',
      reparto: 'Tecnico',
      assegnatario: 'unassigned',
      ordine: 'dueDate',
      ricerca: 'server',
    });
  });

  it('non si porta dietro chiavi estranee', () => {
    const risultato = filtroValido({ id: 'f1', nome: 'Vista', altro: 'y', 42: 'z' });
    expect(risultato).toEqual({ id: 'f1', nome: 'Vista' });
  });
});

describe('stessoFiltro', () => {
  /**
   * Il punto delicato di tutto il modulo: per l'utente "nessun filtro" e
   * "filtro su tutti" sono la stessa cosa. Se non lo fossero anche qui,
   * l'interfaccia proporrebbe di salvare un doppione di quello gia' attivo.
   */
  it('tratta campo assente e campo a "all" come la stessa cosa', () => {
    const salvato = filtro({ stato: 'in-progress' });

    expect(stessoFiltro(salvato, { stato: 'in-progress' })).toBe(true);
    expect(stessoFiltro(salvato, {
      stato: 'in-progress',
      priorita: 'all',
      reparto: 'all',
      assegnatario: 'all',
    })).toBe(true);

    // E nella direzione opposta: 'all' salvato contro campi assenti.
    expect(stessoFiltro(filtro({ stato: 'all', priorita: 'all' }), {})).toBe(true);
  });

  it('considera vuota una ricerca fatta di spazi', () => {
    expect(stessoFiltro(filtro(), { ricerca: '   ' })).toBe(true);
    expect(stessoFiltro(filtro({ ricerca: ' server ' }), { ricerca: 'server' })).toBe(true);
  });

  it('distingue i filtri che mostrano lavoro diverso', () => {
    expect(stessoFiltro(filtro({ stato: 'completed' }), { stato: 'in-progress' })).toBe(false);
    // 'unassigned' e' un filtro vero, non un "tutti": non deve sparire.
    expect(stessoFiltro(filtro({ assegnatario: 'unassigned' }), {})).toBe(false);
    expect(stessoFiltro(filtro({ ordine: 'priority' }), { ordine: 'dueDate' })).toBe(false);
  });

  it('ignora id e nome: conta cosa mostrano, non come si chiamano', () => {
    const a = filtro({ id: 'f1', nome: 'I miei', stato: 'completed' });
    expect(stessoFiltro(a, { id: 'f9', nome: 'Altro nome', stato: 'completed' })).toBe(true);
  });
});

describe('nomeSuggerito', () => {
  it('senza filtri attivi propone la vista completa', () => {
    expect(nomeSuggerito({}, SQUADRA, LINGUA)).toBe('All tasks');
    expect(nomeSuggerito({ stato: 'all', priorita: 'all' }, SQUADRA, LINGUA)).toBe('All tasks');
  });

  it('con un solo filtro il nome e quel filtro', () => {
    expect(nomeSuggerito({ stato: 'in-progress' }, SQUADRA, LINGUA)).toBe('In Progress');
    expect(nomeSuggerito({ assegnatario: 'u1' }, SQUADRA, LINGUA)).toBe('Anna Rossi');
  });

  it('con molti filtri si ferma a tre pezzi e conta i restanti', () => {
    // Oltre tre, il nome smetterebbe di essere leggibile a colpo d'occhio.
    const nome = nomeSuggerito(
      {
        stato: 'not-started',
        priorita: 'high',
        reparto: 'Tecnico',
        assegnatario: 'unassigned',
        ricerca: 'server',
      },
      SQUADRA,
      LINGUA
    );

    expect(nome).toBe('Not Started · High priority · Tecnico +2');
  });

  it('non mette l ordinamento nel nome', () => {
    // Ordinare per scadenza non distingue una vista da un altra: nel nome
    // occuperebbe spazio senza dire niente.
    expect(nomeSuggerito({ stato: 'completed', ordine: 'priority' }, SQUADRA, LINGUA))
      .toBe('Completed');
  });
});

describe('descriviFiltro', () => {
  it('mette insieme i pezzi, ordinamento compreso', () => {
    const descrizione = descriviFiltro(
      filtro({ stato: 'in-progress', assegnatario: 'u2', ordine: 'dueDate' }),
      SQUADRA,
      LINGUA
    );

    expect(descrizione).toBe('In Progress · Marco Bianchi · By due date');
  });

  it('dice che la persona non c e piu invece di mostrare un id', () => {
    // Chi lascia l'azienda sparisce dai dipendenti ma resta nei filtri salvati
    // mesi prima: senza questa frase il filtro sembrerebbe rotto senza motivo.
    const descrizione = descriviFiltro(filtro({ assegnatario: 'u-sparito' }), SQUADRA, LINGUA);

    expect(descrizione).not.toContain('u-sparito');
    expect(descrizione).toBe('Removed member');
  });

  it('senza alcun filtro descrive la vista completa', () => {
    expect(descriviFiltro(filtro(), SQUADRA, LINGUA)).toBe('All tasks');
    expect(descriviFiltro(filtro({ reparto: 'all' }), SQUADRA, LINGUA)).toBe('All tasks');
  });

  it('mostra tale e quale un valore che non conosce', () => {
    // Uno stato aggiunto in futuro non deve rendere il filtro invisibile.
    expect(descriviFiltro(filtro({ stato: 'archiviato' }), SQUADRA, LINGUA)).toBe('archiviato');
  });

  it('include il testo cercato', () => {
    expect(descriviFiltro(filtro({ ricerca: 'server' }), SQUADRA, LINGUA)).toContain('server');
  });
});
