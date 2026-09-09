import { UserRole, Permission, RoleDefinition, Employee } from './types';

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

  const baseRole = employee.userRole || 'member';
  const basePermissions = DEFAULT_ROLES[baseRole].permissions;

  if (!employee.customPermissions) {
    return basePermissions;
  }

  return mergePermissions(basePermissions, employee.customPermissions);
}

function mergePermissions(base: Permission, custom: Partial<Permission>): Permission {
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
  const categoryPermissions = permissions[category] as Record<string, boolean>;
  return categoryPermissions[action] === true;
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
