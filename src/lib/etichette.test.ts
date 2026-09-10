import { describe, it, expect } from 'vitest';
import {
  normalizzaEtichetta,
  etichetteUsate,
  suggerisci,
  coloreEtichetta,
  MAX_LUNGHEZZA_ETICHETTA,
} from '@/lib/etichette';
import type { Task } from '@/lib/types';

/**
 * Il valore di questo modulo sta tutto nella coerenza fra creazione,
 * suggerimento e filtro: se le tre strade normalizzassero in modo diverso, il
 * filtro mostrerebbe meno task di quelli etichettati e nessuno capirebbe
 * perche'. Questi test fissano quella coerenza, non l'implementazione.
 */

function task(labels?: string[]): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Task',
    description: '',
    status: 'not-started',
    priority: 'medium',
    assigneeId: null,
    dueDate: '2025-01-01',
    createdAt: '2025-01-01',
    labels,
  } as Task;
}

describe('normalizzaEtichetta', () => {
  it('toglie gli spazi ai bordi', () => {
    expect(normalizzaEtichetta('  cliente  ')).toBe('cliente');
  });

  it('comprime gli spazi interni, tabulazioni e a capo compresi', () => {
    expect(normalizzaEtichetta('richiesta   cliente')).toBe('richiesta cliente');
    expect(normalizzaEtichetta('richiesta\t\ncliente')).toBe('richiesta cliente');
  });

  it('abbassa le maiuscole, cosi\' "Urgente" e "urgente" sono la stessa cosa', () => {
    expect(normalizzaEtichetta('URGENTE')).toBe('urgente');
    expect(normalizzaEtichetta('Urgente')).toBe(normalizzaEtichetta('urgente'));
  });

  it('taglia alla lunghezza massima senza lasciare uno spazio in coda', () => {
    const lunga = 'a'.repeat(MAX_LUNGHEZZA_ETICHETTA + 20);
    expect(normalizzaEtichetta(lunga)).toHaveLength(MAX_LUNGHEZZA_ETICHETTA);

    const conSpazio = `${'a'.repeat(MAX_LUNGHEZZA_ETICHETTA - 1)} coda`;
    expect(normalizzaEtichetta(conSpazio)).toBe('a'.repeat(MAX_LUNGHEZZA_ETICHETTA - 1));
  });

  it('restituisce stringa vuota per un testo fatto di soli spazi', () => {
    expect(normalizzaEtichetta('   ')).toBe('');
    expect(normalizzaEtichetta('')).toBe('');
  });
});

describe('etichetteUsate', () => {
  it('conta le etichette e le ordina dalla piu\' usata', () => {
    const tasks = [
      task(['cliente', 'urgente']),
      task(['cliente']),
      task(['cliente', 'manutenzione']),
      task(['urgente']),
    ];

    expect(etichetteUsate(tasks)).toEqual([
      { etichetta: 'cliente', quante: 3 },
      { etichetta: 'urgente', quante: 2 },
      { etichetta: 'manutenzione', quante: 1 },
    ]);
  });

  it('unisce le varianti di maiuscole e spazi in una sola voce', () => {
    const tasks = [task(['Urgente']), task(['  urgente ']), task(['URGENTE'])];
    expect(etichetteUsate(tasks)).toEqual([{ etichetta: 'urgente', quante: 3 }]);
  });

  it('non conta due volte un doppione dentro lo stesso task', () => {
    expect(etichetteUsate([task(['Urgente', 'urgente'])])).toEqual([
      { etichetta: 'urgente', quante: 1 },
    ]);
  });

  it('a parita\' di frequenza ordina alfabeticamente, per non cambiare ordine ad ogni render', () => {
    const tasks = [task(['zeta', 'alfa'])];
    expect(etichetteUsate(tasks).map((v) => v.etichetta)).toEqual(['alfa', 'zeta']);
  });

  it('ignora task senza etichette e valori vuoti', () => {
    expect(etichetteUsate([task(), task([]), task(['  ', 'cliente'])])).toEqual([
      { etichetta: 'cliente', quante: 1 },
    ]);
  });

  it('regge un elenco vuoto', () => {
    expect(etichetteUsate([])).toEqual([]);
  });
});

describe('suggerisci', () => {
  const esistenti = ['cliente', 'richiesta cliente', 'manutenzione', 'urgente'];

  it('a campo vuoto propone comunque le esistenti, nell\'ordine ricevuto', () => {
    expect(suggerisci('', esistenti, [])).toEqual(esistenti);
  });

  it('filtra su quello che si sta scrivendo', () => {
    expect(suggerisci('manu', esistenti, [])).toEqual(['manutenzione']);
  });

  it('mette prima chi corrisponde dall\'inizio, poi chi corrisponde in mezzo', () => {
    expect(suggerisci('cli', esistenti, [])).toEqual(['cliente', 'richiesta cliente']);
  });

  it('esclude le etichette gia\' scelte', () => {
    expect(suggerisci('cli', esistenti, ['cliente'])).toEqual(['richiesta cliente']);
    expect(suggerisci('', esistenti, ['cliente', 'urgente'])).toEqual([
      'richiesta cliente',
      'manutenzione',
    ]);
  });

  it('confronta le gia\' scelte in forma normalizzata', () => {
    expect(suggerisci('urg', esistenti, ['  URGENTE '])).toEqual([]);
  });

  it('normalizza anche il parziale, cosi\' scrivere in maiuscolo trova comunque', () => {
    expect(suggerisci('  CLI ', esistenti, [])).toEqual(['cliente', 'richiesta cliente']);
  });

  it('non ripete la stessa etichetta se le esistenti contengono varianti', () => {
    expect(suggerisci('', ['Cliente', 'cliente', 'CLIENTE'], [])).toEqual(['cliente']);
  });

  it('restituisce elenco vuoto se non c\'e\' nulla di simile', () => {
    expect(suggerisci('xyz', esistenti, [])).toEqual([]);
  });
});

describe('coloreEtichetta', () => {
  it('da\' lo stesso colore alla stessa etichetta', () => {
    expect(coloreEtichetta('cliente')).toBe(coloreEtichetta('cliente'));
  });

  it('ignora maiuscole e spazi, come il resto del modulo', () => {
    expect(coloreEtichetta('  Cliente ')).toBe(coloreEtichetta('cliente'));
  });

  it('usa i token del tema e mai colori scritti a mano', () => {
    const parole = ['cliente', 'urgente', 'manutenzione', 'adempimento', 'fornitore', 'x'];
    for (const parola of parole) {
      expect(coloreEtichetta(parola)).toMatch(/^bg-chart-[1-5]\/15 border-chart-[1-5]\/50 text-foreground$/);
    }
  });

  it('distribuisce le tinte invece di darle tutte uguali', () => {
    const tinte = new Set(
      ['cliente', 'urgente', 'manutenzione', 'adempimento', 'fornitore', 'contratto', 'bug'].map(
        coloreEtichetta
      )
    );
    expect(tinte.size).toBeGreaterThan(1);
  });

  it('non lancia su testo vuoto', () => {
    expect(typeof coloreEtichetta('')).toBe('string');
  });
});
