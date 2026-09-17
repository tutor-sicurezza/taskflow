/**
 * L'allineamento della griglia del calendario.
 *
 * Il difetto che ha prodotto questo file non faceva rumore: le classi erano
 * scritte con i nomi di react-day-picker 8, il progetto installa la 9, e i nomi
 * vecchi sono ancora nel tipo `DeprecatedUI` — `tsc` passava, `eslint` passava,
 * e le iniziali dei giorni scivolavano rispetto ai numeri solo a schermo.
 *
 * Qui il componente viene montato davvero in jsdom. jsdom non calcola il
 * layout, quindi non si puo' misurare lo scivolamento: si verifica la sua
 * causa, cioe' che le classi arrivino sugli elementi giusti della 9. Se
 * qualcuno rimettesse un nome della 8, la chiave verrebbe ignorata, la classe
 * non comparirebbe e questi controlli fallirebbero.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Calendar } from '@/components/ui/calendar';

// React 19 pretende di sapere che siamo dentro un test prima di accettare `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let contenitore: HTMLDivElement | null = null;
let radice: Root | null = null;

/** Un mese fisso: il numero di settimane non deve dipendere da quando gira il test. */
const MESE = new Date(2024, 4, 1);

function monta(props: Record<string, unknown> = {}): HTMLElement {
  contenitore = document.createElement('div');
  document.body.appendChild(contenitore);
  radice = createRoot(contenitore);
  act(() => {
    radice!.render(createElement(Calendar, { month: MESE, ...props }));
  });
  return contenitore;
}

afterEach(() => {
  act(() => radice?.unmount());
  contenitore?.remove();
  radice = null;
  contenitore = null;
});

describe('griglia del calendario', () => {
  it('ha sette intestazioni e sette celle per settimana', () => {
    const dom = monta();

    const intestazioni = dom.querySelectorAll('thead tr th');
    expect(intestazioni).toHaveLength(7);

    const settimane = dom.querySelectorAll('tbody tr');
    expect(settimane.length).toBeGreaterThan(3);
    for (const settimana of settimane) {
      expect(settimana.querySelectorAll('td')).toHaveLength(7);
    }
  });

  it('veste le celle dell intestazione, cioe la chiave weekday esiste davvero', () => {
    const dom = monta();
    for (const th of dom.querySelectorAll('thead tr th')) {
      // Larghezza fissa: e' cio' che tiene le iniziali sopra i numeri.
      expect(th.className).toContain('w-8');
    }
  });

  it('tiene le classi del pulsante sul pulsante e non sulla cella', () => {
    // Senza modalita' di selezione la 9 non genera i pulsanti: solo il numero.
    const dom = monta({ mode: 'single' });
    const celle = dom.querySelectorAll('tbody td');
    expect(celle.length).toBeGreaterThan(0);

    for (const td of celle) {
      // `inline-flex` su un <td> lo toglie dal flusso della tabella: era
      // esattamente cosi' che le sette colonne collassavano in una.
      expect(td.className).not.toContain('inline-flex');
      expect(td.className).toContain('p-0');
    }

    const pulsanti = dom.querySelectorAll('tbody td > button');
    expect(pulsanti.length).toBeGreaterThan(0);
    for (const pulsante of pulsanti) {
      expect(pulsante.className).toContain('size-8');
      expect(pulsante.className).toContain('inline-flex');
    }
  });

  it('lascia la navigazione dentro due veri pulsanti raggiungibili', () => {
    const dom = monta();
    const navigazione = dom.querySelector('nav');
    expect(navigazione).not.toBeNull();

    const pulsanti = navigazione!.querySelectorAll('button');
    expect(pulsanti).toHaveLength(2);
    for (const pulsante of pulsanti) {
      // Senza <button> non ci sarebbero ne' etichetta ne' fuoco da tastiera.
      expect(pulsante.getAttribute('aria-label')).toBeTruthy();
      expect(pulsante.querySelector('svg')).not.toBeNull();
    }
  });

  it('marca il giorno selezionato sulla cella e lo colora sul pulsante', () => {
    const scelto = new Date(2024, 4, 15);
    const dom = monta({ mode: 'single', selected: scelto });

    const cella = dom.querySelector('tbody td[aria-selected]');
    expect(cella).not.toBeNull();
    expect(cella!.className).toContain('[&>button]:bg-primary');
    expect(cella!.querySelector('button')?.textContent).toBe('15');
  });
});
