import { describe, it, expect } from 'vitest';
import { canPerformAction } from '@/lib/permissions';
import type { Employee, UserRole } from '@/lib/types';

/**
 * Matrice dei permessi per ruolo.
 *
 * Non e' una verifica di facciata: questi controlli decidono cosa compare
 * nell'interfaccia, e durante l'audit si e' scoperto che pannelli distruttivi
 * (backup, ripristino, "Clear All Data") erano visibili a chiunque perche' non
 * erano agganciati ad alcun permesso. I test fissano le aspettative, cosi' un
 * ruolo non puo' allargarsi per distrazione.
 *
 * Restano comunque controlli sull'INTERFACCIA. L'autorizzazione vera sta nelle
 * policy RLS e nelle rotte api/: un permesso concesso qui e negato li' produce
 * un errore visibile, mai un accesso.
 */
function membroCon(userRole: UserRole): Employee {
  return {
    id: 'utente-1',
    name: 'Utente di prova',
    avatar: '',
    role: 'Ruolo aziendale',
    userRole,
    status: 'active',
    joinedDate: new Date().toISOString(),
  };
}

describe('canPerformAction', () => {
  it('l\'amministratore puo gestire l\'anagrafica e i ruoli', () => {
    const admin = membroCon('admin');
    expect(canPerformAction(admin, 'employees', 'add')).toBe(true);
    expect(canPerformAction(admin, 'employees', 'edit')).toBe(true);
    expect(canPerformAction(admin, 'employees', 'delete')).toBe(true);
    expect(canPerformAction(admin, 'employees', 'manage_roles')).toBe(true);
  });

  it('il manager coordina il lavoro ma non tocca l\'anagrafica', () => {
    const manager = membroCon('manager');
    expect(canPerformAction(manager, 'tasks', 'assign')).toBe(true);
    expect(canPerformAction(manager, 'tasks', 'edit_any')).toBe(true);
    expect(canPerformAction(manager, 'employees', 'view')).toBe(true);
    expect(canPerformAction(manager, 'employees', 'add')).toBe(false);
    expect(canPerformAction(manager, 'employees', 'edit')).toBe(false);
    expect(canPerformAction(manager, 'employees', 'manage_roles')).toBe(false);
  });

  it('il membro lavora sui propri task e non amministra nulla', () => {
    const membro = membroCon('member');
    expect(canPerformAction(membro, 'tasks', 'create')).toBe(true);
    expect(canPerformAction(membro, 'tasks', 'edit_own')).toBe(true);
    expect(canPerformAction(membro, 'tasks', 'edit_any')).toBe(false);
    expect(canPerformAction(membro, 'employees', 'add')).toBe(false);
    expect(canPerformAction(membro, 'employees', 'edit')).toBe(false);
    expect(canPerformAction(membro, 'employees', 'delete')).toBe(false);
    expect(canPerformAction(membro, 'employees', 'manage_roles')).toBe(false);
  });

  it('il viewer non scrive nulla', () => {
    const viewer = membroCon('viewer');
    expect(canPerformAction(viewer, 'tasks', 'view_own')).toBe(true);
    expect(canPerformAction(viewer, 'tasks', 'create')).toBe(false);
    expect(canPerformAction(viewer, 'tasks', 'edit_own')).toBe(false);
    expect(canPerformAction(viewer, 'tasks', 'change_status')).toBe(false);
    expect(canPerformAction(viewer, 'employees', 'add')).toBe(false);
  });

  it('un utente assente non ha permessi, invece di ereditarli', () => {
    // I pannelli ricevono `currentEmployee` che puo' essere null durante il
    // caricamento: se in quel momento la funzione concedesse, comparirebbero
    // comandi amministrativi per una frazione di secondo a chiunque.
    expect(canPerformAction(null, 'employees', 'add')).toBe(false);
    expect(canPerformAction(null, 'tasks', 'delete_any')).toBe(false);
  });

  it('i permessi personalizzati sovrascrivono quelli del ruolo', () => {
    const membro = membroCon('member');
    const conDeroga: Employee = {
      ...membro,
      customPermissions: {
        employees: { view: true, add: true, edit: false, delete: false, manage_roles: false },
      },
    };

    expect(canPerformAction(conDeroga, 'employees', 'add')).toBe(true);
    // Cio' che la deroga non menziona resta quello del ruolo.
    expect(canPerformAction(conDeroga, 'tasks', 'edit_any')).toBe(false);
  });
});
