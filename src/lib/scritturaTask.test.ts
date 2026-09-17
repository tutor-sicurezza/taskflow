import { describe, it, expect } from 'vitest';
import { fondiPerId, taskToRow } from '@/lib/scritturaTask';
import type { Task } from '@/lib/types';

const BASE: Task = {
  id: 'task-1',
  title: 'Verifica ponteggio 3',
  description: '',
  status: 'in-progress',
  priority: 'medium',
  assigneeId: 'anna',
  dueDate: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
  comments: [],
  activities: [],
};

const commento = (id: string, chi: string) => ({
  id,
  taskId: 'task-1',
  userId: chi,
  userName: chi,
  userAvatar: '',
  content: `nota di ${chi}`,
  createdAt: '2026-09-17T10:00:00.000Z',
});

describe('taskToRow', () => {
  it('scrive solo le colonne davvero cambiate', () => {
    const dopo = { ...BASE, title: 'Verifica ponteggio 4' };
    const riga = taskToRow(dopo, BASE);

    expect(Object.keys(riga).sort()).toEqual(['title', 'updated_at']);
  });

  it("non rimanda indietro un'approvazione che questa modifica non ha toccato", () => {
    /*
      E' il caso peggiore, e il motivo per cui questo file esiste. La scheda ha
      in memoria una fotografia precedente all'approvazione; l'utente cambia il
      titolo. Prima si spedivano anche `approved_by: null` e `approved_at:
      null`, e nessun trigger li ferma: la 0023 non controlla un visto che
      viene TOLTO, la 0026 azzera solo se cambia lo stato. La firma spariva
      dalla riga mentre la cronologia continuava a dire "approvato".
    */
    const vecchia: Task = { ...BASE, requiresApproval: true };
    const modificata: Task = { ...vecchia, title: 'Titolo corretto' };

    const riga = taskToRow(modificata, vecchia);

    expect(riga).not.toHaveProperty('approved_by');
    expect(riga).not.toHaveProperty('approved_at');
    expect(riga).not.toHaveProperty('comments');
    expect(riga).not.toHaveProperty('activities');
  });

  it("un'approvazione concessa davvero viene scritta", () => {
    const dopo: Task = {
      ...BASE,
      requiresApproval: true,
      approvedBy: 'mario',
      approvedAt: '2026-09-17T11:00:00.000Z',
    };
    const riga = taskToRow(dopo, { ...BASE, requiresApproval: true });

    expect(riga.approved_by).toBe('mario');
    expect(riga.approved_at).toBe('2026-09-17T11:00:00.000Z');
  });

  it('senza riga precedente scrive tutto: e il ripristino di un allegato mai letto', () => {
    const riga = taskToRow(BASE, undefined);
    expect(riga).toHaveProperty('title');
    expect(riga).toHaveProperty('status');
    // `attachments` resta fuori finche' non e' stato letto: e' la garanzia che
    // cambiare un titolo non cancella cinquanta allegati.
    expect(riga).not.toHaveProperty('attachments');
  });

  it("`updated_at` c'e' sempre, anche quando non cambia nient'altro", () => {
    const riga = taskToRow(BASE, BASE);
    expect(Object.keys(riga)).toEqual(['updated_at']);
  });
});

describe('fondiPerId', () => {
  it('tiene il commento che un collega ha scritto nel frattempo', () => {
    const miaBase = [commento('c1', 'anna')];
    const suDatabase = [commento('c1', 'anna'), commento('c2', 'bruno')];
    const mioDopo = [commento('c1', 'anna'), commento('c3', 'anna')];

    const esito = fondiPerId(suDatabase, miaBase, mioDopo);

    expect(esito.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('una rimozione voluta resta una rimozione', () => {
    const prima = [commento('c1', 'anna'), commento('c2', 'bruno')];
    const suDatabase = [commento('c1', 'anna'), commento('c2', 'bruno')];
    const dopo = [commento('c1', 'anna')];

    expect(fondiPerId(suDatabase, prima, dopo).map((c) => c.id)).toEqual(['c1']);
  });

  it("non resuscita una voce che non era nella mia base: non e' mia da togliere", () => {
    const prima = [commento('c1', 'anna')];
    const suDatabase = [commento('c1', 'anna'), commento('c9', 'bruno')];
    const dopo = [commento('c1', 'anna')];

    // c9 non compare in `prima`: questa modifica non lo ha tolto, semplicemente
    // non lo conosceva. Va lasciato dov'e'.
    expect(fondiPerId(suDatabase, prima, dopo).map((c) => c.id)).toEqual(['c1', 'c9']);
  });

  it('una modifica a una voce esistente vince sulla versione del database', () => {
    const prima = [commento('c1', 'anna')];
    const suDatabase = [commento('c1', 'anna')];
    const dopo = [{ ...commento('c1', 'anna'), content: 'corretto' }];

    expect(fondiPerId(suDatabase, prima, dopo)[0].content).toBe('corretto');
  });

  it("con il database vuoto si scrive semplicemente cio' che si ha", () => {
    expect(fondiPerId([], [], [commento('c1', 'anna')]).map((c) => c.id)).toEqual(['c1']);
  });
});
