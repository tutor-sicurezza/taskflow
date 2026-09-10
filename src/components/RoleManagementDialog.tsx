import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, Lock, Eye, User } from '@phosphor-icons/react';
import { Employee, UserRole, Permission } from '@/lib/types';
import { DEFAULT_ROLES } from '@/lib/permissions';
import { updateOrgMemberRole } from '@/lib/orgMembers';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface RoleManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  onUpdateEmployee: (id: string, updates: Partial<Employee>) => void;
  /**
   * Il chiamante passava una costante 'admin': il dialog si credeva quindi
   * sempre in mano a un amministratore e il proprio controllo interno non
   * poteva mai scattare. Ora riceve la capacita' reale, derivata dai permessi
   * di chi sta guardando.
   */
  canManageRoles: boolean;
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
    assign: 'Assign tasks to others',
    change_status: 'Change task status',
    comment: 'Comment on tasks',
    attach_files: 'Attach files to tasks',
    bulk_operations: 'Perform bulk operations',
  },
  employees: {
    view: 'View employee list',
    add: 'Add new employees',
    edit: 'Edit employee details',
    delete: 'Remove employees',
    manage_roles: 'Manage user roles and permissions',
  },
  announcements: {
    view: 'View announcements',
    create: 'Create announcements',
    edit: 'Edit announcements',
    delete: 'Delete announcements',
  },
  analytics: {
    view_own: 'View personal analytics',
    view_team: 'View team analytics',
    view_all: 'View organization analytics',
  },
  ai_features: {
    use_assistant: 'Use AI assistant',
    auto_assign: 'Use AI auto-assign',
    get_insights: 'Get AI insights',
    estimate_duration: 'Get AI task estimates',
  },
};

export function RoleManagementDialog({
  open,
  onOpenChange,
  employee,
  onUpdateEmployee,
  canManageRoles,
}: RoleManagementDialogProps) {
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<UserRole>(employee.userRole || 'member');
  const [customPermissions, setCustomPermissions] = useState<Partial<Permission>>(
    employee.customPermissions || {}
  );
  const [useCustomPermissions, setUseCustomPermissions] = useState(!!employee.customPermissions);
  const [saving, setSaving] = useState(false);

  const { organization } = useAuth();

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    if (!useCustomPermissions) {
      setCustomPermissions({});
    }
  };

  const handlePermissionToggle = (
    category: keyof Permission,
    permission: string,
    value: boolean
  ) => {
    setCustomPermissions(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] as Record<string, boolean> || {}),
        [permission]: value,
      },
    }));
  };

  /**
   * Il ruolo va scritto su organization_members, non solo nello stato
   * applicativo.
   *
   * Prima qui si aggiornava soltanto `userRole` nell'array `employees`. Quel
   * campo non e' pero' cio' che autorizza alcunche': le policy RLS e i
   * controlli delle rotte api/ leggono organization_members. La promozione era
   * quindi puramente decorativa e, per giunta, temporanea — useSyncEmployees
   * rilegge il ruolo dal database a ogni avvio e la sovrascriveva.
   *
   * I permessi personalizzati restano invece nello stato applicativo: non
   * hanno un equivalente nel database e valgono solo per l'interfaccia.
   */
  const handleSave = async () => {
    if (!canManageRoles) {
      toast.error(t('You do not have permission to manage roles'));
      return;
    }

    if (!organization?.id) {
      toast.error('Nessuna organizzazione attiva');
      return;
    }

    // Senza email non si risale all'account: e' il caso delle righe rimaste
    // dalla vecchia "Add User", che non ne creava uno.
    if (!employee.email) {
      toast.error(
        "Questo membro non ha un account collegato: rimuovilo e ricrealo indicando l'email"
      );
      return;
    }

    setSaving(true);
    try {
      const roleChanged = (employee.userRole || 'member') !== selectedRole;

      if (roleChanged) {
        await updateOrgMemberRole(organization.id, employee.email, selectedRole);
      }

      onUpdateEmployee(employee.id, {
        userRole: selectedRole,
        customPermissions: useCustomPermissions ? customPermissions : undefined,
      });

      toast.success(t('Role and permissions updated successfully'));
      onOpenChange(false);
    } catch (e) {
      // Nessun aggiornamento locale se la scrittura sul database fallisce:
      // un'interfaccia che mostra 'admin' mentre il database dice 'member' e'
      // peggio di un errore visibile.
      toast.error(e instanceof Error ? e.message : 'Aggiornamento del ruolo fallito');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedRole(employee.userRole || 'member');
    setCustomPermissions(employee.customPermissions || {});
    setUseCustomPermissions(!!employee.customPermissions);
  };

  const currentPermissions = useCustomPermissions
    ? { ...DEFAULT_ROLES[selectedRole].permissions, ...customPermissions }
    : DEFAULT_ROLES[selectedRole].permissions;

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck weight="fill" className="text-red-500" />;
      case 'manager':
        return <Lock weight="fill" className="text-orange-500" />;
      case 'member':
        return <User weight="fill" className="text-blue-500" />;
      case 'viewer':
        return <Eye weight="fill" className="text-gray-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" weight="fill" />{t('Manage Role & Permissions')}</DialogTitle>
          <DialogDescription>
            {t('Configure access level and permissions for {name}', { name: employee.name })}
          </DialogDescription>
        </DialogHeader>

        {!canManageRoles && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
            <Lock className="w-5 h-5 text-destructive mt-0.5" weight="fill" />
            <div className="text-sm text-destructive">{t('You do not have permission to manage user roles. Only administrators can modify roles and permissions.')}</div>
          </div>
        )}

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="space-y-6 pr-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="role-select" className="text-base font-semibold">{t('User Role')}</Label>
                <Badge variant="outline" className="gap-1.5">
                  {getRoleIcon(selectedRole)}
                  {DEFAULT_ROLES[selectedRole].name}
                </Badge>
              </div>
              <Select
                value={selectedRole}
                onValueChange={handleRoleChange}
                disabled={!canManageRoles}
              >
                <SelectTrigger id="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DEFAULT_ROLES) as UserRole[]).map(role => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(role)}
                        <div>
                          <div className="font-medium">{DEFAULT_ROLES[role].name}</div>
                          <div className="text-xs text-muted-foreground">
                            {DEFAULT_ROLES[role].description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="custom-permissions" className="text-base font-semibold">{t('Custom Permissions')}</Label>
                <p className="text-sm text-muted-foreground mt-1">{t('Override default role permissions with custom settings')}</p>
              </div>
              <Switch
                id="custom-permissions"
                checked={useCustomPermissions}
                onCheckedChange={setUseCustomPermissions}
                disabled={!canManageRoles}
              />
            </div>

            <Tabs defaultValue="tasks" className="w-full">
              {/*
                grid-cols-5 dava colonne uguali: su 360px sono ~70px a scheda e
                TabsTrigger ha whitespace-nowrap, quindi il testo non andava a
                capo ma usciva dalla cella sovrapponendosi alla scheda vicina.
                Con flex-wrap + h-auto le schede vanno a capo e si dimensionano
                sul contenuto — lo schema gia' usato in App.tsx.
              */}
              <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1">
                {(Object.keys(PERMISSION_LABELS) as Array<keyof Permission>).map(category => (
                  <TabsTrigger key={category} value={category} className="text-xs">
                    {t(PERMISSION_LABELS[category])}
                  </TabsTrigger>
                ))}
              </TabsList>

              {(Object.keys(PERMISSION_LABELS) as Array<keyof Permission>).map(category => (
                <TabsContent key={category} value={category} className="space-y-4 mt-4">
                  <div className="space-y-3">
                    {Object.entries(PERMISSION_DESCRIPTIONS[category]).map(([key, description]) => {
                      const isEnabled = (currentPermissions[category] as Record<string, boolean>)[key];
                      const isCustom = useCustomPermissions && 
                        customPermissions[category] && 
                        key in (customPermissions[category] as Record<string, boolean>);

                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isCustom ? 'bg-primary/5 border-primary/20' : 'bg-card'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`${category}-${key}`} className="font-medium">
                                {t(description)}
                              </Label>
                              {isCustom && (
                                <Badge variant="secondary" className="text-xs">{t('Custom')}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {key.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <Switch
                            id={`${category}-${key}`}
                            checked={isEnabled}
                            onCheckedChange={(value) =>
                              handlePermissionToggle(category, key, value)
                            }
                            disabled={!canManageRoles || !useCustomPermissions}
                          />
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>{t('Reset')}</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={handleSave} disabled={!canManageRoles || saving}>
            <ShieldCheck className="mr-2 h-4 w-4" weight="fill" />
            {saving ? t('Saving…') : t('Save Changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
