/**
 * Il calendario parla la lingua scelta.
 *
 * Nessuno passava `locale` a `DayPicker`, che senza quella prop usa l'inglese:
 * "September 2026" e le iniziali "Su Mo Tu" anche a chi ha scelto l'italiano,
 * con la settimana che parte di domenica invece che di lunedi'.
 *
 * Non era intercettabile da `tsc`: `locale` e' opzionale, ometterla e' codice
 * valido. Si vedeva solo aprendo il pannello della scadenza e guardando.
 *
 * Il montaggio e' quello vero, con l'attesa del pezzo caricato a richiesta:
 * `Calendario` e' un `lazy`, quindi il primo rendering da' il riquadro di
 * attesa e il contenuto arriva al giro dopo.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Calendario } from '@/components/CalendarioPigro';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { caricaDizionario } from '@/lib/i18n';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const MESE = new Date(2024, 4, 1); // maggio 2024

let contenitore: HTMLDivElement | null = null;
let radice: Root | null = null;

async function monta(lingua: string): Promise<HTMLElement> {
  // La scelta si legge da localStorage all'avvio del provider.
  window.localStorage.setItem('taskflow.lingua', lingua);
  if (lingua !== 'it' && lingua !== 'en') await caricaDizionario(lingua as 'fr');

  contenitore = document.createElement('div');
  document.body.appendChild(contenitore);
  radice = createRoot(contenitore);

  await act(async () => {
    radice!.render(
      createElement(LanguageProvider, null,
        createElement(Calendario, { mode: 'single', month: MESE }))
    );
  });

  /*
    Il primo `act` lascia a schermo il riquadro di attesa: `lazy` ha appena
    avviato l'import e la promessa non e' ancora risolta. Senza aspettare, il
    test misurerebbe lo scheletro di caricamento e fallirebbe sempre — che e'
    esattamente cio' che ha fatto al primo tentativo.

    Un solo turno del ciclo di eventi non basta: fra la promessa di `lazy`,
    quella del modulo e il rendering di `Suspense` ci sono piu' passaggi. Si
    forza prima la risoluzione del modulo — `import()` e' memoizzato, quindi e'
    la STESSA promessa che sta aspettando `lazy`, non un secondo caricamento —
    e poi si lascia girare React finche' lo scheletro non sparisce.
  */
  await import('@/components/CalendarioLocalizzato');
  for (let giro = 0; giro < 5 && !contenitore.querySelector('table'); giro++) {
    await act(async () => {
      await new Promise((risolvi) => setTimeout(risolvi, 0));
    });
  }
  expect(contenitore.querySelector('table'), 'il calendario non si e caricato').not.toBeNull();
  return contenitore;
}

/*
  Il titolo del mese e' uno `<span role="status" aria-live="polite">`. Non lo si
  cerca per classe: le classi `rdp-*` qui sono sostituite da quelle di
  `ui/calendar.tsx`, quindi un selettore su quelle troverebbe il vuoto — ed e'
  esattamente l'errore che ha fatto fallire questo test al primo giro, facendolo
  sembrare un difetto del codice invece che del controllo.
*/
function titoloMese(dom: HTMLElement): string {
  return (dom.querySelector('[role="status"]')?.textContent ?? '').toLowerCase();
}

afterEach(() => {
  act(() => radice?.unmount());
  contenitore?.remove();
  radice = null;
  contenitore = null;
  window.localStorage.clear();
});

describe('lingua del calendario', () => {
  it('scrive il mese in italiano, non in inglese', async () => {
    const dom = await monta('it');
    const titolo = titoloMese(dom);
    expect(titolo).toContain('maggio 2024');
    expect(titolo).not.toContain('may');
  });

  it('parte di lunedi in italiano: e la localizzazione a deciderlo', async () => {
    const dom = await monta('it');
    const iniziali = [...dom.querySelectorAll('thead th')].map((th) =>
      (th.textContent ?? '').trim().toLowerCase()
    );
    expect(iniziali).toHaveLength(7);
    expect(iniziali[0]).toMatch(/^lun/);
    expect(iniziali[6]).toMatch(/^dom/);
  });

  it('cambia davvero con la lingua, invece di essere italiano fisso', async () => {
    const dom = await monta('de');
    const titolo = titoloMese(dom);
    expect(titolo).toContain('mai 2024');
    expect(titolo).not.toContain('maggio');
  });

  it('in inglese la settimana parte di domenica', async () => {
    const dom = await monta('en');
    const iniziali = [...dom.querySelectorAll('thead th')].map((th) =>
      (th.textContent ?? '').trim().toLowerCase()
    );
    expect(iniziali[0]).toMatch(/^su/);
  });
});
