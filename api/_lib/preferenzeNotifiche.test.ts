import { describe, it, expect } from 'vitest';
import { chiavePreferenze, puoRicevereEmail } from './preferenzeNotifiche.js';

/**
 * Il comportamento che conta e' l'asimmetria: solo un `false` esplicito
 * spegne un'email. Tutto il resto — preferenze mai aperte, JSON malformato,
 * campi di tipo sbagliato — deve lasciar partire il messaggio, altrimenti un
 * dato sporco zittisce le notifiche di qualcuno senza che nessuno se ne
 * accorga.
 */
describe('puoRicevereEmail', () => {
  it('spedisce quando non ci sono preferenze', () => {
    for (const valore of [null, undefined, {}, [], 'niente', 42]) {
      expect(puoRicevereEmail(valore, 'task_assigned').consentito).toBe(true);
    }
  });

  it('non spedisce se le email sono disattivate del tutto', () => {
    const esito = puoRicevereEmail({ emailNotifications: false }, 'task_assigned');
    expect(esito.consentito).toBe(false);
    expect(esito.motivo).toBe('email disattivate');
  });

  it('non spedisce se e disattivato quel tipo', () => {
    const esito = puoRicevereEmail(
      { emailNotifications: true, enabledNotifications: { task_assigned: false } },
      'task_assigned'
    );
    expect(esito.consentito).toBe(false);
    expect(esito.motivo).toBe('tipo disattivato');
  });

  it('spegne solo il tipo indicato, non gli altri', () => {
    const preferenze = {
      enabledNotifications: { task_assigned: false, task_reassigned: true },
    };
    expect(puoRicevereEmail(preferenze, 'task_assigned').consentito).toBe(false);
    expect(puoRicevereEmail(preferenze, 'task_reassigned').consentito).toBe(true);
    expect(puoRicevereEmail(preferenze, 'mention').consentito).toBe(true);
  });

  it('ignora valori che non sono un false esplicito', () => {
    // Un client vecchio poteva salvare stringhe: "false" non e' una scelta,
    // e interpretarla come tale spegnerebbe le email a chi non l ha chiesto.
    for (const valore of ['false', 0, null, undefined]) {
      expect(
        puoRicevereEmail({ emailNotifications: valore }, 'task_assigned').consentito
      ).toBe(true);
    }
  });

  it('non si fa ingannare da enabledNotifications malformato', () => {
    for (const perTipo of ['tutto', 42, [], null]) {
      expect(
        puoRicevereEmail({ enabledNotifications: perTipo }, 'task_assigned').consentito
      ).toBe(true);
    }
  });

  it('compone la chiave di user_state', () => {
    expect(chiavePreferenze('abc-123')).toBe('notification-preferences-abc-123');
  });
});
