import { describe, it, expect } from 'vitest';
import { prossimaOccorrenza } from './ricorrenza.js';

/*
  Il salto delle occorrenze gia' passate.

  Una serie chiusa con mesi di ritardo generava un'occorrenza con la scadenza
  nel passato: il mattino dopo partiva un "in ritardo" e una settimana dopo
  un'escalation ai responsabili, per un controllo appena creato. Il salto e'
  facoltativo perche' la funzione, senza, resta UN passo di calendario — puro e
  verificabile con date fisse, come fanno gli altri test.
*/

const MENSILE = { tipo: 'mesi' as const, ogni: 1 };

describe('prossimaOccorrenza - salto delle occorrenze passate', () => {
  it('senza `adesso` fa un solo passo, anche nel passato', () => {
    const chiusa = new Date('2026-01-15T09:00:00Z');
    const prossima = prossimaOccorrenza(MENSILE, chiusa);
    expect(prossima?.toISOString().slice(0, 10)).toBe('2026-02-15');
  });

  it('con `adesso` avanza fino alla prima scadenza futura', () => {
    const chiusa = new Date('2026-01-15T09:00:00Z');
    const adesso = new Date('2026-06-20T09:00:00Z');
    const prossima = prossimaOccorrenza(MENSILE, chiusa, adesso);
    expect(prossima?.toISOString().slice(0, 10)).toBe('2026-07-15');
    expect(prossima!.getTime()).toBeGreaterThan(adesso.getTime());
  });

  it('resta allineata al calendario: non riparte da adesso', () => {
    // Il giorno del mese resta il 15, non diventa il 20 di `adesso`: e'
    // la ragione per cui la cadenza si ancora alla scadenza precedente.
    const prossima = prossimaOccorrenza(
      MENSILE,
      new Date('2026-01-15T09:00:00Z'),
      new Date('2026-06-20T09:00:00Z')
    );
    expect(prossima?.getUTCDate()).toBe(15);
  });

  it('una serie con data di fine gia' + ' superata non genera nulla', () => {
    const prossima = prossimaOccorrenza(
      { ...MENSILE, fine: '2026-03-31' },
      new Date('2026-01-15T09:00:00Z'),
      new Date('2026-06-20T09:00:00Z')
    );
    expect(prossima).toBeNull();
  });

  it('non gira all infinito su una cadenza che non avanza', () => {
    // `ogni: 0` non supera la validazione, ma qui arriva jsonb: se passasse,
    // il ciclo deve fermarsi da solo invece di bloccare la funzione.
    const prossima = prossimaOccorrenza(
      { tipo: 'giorni', ogni: 0 } as never,
      new Date('2026-01-15T09:00:00Z'),
      new Date('2026-06-20T09:00:00Z')
    );
    expect(prossima).toBeNull();
  });

  it('una cadenza giornaliera recupera in un colpo solo', () => {
    const prossima = prossimaOccorrenza(
      { tipo: 'giorni', ogni: 1 },
      new Date('2026-01-01T09:00:00Z'),
      new Date('2026-03-01T09:00:00Z')
    );
    expect(prossima?.toISOString().slice(0, 10)).toBe('2026-03-02');
  });
});
