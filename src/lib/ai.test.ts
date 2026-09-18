/**
 * Quando una risposta "riuscita" non lo e' davvero.
 *
 * Il file dichiara in testa che i chiamanti possono fare `JSON.parse` sul
 * risultato senza precauzioni. Quella promessa reggeva finche' il server
 * rispondeva come previsto; con un 200 il cui corpo non ha `text` — oppure non
 * e' JSON affatto, che il `.catch` in `ask` trasforma in `{}` — la funzione
 * restituiva `undefined`, e a schermo arrivava `"undefined" is not valid JSON`.
 *
 * Non e' un caso di laboratorio: lo danno una pagina di protezione del deploy,
 * un `api/` non pubblicato, un proxy che intercetta. Tutti rispondono 200 con
 * dell'HTML.
 */
import { describe, expect, it } from 'vitest';
import { testoDaRisposta } from '@/lib/ai';

describe('testoDaRisposta', () => {
  it('restituisce il testo quando c e', () => {
    expect(testoDaRisposta({ text: '{"insights":[]}' })).toBe('{"insights":[]}');
    // Gli spazi intorno si conservano: chi chiama fa JSON.parse, che li
    // ignora, e troncarli sarebbe una modifica non richiesta del contenuto.
    expect(testoDaRisposta({ text: '  {"a":1}  ' })).toBe('  {"a":1}  ');
  });

  it('rifiuta un 200 senza il campo, che e il caso che faceva il danno', () => {
    expect(testoDaRisposta({})).toBeNull();
    expect(testoDaRisposta({ risultato: 'altro' })).toBeNull();
  });

  it('rifiuta un campo che non e una stringa', () => {
    expect(testoDaRisposta({ text: null })).toBeNull();
    expect(testoDaRisposta({ text: 42 })).toBeNull();
    expect(testoDaRisposta({ text: { annidato: true } })).toBeNull();
  });

  it('rifiuta il vuoto: JSON.parse esplode su "" come su undefined', () => {
    expect(testoDaRisposta({ text: '' })).toBeNull();
    expect(testoDaRisposta({ text: '   \n  ' })).toBeNull();
  });

  it('rifiuta un corpo che non e un oggetto', () => {
    // `{}` e' cio' che `ask` mette al posto di un corpo non JSON: l'HTML di una
    // pagina di protezione arriva esattamente cosi'.
    expect(testoDaRisposta(null)).toBeNull();
    expect(testoDaRisposta(undefined)).toBeNull();
    expect(testoDaRisposta('<!doctype html>')).toBeNull();
    expect(testoDaRisposta(['testo'])).toBeNull();
  });
});
