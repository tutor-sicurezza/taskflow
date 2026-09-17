import { describe, it, expect } from 'vitest';
import { MAX_SOTTOATTIVITA, normalizzaNuovoTask } from './nuovoTask.js';

/**
 * POST /api/tasks scrive con il service role, quindi policy e trigger non
 * guardano queste righe: questa funzione e' l'unica cosa fra il corpo di una
 * richiesta e la tabella. I casi qui sotto sono le scorciatoie che un client
 * scritto a mano proverebbe per prime.
 */

const AUTORE = '11111111-1111-4111-8111-111111111111';
const COLLEGA = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';

function minimo(extra: Record<string, unknown> = {}) {
  return { id: ID, title: 'Controllo estintori', ...extra };
}

function riga(corpo: Record<string, unknown>) {
  const esito = normalizzaNuovoTask(corpo, AUTORE);
  if (!esito.ok) throw new Error(esito.errore);
  return esito.task;
}

describe('normalizzaNuovoTask', () => {
  it('un corpo minimo produce una riga completa con i valori predefiniti', () => {
    const { riga: r, assigneeId, watchers, blockedBy } = riga(minimo());
    expect(r).toMatchObject({
      id: ID,
      title: 'Controllo estintori',
      description: '',
      assignee_id: null,
      priority: 'medium',
      status: 'not-started',
      due_date: null,
      labels: [],
      subtasks: [],
      blocked_by: [],
      watchers: [],
      recurrence: null,
      recurrence_parent: null,
      archived_at: null,
      requires_approval: false,
      approved_by: null,
      approved_at: null,
      comments: [],
      activities: [],
    });
    // organization_id e created_by li decide la rotta, mai il corpo.
    expect(r).not.toHaveProperty('organization_id');
    expect(r).not.toHaveProperty('created_by');
    // La colonna attachments non si nomina se non ci sono allegati.
    expect(r).not.toHaveProperty('attachments');
    expect(assigneeId).toBeNull();
    expect(watchers).toEqual([]);
    expect(blockedBy).toEqual([]);
  });

  it('ignora organization_id e created_by anche se il corpo li manda', () => {
    const { riga: r } = riga(minimo({ organization_id: 'altra', created_by: COLLEGA, createdBy: COLLEGA }));
    expect(r).not.toHaveProperty('organization_id');
    expect(r).not.toHaveProperty('created_by');
  });

  it('rifiuta un corpo senza titolo, o che non e un oggetto', () => {
    expect(normalizzaNuovoTask(minimo({ title: '   ' }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(null, AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask([minimo()], AUTORE).ok).toBe(false);
  });

  it('accetta solo un uuid come id: un id inventato fallirebbe piu avanti in modo illeggibile', () => {
    expect(normalizzaNuovoTask(minimo({ id: '1788948852606' }), AUTORE).ok).toBe(false);
    // Senza id la riga non lo nomina: lo genera il database.
    expect(riga({ title: 'x' }).riga).not.toHaveProperty('id');
  });

  it('nessun task nasce approvato, archiviato, completato o occorrenza di una serie', () => {
    expect(normalizzaNuovoTask(minimo({ approvedBy: AUTORE }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ approvedAt: '2026-09-14T00:00:00Z' }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ archivedAt: '2026-09-14T00:00:00Z' }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ status: 'completed' }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ recurrenceParent: ID }), AUTORE).ok).toBe(false);
    // Mandarli a null e' invece innocuo: e' quello che fa il client.
    expect(normalizzaNuovoTask(minimo({ approvedBy: null, archivedAt: null, recurrenceParent: null }), AUTORE).ok).toBe(true);
  });

  it('gli stati iniziali ammessi sono tre, e "blocked" e uno di questi', () => {
    for (const status of ['not-started', 'in-progress', 'blocked']) {
      expect(riga(minimo({ status })).riga.status).toBe(status);
    }
    expect(normalizzaNuovoTask(minimo({ status: 'done' }), AUTORE).ok).toBe(false);
  });

  it('consegna alla rotta gli id da verificare sul database', () => {
    const t = riga(minimo({ assigneeId: COLLEGA, watchers: [COLLEGA, COLLEGA], blockedBy: [ID, AUTORE] }));
    expect(t.assigneeId).toBe(COLLEGA);
    // Doppioni tolti.
    expect(t.watchers).toEqual([COLLEGA]);
    // Il proprio id non compare fra i bloccanti (vincolo della 0022).
    expect(t.blockedBy).toEqual([AUTORE]);
    expect(t.riga.blocked_by).toEqual([AUTORE]);
  });

  it('un assegnatario vuoto vale come nessuno, uno non uuid e un errore', () => {
    expect(riga(minimo({ assigneeId: '' })).assigneeId).toBeNull();
    expect(normalizzaNuovoTask(minimo({ assigneeId: 'mario' }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ watchers: ['mario'] }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ blockedBy: 'non-un-elenco' }), AUTORE).ok).toBe(false);
  });

  it('commenti, cronologia e allegati devono essere firmati da chi crea', () => {
    const creato = { id: 'a1', taskId: ID, userId: AUTORE, type: 'created' };
    expect(riga(minimo({ activities: [creato] })).riga.activities).toEqual([creato]);

    const finto = { ...creato, userId: COLLEGA };
    expect(normalizzaNuovoTask(minimo({ activities: [finto] }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ comments: [{ id: 'c1', userId: COLLEGA, content: 'ok' }] }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ attachments: [{ id: 'f1', uploadedBy: COLLEGA }] }), AUTORE).ok).toBe(false);
    expect(riga(minimo({ attachments: [{ id: 'f1', uploadedBy: AUTORE }] })).riga.attachments).toHaveLength(1);
  });

  it('la scadenza e facoltativa e viene normalizzata in ISO', () => {
    expect(riga(minimo()).riga.due_date).toBeNull();
    expect(riga(minimo({ dueDate: null })).riga.due_date).toBeNull();
    expect(riga(minimo({ dueDate: '2026-09-20T10:00:00+02:00' })).riga.due_date).toBe('2026-09-20T08:00:00.000Z');
    expect(normalizzaNuovoTask(minimo({ dueDate: 'domani' }), AUTORE).ok).toBe(false);
  });

  it('stima e tempo impiegato sono minuti interi non negativi, o nulli', () => {
    expect(riga(minimo({ estimateMinutes: 90, spentMinutes: null })).riga).toMatchObject({
      estimate_minutes: 90,
      spent_minutes: null,
    });
    expect(normalizzaNuovoTask(minimo({ estimateMinutes: -1 }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ estimateMinutes: 1.5 }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ spentMinutes: '30' }), AUTORE).ok).toBe(false);
  });

  it('i passi vengono ripuliti e hanno un tetto', () => {
    const t = riga(minimo({ subtasks: [{ id: 'p1', title: '  Verifica  ', done: 'si' }] }));
    expect(t.riga.subtasks).toEqual([
      expect.objectContaining({ id: 'p1', title: 'Verifica', done: false }),
    ]);

    const troppi = Array.from({ length: MAX_SOTTOATTIVITA + 1 }, (_, i) => ({ id: `p${i}`, title: 'x' }));
    expect(normalizzaNuovoTask(minimo({ subtasks: troppi }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ subtasks: [{ id: 'p1', title: '' }] }), AUTORE).ok).toBe(false);
    expect(normalizzaNuovoTask(minimo({ subtasks: [{ id: 'p1', title: 'a' }, { id: 'p1', title: 'b' }] }), AUTORE).ok).toBe(false);
  });

  it('la ricorrenza passa dallo stesso validatore del lavoro pianificato', () => {
    expect(riga(minimo({ recurrence: { tipo: 'settimane', ogni: 1, giorniSettimana: [1] } })).riga.recurrence).toEqual({
      tipo: 'settimane',
      ogni: 1,
      giorniSettimana: [1],
    });
    expect(normalizzaNuovoTask(minimo({ recurrence: { tipo: 'anni', ogni: 1 } }), AUTORE).ok).toBe(false);
    expect(riga(minimo({ recurrence: null })).riga.recurrence).toBeNull();
  });

  it('le etichette sono testi ripuliti e senza doppioni', () => {
    expect(riga(minimo({ labels: [' urgente', 'urgente', '', 'sede'] })).riga.labels).toEqual(['urgente', 'sede']);
    expect(normalizzaNuovoTask(minimo({ labels: [1] }), AUTORE).ok).toBe(false);
  });
});
