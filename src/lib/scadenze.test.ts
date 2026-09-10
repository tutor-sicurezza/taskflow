import { describe, it, expect } from 'vitest';
import {
  haScadenza, dataScadenza, eInRitardo, confrontaScadenze, giorniAllaScadenza,
} from '@/lib/scadenze';
import type { Task } from '@/lib/types';

const t = (dueDate: Task['dueDate'], status: Task['status'] = 'not-started') =>
  ({ dueDate, status }) as Task;

const IERI = new Date(Date.now() - 86400000).toISOString();
const DOMANI = new Date(Date.now() + 86400000).toISOString();

/**
 * La scadenza e' diventata facoltativa: il caso "non ce l'ha" deve essere una
 * risposta, non un `Invalid Date` che arriva fino a schermo.
 */
describe('scadenze', () => {
  it('riconosce chi ha una scadenza e chi no', () => {
    expect(haScadenza(t(DOMANI))).toBe(true);
    expect(haScadenza(t(null))).toBe(false);
    expect(haScadenza(t(undefined))).toBe(false);
    expect(haScadenza(t(''))).toBe(false);
  });

  it('non produce mai una data non valida', () => {
    expect(dataScadenza(t(null))).toBeNull();
    expect(dataScadenza(t('non-una-data'))).toBeNull();
    expect(dataScadenza(t(DOMANI))).toBeInstanceOf(Date);
  });

  it('senza scadenza non e mai in ritardo', () => {
    // E' il motivo per cui la scadenza e' diventata facoltativa: prima chi non
    // ne aveva una se la inventava e finiva fra i ritardi.
    expect(eInRitardo(t(null))).toBe(false);
    expect(eInRitardo(t(undefined))).toBe(false);
    expect(eInRitardo(t('non-una-data'))).toBe(false);
  });

  it('e in ritardo solo se la scadenza e passata e il task non e chiuso', () => {
    expect(eInRitardo(t(IERI))).toBe(true);
    expect(eInRitardo(t(IERI, 'completed'))).toBe(false);
    expect(eInRitardo(t(DOMANI))).toBe(false);
    // Bloccato non e' chiuso: se e' scaduto, e' in ritardo — ed e' proprio il
    // caso che si vuole vedere.
    expect(eInRitardo(t(IERI, 'blocked'))).toBe(true);
  });

  it('ordina i task senza scadenza in fondo', () => {
    const conData = t(DOMANI);
    const senza = t(null);
    expect(confrontaScadenze(conData, senza)).toBeLessThan(0);
    expect(confrontaScadenze(senza, conData)).toBeGreaterThan(0);
    expect(confrontaScadenze(senza, t(undefined))).toBe(0);
    expect(confrontaScadenze(t(IERI), t(DOMANI))).toBeLessThan(0);
  });

  it('conta i giorni, negativi se la scadenza e passata', () => {
    expect(giorniAllaScadenza(t(null))).toBeNull();
    expect(giorniAllaScadenza(t(DOMANI))).toBeGreaterThan(0);
    expect(giorniAllaScadenza(t(IERI))).toBeLessThanOrEqual(0);
  });
});
