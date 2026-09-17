/**
 * L'anello di fuoco si vede abbastanza.
 *
 * `--ring` qui e' `oklch(0.45 0.12 210)`, un teal deciso: pieno, su fondo
 * chiaro, misura 6,48:1. Ma i componenti lo disegnavano a META' OPACITA'
 * (`ring-ring/50`, com'e' nel modello di partenza di shadcn, dove pero'
 * `--ring` e' un grigio chiaro e la scelta ha un altro senso). Il risultato
 * misurato e' 2,31:1, contro i 3 che chiede WCAG 2.2 SC 1.4.11 per gli
 * indicatori non testuali: chi naviga da tastiera fatica a vedere dov'e'.
 *
 * Il difetto vive in una stringa di classi CSS. Nessun type-check lo vede,
 * nessun rendering in jsdom lo misura — jsdom non compila Tailwind e non
 * calcola colori. Quello che si puo' controllare e' che nel codice non torni
 * un'opacita' troppo bassa, e che il numero dichiarato sia quello vero.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/*
  Da oklch a sRGB **codificato in gamma**, cioe' i valori che stanno nei
  pixel — non quelli lineari.

  La distinzione non e' pedanteria: la composizione con alfa che fa il browser
  avviene su questi, non sui lineari. Mescolando in spazio lineare, `/70`
  risultava 2,45:1 invece di 3,43:1, e questo file ha bocciato una correzione
  giusta. La prima stesura del test sbagliava esattamente qui.
*/
function oklchInSrgb(L: number, C: number, gradi: number): [number, number, number] {
  const h = (gradi * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lineare = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lineare.map((u) => {
    const v = Math.min(1, Math.max(0, u));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

/** Luminanza relativa: linearizza prima, come vuole la formula WCAG. */
function luminanza([r, g, b]: [number, number, number]): number {
  const lin = (u: number) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrasto(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** L'anello disegnato a opacita' `alfa` sopra `fondo`. */
function sovrapposto(
  colore: [number, number, number],
  fondo: [number, number, number],
  alfa: number
): [number, number, number] {
  return colore.map((c, i) => c * alfa + fondo[i] * (1 - alfa)) as [number, number, number];
}

// I due token di `src/index.css`, che vince su main.css perche' e' importato dopo.
const RING = oklchInSrgb(0.45, 0.12, 210);
const FONDO = oklchInSrgb(0.99, 0, 0);

const CARTELLA_UI = join(process.cwd(), 'src', 'components', 'ui');

describe('contrasto dell anello di fuoco', () => {
  it('a meta opacita non bastava: e il motivo di questo file', () => {
    expect(contrasto(sovrapposto(RING, FONDO, 0.5), FONDO)).toBeLessThan(3);
  });

  it('all opacita usata adesso supera il 3:1 richiesto', () => {
    const misura = contrasto(sovrapposto(RING, FONDO, 0.7), FONDO);
    expect(misura, `${misura.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });

  it('nessun componente e tornato sotto il 3:1', () => {
    const colpevoli: string[] = [];
    for (const nome of readdirSync(CARTELLA_UI)) {
      if (!nome.endsWith('.tsx')) continue;
      const testo = readFileSync(join(CARTELLA_UI, nome), 'utf-8');
      for (const [, alfa] of testo.matchAll(/(?:ring|outline)-ring\/(\d+)/g)) {
        const misura = contrasto(sovrapposto(RING, FONDO, Number(alfa) / 100), FONDO);
        if (misura < 3) colpevoli.push(`${nome}: /${alfa} = ${misura.toFixed(2)}:1`);
      }
    }
    expect(colpevoli).toEqual([]);
  });
});
