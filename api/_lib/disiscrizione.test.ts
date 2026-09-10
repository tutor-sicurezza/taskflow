import { describe, it, expect, beforeAll } from 'vitest';
import { creaGettone, verificaGettone, collegamentoDisiscrizione } from './disiscrizione.js';

/**
 * Il gettone di disiscrizione e' l'unica cosa che separa "spegni le mie email"
 * da "spegni quelle di un collega": senza firma basterebbe cambiare una cifra
 * nell'indirizzo. I test guardano proprio quel confine.
 */
beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'segreto-di-prova-non-reale';
});

describe('gettone di disiscrizione', () => {
  it('riconosce un gettone che ha prodotto lui', async () => {
    const g = await creaGettone('utente-1');
    expect(g).not.toBeNull();
    expect(await verificaGettone(g!)).toBe('utente-1');
  });

  it('rifiuta il gettone di un altro utente con la stessa firma', async () => {
    const g = await creaGettone('utente-1');
    const manomesso = g!.replace('utente-1', 'utente-2');
    expect(await verificaGettone(manomesso)).toBeNull();
  });

  it('rifiuta una firma alterata', async () => {
    const g = await creaGettone('utente-1');
    const i = g!.lastIndexOf('.');
    const firma = g!.slice(i + 1);
    const alterata = (firma[0] === 'A' ? 'B' : 'A') + firma.slice(1);
    expect(await verificaGettone(`${g!.slice(0, i)}.${alterata}`)).toBeNull();
  });

  it('rifiuta forme prive di firma', async () => {
    for (const brutto of ['', 'utente-1', '.firma', 'utente-1.', 'a.b.c']) {
      expect(await verificaGettone(brutto)).toBeNull();
    }
  });

  it('produce gettoni diversi per utenti diversi', async () => {
    expect(await creaGettone('a')).not.toBe(await creaGettone('b'));
  });

  it('costruisce il collegamento, e nulla senza origine o utente', async () => {
    const url = await collegamentoDisiscrizione('https://esempio.test/', 'utente-1');
    expect(url).toMatch(/^https:\/\/esempio\.test\/api\/email\/disiscrivi\?g=/);
    expect(url).not.toContain('//api');
    expect(await collegamentoDisiscrizione(undefined, 'utente-1')).toBeNull();
    expect(await collegamentoDisiscrizione('https://esempio.test', null)).toBeNull();
  });
});
