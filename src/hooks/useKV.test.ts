import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Verifica del RAGGRUPPAMENTO delle letture.
 *
 * Non ci sono credenziali per guardare le richieste nel pannello di rete del
 * browser, quindi il conteggio si fa qui: il client Supabase e' sostituito da
 * un finto che registra ogni `select` con la tabella e le chiavi chieste. I
 * componenti vengono montati per davvero con react-dom, cosi' il test misura
 * quello che succede in un commit vero di React (e' li' che nasceva il
 * problema: gli effetti di tutti i `useKV` montati insieme girano nello stesso
 * task) e non una simulazione di comodo.
 */

interface Select {
  table: string;
  scopeColumn: string;
  scopeId: string;
  keys: string[];
}

const selects: Select[] = [];
const upserts: { table: string; key: string; value: unknown }[] = [];
/** Righe che il finto server contiene, per tabella e chiave. */
const righe = new Map<string, unknown>();

function rowKey(table: string, key: string) {
  return `${table}/${key}`;
}

function creaBuilder(table: string) {
  const stato = { scopeColumn: '', scopeId: '' };

  const builder = {
    select() {
      return builder;
    },
    eq(colonna: string, valore: string) {
      stato.scopeColumn = colonna;
      stato.scopeId = valore;
      return builder;
    },
    in(_colonna: string, keys: string[]) {
      selects.push({ table, ...stato, keys: [...keys] });
      const data = keys
        .filter((k) => righe.has(rowKey(table, k)))
        .map((k) => ({ key: k, value: righe.get(rowKey(table, k)) }));
      return Promise.resolve({ data, error: null });
    },
    upsert(riga: { key: string; value: unknown }) {
      upserts.push({ table, key: riga.key, value: riga.value });
      righe.set(rowKey(table, riga.key), riga.value);
      return Promise.resolve({ error: null });
    },
  };

  return builder;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => creaBuilder(table),
    // I canali realtime non c'entrano con il conteggio delle richieste, ma
    // useKV ne apre uno per scope: senza questi finti il mount lancia.
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: () => Promise.resolve('ok'),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'utente-1' }, organization: { id: 'org-1' } }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { useKV, resetKVCache } = await import('./useKV');

/** Componente minimo che monta una sola chiave e non disegna nulla. */
function Sonda({ chiave, iniziale }: { chiave: string; iniziale: unknown }) {
  useKV(chiave, iniziale);
  return null;
}

let container: HTMLDivElement;
let root: Root;

async function monta(children: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(children);
  });
  // Il batch parte in un microtask e la risposta e' gia' risolta: un secondo
  // giro di act lascia arrivare gli aggiornamenti di stato conseguenti.
  await act(async () => {});
}

/** Lascia scadere il debounce di scrittura (400 ms) e arrivare il salvataggio. */
async function attendiFlush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  selects.length = 0;
  upserts.length = 0;
  righe.clear();
  resetKVCache();
  vi.useRealTimers();
});

// Ogni test smonta cio' che ha montato: senza, i componenti dei test
// precedenti restano iscritti allo store di modulo e reagiscono ai broadcast
// dei test successivi.
afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
});

describe('useKV — letture raggruppate', () => {
  it('monta otto chiavi insieme e parte UNA sola richiesta', async () => {
    const chiavi = [
      'tasks',
      'employees',
      'departments',
      'activities',
      'notifications',
      'email-templates',
      'app-settings',
      'custom-fields',
    ];

    await monta(
      createElement(
        'div',
        null,
        chiavi.map((k) => createElement(Sonda, { key: k, chiave: k, iniziale: [] }))
      )
    );

    // Prima: una select per chiave, cioe' otto round trip in fila.
    expect(selects).toHaveLength(1);
    expect(selects[0].table).toBe('app_state');
    expect(selects[0].scopeColumn).toBe('organization_id');
    expect(selects[0].keys.sort()).toEqual([...chiavi].sort());
  });

  it('separa le chiavi per-utente da quelle dell organizzazione', async () => {
    await monta(
      createElement(
        'div',
        null,
        createElement(Sonda, { key: 'a', chiave: 'tasks', iniziale: [] }),
        createElement(Sonda, { key: 'b', chiave: 'lingua', iniziale: 'it' }),
        createElement(Sonda, {
          key: 'c',
          chiave: 'notification-preferences-utente-1',
          iniziale: {},
        })
      )
    );

    // Due richieste e non tre: tabelle e colonna di filtro diverse rendono
    // impossibile un unico `in (...)`, ma dentro ogni tabella si raggruppa.
    expect(selects).toHaveLength(2);

    const org = selects.find((s) => s.table === 'app_state')!;
    const utente = selects.find((s) => s.table === 'user_state')!;

    expect(org.keys).toEqual(['tasks']);
    expect(utente.scopeColumn).toBe('user_id');
    expect(utente.scopeId).toBe('utente-1');
    expect(utente.keys.sort()).toEqual(['lingua', 'notification-preferences-utente-1']);
  });

  it('due componenti sulla stessa chiave leggono una volta sola', async () => {
    righe.set(rowKey('app_state', 'employees'), [{ id: 'e1' }]);

    await monta(
      createElement(
        'div',
        null,
        // E' il caso reale: `employees` montata da App.tsx e da
        // useSyncEmployees nello stesso commit.
        createElement(Sonda, { key: '1', chiave: 'employees', iniziale: [] }),
        createElement(Sonda, { key: '2', chiave: 'employees', iniziale: [] })
      )
    );

    expect(selects).toHaveLength(1);
    expect(selects[0].keys).toEqual(['employees']);
  });

  it('una chiave assente dal risultato non e un errore: caricato diventa true', async () => {
    righe.set(rowKey('app_state', 'tasks'), [{ id: 't1' }]);

    let statoPresente: [unknown, boolean] | null = null;
    let statoAssente: [unknown, boolean] | null = null;

    function Lettore() {
      const [presente, , , caricatoPresente] = useKV('tasks', []);
      const [assente, , , caricatoAssente] = useKV('email-templates', ['default']);
      statoPresente = [presente, caricatoPresente];
      statoAssente = [assente, caricatoAssente];
      return null;
    }

    await monta(createElement(Lettore));

    // La chiave che esiste arriva dal server...
    expect(statoPresente).toEqual([[{ id: 't1' }], true]);
    // ...e quella che non esiste tiene il valore iniziale, ma `caricato` e'
    // comunque true: e' il flag che impedisce a EmailTemplateCustomization di
    // seminare i modelli prima della risposta, sovrascrivendo quelli veri.
    expect(statoAssente).toEqual([['default'], true]);
    // Riga assente significa "non esiste", non "va creata".
    expect(upserts).toHaveLength(0);
  });
});

describe('useKV — scritture', () => {
  it('non accoda nulla se il valore non cambia', async () => {
    const esistenti = [{ id: 'e1', name: 'Anna' }];
    righe.set(rowKey('app_state', 'employees'), esistenti);

    let scrivi: ((v: unknown) => void) | null = null;
    function Lettore() {
      const [, set] = useKV('employees', []);
      scrivi = set as (v: unknown) => void;
      return null;
    }

    await monta(createElement(Lettore));
    const selectDopoIlCaricamento = selects.length;

    // E' letteralmente cio' che fa useSyncEmployees quando non c'e' nulla da
    // sincronizzare: restituisce l'array che ha ricevuto.
    await act(async () => {
      scrivi!((current: unknown) => current);
    });
    // ...e anche una sostituzione con un valore strutturalmente identico.
    await act(async () => {
      scrivi!([{ id: 'e1', name: 'Anna' }]);
    });

    await attendiFlush();

    expect(upserts).toHaveLength(0);
    // Nemmeno la SELECT di riconciliazione del flush deve partire.
    expect(selects).toHaveLength(selectDopoIlCaricamento);
  });

  it('una modifica vera viene salvata, riapplicando l operazione sul valore del server', async () => {
    righe.set(rowKey('app_state', 'tasks'), [{ id: 't1' }]);

    let scrivi: ((v: unknown) => void) | null = null;
    function Lettore() {
      const [, set] = useKV<{ id: string }[]>('tasks', []);
      scrivi = set as (v: unknown) => void;
      return null;
    }

    await monta(createElement(Lettore));

    // Nel frattempo un'altra scheda ha aggiunto t2: l'operazione in coda deve
    // essere riapplicata a QUESTO valore, non alla copia in memoria.
    righe.set(rowKey('app_state', 'tasks'), [{ id: 't1' }, { id: 't2' }]);

    await act(async () => {
      scrivi!((current: { id: string }[]) => [...(current ?? []), { id: 't3' }]);
    });

    await attendiFlush();

    expect(upserts).toHaveLength(1);
    expect(upserts[0].value).toEqual([{ id: 't1' }, { id: 't2' }, { id: 't3' }]);
  });
});
