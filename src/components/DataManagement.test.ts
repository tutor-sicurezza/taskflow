/**
 * «Importa backup» si raggiunge da tastiera.
 *
 * Com'era: `<label htmlFor="import-file">` con dentro `<Button asChild><span>`,
 * e l'`<input type="file">` con `class="hidden"`, cioe' `display:none`.
 *
 * Nessuno dei due elementi era raggiungibile. Uno `<span>` non e' interattivo:
 * non entra nell'ordine di tabulazione e non risponde a Invio o Spazio. Un
 * elemento in `display:none` e' fuori dall'albero di accessibilita' e non puo'
 * prendere il fuoco. Il `<label>` rendeva l'area CLICCABILE, che e' un'altra
 * cosa: l'unico modo di importare un backup era il mouse.
 *
 * Il controllo non guarda le classi: monta il componente e cerca un elemento
 * che possa davvero ricevere il fuoco e portare il nome del comando.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DataManagement } from '@/components/DataManagement';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let contenitore: HTMLDivElement | null = null;
let radice: Root | null = null;

/** Monta il pannello e lo apre: il contenuto sta dentro un Dialog. */
async function apri(): Promise<HTMLElement> {
  contenitore = document.createElement('div');
  document.body.appendChild(contenitore);
  radice = createRoot(contenitore);

  await act(async () => {
    radice!.render(
      createElement(DataManagement, {
        onExportData: async () => {},
        onImportData: async () => {},
        onClearAllData: async () => {},
      })
    );
  });

  // Il pulsante che apre il pannello e' l'unico presente prima dell'apertura.
  const apripista = contenitore.querySelector('button');
  expect(apripista, 'manca il pulsante che apre il pannello').not.toBeNull();
  await act(async () => {
    apripista!.click();
  });

  // Radix porta il contenuto del dialogo in fondo al body, non dentro il
  // contenitore: cercarlo nel contenitore darebbe sempre vuoto.
  return document.body;
}

/*
  Gli elementi che possono ricevere il fuoco con il tasto Tab.

  Il filtro guarda `tabIndex` e non gli stili: jsdom non calcola il layout e non
  conosce Tailwind, quindi per lui `class="hidden"` e' una stringa qualunque e
  un elemento cosi' marcato risulterebbe raggiungibile. E' il motivo per cui
  l'input del file porta anche `tabIndex={-1}`: senza, questo controllo non
  potrebbe distinguere "nascosto" da "raggiungibile".
*/
function raggiungibili(dom: HTMLElement): HTMLElement[] {
  return [...dom.querySelectorAll<HTMLElement>('button, [href], input, select, textarea')]
    .filter((el) => el.tabIndex >= 0)
    .filter((el) => !el.hasAttribute('disabled'))
    .filter((el) => !el.closest('[aria-hidden="true"]'));
}

afterEach(() => {
  act(() => radice?.unmount());
  contenitore?.remove();
  radice = null;
  contenitore = null;
  document.body.innerHTML = '';
});

describe('importazione di un backup', () => {
  it('offre un comando raggiungibile da tastiera, non solo cliccabile', async () => {
    const dom = await apri();
    const importa = raggiungibili(dom).find((el) =>
      (el.textContent ?? '').toLowerCase().includes('import')
    );

    expect(importa, 'nessun comando di importazione raggiungibile da tastiera')
      .toBeDefined();
    // Un <span> dentro un <label> soddisfaceva "ha il testo giusto" ma non
    // questo: e' la differenza fra cliccabile e raggiungibile.
    expect(importa!.tagName).toBe('BUTTON');
  });

  it('tiene il selettore di file fuori dalla tabulazione, ma collegato', async () => {
    const dom = await apri();
    const input = dom.querySelector<HTMLInputElement>('input[type="file"]');

    expect(input, 'manca il selettore di file').not.toBeNull();
    // Nascosto alla vista e fuori dalla tabulazione: non deve diventare una
    // tappa muta fra il pulsante e il resto del pannello.
    expect(input!.className).toContain('hidden');
    expect(input!.tabIndex).toBe(-1);
    // Ma deve esistere e accettare solo il formato giusto: e' quello che il
    // pulsante apre con .click().
    expect(input!.accept).toBe('.json');
    expect(raggiungibili(dom)).not.toContain(input);
  });

  it('il pulsante apre davvero il selettore di file', async () => {
    const dom = await apri();
    const input = dom.querySelector<HTMLInputElement>('input[type="file"]')!;
    const importa = raggiungibili(dom).find((el) =>
      (el.textContent ?? '').toLowerCase().includes('import')
    )!;

    let aperto = 0;
    input.click = () => {
      aperto += 1;
    };

    await act(async () => {
      importa.click();
    });
    expect(aperto, 'il pulsante non apre il selettore').toBe(1);
  });
});
