import { describe, it, expect } from 'vitest';
import {
  GIORNI_ARCHIVIAZIONE,
  GIORNI_ESCALATION,
  daArchiviare,
  daScalare,
  dataCompletamento,
  dataDiRiferimentoArchiviazione,
  giorniDiRitardo,
  messaggioEscalation,
  sogliaRitardo,
  type TaskDaManutenere,
} from './manutenzioneTask.js';

/**
 * La rotta intera non e' provabile senza un database, ma le due decisioni che
 * cambiano dati stanno qui e sono pure: quando un task sparisce dall'elenco, e
 * quando un ritardo diventa un'email a tutti i responsabili.
 *
 * Sono anche le due che sbagliano in silenzio. Un'archiviazione anticipata non
 * produce nessun messaggio: produce un elenco piu' corto, e nessuno sa dire di
 * quanto. Un'escalation troppo facile non produce un errore: produce posta che
 * la gente impara a ignorare.
 */

const ADESSO = new Date('2026-09-10T09:00:00.000Z');
const GIORNO = 24 * 60 * 60 * 1000;

/** Un istante N giorni prima di ADESSO, in ISO. */
const giorniFa = (n: number) => new Date(ADESSO.getTime() - n * GIORNO).toISOString();

/** Un task completato con la traccia in cronologia, chiuso N giorni fa. */
const completato = (n: number, extra: Partial<TaskDaManutenere> = {}): TaskDaManutenere => ({
  status: 'completed',
  updated_at: giorniFa(n),
  activities: [
    { type: 'comment_added', createdAt: giorniFa(n + 5) },
    { type: 'status_changed', newValue: 'in-progress', createdAt: giorniFa(n + 2) },
    { type: 'status_changed', newValue: 'completed', createdAt: giorniFa(n) },
  ],
  ...extra,
});

describe('dataCompletamento', () => {
  it('legge la data dallattivita di passaggio a completed', () => {
    expect(dataCompletamento(completato(3))?.toISOString()).toBe(giorniFa(3));
  });

  it('su un task non completato non risponde, qualunque cosa dica la cronologia', () => {
    const riaperto = { ...completato(3), status: 'in-progress' };
    expect(dataCompletamento(riaperto)).toBeNull();
  });

  it('con piu chiusure tiene lultima: un task riaperto e richiuso e stato chiuso lultima volta', () => {
    const task: TaskDaManutenere = {
      status: 'completed',
      activities: [
        { type: 'status_changed', newValue: 'completed', createdAt: giorniFa(40) },
        { type: 'status_changed', newValue: 'completed', createdAt: giorniFa(2) },
      ],
    };
    expect(dataCompletamento(task)?.toISOString()).toBe(giorniFa(2));
  });

  it('senza traccia in cronologia non inventa una data', () => {
    expect(dataCompletamento({ status: 'completed', activities: [] })).toBeNull();
  });

  it('regge un JSONB malformato invece di far fallire lesecuzione pianificata', () => {
    // `activities` arriva dal database come JSON grezzo: puo' essere qualunque
    // cosa ci abbia scritto un import o una versione precedente.
    expect(dataCompletamento({ status: 'completed', activities: null })).toBeNull();
    expect(
      dataCompletamento({
        status: 'completed',
        activities: [{ type: 'status_changed', newValue: 'completed', createdAt: 'ieri' }],
      })
    ).toBeNull();
  });
});

describe('dataDiRiferimentoArchiviazione', () => {
  it('preferisce sempre la cronologia', () => {
    const task = completato(3, { updated_at: giorniFa(1) });
    expect(dataDiRiferimentoArchiviazione(task)?.toISOString()).toBe(giorniFa(3));
  });

  it('ripiega su updated_at quando la traccia non ce, invece di non archiviare mai', () => {
    // Il caso dei task migrati da app_state, o chiusi prima che la cronologia
    // esistesse. Senza ripiego resterebbero nell'elenco per sempre, che e' il
    // difetto che questa funzione deve chiudere.
    const migrato: TaskDaManutenere = {
      status: 'completed',
      updated_at: giorniFa(90),
      activities: [],
    };
    expect(dataDiRiferimentoArchiviazione(migrato)?.toISOString()).toBe(giorniFa(90));
  });
});

describe('daArchiviare', () => {
  it('completato ieri: no', () => {
    expect(daArchiviare(completato(1), GIORNI_ARCHIVIAZIONE, ADESSO)).toBe(false);
  });

  it('completato oltre la soglia: si', () => {
    expect(
      daArchiviare(completato(GIORNI_ARCHIVIAZIONE + 1), GIORNI_ARCHIVIAZIONE, ADESSO)
    ).toBe(true);
  });

  it('esattamente sulla soglia: si, il confine e incluso', () => {
    // Escluderlo non sposta il comportamento di un giorno: lo rende dipendente
    // dal minuto in cui gira il lavoro pianificato.
    expect(daArchiviare(completato(GIORNI_ARCHIVIAZIONE), GIORNI_ARCHIVIAZIONE, ADESSO)).toBe(
      true
    );
  });

  it('gia archiviato: no, altrimenti archived_at si sposterebbe in avanti ogni giorno', () => {
    const task = completato(90, { archived_at: giorniFa(30) });
    expect(daArchiviare(task, GIORNI_ARCHIVIAZIONE, ADESSO)).toBe(false);
  });

  it('non completato: no, per quanto vecchio sia', () => {
    const aperto: TaskDaManutenere = { status: 'in-progress', updated_at: giorniFa(400) };
    expect(daArchiviare(aperto, GIORNI_ARCHIVIAZIONE, ADESSO)).toBe(false);
  });

  it('senza traccia in cronologia usa il ripiego e decide con quello', () => {
    const vecchio: TaskDaManutenere = {
      status: 'completed',
      updated_at: giorniFa(GIORNI_ARCHIVIAZIONE + 10),
      activities: [],
    };
    const recente: TaskDaManutenere = {
      status: 'completed',
      updated_at: giorniFa(2),
      activities: [],
    };
    expect(daArchiviare(vecchio, GIORNI_ARCHIVIAZIONE, ADESSO)).toBe(true);
    expect(daArchiviare(recente, GIORNI_ARCHIVIAZIONE, ADESSO)).toBe(false);
  });
});

describe('daScalare', () => {
  const inRitardo = (n: number, extra: Partial<TaskDaManutenere> = {}): TaskDaManutenere => ({
    status: 'in-progress',
    due_date: giorniFa(n),
    ...extra,
  });

  it('scaduto da poco: no, ci hanno gia pensato i promemoria', () => {
    expect(daScalare(inRitardo(1), GIORNI_ESCALATION, ADESSO)).toBe(false);
  });

  it('scaduto da molto: si', () => {
    expect(daScalare(inRitardo(GIORNI_ESCALATION + 3), GIORNI_ESCALATION, ADESSO)).toBe(true);
  });

  it('esattamente sulla soglia: si', () => {
    expect(daScalare(inRitardo(GIORNI_ESCALATION), GIORNI_ESCALATION, ADESSO)).toBe(true);
  });

  it('senza scadenza: mai, per quanto vecchio sia il task', () => {
    // La scadenza e' facoltativa (0020) proprio perche' prima chi non ne aveva
    // una se la inventava. Un'escalation su una data inventata arriverebbe a un
    // dirigente: e' la versione peggiore di quel difetto.
    expect(daScalare({ status: 'in-progress' }, GIORNI_ESCALATION, ADESSO)).toBe(false);
    expect(daScalare({ status: 'in-progress', due_date: null }, GIORNI_ESCALATION, ADESSO)).toBe(
      false
    );
  });

  it('completato: no, anche se la scadenza e passata da mesi', () => {
    expect(daScalare(inRitardo(200, { status: 'completed' }), GIORNI_ESCALATION, ADESSO)).toBe(
      false
    );
  });

  it('bloccato: si, ed e proprio il caso che serve vedere', () => {
    // 'blocked' non e' uno stato terminale: un task fermo da una settimana per
    // un ostacolo esterno e' l'esempio tipico di cio' che un responsabile puo'
    // sbloccare e l'assegnatario no.
    expect(daScalare(inRitardo(20, { status: 'blocked' }), GIORNI_ESCALATION, ADESSO)).toBe(true);
  });

  it('archiviato: no, riportarlo nella posta di tutti sarebbe resuscitarlo', () => {
    expect(
      daScalare(inRitardo(60, { archived_at: giorniFa(5) }), GIORNI_ESCALATION, ADESSO)
    ).toBe(false);
  });

  it('con una data malformata non scala: nel dubbio si tace', () => {
    expect(daScalare(inRitardo(0, { due_date: 'boh' }), GIORNI_ESCALATION, ADESSO)).toBe(false);
  });
});

describe('giorniDiRitardo', () => {
  it('conta i giorni interi passati dalla scadenza', () => {
    expect(giorniDiRitardo({ due_date: giorniFa(9) }, ADESSO)).toBe(9);
  });

  it('non e mai negativo, e senza scadenza vale zero', () => {
    // Il numero finisce dentro un messaggio letto da una persona: "in ritardo
    // da -3 giorni" e' peggio di nessun messaggio.
    expect(giorniDiRitardo({ due_date: giorniFa(-5) }, ADESSO)).toBe(0);
    expect(giorniDiRitardo({}, ADESSO)).toBe(0);
  });
});

describe('sogliaRitardo', () => {
  it('guarda nel passato: e il verso in cui si sbaglia di segno', () => {
    // Con il segno invertito la soglia finirebbe nel futuro e verrebbe scalato
    // OGNI task aperto, compresi quelli che scadono fra un mese.
    const limite = sogliaRitardo(ADESSO, GIORNI_ESCALATION);
    expect(new Date(limite).getTime()).toBe(ADESSO.getTime() - GIORNI_ESCALATION * GIORNO);
    expect(new Date(limite).getTime()).toBeLessThan(ADESSO.getTime());
  });

  it('produce ISO 8601 in UTC, il formato che PostgREST confronta senza ambiguita di fuso', () => {
    expect(sogliaRitardo(ADESSO, GIORNI_ESCALATION)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });
});

describe('messaggioEscalation', () => {
  it('dice il titolo e da quanto: le due cose che servono a chi deve intervenire', () => {
    const testo = messaggioEscalation('it', 'Verifica antincendio', 9);
    expect(testo).toContain('Verifica antincendio');
    expect(testo).toContain('9');
  });

  it('ripiega sullitaliano per una lingua che non conosce, invece di restare vuoto', () => {
    expect(messaggioEscalation('pt', 'Audit', 8)).toBe(messaggioEscalation('it', 'Audit', 8));
  });

  it('traduce nelle lingue previste', () => {
    expect(messaggioEscalation('en', 'Audit', 8)).toContain('overdue');
    expect(messaggioEscalation('es', 'Audit', 8)).toContain('retraso');
  });
});
