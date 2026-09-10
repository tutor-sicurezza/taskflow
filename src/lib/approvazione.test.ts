import { describe, it, expect } from 'vitest';
import {
  richiedeApprovazione,
  eApprovato,
  statoApprovazione,
  inAttesaDiApprovazione,
  eChiusoDavvero,
  valutaApprovazione,
  puoApprovare,
  campiApprovazione,
  campiRifiuto,
  campiCambioStato,
  nomeApprovatore,
} from '@/lib/approvazione';
import type { Employee, Task, UserRole } from '@/lib/types';

const task = (parziale: Partial<Task> = {}): Task =>
  ({
    id: 't1',
    title: 'Lavoro',
    description: '',
    assigneeId: 'anna',
    priority: 'medium',
    status: 'completed',
    createdAt: new Date().toISOString(),
    requiresApproval: true,
    approvedBy: null,
    approvedAt: null,
    ...parziale,
  }) as Task;

const persona = (id: string, userRole: UserRole): Employee =>
  ({
    id,
    name: id.toUpperCase(),
    avatar: '',
    role: '',
    userRole,
    status: 'active',
    joinedDate: '2024-01-01',
  }) as Employee;

const ANNA = persona('anna', 'member');
const CAPO = persona('capo', 'manager');
const ADMIN = persona('admin', 'admin');
const OSPITE = persona('ospite', 'viewer');

describe('approvazione — stato del task', () => {
  it('distingue le tre situazioni possibili', () => {
    expect(statoApprovazione(task({ requiresApproval: false }))).toBe('non-richiesta');
    expect(statoApprovazione(task())).toBe('in-attesa');
    expect(
      statoApprovazione(task({ approvedBy: 'capo', approvedAt: '2026-01-01T10:00:00.000Z' }))
    ).toBe('approvata');
  });

  it('non considera approvato un visto senza chi lo ha dato', () => {
    // Meta' scrittura o riga migrata: meglio richiedere di nuovo il visto che
    // dare per buona un'approvazione che nessuno si e' intestato.
    expect(eApprovato(task({ approvedAt: '2026-01-01T10:00:00.000Z' }))).toBe(false);
    expect(eApprovato(task({ approvedBy: 'capo' }))).toBe(false);
    expect(eApprovato(task({ approvedBy: 'capo', approvedAt: '2026-01-01T10:00:00.000Z' }))).toBe(true);
  });

  it('aspetta un visto solo dopo che l assegnatario ha dichiarato di aver finito', () => {
    expect(inAttesaDiApprovazione(task({ status: 'in-progress' }))).toBe(false);
    expect(inAttesaDiApprovazione(task({ status: 'blocked' }))).toBe(false);
    expect(inAttesaDiApprovazione(task({ status: 'completed' }))).toBe(true);
  });

  it('non aspetta niente se l approvazione non e richiesta', () => {
    expect(richiedeApprovazione(task({ requiresApproval: false }))).toBe(false);
    expect(richiedeApprovazione(task({ requiresApproval: undefined }))).toBe(false);
    expect(inAttesaDiApprovazione(task({ requiresApproval: false }))).toBe(false);
  });
});

describe('approvazione — cosa conta come chiuso', () => {
  it('completed non basta se manca il visto', () => {
    // E' il punto dell'intero meccanismo: per l'assegnatario e' finito, per
    // l'organizzazione e' ancora lavoro aperto.
    expect(eChiusoDavvero(task())).toBe(false);
  });

  it('chiude un task normale e un task approvato', () => {
    expect(eChiusoDavvero(task({ requiresApproval: false }))).toBe(true);
    expect(
      eChiusoDavvero(task({ approvedBy: 'capo', approvedAt: '2026-01-01T10:00:00.000Z' }))
    ).toBe(true);
  });

  it('non chiude niente che non sia completed', () => {
    expect(eChiusoDavvero(task({ status: 'in-progress', requiresApproval: false }))).toBe(false);
    expect(
      eChiusoDavvero(task({ status: 'in-progress', approvedBy: 'capo', approvedAt: 'x' }))
    ).toBe(false);
  });
});

describe('approvazione — chi puo approvare', () => {
  it('un responsabile che non e l assegnatario puo', () => {
    expect(puoApprovare(task(), CAPO)).toBe(true);
    expect(puoApprovare(task(), ADMIN)).toBe(true);
  });

  it('l assegnatario non approva il proprio lavoro, nemmeno se admin', () => {
    expect(valutaApprovazione(task({ assigneeId: 'anna' }), ANNA).motivo).toBe('e-assegnatario');
    const capoAssegnatario = task({ assigneeId: 'admin' });
    expect(valutaApprovazione(capoAssegnatario, ADMIN)).toEqual({
      puo: false,
      motivo: 'e-assegnatario',
    });
  });

  it('senza il permesso sul lavoro altrui non si approva', () => {
    expect(valutaApprovazione(task(), persona('bruno', 'member')).motivo).toBe('senza-permesso');
    expect(valutaApprovazione(task(), OSPITE).motivo).toBe('senza-permesso');
  });

  it('non si approva un task che non sta aspettando', () => {
    expect(valutaApprovazione(task({ status: 'in-progress' }), CAPO).motivo).toBe('non-in-attesa');
    expect(valutaApprovazione(task({ requiresApproval: false }), CAPO).motivo).toBe('non-in-attesa');
    expect(
      valutaApprovazione(task({ approvedBy: 'admin', approvedAt: 'x' }), CAPO).motivo
    ).toBe('non-in-attesa');
  });

  it('senza utente non si approva', () => {
    expect(valutaApprovazione(task(), null).motivo).toBe('senza-utente');
    expect(valutaApprovazione(task(), undefined).motivo).toBe('senza-utente');
  });
});

describe('approvazione — le modifiche da salvare', () => {
  it('approvando registra chi e quando, lasciando il task completato', () => {
    const ora = new Date('2026-03-01T09:30:00.000Z');
    expect(campiApprovazione('capo', ora)).toEqual({
      status: 'completed',
      approvedBy: 'capo',
      approvedAt: '2026-03-01T09:30:00.000Z',
    });
  });

  it('il task diventa chiuso davvero solo dopo l approvazione', () => {
    const prima = task();
    expect(eChiusoDavvero(prima)).toBe(false);
    const dopo = { ...prima, ...campiApprovazione('capo') };
    expect(eChiusoDavvero(dopo)).toBe(true);
    expect(inAttesaDiApprovazione(dopo)).toBe(false);
  });

  it('rifiutando si torna in lavorazione e si azzera ogni visto precedente', () => {
    const approvato = task({ approvedBy: 'capo', approvedAt: '2026-01-01T10:00:00.000Z' });
    const dopo = { ...approvato, ...campiRifiuto() };
    expect(dopo.status).toBe('in-progress');
    expect(eApprovato(dopo)).toBe(false);
    expect(eChiusoDavvero(dopo)).toBe(false);
    // Torna in attesa non appena l'assegnatario ridichiara di aver finito.
    expect(statoApprovazione(dopo)).toBe('in-attesa');
  });
});

describe('approvazione — cambio di stato', () => {
  it('un task riaperto e richiuso non resta approvato dalla volta prima', () => {
    const approvato = task({ approvedBy: 'capo', approvedAt: '2026-01-01T10:00:00.000Z' });
    const riaperto = { ...approvato, ...campiCambioStato(approvato, 'in-progress') };
    expect(eApprovato(riaperto)).toBe(false);

    const richiuso = { ...riaperto, ...campiCambioStato(riaperto, 'completed') };
    expect(inAttesaDiApprovazione(richiuso)).toBe(true);
    expect(eChiusoDavvero(richiuso)).toBe(false);
  });

  it('su un task senza approvazione il cambio di stato non tocca altro', () => {
    const normale = task({ requiresApproval: false, status: 'in-progress' });
    const dopo = { ...normale, ...campiCambioStato(normale, 'completed') };
    expect(dopo.approvedBy).toBeNull();
    expect(eChiusoDavvero(dopo)).toBe(true);
  });
});

describe('approvazione — chi ha approvato', () => {
  it('trova il nome, e regge chi non e piu in elenco', () => {
    const approvato = task({ approvedBy: 'capo', approvedAt: 'x' });
    expect(nomeApprovatore(approvato, [ANNA, CAPO])).toBe('CAPO');
    expect(nomeApprovatore(approvato, [ANNA])).toBeNull();
    expect(nomeApprovatore(approvato, undefined)).toBeNull();
    expect(nomeApprovatore(task(), [CAPO])).toBeNull();
  });
});
