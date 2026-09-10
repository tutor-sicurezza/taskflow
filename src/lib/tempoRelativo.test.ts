import { describe, it, expect, vi, afterEach } from 'vitest';
import { tempoRelativo, dataBreve, dataEstesa, dataOra } from '@/lib/tempoRelativo';

/*
  Le asserzioni non fissano il testo esatto prodotto da Intl: quello dipende
  dai dati CLDR del motore e cambiarebbe test verdi in rossi al primo
  aggiornamento di Node. Si verifica cio' che ci interessa davvero — che la
  lingua venga rispettata, che le date storte non diventino "Invalid Date", e
  che il verso del tempo (passato o futuro) sia quello giusto.
*/

const ORA = new Date('2026-09-10T12:00:00Z');

afterEach(() => {
  vi.useRealTimers();
});

function conOrologioFermo<T>(azione: () => T): T {
  vi.useFakeTimers();
  vi.setSystemTime(ORA);
  return azione();
}

describe('tempoRelativo', () => {
  it('parla la lingua richiesta', () => {
    const dueOreFa = new Date(ORA.getTime() - 2 * 60 * 60 * 1000);
    const [it, en, de] = conOrologioFermo(() => [
      tempoRelativo(dueOreFa, 'it'),
      tempoRelativo(dueOreFa, 'en'),
      tempoRelativo(dueOreFa, 'de'),
    ]);

    expect(it).toContain('2');
    expect(it).not.toBe(en);
    expect(de).not.toBe(en);
    // Il difetto che stiamo correggendo era proprio questo.
    expect(it.toLowerCase()).not.toContain('hours ago');
  });

  it('distingue il passato dal futuro', () => {
    const [passato, futuro] = conOrologioFermo(() => [
      tempoRelativo(new Date(ORA.getTime() - 3 * 24 * 60 * 60 * 1000), 'en'),
      tempoRelativo(new Date(ORA.getTime() + 3 * 24 * 60 * 60 * 1000), 'en'),
    ]);

    expect(passato).toContain('ago');
    expect(futuro).not.toContain('ago');
  });

  it('sotto il minuto non dice "0 minuti fa"', () => {
    const adesso = conOrologioFermo(() =>
      tempoRelativo(new Date(ORA.getTime() - 5000), 'en')
    );
    expect(adesso).not.toContain('0');
  });

  it('sceglie lo scaglione piu' + ' grande che si applica', () => {
    const risultati = conOrologioFermo(() => ({
      minuti: tempoRelativo(new Date(ORA.getTime() - 5 * 60 * 1000), 'en'),
      ore: tempoRelativo(new Date(ORA.getTime() - 5 * 60 * 60 * 1000), 'en'),
      giorni: tempoRelativo(new Date(ORA.getTime() - 5 * 24 * 60 * 60 * 1000), 'en'),
      mesi: tempoRelativo(new Date(ORA.getTime() - 60 * 24 * 60 * 60 * 1000), 'en'),
    }));

    expect(risultati.minuti).toContain('minute');
    expect(risultati.ore).toContain('hour');
    expect(risultati.giorni).toContain('day');
    expect(risultati.mesi).toContain('month');
  });

  it('accetta una stringa ISO come le date che arrivano dal database', () => {
    const daStringa = conOrologioFermo(() => tempoRelativo('2026-09-10T10:00:00Z', 'en'));
    expect(daStringa).toContain('hour');
  });

  it('su una data non interpretabile restituisce vuoto, non "Invalid Date"', () => {
    expect(tempoRelativo('non e-una-data', 'it')).toBe('');
    expect(dataBreve('', 'it')).toBe('');
    expect(dataEstesa(NaN, 'it')).toBe('');
    expect(dataOra('boh', 'it')).toBe('');
  });
});

describe('formati di data', () => {
  it('cambiano con la lingua', () => {
    const data = new Date('2026-09-23T08:30:00Z');
    expect(dataEstesa(data, 'it')).not.toBe(dataEstesa(data, 'de'));
    expect(dataBreve(data, 'it')).toContain('23');
    expect(dataEstesa(data, 'it')).toContain('2026');
  });

  it('la data con ora contiene sia il giorno sia i minuti', () => {
    const testo = dataOra(new Date('2026-09-23T08:30:00Z'), 'en');
    expect(testo).toContain('23');
    expect(testo).toMatch(/\d{1,2}:\d{2}/);
  });
});
