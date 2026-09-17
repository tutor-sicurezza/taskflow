import { UserRole, Permission, RoleDefinition, Employee, DeroghePermessi } from './types';

export const DEFAULT_ROLES: Record<UserRole, RoleDefinition> = {
  admin: {
    role: 'admin',
    name: 'Administrator',
    description: 'Full system access with all permissions',
    permissions: {
      tasks: {
        create: true,
        edit_own: true,
        edit_any: true,
        delete_own: true,
        delete_any: true,
        view_own: true,
        view_team: true,
        view_all: true,
        assign: true,
        change_status: true,
        comment: true,
        attach_files: true,
        bulk_operations: true,
      },
      employees: {
        view: true,
        add: true,
        edit: true,
        delete: true,
        manage_roles: true,
      },
      announcements: {
        view: true,
        create: true,
        edit: true,
        delete: true,
      },
      analytics: {
        view_own: true,
        view_team: true,
        view_all: true,
      },
      ai_features: {
        use_assistant: true,
        auto_assign: true,
        get_insights: true,
        estimate_duration: true,
      },
    },
  },
  manager: {
    role: 'manager',
    name: 'Manager',
    description: 'Can manage team tasks and view team analytics',
    permissions: {
      tasks: {
        create: true,
        edit_own: true,
        edit_any: true,
        delete_own: true,
        delete_any: false,
        view_own: true,
        view_team: true,
        view_all: true,
        assign: true,
        change_status: true,
        comment: true,
        attach_files: true,
        bulk_operations: true,
      },
      employees: {
        view: true,
        add: false,
        edit: false,
        delete: false,
        manage_roles: false,
      },
      announcements: {
        view: true,
        create: true,
        edit: true,
        delete: false,
      },
      analytics: {
        view_own: true,
        view_team: true,
        view_all: true,
      },
      ai_features: {
        use_assistant: true,
        auto_assign: true,
        get_insights: true,
        estimate_duration: true,
      },
    },
  },
  member: {
    role: 'member',
    name: 'Team Member',
    description: 'Can manage own tasks and collaborate',
    permissions: {
      tasks: {
        create: true,
        edit_own: true,
        edit_any: false,
        delete_own: true,
        delete_any: false,
        view_own: true,
        view_team: true,
        view_all: false,
        assign: false,
        change_status: true,
        comment: true,
        attach_files: true,
        bulk_operations: false,
      },
      employees: {
        view: true,
        add: false,
        edit: false,
        delete: false,
        manage_roles: false,
      },
      announcements: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      analytics: {
        view_own: true,
        view_team: false,
        view_all: false,
      },
      ai_features: {
        use_assistant: true,
        auto_assign: false,
        get_insights: false,
        estimate_duration: true,
      },
    },
  },
  viewer: {
    role: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to tasks',
    permissions: {
      tasks: {
        create: false,
        edit_own: false,
        edit_any: false,
        delete_own: false,
        delete_any: false,
        view_own: true,
        view_team: true,
        view_all: false,
        assign: false,
        change_status: false,
        comment: true,
        attach_files: false,
        bulk_operations: false,
      },
      employees: {
        view: true,
        add: false,
        edit: false,
        delete: false,
        manage_roles: false,
      },
      announcements: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
      analytics: {
        view_own: true,
        view_team: false,
        view_all: false,
      },
      ai_features: {
        use_assistant: false,
        auto_assign: false,
        get_insights: false,
        estimate_duration: false,
      },
    },
  },
};

export function getEmployeePermissions(employee: Employee | null): Permission {
  if (!employee) {
    return DEFAULT_ROLES.viewer.permissions;
  }

  /*
    `userRole` arriva anche da `app_state.employees`, che e' scrivibile da
    ogni membro: un valore che non sia uno dei quattro ruoli non e' un caso
    teorico. Senza questa riga, `DEFAULT_ROLES['superadmin']` e' `undefined` e
    leggerne `.permissions` fa esplodere questa funzione — che viene chiamata
    su TUTTI i colleghi nel ciclo delle approvazioni, quindi una sola riga
    malformata portava alla schermata bianca.

    I due ripieghi sono diversi di proposito. Ruolo ASSENTE resta `member`,
    com'era: e' il caso di una riga vecchia o incompleta, e togliere di colpo
    i permessi a chi li aveva sarebbe un guasto peggiore di quello che si sta
    chiudendo. Ruolo PRESENTE ma sconosciuto ripiega invece su `viewer`: li'
    qualcuno ha scritto qualcosa che non dovrebbe esserci, e davanti a un
    ruolo che non si riconosce si concede il meno, non il piu'.
  */
  const dichiarato = employee.userRole;
  const baseRole = !dichiarato
    ? 'member'
    : dichiarato in DEFAULT_ROLES
      ? dichiarato
      : 'viewer';
  const basePermissions = DEFAULT_ROLES[baseRole].permissions;

  if (!employee.customPermissions) {
    return basePermissions;
  }

  return fondiPermessi(basePermissions, employee.customPermissions);
}

/**
 * I permessi del ruolo con sopra le deroghe, voce per voce.
 *
 * Cio' che la deroga non nomina resta quello del ruolo: e' una fusione e non
 * una sostituzione, ed e' il motivo per cui le categorie possono essere
 * parziali.
 */
export function fondiPermessi(base: Permission, custom: DeroghePermessi): Permission {
  return {
    tasks: { ...base.tasks, ...(custom.tasks || {}) },
    employees: { ...base.employees, ...(custom.employees || {}) },
    announcements: { ...base.announcements, ...(custom.announcements || {}) },
    analytics: { ...base.analytics, ...(custom.analytics || {}) },
    ai_features: { ...base.ai_features, ...(custom.ai_features || {}) },
  };
}

export function canPerformAction(
  employee: Employee | null,
  category: keyof Permission,
  action: string
): boolean {
  const permissions = getEmployeePermissions(employee);
  /*
    Il `?.` non e' pigrizia: `category` e' tipata, ma le deroghe arrivano da un
    jsonb del database e il ruolo da una chiave scrivibile, quindi una
    categoria assente a runtime e' possibile davvero. Senza, questa funzione
    lancia — e viene chiamata su tutti i colleghi nel ciclo delle
    approvazioni, cioe' una riga malformata bastava a far comparire la
    schermata di errore al posto della bacheca.

    Il ripiego e' `false`: un permesso che non si sa leggere e' un permesso
    che non c'e'.
  */
  const categoryPermissions = permissions[category] as Record<string, boolean> | undefined;
  return categoryPermissions?.[action] === true;
}

export function hasAnyPermission(
  employee: Employee | null,
  checks: Array<{ category: keyof Permission; action: string }>
): boolean {
  return checks.some(check => canPerformAction(employee, check.category, check.action));
}

export function hasAllPermissions(
  employee: Employee | null,
  checks: Array<{ category: keyof Permission; action: string }>
): boolean {
  return checks.every(check => canPerformAction(employee, check.category, check.action));
}
