import { describe, it, expect } from 'vitest';
import {
  classificaTask,
  costruisciTaskUrl,
  messaggioPromemoria,
  FINESTRA_DUE_SOON_MS,
} from './promemoriaLogica.js';

/**
 * La rotta intera non e' provabile senza un database, ma la decisione che
 * conta — "questo task merita un'email, e quale?" — e' pura e sta qui.
 *
 * Un errore in questa funzione non si vede: o nessuno riceve i promemoria, o
 * li ricevono persone che non c'entrano. In entrambi i casi non c'e' un errore
 * a schermo che lo segnali, quindi i casi limite vanno fissati qui.
 */

const ADESSO = new Date('2026-09-10T09:00:00.000Z');
const ORA = 60 * 60 * 1000;

/** Un task sano e in scadenza: ogni prova cambia solo cio' che le interessa. */
function task(sovrascritture: Partial<Parameters<typeof classificaTask>[0]> = {}) {
  return {
    status: 'in-progress',
    assignee_id: '00000000-0000-0000-0000-000000000001',
    due_date: new Date(ADESSO.getTime() + 2 * ORA).toISOString(),
    ...sovrascritture,
  };
}

describe('classificaTask', () => {
  it('avvisa in anticipo se la scadenza e fra due ore', () => {
    expect(classificaTask(task(), ADESSO)).toBe('task_due_soon');
  });

  it('tace se la scadenza e fra trenta ore', () => {
    const fraTrenta = new Date(ADESSO.getTime() + 30 * ORA).toISOString();
    expect(classificaTask(task({ due_date: fraTrenta }), ADESSO)).toBeNull();
  });

  it('segnala come scaduto un task di ieri', () => {
    const ieri = new Date(ADESSO.getTime() - 24 * ORA).toISOString();
    expect(classificaTask(task({ due_date: ieri }), ADESSO)).toBe('task_overdue');
  });

  it('non avvisa per un task gia completato, nemmeno se scaduto', () => {
    const ieri = new Date(ADESSO.getTime() - 24 * ORA).toISOString();
    expect(classificaTask(task({ status: 'completed', due_date: ieri }), ADESSO)).toBeNull();
  });

  it('avvisa per un task appena creato e non ancora iniziato', () => {
    expect(classificaTask(task({ status: 'not-started' }), ADESSO)).toBe('task_due_soon');
  });

  it('tace se il task non ha scadenza', () => {
    for (const valore of [null, undefined, '']) {
      expect(classificaTask(task({ due_date: valore }), ADESSO)).toBeNull();
    }
  });

  it('tace se la data e illeggibile invece di trattarla come scaduta', () => {
    // `new Date('domani').getTime()` e' NaN, e ogni confronto con NaN e'
    // falso: senza il controllo esplicito il task finirebbe fra i "niente da
    // fare" per caso, non per scelta.
    expect(classificaTask(task({ due_date: 'domani' }), ADESSO)).toBeNull();
  });

  it('tace se il task non ha assegnatario', () => {
    for (const valore of [null, undefined, '']) {
      expect(classificaTask(task({ assignee_id: valore }), ADESSO)).toBeNull();
    }
  });

  it('include il confine esatto delle 24 ore nella finestra di preavviso', () => {
    const alLimite = new Date(ADESSO.getTime() + FINESTRA_DUE_SOON_MS).toISOString();
    expect(classificaTask(task({ due_date: alLimite }), ADESSO)).toBe('task_due_soon');

    // Un millisecondo oltre: e' ancora presto per disturbare.
    const oltreIlLimite = new Date(ADESSO.getTime() + FINESTRA_DUE_SOON_MS + 1).toISOString();
    expect(classificaTask(task({ due_date: oltreIlLimite }), ADESSO)).toBeNull();
  });

  it('separa scaduto e in scadenza esattamente su adesso', () => {
    const adessoIso = ADESSO.toISOString();
    expect(classificaTask(task({ due_date: adessoIso }), ADESSO)).toBe('task_due_soon');

    const unMillisecondoFa = new Date(ADESSO.getTime() - 1).toISOString();
    expect(classificaTask(task({ due_date: unMillisecondoFa }), ADESSO)).toBe('task_overdue');
  });
});

describe('costruisciTaskUrl', () => {
  it('usa il formato #task-<id> gia in uso nel client', () => {
    expect(costruisciTaskUrl('https://esempio.app', 'abc')).toBe('https://esempio.app/#task-abc');
  });

  it('non raddoppia la barra se l origine finisce gia con una', () => {
    expect(costruisciTaskUrl('https://esempio.app/', 'abc')).toBe('https://esempio.app/#task-abc');
  });

  it('omette il link se l origine non e configurata', () => {
    // Meglio un'email senza link che un link a un dominio inventato: il
    // secondo sembra funzionante e non lo e'.
    expect(costruisciTaskUrl(undefined, 'abc')).toBeUndefined();
  });
});

/**
 * Il messaggio della notifica in applicazione.
 *
 * E' l'unico avviso che riceve chi ha spento le email, quindi deve esserci in
 * tutte le lingue e non deve mai uscire vuoto o in inglese per ripiego.
 */
describe('messaggioPromemoria', () => {
  const lingue = ['it', 'en', 'fr', 'de', 'es'] as const;

  it('esiste in tutte le lingue e cita il titolo', () => {
    for (const lingua of lingue) {
      for (const tipo of ['task_due_soon', 'task_overdue'] as const) {
        const m = messaggioPromemoria(lingua, tipo, 'Bilancio Q4');
        expect(m, `${lingua}/${tipo}`).toContain('Bilancio Q4');
        expect(m.length, `${lingua}/${tipo}`).toBeGreaterThan(10);
      }
    }
  });

  it('distingue la scadenza vicina dal ritardo', () => {
    for (const lingua of lingue) {
      expect(messaggioPromemoria(lingua, 'task_due_soon', 'X')).not.toBe(
        messaggioPromemoria(lingua, 'task_overdue', 'X')
      );
    }
  });

  it('ripiega sull italiano per una lingua sconosciuta', () => {
    expect(messaggioPromemoria('xx', 'task_overdue', 'X')).toBe(
      messaggioPromemoria('it', 'task_overdue', 'X')
    );
  });

  it('regge un titolo mancante senza produrre undefined', () => {
    const m = messaggioPromemoria('it', 'task_due_soon', '');
    expect(m).not.toContain('undefined');
    expect(m.trim()).not.toBe('');
  });
});
