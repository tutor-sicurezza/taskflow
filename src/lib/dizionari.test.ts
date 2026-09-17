/**
 * L'allineamento delle cinque lingue, misurato sugli OGGETTI e non sul testo.
 *
 * Questo file nasce da un errore ripetuto tre volte nello stesso pomeriggio.
 * La domanda era «quante voci mancano all'italiano»; la risposta, data con
 * sicurezza, e' stata prima 1.359, poi 976, poi 51. Tutte e tre sbagliate, e
 * tutte e tre per lo stesso motivo: erano ottenute leggendo i sorgenti con
 * espressioni regolari.
 *
 *   - la prima ignorava che `TESTI_IT` unisce cinque oggetti da file diversi,
 *     e contava solo le voci scritte in `traduzioni.ts`;
 *   - la seconda ignorava le chiavi semantiche, che in italiano stanno in
 *     `i18n.ts` e non nei dizionari;
 *   - la terza usava una regex che riconosceva solo le chiavi fra apici
 *     singoli, e quindi non vedeva le dodici scritte fra virgolette doppie
 *     perche' contengono un apostrofo.
 *
 * La risposta vera e' **zero**: ogni chiave che l'interfaccia chiede e' nota a
 * tutte le lingue. Ma il punto non e' il numero, e' il metodo: qui si
 * importano gli oggetti gia' costruiti dal compilatore, che non puo'
 * sbagliarsi su cosa contengono.
 */

import { describe, expect, it } from 'vitest';
import { SEMANTICHE_EN, SEMANTICHE_IT } from '@/lib/i18n';
import { PARTE_GENERALE, TESTI_EN_EXTRA, TESTI_IT } from '@/lib/traduzioni';
import { PARTE_2 } from '@/lib/traduzioni-2';
import { PARTE_3 } from '@/lib/traduzioni-3';
import { PARTE_4 } from '@/lib/traduzioni-4';
import { PARTE_5 } from '@/lib/traduzioni-5';
import { TESTI_DE } from '@/lib/traduzioni-de';
import { TESTI_ES } from '@/lib/traduzioni-es';
import { TESTI_FR } from '@/lib/traduzioni-fr';

const PARTI_ITALIANE = { PARTE_2, PARTE_3, PARTE_4, PARTE_5, PARTE_GENERALE };

/** Tutto cio' che l'italiano sa dire: i dizionari piu' le chiavi semantiche. */
const ITALIANO = new Set([...Object.keys(TESTI_IT), ...Object.keys(SEMANTICHE_IT)]);

/*
  I testi scritti in italiano nel codice (`'Accesso revocato e membro rimosso'`)
  usano la frase italiana COME chiave: per l'italiano il ripiego sulla chiave
  da' gia' la risposta giusta, e una voce di dizionario sarebbe una ripetizione.
  Sono l'unica eccezione legittima, e si riconoscono da sole: stanno in
  `TESTI_EN_EXTRA`, che esiste apposta per dare a quelle frasi l'inglese.
*/
const SCRITTE_IN_ITALIANO = new Set(Object.keys(TESTI_EN_EXTRA));

const ALTRE_LINGUE = { fr: TESTI_FR, de: TESTI_DE, es: TESTI_ES };

describe('le parti del dizionario italiano', () => {
  it('non ripetono nessuna chiave fra loro', () => {
    const visto = new Map<string, string>();
    const doppioni: string[] = [];
    for (const [nome, parte] of Object.entries(PARTI_ITALIANE)) {
      for (const chiave of Object.keys(parte)) {
        const primo = visto.get(chiave);
        if (primo) doppioni.push(`'${chiave}' in ${primo} e in ${nome}`);
        else visto.set(chiave, nome);
      }
    }
    // Un doppione non si vede a schermo — vince l'ultima parte unita, e finora
    // avevano tutti lo stesso valore — ma e' un secondo posto in cui sbagliare,
    // e nasconde la voce vera a chi cerca con un grep.
    expect(doppioni).toEqual([]);
  });

  it('sommate danno esattamente le chiavi di TESTI_IT', () => {
    const somma = Object.values(PARTI_ITALIANE).reduce(
      (n, parte) => n + Object.keys(parte).length,
      0
    );
    // Vale solo se non ci sono doppioni: e' la controprova del test qui sopra.
    expect(Object.keys(TESTI_IT)).toHaveLength(somma);
  });

  it('non lascia nessuna voce vuota', () => {
    const vuote = Object.entries(TESTI_IT)
      .filter(([, v]) => !v || !v.trim())
      .map(([k]) => k);
    expect(vuote).toEqual([]);
  });
});

describe('allineamento fra le lingue', () => {
  for (const [lingua, dizionario] of Object.entries(ALTRE_LINGUE)) {
    it(`${lingua}: nessuna chiave che l italiano non conosca`, () => {
      const orfane = Object.keys(dizionario).filter(
        (chiave) => !ITALIANO.has(chiave) && !SCRITTE_IN_ITALIANO.has(chiave)
      );
      expect(orfane).toEqual([]);
    });

    it(`${lingua}: conosce tutto cio che conosce l italiano`, () => {
      const noto = new Set([...Object.keys(dizionario), ...Object.keys(SEMANTICHE_EN)]);
      const mancanti = [...ITALIANO].filter(
        (chiave) => !noto.has(chiave) && !SCRITTE_IN_ITALIANO.has(chiave)
      );
      expect(mancanti).toEqual([]);
    });

    it(`${lingua}: non lascia nessuna voce vuota`, () => {
      const vuote = Object.entries(dizionario)
        .filter(([, v]) => !v || !v.trim())
        .map(([k]) => k);
      expect(vuote).toEqual([]);
    });
  }

  it('le tre lingue caricate a richiesta hanno lo stesso insieme di chiavi', () => {
    const [fr, de, es] = [TESTI_FR, TESTI_DE, TESTI_ES].map((d) => Object.keys(d).sort());
    expect(de).toEqual(fr);
    expect(es).toEqual(fr);
  });
});
