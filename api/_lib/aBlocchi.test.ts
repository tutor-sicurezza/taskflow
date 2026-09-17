import { describe, it, expect } from 'vitest';
import { aBlocchi, DIMENSIONE_BLOCCO, perBlocchi } from './aBlocchi.js';

describe('aBlocchi', () => {
  it('non produce nessun blocco per un elenco vuoto', () => {
    // Conta: un blocco vuoto diventerebbe `in ()`, che e' una query rotta.
    expect(aBlocchi([])).toEqual([]);
  });

  it('lascia intero un elenco che ci sta', () => {
    expect(aBlocchi([1, 2, 3])).toEqual([[1, 2, 3]]);
  });

  it("spezza e non perde ne' duplica nulla", () => {
    const elementi = Array.from({ length: 250 }, (_, i) => i);
    const blocchi = aBlocchi(elementi);

    expect(blocchi).toHaveLength(3);
    expect(blocchi.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(blocchi.flat()).toEqual(elementi);
  });

  it('un elenco esattamente lungo come il blocco resta uno solo', () => {
    expect(aBlocchi(Array.from({ length: DIMENSIONE_BLOCCO }, (_, i) => i))).toHaveLength(1);
  });
});

describe('perBlocchi', () => {
  it('chiama una volta per blocco e unisce i risultati', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const visti: number[] = [];

    const esito = await perBlocchi(ids, (blocco) => {
      visti.push(blocco.length);
      return Promise.resolve({ data: blocco.map((id) => ({ id })), error: null });
    });

    expect(visti).toEqual([100, 100, 50]);
    expect(esito.error).toBeNull();
    expect(esito.data).toHaveLength(250);
  });

  it("non chiama affatto se non c'e' niente da fare", async () => {
    let chiamate = 0;
    const esito = await perBlocchi([], () => {
      chiamate += 1;
      return Promise.resolve({ data: [], error: null });
    });

    expect(chiamate).toBe(0);
    expect(esito.data).toEqual([]);
  });

  it("si ferma al primo errore e restituisce cio' che aveva gia' raccolto", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    let chiamate = 0;

    const esito = await perBlocchi(ids, (blocco) => {
      chiamate += 1;
      if (chiamate === 2) return Promise.resolve({ data: null, error: { message: 'troppo lungo' } });
      return Promise.resolve({ data: blocco.map((id) => ({ id })), error: null });
    });

    // Il terzo blocco non viene nemmeno tentato.
    expect(chiamate).toBe(2);
    expect(esito.error).toBe('troppo lungo');
    // Ma il primo era lavoro fatto, e non si butta via.
    expect(esito.data).toHaveLength(100);
  });
});
