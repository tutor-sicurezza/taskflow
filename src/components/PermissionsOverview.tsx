import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, Check, X, Eye } from '@phosphor-icons/react';
import { Employee, UserRole, Permission } from '@/lib/types';
import { DEFAULT_ROLES, getEmployeePermissions } from '@/lib/permissions';

interface PermissionsOverviewProps {
  employee: Employee | null;
}

const PERMISSION_LABELS: Record<keyof Permission, string> = {
  tasks: 'Task Management',
  employees: 'Employee Management',
  announcements: 'Announcements',
  analytics: 'Analytics',
  ai_features: 'AI Features',
};

const PERMISSION_DESCRIPTIONS: Record<keyof Permission, Record<string, string>> = {
  tasks: {
    create: 'Create new tasks',
    edit_own: 'Edit own tasks',
    edit_any: 'Edit any task',
    delete_own: 'Delete own tasks',
    delete_any: 'Delete any task',
    view_own: 'View own tasks',
    view_team: 'View team tasks',
    view_all: 'View all tasks',
    assign: 'Assign tasks',
    change_status: 'Change status',
    comment: 'Add comments',
    attach_files: 'Attach files',
    bulk_operations: 'Bulk operations',
  },
  employees: {
    view: 'View employees',
    add: 'Add employees',
    edit: 'Edit employees',
    delete: 'Delete employees',
    manage_roles: 'Manage roles',
  },
  announcements: {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
  },
  analytics: {
    view_own: 'Personal analytics',
    view_team: 'Team analytics',
    view_all: 'All analytics',
  },
  ai_features: {
    use_assistant: 'AI assistant',
    auto_assign: 'Auto-assign',
    get_insights: 'AI insights',
    estimate_duration: 'Task estimates',
  },
};

const getRoleIcon = (role: UserRole) => {
  switch (role) {
    case 'admin':
      return <ShieldCheck weight="fill" className="text-red-500" />;
    case 'manager':
      return <ShieldCheck weight="fill" className="text-orange-500" />;
    case 'member':
      return <ShieldCheck weight="fill" className="text-blue-500" />;
    case 'viewer':
      return <Eye weight="fill" className="text-gray-500" />;
  }
};

export function PermissionsOverview({ employee }: PermissionsOverviewProps) {
  if (!employee) return null;

  const userRole = employee.userRole || 'member';
  const permissions = getEmployeePermissions(employee);
  const hasCustomPermissions = !!employee.customPermissions;

  const roleDefinition = DEFAULT_ROLES[userRole];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {getRoleIcon(userRole)}
          My Permissions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" weight="fill" />
            Your Access Level
          </DialogTitle>
          <DialogDescription>
            View your current role and permissions
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-150px)]">
          <div className="space-y-6 pr-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{employee.name}</h3>
                  <Badge variant="outline" className="gap-1.5">
                    {getRoleIcon(userRole)}
                    {roleDefinition.name}
                  </Badge>
                  {hasCustomPermissions && (
                    <Badge variant="secondary" className="text-xs">
                      Custom Permissions
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {roleDefinition.description}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-6">
              {(Object.keys(PERMISSION_LABELS) as Array<keyof Permission>).map(category => (
                <div key={category} className="space-y-3">
                  <h4 className="font-semibold text-sm text-primary">
                    {PERMISSION_LABELS[category]}
                  </h4>
                  <div className="grid gap-2">
                    {Object.entries(PERMISSION_DESCRIPTIONS[category]).map(([key, description]) => {
                      const isEnabled = (permissions[category] as Record<string, boolean>)[key];
                      const isCustom = hasCustomPermissions && 
                        employee.customPermissions?.[category] && 
                        key in (employee.customPermissions[category] as Record<string, boolean>);

                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between p-2.5 rounded-lg border ${
                            isCustom 
                              ? 'bg-primary/5 border-primary/20' 
                              : isEnabled 
                                ? 'bg-green-500/5 border-green-500/20' 
                                : 'bg-muted/50 border-border'
                          }`}
                        >
                          <span className="text-sm font-medium">{description}</span>
                          <div className="flex items-center gap-2">
                            {isCustom && (
                              <Badge variant="secondary" className="text-xs h-5">
                                Custom
                              </Badge>
                            )}
                            {isEnabled ? (
                              <Check className="w-5 h-5 text-green-600" weight="bold" />
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground" weight="bold" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Need different permissions?</p>
              <p className="text-sm text-muted-foreground">
                Contact your administrator to request changes to your role or permissions.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
