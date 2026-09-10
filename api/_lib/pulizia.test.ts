import { describe, it, expect } from 'vitest';
import {
  GIORNI_LOG_EMAIL,
  GIORNI_NOTIFICHE_LETTE,
  TETTO_VOCI_AUDIT,
  limiteConservazione,
  potaAudit,
} from './pulizia.js';

/**
 * La rotta intera non e' provabile senza un database, ma le due decisioni che
 * possono distruggere dati sono pure e stanno qui: da quale istante in poi un
 * dato e' "vecchio", e quale estremo del registro di audit va tenuto.
 *
 * Sono anche le due che sbagliano in silenzio. Una DELETE con la data storta
 * parte lo stesso; una potatura dall'estremo sbagliato lascia il pannello con
 * dieci righe, che e' quello che mostrava anche prima. In nessuno dei due casi
 * compare un errore: compaiono dei dati che non ci sono piu'.
 */

const ADESSO = new Date('2026-09-10T09:00:00.000Z');
const GIORNO = 24 * 60 * 60 * 1000;

describe('limiteConservazione', () => {
  it('torna indietro del numero di giorni chiesto', () => {
    expect(limiteConservazione(ADESSO, 30)).toBe('2026-08-11T09:00:00.000Z');
  });

  it('produce ISO 8601 in UTC, che e il formato che PostgREST confronta senza ambiguita di fuso', () => {
    const limite = limiteConservazione(ADESSO, GIORNI_LOG_EMAIL);
    expect(limite).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(limite).getTime()).toBe(ADESSO.getTime() - GIORNI_LOG_EMAIL * GIORNO);
  });

  it('guarda sempre nel passato: e il verso in cui si sbaglia di segno', () => {
    // Con il segno invertito il limite finirebbe nel futuro e la DELETE
    // cancellerebbe TUTTO, log di stamattina compresi.
    expect(new Date(limiteConservazione(ADESSO, GIORNI_NOTIFICHE_LETTE)).getTime()).toBeLessThan(
      ADESSO.getTime()
    );
  });

  it('con zero giorni non sposta nulla', () => {
    expect(limiteConservazione(ADESSO, 0)).toBe(ADESSO.toISOString());
  });
});

describe('potaAudit', () => {
  /** Voci finte, nell'ordine in cui l'applicazione le appende: le nuove in coda. */
  const registro = (quante: number) =>
    Array.from({ length: quante }, (_, i) => ({ id: `voce-${i}` }));

  it('lascia invariato un registro piu corto del tetto', () => {
    const voci = registro(3);
    expect(potaAudit(voci, 10)).toEqual(voci);
  });

  it('lascia invariato un registro esattamente al tetto', () => {
    const voci = registro(10);
    const potato = potaAudit(voci, 10);
    expect(potato).toEqual(voci);
    // Stesso riferimento: al tetto non c'e' niente da fare, e il chiamante non
    // deve riscrivere il blob per nulla.
    expect(potato).toBe(voci);
  });

  it('su un registro piu lungo tiene le voci PIU RECENTI, cioe quelle in coda', () => {
    // Il punto della prova non e' "ne restano tre": e' QUALI tre. Se la
    // potatura tagliasse dalla coda invece che dalla testa, la lunghezza
    // sarebbe identica e nessun test la vedrebbe.
    const voci = registro(5);
    expect(potaAudit(voci, 3)).toEqual([{ id: 'voce-2' }, { id: 'voce-3' }, { id: 'voce-4' }]);
  });

  it('non tiene mai la testa dell array, che e la parte vecchia', () => {
    const voci = registro(1500);
    const potato = potaAudit(voci, TETTO_VOCI_AUDIT) as { id: string }[];
    expect(potato).toHaveLength(TETTO_VOCI_AUDIT);
    expect(potato[0]).toEqual({ id: 'voce-500' });
    expect(potato[potato.length - 1]).toEqual({ id: 'voce-1499' });
    expect(potato).not.toContainEqual({ id: 'voce-0' });
  });

  it('non lascia nulla se il tetto e zero', () => {
    expect(potaAudit(registro(4), 0)).toEqual([]);
  });

  it('sul registro vuoto non fa nulla', () => {
    expect(potaAudit([], TETTO_VOCI_AUDIT)).toEqual([]);
  });

  it('su un valore che non e un array risponde null, cioe "non toccare"', () => {
    // Il contenuto di app_state.value lo scrive il client: puo' essere
    // qualunque cosa. Normalizzare l'inatteso a [] vorrebbe dire cancellare un
    // registro che non abbiamo capito, che e' il peggiore dei due errori.
    expect(potaAudit(null, 10)).toBeNull();
    expect(potaAudit(undefined, 10)).toBeNull();
    expect(potaAudit({ voci: [1, 2, 3] }, 10)).toBeNull();
    expect(potaAudit('audit-log', 10)).toBeNull();
    expect(potaAudit(42, 10)).toBeNull();
  });
});
