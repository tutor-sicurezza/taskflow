/**
 * Il contratto dell'avviso.
 *
 * Qui c'erano sei controlli sulla funzione che decideva se scrivere il
 * profilo. Dalla 0032 quella decisione sta nel `where` di un `update`, cioe'
 * nel database, e i controlli che le corrispondono sono la prova eseguita
 * contro Postgres prima di applicare la migrazione — non un test in jsdom.
 *
 * Resta da verificare cio' che il database non decide: che la frase mostrata
 * all'amministratore dica la cosa giusta.
 */

import { describe, expect, it } from 'vitest';
import { AVVISO_PROFILO_ALTROVE } from './scritturaProfilo.js';

describe('avviso sul profilo non scritto', () => {
  it('dice cosa non e stato fatto', () => {
    expect(AVVISO_PROFILO_ALTROVE).toMatch(/non sono stati modificati/);
  });

  it('dice anche il perche, non solo il cosa', () => {
    // Un avviso che dice "non fatto" senza dire perche' porta
    // l'amministratore a riprovare identico.
    expect(AVVISO_PROFILO_ALTROVE).toMatch(/altre organizzazioni/);
  });

  it('non racconta quale gesto sia riuscito', () => {
    // La stessa rotta serve l'invito e la modifica: un avviso che ne
    // nominasse uno mentirebbe sull'altro. A dirlo e' chi chiama.
    expect(AVVISO_PROFILO_ALTROVE).not.toMatch(/Aggiunt|Aggiornat/);
  });
});
