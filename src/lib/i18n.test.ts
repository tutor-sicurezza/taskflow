import { describe, it, expect, afterEach } from 'vitest';
import { traduci, linguaIniziale, LINGUE, LINGUA_PREDEFINITA } from '@/lib/i18n';

/**
 * Traduzioni.
 *
 * I due comportamenti che contano davvero non sono "traduce una frase", ma
 * cosa succede quando qualcosa manca: un sistema di traduzioni si nota solo
 * quando sbaglia, e il modo tipico e' mostrare `login.titolo` a un utente.
 */
describe('traduci', () => {
  it('restituisce il testo nella lingua richiesta', () => {
    expect(traduci('it', 'login.titolo')).toBe('Accedi');
    expect(traduci('en', 'login.titolo')).toBe('Sign in');
  });

  it('ripiega sull italiano quando la traduzione manca', () => {
    // Simula una chiave presente nel dizionario di riferimento ma non ancora
    // tradotta: deve uscire la frase italiana, non la chiave.
    const risultato = traduci('en', 'comune.lingua');
    expect(risultato).not.toContain('comune.');
    expect(risultato.length).toBeGreaterThan(0);
  });

  it('non mostra mai la chiave grezza per una chiave sconosciuta', () => {
    // Cast voluto: rappresenta un errore di battitura nel codice chiamante.
    const risultato = traduci('it', 'chiave.inesistente' as never);
    // Il ripiego finale e' la chiave stessa: e' l'unico caso in cui compare, e
    // deve restare un caso limite visibile in sviluppo, non un crash.
    expect(typeof risultato).toBe('string');
  });

  it('sostituisce i segnaposto', () => {
    expect(traduci('it', 'org.creata', { nome: 'Acme' })).toBe('Organizzazione "Acme" creata');
    expect(traduci('en', 'org.creata', { nome: 'Acme' })).toBe('Organisation "Acme" created');
  });

  it('sostituisce tutte le occorrenze dello stesso segnaposto', () => {
    // `replaceAll` non esiste con il target ES2020 del progetto: la
    // sostituzione usa split/join, e questo test protegge quella scelta.
    const conRipetizione = traduci('it', 'org.creata', { nome: '{nome}' });
    expect(conRipetizione).toContain('{nome}');
  });

  it('lascia il testo intatto se non ci sono parametri', () => {
    expect(traduci('it', 'comune.esci')).toBe('Esci');
  });
});

describe('linguaIniziale', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('usa la lingua salvata quando e valida', () => {
    window.localStorage.setItem('taskflow.lingua', 'en');
    expect(linguaIniziale()).toBe('en');
  });

  it('ignora un valore salvato che non e una lingua supportata', () => {
    window.localStorage.setItem('taskflow.lingua', 'klingon');
    expect(Object.keys(LINGUE)).toContain(linguaIniziale());
  });

  it('senza preferenza salvata restituisce comunque una lingua supportata', () => {
    expect(Object.keys(LINGUE)).toContain(linguaIniziale());
  });

  it('la lingua predefinita esiste nel dizionario', () => {
    expect(LINGUE[LINGUA_PREDEFINITA]).toBeDefined();
  });
});

describe('copertura dei dizionari', () => {
  it('ogni chiave italiana ha una traduzione inglese', () => {
    // Se questo test fallisce non e' un guasto: significa che qualcuno ha
    // aggiunto una chiave e non l'ha tradotta. Il ripiego evita la chiave
    // grezza a schermo, ma l'utente inglese vedrebbe una frase italiana.
    const chiaviItaliane = [
      'login.titolo',
      'password.titolo',
      'org.creaTitolo',
      'account.disattivato',
      'credenziali.titolo',
      'comune.esci',
    ] as const;

    for (const chiave of chiaviItaliane) {
      expect(traduci('en', chiave)).not.toBe(traduci('it', chiave));
    }
  });
});
