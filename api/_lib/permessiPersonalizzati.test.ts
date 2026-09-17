import { describe, it, expect } from 'vitest';
import {
  CATALOGO_PERMESSI,
  normalizzaPermessiPersonalizzati,
} from './permessiPersonalizzati.js';

/**
 * La rotta dei membri scrive quello che esce da qui dentro
 * `profiles.custom_permissions`, con il service role. E' l'unico filtro fra
 * il corpo di una richiesta e una colonna che decide cosa l'interfaccia mostra
 * a una persona: se lascia passare una voce inventata o un valore non
 * booleano, il client la fonde sopra i permessi del ruolo senza fare domande.
 */

describe('normalizzaPermessiPersonalizzati', () => {
  it('null significa "nessuna deroga"', () => {
    expect(normalizzaPermessiPersonalizzati(null)).toEqual({ ok: true, valore: null });
  });

  it('un oggetto vuoto, o con sole categorie vuote, vale come nessuna deroga', () => {
    expect(normalizzaPermessiPersonalizzati({})).toEqual({ ok: true, valore: null });
    expect(normalizzaPermessiPersonalizzati({ tasks: {}, employees: null })).toEqual({
      ok: true,
      valore: null,
    });
  });

  it('conserva le voci note con il loro valore, e solo quelle', () => {
    const esito = normalizzaPermessiPersonalizzati({
      tasks: { edit_any: true, delete_any: false },
      employees: { view: true },
    });
    expect(esito).toEqual({
      ok: true,
      valore: {
        tasks: { edit_any: true, delete_any: false },
        employees: { view: true },
      },
    });
  });

  it('rifiuta una categoria sconosciuta invece di ignorarla', () => {
    const esito = normalizzaPermessiPersonalizzati({ billing: { pay: true } });
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errore).toContain('billing');
  });

  it('rifiuta una voce sconosciuta dentro una categoria nota', () => {
    const esito = normalizzaPermessiPersonalizzati({ tasks: { delete_everything: true } });
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errore).toContain('tasks.delete_everything');
  });

  it('rifiuta i valori non booleani: "true" come stringa non e un permesso', () => {
    // Il client confronta con `=== true`: una stringa salvata sembrerebbe un
    // permesso concesso nel pannello e non lo sarebbe in nessun controllo.
    expect(normalizzaPermessiPersonalizzati({ tasks: { edit_any: 'true' } }).ok).toBe(false);
    expect(normalizzaPermessiPersonalizzati({ tasks: { edit_any: 1 } }).ok).toBe(false);
  });

  it('rifiuta cio che non e un oggetto', () => {
    expect(normalizzaPermessiPersonalizzati('tutto').ok).toBe(false);
    expect(normalizzaPermessiPersonalizzati([{ tasks: {} }]).ok).toBe(false);
    expect(normalizzaPermessiPersonalizzati({ tasks: ['edit_any'] }).ok).toBe(false);
    expect(normalizzaPermessiPersonalizzati(undefined).ok).toBe(false);
  });

  it('il catalogo copre le cinque categorie dell interfaccia', () => {
    expect(Object.keys(CATALOGO_PERMESSI).sort()).toEqual(
      ['ai_features', 'analytics', 'announcements', 'employees', 'tasks'].sort()
    );
  });
});
