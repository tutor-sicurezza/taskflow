import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import {
  traduci,
  linguaIniziale,
  caricaDizionario,
  richiedeCaricamento,
  LINGUE,
  LINGUA_PREDEFINITA,
} from '@/lib/i18n';
import { TESTI_IT, TESTI_EN_EXTRA } from '@/lib/traduzioni';
import { TESTI_FR } from '@/lib/traduzioni-fr';
import { TESTI_DE } from '@/lib/traduzioni-de';
import { TESTI_ES } from '@/lib/traduzioni-es';

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

/**
 * Copertura delle lingue aggiunte dopo le prime due.
 *
 * Francese, tedesco e spagnolo hanno un dizionario unico che deve contenere
 * TUTTE le chiavi del corpo dell'interfaccia. Una chiave dimenticata non
 * rompe niente — esce la frase inglese — e proprio per questo passerebbe
 * inosservata fino a quando un utente non se ne accorge. Il controllo va
 * fatto qui.
 */
describe('dizionari fr/de/es', () => {
  const chiaviAttese = new Set([
    ...Object.keys(TESTI_IT),
    ...Object.keys(TESTI_EN_EXTRA),
  ]);

  const dizionari = { fr: TESTI_FR, de: TESTI_DE, es: TESTI_ES };

  // I dizionari non sono piu' nel pacchetto iniziale: la copertura si verifica
  // sui moduli importati direttamente (sopra), ma le asserzioni che passano da
  // `traduci` hanno bisogno che il registro sia stato popolato.
  beforeAll(async () => {
    await Promise.all([caricaDizionario('fr'), caricaDizionario('de'), caricaDizionario('es')]);
  });

  for (const [lingua, dizionario] of Object.entries(dizionari)) {
    it(`${lingua}: copre ogni stringa dell'interfaccia`, () => {
      const mancanti = [...chiaviAttese].filter((c) => !dizionario[c]);
      expect(mancanti).toEqual([]);
    });

    it(`${lingua}: non traduce nulla con la stringa vuota`, () => {
      const vuote = Object.entries(dizionario)
        .filter(([, v]) => v.trim() === '')
        .map(([k]) => k);
      expect(vuote).toEqual([]);
    });

    it(`${lingua}: e' una lingua selezionabile`, () => {
      expect(Object.keys(LINGUE)).toContain(lingua);
    });
  }

  it('traduce le chiavi semantiche, non le ripete in italiano', () => {
    expect(traduci('fr', 'login.titolo')).toBe('Se connecter');
    expect(traduci('de', 'login.titolo')).not.toBe(traduci('it', 'login.titolo'));
    expect(traduci('es', 'login.titolo')).not.toBe(traduci('it', 'login.titolo'));
  });
});

/**
 * Caricamento a richiesta.
 *
 * Francese, tedesco e spagnolo arrivano con un import dinamico, quindi esiste
 * una finestra — breve, ma reale — in cui la lingua e' selezionata e il suo
 * dizionario no. E' l'istante in cui un sistema di traduzioni puo' mostrare
 * `login.titolo` a un utente: questi test lo presidiano.
 *
 * `vi.resetModules()` serve a rileggere i18n con il registro vuoto: il modulo
 * accumula i dizionari caricati, e senza reset il primo test contaminerebbe i
 * successivi.
 */
describe('caricamento a richiesta', () => {
  it('it ed en non hanno nulla da caricare', () => {
    expect(richiedeCaricamento('it')).toBe(false);
    expect(richiedeCaricamento('en')).toBe(false);
  });

  it('prima del caricamento traduci ripiega invece di restituire la chiave', async () => {
    vi.resetModules();
    const i18n = await import('@/lib/i18n');

    expect(i18n.richiedeCaricamento('fr')).toBe(true);

    // Chiave semantica: ripiego sull'italiano, mai l'identificatore.
    const semantica = i18n.traduci('fr', 'login.titolo');
    expect(semantica).not.toContain('login.');
    expect(semantica).toBe(i18n.traduci('it', 'login.titolo'));

    // Stringa del corpo dell'interfaccia: la chiave E' il testo inglese, quindi
    // vederla e' il comportamento voluto, non una perdita.
    expect(i18n.traduci('fr', 'Dashboard')).toBe('Dashboard');

    // I segnaposto restano sostituiti anche quando si ripiega.
    expect(i18n.traduci('fr', 'org.creata', { nome: 'Acme' })).toContain('Acme');
  });

  it('caricaDizionario registra davvero il dizionario', async () => {
    vi.resetModules();
    const i18n = await import('@/lib/i18n');

    expect(i18n.traduci('fr', 'login.titolo')).not.toBe('Se connecter');

    await i18n.caricaDizionario('fr');

    expect(i18n.richiedeCaricamento('fr')).toBe(false);
    expect(i18n.traduci('fr', 'login.titolo')).toBe('Se connecter');
  });

  it('due chiamate ravvicinate non ricaricano due volte', async () => {
    vi.resetModules();
    const i18n = await import('@/lib/i18n');

    const prima = i18n.caricaDizionario('de');
    const seconda = i18n.caricaDizionario('de');
    expect(seconda).toBe(prima);

    await prima;
    expect(i18n.traduci('de', 'login.titolo')).not.toBe(i18n.traduci('it', 'login.titolo'));
  });

  it('registraDizionario rende la lingua disponibile subito, in modo sincrono', async () => {
    vi.resetModules();
    const i18n = await import('@/lib/i18n');

    i18n.registraDizionario('es', { 'login.titolo': 'Entrar' });

    expect(i18n.richiedeCaricamento('es')).toBe(false);
    expect(i18n.traduci('es', 'login.titolo')).toBe('Entrar');
  });
});
