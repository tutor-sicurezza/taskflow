import { describe, it, expect } from 'vitest';
import { derogheDalProfilo, dipendenteCorrente, ruoloInterfaccia } from '@/lib/dipendenteCorrente';
import { canPerformAction } from '@/lib/permissions';
import type { Employee } from '@/lib/types';

/**
 * L'attacco che questi controlli chiudono, riprovato in produzione il 14
 * settembre 2026 con un account 'member' vero e un token vero: il dipendente
 * riscrive l'array `employees` in app_state — cosa che il database gli
 * CONCEDE, ed e' giusto, perche' quella chiave e' lavoro quotidiano — e ci
 * mette dentro, nella riga che lo riguarda, dei permessi da responsabile.
 *
 * Prima, l'interfaccia gli credeva. La riga avvelenata qui sotto e' quella
 * scritta davvero durante la verifica, con `tasks.view_all` e `tasks.edit_any`:
 * la prima cambia i numeri in cima al cruscotto, la seconda i comandi di
 * approvazione.
 */
const RIGA_AVVELENATA: Employee = {
  id: 'utente-1',
  name: 'Dipendente',
  avatar: '',
  role: 'Collaudo',
  /*
    `userRole: 'admin'` e non 'member', ed e' il punto.

    La prima versione di questi test metteva qui 'member', cioe' la verita':
    la riga "avvelenata" e il ruolo vero coincidevano, e quindi ogni caso
    passava anche quando il codice ascoltava l'array invece del database.
    Copriva il buco solo in apparenza. `admin` e' il valore che un dipendente
    ci scriverebbe davvero, ed e' l'unico che rende visibile la differenza.
  */
  userRole: 'admin',
  status: 'active',
  joinedDate: '2026-09-14T00:00:00.000Z',
  customPermissions: { tasks: { view_all: true, edit_any: true } },
};

const PROFILO_SENZA_DEROGHE = {
  job_title: 'Collaudo',
  email: 'dipendente@esempio.it',
  departments: [],
  status: 'active' as const,
  team_lead: false,
  custom_permissions: null,
};

describe('dipendenteCorrente', () => {
  it("non ascolta i permessi scritti nell'anagrafica: quelli valgono solo dal profilo", () => {
    const io = dipendenteCorrente({
      userId: 'utente-1',
      nome: 'Dipendente',
      avatar: '',
      profilo: PROFILO_SENZA_DEROGHE,
      orgDeroghe: null,
      orgRole: 'member',
      employees: [RIGA_AVVELENATA],
    });

    // La deroga iniettata non arriva fino ai permessi.
    expect(io.customPermissions).toBeUndefined();
    expect(canPerformAction(io, 'tasks', 'view_all')).toBe(false);
    expect(canPerformAction(io, 'tasks', 'edit_any')).toBe(false);

    // E' una SOSTITUZIONE, non una fusione: se lo fosse, la riga avvelenata
    // sopravviverebbe ogni volta che il profilo non ha nulla da dire.
    expect(canPerformAction(RIGA_AVVELENATA, 'tasks', 'edit_any')).toBe(true);
  });

  it("dell'anagrafica resta l'anagrafica: ruolo e stato vengono dal database", () => {
    const io = dipendenteCorrente({
      userId: 'utente-1',
      nome: 'Nome dal profilo',
      avatar: '',
      profilo: PROFILO_SENZA_DEROGHE,
      orgDeroghe: null,
      orgRole: 'member',
      employees: [{ ...RIGA_AVVELENATA, department: 'Cantiere', skills: ['ponteggi'] }],
    });

    // Quello per cui l'array esiste passa.
    expect(io.department).toBe('Cantiere');
    expect(io.skills).toEqual(['ponteggi']);

    // Quello che decide cosa si puo' fare, no.
    expect(io.customPermissions).toBeUndefined();
    expect(io.userRole).toBe('member');
    expect(io.status).toBe('active');
    expect(io.teamLead).toBe(false);
  });

  it("il ruolo scritto nell'anagrafica non apre nessun pannello", () => {
    /*
      E' l'attacco per intero: il dipendente non tocca i permessi — quelli
      ormai sono protetti — ma si scrive `userRole: 'admin'` nella propria
      riga. Prima bastava a far comparire i comandi amministrativi finche' la
      sincronizzazione non rimarginava l'array; e se la lettura dei membri
      falliva, per tutta la sessione.
    */
    const io = dipendenteCorrente({
      userId: 'utente-1',
      nome: 'Dipendente',
      avatar: '',
      profilo: PROFILO_SENZA_DEROGHE,
      orgDeroghe: null,
      orgRole: 'member',
      employees: [RIGA_AVVELENATA],
    });

    expect(io.userRole).toBe('member');
    expect(canPerformAction(io, 'employees', 'manage_roles')).toBe(false);
    expect(canPerformAction(io, 'employees', 'delete')).toBe(false);

    // Che la riga avvelenata, da sola, otterrebbe davvero: senza questo
    // controllo il test sopra passerebbe anche se non servisse a niente.
    expect(canPerformAction(RIGA_AVVELENATA, 'employees', 'manage_roles')).toBe(true);
  });

  it("uno stato 'inactive' iniettato nell'anagrafica non vale: conta il profilo", () => {
    const io = dipendenteCorrente({
      userId: 'utente-1',
      nome: 'Dipendente',
      avatar: '',
      profilo: PROFILO_SENZA_DEROGHE,
      orgDeroghe: null,
      orgRole: 'member',
      employees: [{ ...RIGA_AVVELENATA, status: 'inactive', teamLead: true }],
    });

    expect(io.status).toBe('active');
    expect(io.teamLead).toBe(false);
  });

  it("una deroga vera, scritta da un amministratore sull'appartenenza, vale", () => {
    const io = dipendenteCorrente({
      userId: 'utente-1',
      nome: 'Dipendente',
      avatar: '',
      profilo: PROFILO_SENZA_DEROGHE,
      // Dall'APPARTENENZA, non dal profilo: e' la riga di questa
      // organizzazione, e una deroga concessa qui non deve valere altrove.
      orgDeroghe: { tasks: { edit_any: true } },
      orgRole: 'member',
      employees: [{ ...RIGA_AVVELENATA, customPermissions: undefined }],
    });

    expect(canPerformAction(io, 'tasks', 'edit_any')).toBe(true);
    // Cio' che la deroga non nomina resta quello del ruolo.
    expect(canPerformAction(io, 'employees', 'manage_roles')).toBe(false);
  });

  it("costruisce la riga dal profilo quando l'anagrafica non conosce ancora la persona", () => {
    // E' il primo accesso, o il primo render prima che la sincronizzazione
    // arrivi: e' proprio la finestra in cui la copia locale sarebbe l'unica
    // voce ascoltata.
    const io = dipendenteCorrente({
      userId: 'utente-9',
      nome: 'Nuova persona',
      avatar: 'avatar',
      emailAccesso: 'nuova@esempio.it',
      profilo: { ...PROFILO_SENZA_DEROGHE, job_title: 'Operaio', departments: ['Cantiere'] },
      orgDeroghe: null,
      orgRole: 'manager',
      employees: [RIGA_AVVELENATA],
      creatoIl: '2026-01-01T00:00:00.000Z',
    });

    expect(io).toMatchObject({
      id: 'utente-9',
      role: 'Operaio',
      userRole: 'manager',
      department: 'Cantiere',
      joinedDate: '2026-01-01T00:00:00.000Z',
      customPermissions: undefined,
    });
  });

  it('senza profilo non si eredita nulla: nessuna deroga', () => {
    const io = dipendenteCorrente({
      userId: 'utente-1',
      nome: 'Dipendente',
      avatar: '',
      profilo: null,
      orgDeroghe: null,
      orgRole: 'member',
      employees: [RIGA_AVVELENATA],
    });
    expect(io.customPermissions).toBeUndefined();
  });
});

describe('derogheDalProfilo', () => {
  it('accetta solo un oggetto con almeno una voce', () => {
    expect(derogheDalProfilo({ tasks: { edit_any: true } })).toEqual({ tasks: { edit_any: true } });
    expect(derogheDalProfilo(null)).toBeUndefined();
    expect(derogheDalProfilo({})).toBeUndefined();
    // La colonna e' jsonb: puo' contenere qualunque cosa, e nessuna di queste
    // deve diventare un permesso.
    expect(derogheDalProfilo([{ tasks: { edit_any: true } }])).toBeUndefined();
    expect(derogheDalProfilo('tutto')).toBeUndefined();
    expect(derogheDalProfilo(true)).toBeUndefined();
    expect(derogheDalProfilo(42)).toBeUndefined();
  });
});

describe('ruoloInterfaccia', () => {
  it("'owner' diventa 'admin', e qualunque cosa ignota diventa 'member'", () => {
    expect(ruoloInterfaccia('owner')).toBe('admin');
    expect(ruoloInterfaccia('admin')).toBe('admin');
    expect(ruoloInterfaccia('manager')).toBe('manager');
    expect(ruoloInterfaccia('viewer')).toBe('viewer');
    expect(ruoloInterfaccia('member')).toBe('member');
    // Il verso in cui si sbaglia conta: un ruolo che non conosciamo non deve
    // diventare 'admin'.
    expect(ruoloInterfaccia('superuser')).toBe('member');
    expect(ruoloInterfaccia(null)).toBe('member');
    expect(ruoloInterfaccia(undefined)).toBe('member');
  });
});
