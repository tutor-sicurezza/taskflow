/**
 * Le due scale chiuse: parola tradotta e contrasto sufficiente.
 *
 * Il difetto che ha prodotto questo file si vedeva solo a schermo, e solo se
 * si guardava con la lingua giusta: `task.priority.toUpperCase()` produce
 * "HIGH" per tutti, italiani compresi, e `tsc` non ha niente da ridire perche'
 * e' una stringa valida.
 *
 * Qui si verificano tre cose che nessun type-check puo' vedere:
 *   1. ogni valore della scala ha una chiave che i dizionari conoscono;
 *   2. ogni chiave e' tradotta in tutte e cinque le lingue;
 *   3. le coppie di colori raggiungono il contrasto che serve.
 */

import { describe, expect, it } from 'vitest';
import {
  COLORE_PRIORITA,
  ETICHETTA_PRIORITA,
  ETICHETTA_STATO,
  targhettaPriorita,
} from '@/lib/scaleTask';
import { LINGUE, traduci, type Lingua } from '@/lib/i18n';
import { TESTI_DE } from '@/lib/traduzioni-de';
import { TESTI_ES } from '@/lib/traduzioni-es';
import { TESTI_FR } from '@/lib/traduzioni-fr';

const LINGUE_TUTTE = Object.keys(LINGUE) as Lingua[];

/*
  I dizionari non-italiani si caricano a richiesta: in un test sincrono
  `traduci('fr', ...)` ripiegherebbe sull'italiano e il controllo passerebbe
  per il motivo sbagliato. Si guardano quindi le tabelle direttamente.
*/
const TABELLE: Record<string, Record<string, string>> = {
  fr: TESTI_FR,
  de: TESTI_DE,
  es: TESTI_ES,
};

/** Contrasto WCAG fra due colori sRGB dati in esadecimale. */
function contrasto(a: string, b: string): number {
  const luminanza = (hex: string) => {
    const canali = [0, 2, 4].map((i) => parseInt(hex.slice(i + 1, i + 3), 16) / 255);
    const [r, g, bl] = canali.map((u) =>
      u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/*
  I valori della tavolozza Tailwind usati nelle classi qui sopra.

  NON sono gli esadecimali della documentazione di Tailwind 3: la 4 spedisce la
  tavolozza in `oklch`, e i colori che finiscono davvero nei pixel sono un po'
  diversi. Questi sono stati LETTI dal browser — Chromium, foglio di stile
  compilato, colore dipinto su un canvas e pixel riletto — perche' scriverli a
  memoria e' come averli inventati.

  La prima stesura usava gli esadecimali della 3: i verdetti non cambiavano,
  ma il test misurava colori che nessuno vede.

  Se qualcuno cambia una classe senza aggiornare questa tabella, il controllo
  di corrispondenza piu' sotto se ne accorge.
*/
const TAILWIND: Record<string, string> = {
  'red-100': '#ffe2e2',
  'red-700': '#c10007',
  'amber-100': '#fef3c6',
  'amber-800': '#973c00',
  'slate-100': '#f1f5f9',
  'slate-700': '#314158',
};

describe('etichette delle scale', () => {
  it('da una chiave inglese per ogni priorita, non il valore grezzo', () => {
    expect(ETICHETTA_PRIORITA).toEqual({ high: 'High', medium: 'Medium', low: 'Low' });
    for (const chiave of Object.values(ETICHETTA_PRIORITA)) {
      // Se la chiave fosse il valore grezzo ('high') nessun dizionario la
      // conoscerebbe e a schermo tornerebbe l'inglese.
      expect(chiave).not.toBe(chiave.toLowerCase());
    }
  });

  it('da una chiave inglese per ogni stato, trattini compresi', () => {
    expect(ETICHETTA_STATO['not-started']).toBe('Not Started');
    expect(ETICHETTA_STATO['in-progress']).toBe('In Progress');
    expect(ETICHETTA_STATO.blocked).toBe('Blocked');
    expect(ETICHETTA_STATO.completed).toBe('Completed');
  });

  it('traduce davvero in italiano invece di ripiegare sulla chiave', () => {
    const attese: Record<string, string> = { High: 'Alta', Medium: 'Media', Low: 'Bassa' };
    for (const [chiave, atteso] of Object.entries(attese)) {
      const testo = traduci('it', chiave);
      expect(testo).toBe(atteso);
      // Il ripiego di `traduci` restituisce la chiave stessa: se succedesse,
      // l'interfaccia italiana direbbe "Medium".
      expect(testo).not.toBe(chiave);
    }
  });

  it('ha tutte le chiavi delle due scale in tutte le lingue', () => {
    const chiavi = [
      ...Object.values(ETICHETTA_PRIORITA),
      ...Object.values(ETICHETTA_STATO),
    ];
    for (const lingua of LINGUE_TUTTE) {
      for (const chiave of chiavi) {
        if (lingua === 'en') {
          // In inglese la chiave E' il testo: non serve una riga di dizionario.
          expect(traduci('en', chiave)).toBe(chiave);
          continue;
        }
        const testo = lingua === 'it' ? traduci('it', chiave) : TABELLE[lingua][chiave];
        expect(testo, `${chiave} manca in ${lingua}`).toBeTruthy();
        expect(testo).not.toBe(chiave);
      }
    }
  });
});

describe('contrasto delle targhette', () => {
  it('usa solo colori presenti nella tabella di riferimento', () => {
    for (const classi of Object.values(COLORE_PRIORITA)) {
      // Solo le varianti chiare: quelle `dark:` non si attivano mai oggi.
      const fondo = classi.match(/(?:^|\s)bg-([a-z]+-\d+)/)?.[1];
      const testo = classi.match(/(?:^|\s)text-([a-z]+-\d+)/)?.[1];
      expect(fondo && TAILWIND[fondo], `fondo ${fondo} sconosciuto`).toBeTruthy();
      expect(testo && TAILWIND[testo], `testo ${testo} sconosciuto`).toBeTruthy();
    }
  });

  it('raggiunge 4,5:1 su ogni priorita, come vuole SC 1.4.3', () => {
    for (const [priorita, classi] of Object.entries(COLORE_PRIORITA)) {
      const fondo = TAILWIND[classi.match(/(?:^|\s)bg-([a-z]+-\d+)/)![1]];
      const testo = TAILWIND[classi.match(/(?:^|\s)text-([a-z]+-\d+)/)![1]];
      const misura = contrasto(fondo, testo);
      expect(misura, `${priorita}: ${misura.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('boccia le coppie che c erano prima, cosi il controllo vale qualcosa', () => {
    // Misurati nel browser come gli altri: bg-amber-500 con testo bianco sta a
    // 2,13:1, bg-slate-400 con bianco a 2,63:1. Meno della meta' del minimo.
    expect(contrasto('#fe9a00', '#ffffff')).toBeLessThan(4.5);
    expect(contrasto('#90a1b9', '#ffffff')).toBeLessThan(4.5);
  });
});

describe('targhettaPriorita', () => {
  it('mostra un valore sconosciuto com e scritto, invece di sparire', () => {
    expect(targhettaPriorita('urgentissima').chiave).toBe('urgentissima');
    expect(targhettaPriorita('urgentissima').colore).toBe(COLORE_PRIORITA.low);
  });

  it('regge un valore assente', () => {
    expect(targhettaPriorita(undefined).chiave).toBe('');
  });
});
