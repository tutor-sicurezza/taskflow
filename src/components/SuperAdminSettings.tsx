import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useKV } from '@/hooks/useKV';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Gear, FloppyDisk, Warning, CheckCircle, ShieldCheck, Robot, Bell, Users, FolderOpen, Globe, Plugs, ClockCounterClockwise, CloudArrowDown, CloudArrowUp, ChartBar, Envelope, Wrench, Database, WarningCircle, Info } from '@phosphor-icons/react';
import { SystemSettings, UserRole, AuditLogEntry } from '@/lib/types';
import { SendGridConfiguration } from '@/components/SendGridConfiguration';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAIAvailability } from '@/lib/ai';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { newId } from '@/lib/utils';

const DEFAULT_SETTINGS: SystemSettings = {
  general: {
    applicationName: 'TaskFlow',
    companyName: 'Your Company',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    weekStartDay: 'monday',
    language: 'en',
  },
  tasks: {
    defaultTaskDuration: 7,
    allowTaskDeletion: true,
    requireTaskApproval: false,
    autoArchiveCompletedAfterDays: 30,
    maxAttachmentSize: 10,
    allowedFileTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png'],
    enableSubtasks: true,
    enableTaskDependencies: false,
  },
  notifications: {
    enableSystemNotifications: true,
    dailyDigestTime: '09:00',
    reminderBeforeDueDays: 1,
    escalateOverdueAfterDays: 3,
    notificationRetentionDays: 30,
  },
  users: {
    requireEmailVerification: false,
    allowSelfRegistration: false,
    defaultUserRole: 'member',
    passwordExpiryDays: 90,
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
  },
  departments: {
    requireDepartmentAssignment: false,
    allowMultipleDepartments: true,
    enableDepartmentBudgets: false,
  },
  ai: {
    enableAIFeatures: true,
    aiModel: 'gpt-4o',
    maxAIRequestsPerDay: 100,
    enableAutoAssignment: true,
    enableSmartSuggestions: true,
  },
  security: {
    enableTwoFactorAuth: false,
    requireStrongPasswords: true,
    enableAuditLog: true,
    dataRetentionDays: 365,
    enableIPWhitelist: false,
    allowedIPs: [],
  },
  integrations: {
    enableAPIAccess: false,
    webhookURL: '',
    enableSlackIntegration: false,
    slackWebhookURL: '',
  },
};

interface SuperAdminSettingsProps {
  currentUserId?: string;
  currentUserName?: string;
}

/**
 * Fonde le impostazioni salvate sopra quelle predefinite, sezione per sezione.
 *
 * Il codice leggeva direttamente `settings.ai.enableAIFeatures` e simili. Se il
 * valore memorizzato era parziale o malformato — un backup vecchio
 * ripristinato, una scrittura interrotta, una chiave creata a mano — l'accesso
 * andava in TypeError e, non essendo intercettato, portava giu' l'intera
 * applicazione: schermata bianca per tutti i membri dell'organizzazione,
 * amministratore compreso, cioe' proprio chi avrebbe dovuto rimediare.
 * Successo davvero, con un `system-settings` valorizzato a {}.
 *
 * La fusione e' a due livelli perche' tali sono le impostazioni: le sezioni
 * mancanti tornano ai valori predefiniti, quelle presenti conservano solo i
 * campi effettivamente salvati.
 */
export function conImpostazioniPredefinite(salvate: SystemSettings | undefined): SystemSettings {
  if (!salvate || typeof salvate !== 'object') return DEFAULT_SETTINGS;

  const unite = { ...DEFAULT_SETTINGS } as unknown as Record<string, unknown>;

  for (const [sezione, predefiniti] of Object.entries(DEFAULT_SETTINGS)) {
    const valore = (salvate as unknown as Record<string, unknown>)[sezione];

    unite[sezione] =
      valore && typeof valore === 'object' && !Array.isArray(valore)
        ? { ...(predefiniti as object), ...(valore as object) }
        : predefiniti;
  }

  return unite as unknown as SystemSettings;
}

export function SuperAdminSettings({ currentUserId, currentUserName }: SuperAdminSettingsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { organization, user } = useAuth();
  const statoAI = useAIAvailability();
  const [settings, setSettings] = useKV<SystemSettings>('system-settings', DEFAULT_SETTINGS);
  const [auditLog, setAuditLog] = useKV<AuditLogEntry[]>('audit-log', []);
  const [maintenanceMode, setMaintenanceMode] = useKV<boolean>('maintenance-mode', false);
  const [hasChanges, setHasChanges] = useState(false);
  const [localSettings, setLocalSettings] = useState<SystemSettings>(() =>
    conImpostazioniPredefinite(settings)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    setLocalSettings(conImpostazioniPredefinite(settings));
  }, [settings]);

  useEffect(() => {
    if (JSON.stringify(localSettings) !== JSON.stringify(settings)) {
      setHasChanges(true);
    } else {
      setHasChanges(false);
    }
  }, [localSettings, settings]);

  const logAuditEntry = (action: string, details: string, category: AuditLogEntry['category'] = 'settings') => {
    if (!currentUserId || !currentUserName) return;

    const entry: AuditLogEntry = {
      id: newId('audit'),
      timestamp: new Date().toISOString(),
      userId: currentUserId,
      userName: currentUserName,
      action,
      category,
      details,
    };

    setAuditLog((currentLog) => [...(currentLog || []), entry]);
  };

  const handleSave = () => {
    setSettings(localSettings);
    setHasChanges(false);
    logAuditEntry('System Settings Updated', 'Super admin updated system-wide settings');
    toast.success(t('Settings saved successfully!'));
  };

  const handleReset = () => {
    setLocalSettings(settings || DEFAULT_SETTINGS);
    setHasChanges(false);
    toast.info(t('Changes discarded'));
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values? This cannot be undone.')) {
      setSettings(DEFAULT_SETTINGS);
      setLocalSettings(DEFAULT_SETTINGS);
      setHasChanges(false);
      logAuditEntry('System Settings Reset', 'Super admin reset all settings to defaults', 'system');
      toast.success(t('Settings reset to defaults'));
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(
    category: K,
    key: keyof SystemSettings[K],
    value: any
  ) => {
    setLocalSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  };

  const addAllowedIP = () => {
    const ip = window.prompt('Enter IP address to whitelist:');
    if (ip && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      setLocalSettings((prev) => ({
        ...prev,
        security: {
          ...prev.security,
          allowedIPs: [...prev.security.allowedIPs, ip],
        },
      }));
      toast.success(t('IP address added'));
    } else if (ip) {
      toast.error(t('Invalid IP address format'));
    }
  };

  const removeAllowedIP = (ip: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      security: {
        ...prev.security,
        allowedIPs: prev.security.allowedIPs.filter((i) => i !== ip),
      },
    }));
    toast.success(t('IP address removed'));
  };

  /**
   * Backup e ripristino, riscritti su app_state / user_state.
   *
   * Prima passavano da window.spark.kv, cioe' dagli endpoint /_spark/kv del
   * runtime GitHub Spark: fuori da quel runtime rispondono 404. L'export
   * scaricava quindi un file vuoto o falliva, e l'import non scriveva da
   * nessuna parte — con l'aggravante che entrambi SEMBRAVANO funzionare, il
   * che e' il modo peggiore in cui puo' rompersi un backup.
   *
   * Si esporta cio' che appartiene all'organizzazione corrente (app_state) e
   * le chiavi personali di chi esporta (user_state). Le RLS fanno il resto:
   * non e' possibile leggere ne' scrivere i dati di un'altra organizzazione,
   * quindi un file altrui, se importato, finisce comunque nella propria.
   */
  const BACKUP_FORMAT = 'taskflow-backup-v1';

  const handleExportData = async () => {
    if (!organization?.id) {
      toast.error('Nessuna organizzazione attiva');
      return;
    }

    setIsExporting(true);
    try {
      const { data: appRows, error: appError } = await supabase
        .from('app_state')
        .select('key, value')
        .eq('organization_id', organization.id);

      if (appError) throw new Error(appError.message);

      const { data: userRows, error: userError } = user?.id
        ? await supabase.from('user_state').select('key, value').eq('user_id', user.id)
        : { data: [], error: null };

      if (userError) throw new Error(userError.message);

      // I task non stanno piu' in app_state (0012): senza questa lettura il
      // backup conterrebbe tutto TRANNE il lavoro vero.
      const { data: taskRows, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', organization.id);

      if (tasksError) throw new Error(tasksError.message);

      const payload = {
        format: BACKUP_FORMAT,
        exportedAt: new Date().toISOString(),
        organizationId: organization.id,
        organizationName: organization.name,
        appState: Object.fromEntries((appRows ?? []).map((r) => [r.key, r.value])),
        userState: Object.fromEntries((userRows ?? []).map((r) => [r.key, r.value])),
        tasks: taskRows ?? [],
      };

      const dataBlob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `taskflow-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const count = (appRows?.length ?? 0) + (userRows?.length ?? 0);
      logAuditEntry(
        'Data Export',
        `Esportate ${count} chiavi e ${taskRows?.length ?? 0} task`,
        'system'
      );
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success(`Backup esportato: ${count} chiavi e ${taskRows?.length ?? 0} task`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      toast.error(`Esportazione fallita: ${message}`);
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async () => {
    if (!organization?.id) {
      toast.error('Nessuna organizzazione attiva');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // I backup prodotti prima di questa correzione (o a mano) sono un
        // oggetto piatto chiave -> valore: si accettano ancora, trattandoli
        // come dati di organizzazione.
        const isEnvelope = parsed?.format === BACKUP_FORMAT;
        const appState: Record<string, unknown> = isEnvelope
          ? parsed.appState ?? {}
          : parsed ?? {};
        const userState: Record<string, unknown> = isEnvelope
          ? parsed.userState ?? {}
          : {};

        const tasksDaRipristinare: Record<string, unknown>[] = isEnvelope && Array.isArray(parsed.tasks)
          ? parsed.tasks
          : [];

        const appKeys = Object.keys(appState);
        const userKeys = Object.keys(userState);

        if (appKeys.length === 0 && userKeys.length === 0 && tasksDaRipristinare.length === 0) {
          toast.error(t('Il file non contiene dati da ripristinare'));
          setIsImporting(false);
          return;
        }

        const provenienza =
          isEnvelope && parsed.organizationId && parsed.organizationId !== organization.id
            ? `

ATTENZIONE: il backup proviene da un'altra organizzazione (${parsed.organizationName ?? parsed.organizationId}). I dati verranno comunque scritti in "${organization.name}".`
            : '';

        if (
          !confirm(
            `Verranno sovrascritte ${appKeys.length + userKeys.length} chiavi e ripristinati ${tasksDaRipristinare.length} task di "${organization.name}". I dati attuali con le stesse chiavi andranno persi.${provenienza}

Procedere?`
          )
        ) {
          setIsImporting(false);
          return;
        }

        const now = new Date().toISOString();

        if (appKeys.length > 0) {
          const { error } = await supabase.from('app_state').upsert(
            appKeys.map((key) => ({
              organization_id: organization.id,
              key,
              value: appState[key],
              updated_at: now,
              updated_by: user?.id ?? null,
            })),
            { onConflict: 'organization_id,key' }
          );
          if (error) throw new Error(error.message);
        }

        if (userKeys.length > 0 && user?.id) {
          const { error } = await supabase.from('user_state').upsert(
            userKeys.map((key) => ({
              user_id: user.id,
              key,
              value: userState[key],
              updated_at: now,
            })),
            { onConflict: 'user_id,key' }
          );
          if (error) throw new Error(error.message);
        }

        if (tasksDaRipristinare.length > 0) {
          // I task tornano nella loro tabella, con l'organizzazione corrente:
          // un backup non deve poter reintrodurre righe di un'altra.
          const { error } = await supabase.from('tasks').upsert(
            tasksDaRipristinare.map((t) => ({
              ...t,
              organization_id: organization.id,
            })),
            { onConflict: 'id' }
          );
          if (error) throw new Error(error.message);
        }

        logAuditEntry(
          'Data Import',
          `Ripristinate ${appKeys.length + userKeys.length} chiavi e ${tasksDaRipristinare.length} task`,
          'system'
        );
        toast.success(t('Backup ripristinato. Ricarico la pagina...'));

        // Ricarica obbligatoria: lo store in memoria di useKV contiene ancora
        // i valori precedenti e li riscriverebbe sopra a quelli appena
        // ripristinati alla prima modifica.
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'formato non valido';
        toast.error(`Ripristino fallito: ${message}`);
        console.error('Import error:', error);
        setIsImporting(false);
      }
    };

    input.click();
  };

  const handleToggleMaintenanceMode = () => {
    const newMode = !maintenanceMode;
    setMaintenanceMode(newMode);
    logAuditEntry(
      newMode ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
      `Super admin ${newMode ? 'enabled' : 'disabled'} maintenance mode`,
      'system'
    );
    toast.success(newMode ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
  };

  const handleClearAuditLog = () => {
    if (confirm('Are you sure you want to clear all audit log entries? This cannot be undone.')) {
      setAuditLog([]);
      toast.success(t('Audit log cleared'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Gear className="mr-2 h-4 w-4" weight="fill" />{t('System Settings')}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-primary" weight="fill" />{t('System Settings')}</DialogTitle>
              <DialogDescription>{t('Configure system-wide settings and preferences')}</DialogDescription>
            </div>
            {hasChanges && (
              <Badge variant="secondary" className="animate-pulse">
                <Warning className="mr-1 h-3 w-3" weight="fill" />{t('Unsaved Changes')}</Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-180px)]">
          <div className="px-6 pb-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid grid-cols-6 lg:grid-cols-11 mb-6">
                <TabsTrigger value="overview">
                  <ChartBar className="h-4 w-4 mr-1" />{t('Overview')}</TabsTrigger>
                <TabsTrigger value="data">
                  <Database className="h-4 w-4 mr-1" />{t('Data')}</TabsTrigger>
                <TabsTrigger value="email">
                  <Envelope className="h-4 w-4 mr-1" />{t('Email')}</TabsTrigger>
                <TabsTrigger value="general">
                  <Globe className="h-4 w-4 mr-1" />{t('General')}</TabsTrigger>
                <TabsTrigger value="tasks">
                  <FolderOpen className="h-4 w-4 mr-1" />{t('Tasks')}</TabsTrigger>
                <TabsTrigger value="notifications">
                  <Bell className="h-4 w-4 mr-1" />{t('Notifications')}</TabsTrigger>
                <TabsTrigger value="users">
                  <Users className="h-4 w-4 mr-1" />{t('Users')}</TabsTrigger>
                <TabsTrigger value="departments">
                  <FolderOpen className="h-4 w-4 mr-1" />{t('Departments')}</TabsTrigger>
                <TabsTrigger value="ai">
                  <Robot className="h-4 w-4 mr-1" />
                  AI
                </TabsTrigger>
                <TabsTrigger value="security">
                  <ShieldCheck className="h-4 w-4 mr-1" />{t('Security')}</TabsTrigger>
                <TabsTrigger value="integrations">
                  <Plugs className="h-4 w-4 mr-1" />{t('Integrations')}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ChartBar className="h-5 w-5" weight="fill" />{t('System Overview')}</CardTitle>
                    <CardDescription>{t('Current system status and statistics')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {maintenanceMode && (
                      <Alert className="border-destructive">
                        <WarningCircle className="h-4 w-4 text-destructive" weight="fill" />
                        <AlertDescription className="text-destructive font-medium">{t('System is currently in maintenance mode')}</AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground mb-1">{t('Settings Version')}</div>
                          <div className="text-2xl font-bold">v1.0.0</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-accent/10 to-accent/5">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground mb-1">{t('Audit Entries')}</div>
                          <div className="text-2xl font-bold">{(auditLog || []).length}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-secondary/20 to-secondary/10">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground mb-1">{t('AI Features')}</div>
                          <div className="text-2xl font-bold">{localSettings.ai.enableAIFeatures ? 'Enabled' : 'Disabled'}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground mb-1">{t('Security Status')}</div>
                          <div className="text-2xl font-bold flex items-center gap-1">
                            <CheckCircle className="h-5 w-5 text-green-600" weight="fill" />{t('Active')}</div>
                        </CardContent>
                      </Card>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold mb-3">{t('Active Settings Summary')}</h3>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <span className="text-sm">{t('Application Name')}</span>
                          <Badge variant="secondary">{localSettings.general.applicationName}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <span className="text-sm">{t('Default User Role')}</span>
                          <Badge variant="secondary" className="capitalize">{localSettings.users.defaultUserRole}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <span className="text-sm">{t('AI Model')}</span>
                          <Badge variant="secondary">{localSettings.ai.aiModel}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <span className="text-sm">{t('System Notifications')}</span>
                          <Badge variant={localSettings.notifications.enableSystemNotifications ? "default" : "outline"}>
                            {localSettings.notifications.enableSystemNotifications ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <span className="text-sm">{t('Audit Logging')}</span>
                          <Badge variant={localSettings.security.enableAuditLog ? "default" : "outline"}>
                            {localSettings.security.enableAuditLog ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold mb-3">{t('Quick Info')}</h3>
                      <div className="space-y-2">
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            <span className="font-medium">Timezone:</span> {localSettings.general.timezone} • 
                            <span className="font-medium ml-2">Date Format:</span> {localSettings.general.dateFormat} • 
                            <span className="font-medium ml-2">Week Start:</span> {localSettings.general.weekStartDay}
                          </AlertDescription>
                        </Alert>
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            <span className="font-medium">Max Attachment Size:</span> {localSettings.tasks.maxAttachmentSize}MB • 
                            <span className="font-medium ml-2">Data Retention:</span> {localSettings.security.dataRetentionDays} days
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="data" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" weight="fill" />{t('Data Management')}</CardTitle>
                    <CardDescription>{t('Backup, restore, and manage system data')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CloudArrowDown className="h-5 w-5 text-primary" weight="fill" />
                              <h3 className="font-semibold">{t('Export Data')}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">{t('Download a complete backup of all system data including tasks, users, settings, and audit logs.')}</p>
                            <Button onClick={handleExportData} disabled={isExporting} className="w-full sm:w-auto">
                              <CloudArrowDown className="mr-2 h-4 w-4" weight="fill" />
                              {isExporting ? 'Exporting...' : 'Export All Data'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CloudArrowUp className="h-5 w-5 text-accent" weight="fill" />
                              <h3 className="font-semibold">{t('Import Data')}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{t('Restore system data from a previously exported backup file.')}</p>
                            <Alert className="mb-4">
                              <WarningCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                <strong>Warning:</strong>{t('This will overwrite all existing data. Make sure to export current data first.')}</AlertDescription>
                            </Alert>
                            <Button onClick={handleImportData} disabled={isImporting} variant="secondary" className="w-full sm:w-auto">
                              <CloudArrowUp className="mr-2 h-4 w-4" weight="fill" />
                              {isImporting ? 'Importing...' : 'Import Data'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Wrench className="h-5 w-5 text-orange-600" weight="fill" />
                              <h3 className="font-semibold">{t('Maintenance Mode')}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                              {maintenanceMode 
                                ? 'Maintenance mode is currently enabled. Users may experience limited functionality.' 
                                : 'Enable maintenance mode to perform system updates or maintenance tasks.'}
                            </p>
                            <Button 
                              onClick={handleToggleMaintenanceMode}
                              variant={maintenanceMode ? 'destructive' : 'outline'}
                              className="w-full sm:w-auto"
                            >
                              <Wrench className="mr-2 h-4 w-4" weight="fill" />
                              {maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg border bg-card">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <ClockCounterClockwise className="h-5 w-5 text-destructive" weight="fill" />
                              <h3 className="font-semibold">{t('Clear Audit Log')}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">{t('Permanently delete all audit log entries. This action cannot be undone.')}</p>
                            <Button 
                              onClick={handleClearAuditLog}
                              variant="destructive"
                              className="w-full sm:w-auto"
                              disabled={!auditLog || auditLog.length === 0}
                            >
                              <ClockCounterClockwise className="mr-2 h-4 w-4" weight="fill" />
                              Clear Audit Log ({(auditLog || []).length} entries)
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('Storage Information')}</CardTitle>
                    <CardDescription>{t('Current data usage across all collections')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{t('System Settings')}</span>
                          <span className="text-sm font-medium">1 item</span>
                        </div>
                        <Progress value={100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{t('Audit Log')}</span>
                          <span className="text-sm font-medium">{(auditLog || []).length} entries</span>
                        </div>
                        <Progress value={Math.min((auditLog || []).length / 100 * 100, 100)} className="h-2" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{t('Maintenance Mode')}</span>
                          <span className="text-sm font-medium">{maintenanceMode ? 'Active' : 'Inactive'}</span>
                        </div>
                        <Progress value={maintenanceMode ? 100 : 0} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="email" className="space-y-4">
                <SendGridConfiguration />
              </TabsContent>

              <TabsContent value="general" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('General Settings')}</CardTitle>
                    <CardDescription>{t('Basic application configuration')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="app-name">{t('Application Name')}</Label>
                        <Input
                          id="app-name"
                          value={localSettings.general.applicationName}
                          onChange={(e) => updateSetting('general', 'applicationName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company-name">{t('Company Name')}</Label>
                        <Input
                          id="company-name"
                          value={localSettings.general.companyName}
                          onChange={(e) => updateSetting('general', 'companyName', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="timezone">{t('Timezone')}</Label>
                        <Select
                          value={localSettings.general.timezone}
                          onValueChange={(value) => updateSetting('general', 'timezone', value)}
                        >
                          <SelectTrigger id="timezone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="America/New_York">{t('Eastern Time')}</SelectItem>
                            <SelectItem value="America/Chicago">{t('Central Time')}</SelectItem>
                            <SelectItem value="America/Denver">{t('Mountain Time')}</SelectItem>
                            <SelectItem value="America/Los_Angeles">{t('Pacific Time')}</SelectItem>
                            <SelectItem value="Europe/London">{t('London')}</SelectItem>
                            <SelectItem value="Europe/Paris">{t('Paris')}</SelectItem>
                            <SelectItem value="Asia/Tokyo">{t('Tokyo')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date-format">{t('Date Format')}</Label>
                        <Select
                          value={localSettings.general.dateFormat}
                          onValueChange={(value) => updateSetting('general', 'dateFormat', value)}
                        >
                          <SelectTrigger id="date-format">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MM/DD/YYYY">{t('MM/DD/YYYY')}</SelectItem>
                            <SelectItem value="DD/MM/YYYY">{t('DD/MM/YYYY')}</SelectItem>
                            <SelectItem value="YYYY-MM-DD">{t('YYYY-MM-DD')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="week-start">{t('Week Start Day')}</Label>
                        <Select
                          value={localSettings.general.weekStartDay}
                          onValueChange={(value: 'monday' | 'sunday') => updateSetting('general', 'weekStartDay', value)}
                        >
                          <SelectTrigger id="week-start">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monday">{t('Monday')}</SelectItem>
                            <SelectItem value="sunday">{t('Sunday')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="language">{t('Language')}</Label>
                        <Select
                          value={localSettings.general.language}
                          onValueChange={(value) => updateSetting('general', 'language', value)}
                        >
                          <SelectTrigger id="language">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">{t('English')}</SelectItem>
                            <SelectItem value="es">{t('Spanish')}</SelectItem>
                            <SelectItem value="fr">{t('French')}</SelectItem>
                            <SelectItem value="de">{t('German')}</SelectItem>
                            <SelectItem value="it">{t('Italian')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tasks" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Task Management')}</CardTitle>
                    <CardDescription>{t('Configure task behavior and policies')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="default-duration">{t('Default Task Duration (days)')}</Label>
                        <Input
                          id="default-duration"
                          type="number"
                          min="1"
                          value={localSettings.tasks.defaultTaskDuration}
                          onChange={(e) => updateSetting('tasks', 'defaultTaskDuration', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="auto-archive">{t('Auto-archive Completed After (days)')}</Label>
                        <Input
                          id="auto-archive"
                          type="number"
                          min="0"
                          value={localSettings.tasks.autoArchiveCompletedAfterDays}
                          onChange={(e) => updateSetting('tasks', 'autoArchiveCompletedAfterDays', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-attachment">{t('Max Attachment Size (MB)')}</Label>
                      <Input
                        id="max-attachment"
                        type="number"
                        min="1"
                        max="100"
                        value={localSettings.tasks.maxAttachmentSize}
                        onChange={(e) => updateSetting('tasks', 'maxAttachmentSize', parseInt(e.target.value))}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="allow-deletion">{t('Allow Task Deletion')}</Label>
                        <Switch
                          id="allow-deletion"
                          checked={localSettings.tasks.allowTaskDeletion}
                          onCheckedChange={(checked) => updateSetting('tasks', 'allowTaskDeletion', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="require-approval">{t('Require Task Approval')}</Label>
                        <Switch
                          id="require-approval"
                          checked={localSettings.tasks.requireTaskApproval}
                          onCheckedChange={(checked) => updateSetting('tasks', 'requireTaskApproval', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enable-subtasks">{t('Enable Subtasks')}</Label>
                        <Switch
                          id="enable-subtasks"
                          checked={localSettings.tasks.enableSubtasks}
                          onCheckedChange={(checked) => updateSetting('tasks', 'enableSubtasks', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="enable-dependencies">{t('Enable Task Dependencies')}</Label>
                        <Switch
                          id="enable-dependencies"
                          checked={localSettings.tasks.enableTaskDependencies}
                          onCheckedChange={(checked) => updateSetting('tasks', 'enableTaskDependencies', checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Notification Settings')}</CardTitle>
                    <CardDescription>{t('System-wide notification configuration')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable-notifications">{t('Enable System Notifications')}</Label>
                      <Switch
                        id="enable-notifications"
                        checked={localSettings.notifications.enableSystemNotifications}
                        onCheckedChange={(checked) => updateSetting('notifications', 'enableSystemNotifications', checked)}
                      />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="digest-time">{t('Daily Digest Time')}</Label>
                        <Input
                          id="digest-time"
                          type="time"
                          value={localSettings.notifications.dailyDigestTime}
                          onChange={(e) => updateSetting('notifications', 'dailyDigestTime', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reminder-days">{t('Reminder Before Due (days)')}</Label>
                        <Input
                          id="reminder-days"
                          type="number"
                          min="0"
                          value={localSettings.notifications.reminderBeforeDueDays}
                          onChange={(e) => updateSetting('notifications', 'reminderBeforeDueDays', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="escalate-days">{t('Escalate Overdue After (days)')}</Label>
                        <Input
                          id="escalate-days"
                          type="number"
                          min="0"
                          value={localSettings.notifications.escalateOverdueAfterDays}
                          onChange={(e) => updateSetting('notifications', 'escalateOverdueAfterDays', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="retention-days">{t('Notification Retention (days)')}</Label>
                        <Input
                          id="retention-days"
                          type="number"
                          min="1"
                          value={localSettings.notifications.notificationRetentionDays}
                          onChange={(e) => updateSetting('notifications', 'notificationRetentionDays', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('User Management')}</CardTitle>
                    <CardDescription>{t('User account policies and defaults')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="default-role">{t('Default User Role')}</Label>
                      <Select
                        value={localSettings.users.defaultUserRole}
                        onValueChange={(value: UserRole) => updateSetting('users', 'defaultUserRole', value)}
                      >
                        <SelectTrigger id="default-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">{t('Viewer')}</SelectItem>
                          <SelectItem value="member">{t('Member')}</SelectItem>
                          <SelectItem value="manager">{t('Manager')}</SelectItem>
                          <SelectItem value="admin">{t('Admin')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="password-expiry">{t('Password Expiry (days)')}</Label>
                        <Input
                          id="password-expiry"
                          type="number"
                          min="0"
                          value={localSettings.users.passwordExpiryDays}
                          onChange={(e) => updateSetting('users', 'passwordExpiryDays', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="session-timeout">{t('Session Timeout (minutes)')}</Label>
                        <Input
                          id="session-timeout"
                          type="number"
                          min="5"
                          value={localSettings.users.sessionTimeoutMinutes}
                          onChange={(e) => updateSetting('users', 'sessionTimeoutMinutes', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-login-attempts">{t('Max Login Attempts')}</Label>
                      <Input
                        id="max-login-attempts"
                        type="number"
                        min="1"
                        max="10"
                        value={localSettings.users.maxLoginAttempts}
                        onChange={(e) => updateSetting('users', 'maxLoginAttempts', parseInt(e.target.value))}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="email-verification">{t('Require Email Verification')}</Label>
                        <Switch
                          id="email-verification"
                          checked={localSettings.users.requireEmailVerification}
                          onCheckedChange={(checked) => updateSetting('users', 'requireEmailVerification', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="self-registration">{t('Allow Self Registration')}</Label>
                        <Switch
                          id="self-registration"
                          checked={localSettings.users.allowSelfRegistration}
                          onCheckedChange={(checked) => updateSetting('users', 'allowSelfRegistration', checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="departments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Department Settings')}</CardTitle>
                    <CardDescription>{t('Department organization and policies')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="require-dept">{t('Require Department Assignment')}</Label>
                          <p className="text-sm text-muted-foreground">{t('Users must be assigned to at least one department')}</p>
                        </div>
                        <Switch
                          id="require-dept"
                          checked={localSettings.departments.requireDepartmentAssignment}
                          onCheckedChange={(checked) => updateSetting('departments', 'requireDepartmentAssignment', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="multiple-depts">{t('Allow Multiple Departments')}</Label>
                          <p className="text-sm text-muted-foreground">{t('Users can belong to multiple departments')}</p>
                        </div>
                        <Switch
                          id="multiple-depts"
                          checked={localSettings.departments.allowMultipleDepartments}
                          onCheckedChange={(checked) => updateSetting('departments', 'allowMultipleDepartments', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="dept-budgets">{t('Enable Department Budgets')}</Label>
                          <p className="text-sm text-muted-foreground">{t('Track and manage department budgets')}</p>
                        </div>
                        <Switch
                          id="dept-budgets"
                          checked={localSettings.departments.enableDepartmentBudgets}
                          onCheckedChange={(checked) => updateSetting('departments', 'enableDepartmentBudgets', checked)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4">
                {/*
                  Stato reale del servizio. Senza questo, un amministratore
                  vedeva le impostazioni AI come se tutto funzionasse, mentre
                  l'endpoint rispondeva con un errore di configurazione: la
                  diagnosi era leggibile solo nei log del server, cioe' dove
                  lui non guarda mai.
                */}
                {statoAI.available === false && (
                  <Alert>
                    <WarningCircle weight="fill" />
                    <AlertDescription>
                      <strong>{t('Le funzioni AI non sono attive')}</strong> e restano nascoste
                      agli utenti. Motivo riportato dal server:
                      <span className="mt-1 block font-mono text-xs break-all">
                        {statoAI.reason ?? 'non specificato'}
                      </span>
                      <span className="mt-2 block">
                        Se la chiave non e' legata a un workspace, imposta la variabile
                        d'ambiente <code>ANTHROPIC_WORKSPACE_ID</code> oppure usa una
                        chiave gia' associata a un workspace.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('AI Features')}</CardTitle>
                    <CardDescription>{t('Configure AI-powered capabilities')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="enable-ai">{t('Enable AI Features')}</Label>
                        <p className="text-sm text-muted-foreground">{t('Enable all AI-powered features')}</p>
                      </div>
                      <Switch
                        id="enable-ai"
                        checked={localSettings.ai.enableAIFeatures}
                        onCheckedChange={(checked) => updateSetting('ai', 'enableAIFeatures', checked)}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="ai-model">{t('AI Model')}</Label>
                      <Select
                        value={localSettings.ai.aiModel}
                        onValueChange={(value: 'gpt-4o' | 'gpt-4o-mini') => updateSetting('ai', 'aiModel', value)}
                        disabled={!localSettings.ai.enableAIFeatures}
                      >
                        <SelectTrigger id="ai-model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">{t('GPT-4o (More capable)')}</SelectItem>
                          <SelectItem value="gpt-4o-mini">{t('GPT-4o-mini (Faster)')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-ai-requests">{t('Max AI Requests Per Day')}</Label>
                      <Input
                        id="max-ai-requests"
                        type="number"
                        min="1"
                        value={localSettings.ai.maxAIRequestsPerDay}
                        onChange={(e) => updateSetting('ai', 'maxAIRequestsPerDay', parseInt(e.target.value))}
                        disabled={!localSettings.ai.enableAIFeatures}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-assign">{t('Enable Auto-Assignment')}</Label>
                        <Switch
                          id="auto-assign"
                          checked={localSettings.ai.enableAutoAssignment}
                          onCheckedChange={(checked) => updateSetting('ai', 'enableAutoAssignment', checked)}
                          disabled={!localSettings.ai.enableAIFeatures}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="smart-suggestions">{t('Enable Smart Suggestions')}</Label>
                        <Switch
                          id="smart-suggestions"
                          checked={localSettings.ai.enableSmartSuggestions}
                          onCheckedChange={(checked) => updateSetting('ai', 'enableSmartSuggestions', checked)}
                          disabled={!localSettings.ai.enableAIFeatures}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Security Settings')}</CardTitle>
                    <CardDescription>{t('Security policies and audit configuration')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="2fa">{t('Enable Two-Factor Authentication')}</Label>
                          <p className="text-sm text-muted-foreground">{t('Require 2FA for all users')}</p>
                        </div>
                        <Switch
                          id="2fa"
                          checked={localSettings.security.enableTwoFactorAuth}
                          onCheckedChange={(checked) => updateSetting('security', 'enableTwoFactorAuth', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="strong-passwords">{t('Require Strong Passwords')}</Label>
                          <p className="text-sm text-muted-foreground">{t('Enforce password complexity rules')}</p>
                        </div>
                        <Switch
                          id="strong-passwords"
                          checked={localSettings.security.requireStrongPasswords}
                          onCheckedChange={(checked) => updateSetting('security', 'requireStrongPasswords', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="audit-log">{t('Enable Audit Log')}</Label>
                          <p className="text-sm text-muted-foreground">{t('Track all system changes and actions')}</p>
                        </div>
                        <Switch
                          id="audit-log"
                          checked={localSettings.security.enableAuditLog}
                          onCheckedChange={(checked) => updateSetting('security', 'enableAuditLog', checked)}
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="data-retention">{t('Data Retention (days)')}</Label>
                      <Input
                        id="data-retention"
                        type="number"
                        min="30"
                        value={localSettings.security.dataRetentionDays}
                        onChange={(e) => updateSetting('security', 'dataRetentionDays', parseInt(e.target.value))}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ip-whitelist">{t('Enable IP Whitelist')}</Label>
                        <Switch
                          id="ip-whitelist"
                          checked={localSettings.security.enableIPWhitelist}
                          onCheckedChange={(checked) => updateSetting('security', 'enableIPWhitelist', checked)}
                        />
                      </div>
                      {localSettings.security.enableIPWhitelist && (
                        <div className="space-y-2 pt-2">
                          <Label>{t('Allowed IP Addresses')}</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {localSettings.security.allowedIPs.map((ip) => (
                              <Badge key={ip} variant="secondary">
                                {ip}
                                <button
                                  onClick={() => removeAllowedIP(ip)}
                                  className="ml-2 text-destructive hover:text-destructive/80"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <Button onClick={addAllowedIP} variant="outline" size="sm">{t('Add IP Address')}</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClockCounterClockwise className="h-5 w-5" />{t('Recent Audit Log')}</CardTitle>
                    <CardDescription>{t('Last 10 system changes')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!auditLog || auditLog.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t('No audit entries yet')}</p>
                    ) : (
                      <div className="space-y-2">
                        {(auditLog || []).slice(-10).reverse().map((entry) => (
                          <div key={entry.id} className="flex items-start justify-between text-sm border-b pb-2 last:border-0">
                            <div className="flex-1">
                              <p className="font-medium">{entry.action}</p>
                              <p className="text-muted-foreground text-xs">{entry.details}</p>
                              <p className="text-muted-foreground text-xs">
                                by {entry.userName} • {new Date(entry.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="outline" className="capitalize">
                              {entry.category}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="integrations" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Integrations')}</CardTitle>
                    <CardDescription>{t('External service connections')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="api-access">{t('Enable API Access')}</Label>
                        <Switch
                          id="api-access"
                          checked={localSettings.integrations.enableAPIAccess}
                          onCheckedChange={(checked) => updateSetting('integrations', 'enableAPIAccess', checked)}
                        />
                      </div>
                      {localSettings.integrations.enableAPIAccess && (
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="webhook-url">{t('Webhook URL')}</Label>
                          <Input
                            id="webhook-url"
                            placeholder="https://your-webhook-url.com/endpoint"
                            value={localSettings.integrations.webhookURL || ''}
                            onChange={(e) => updateSetting('integrations', 'webhookURL', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="slack-integration">{t('Enable Slack Integration')}</Label>
                        <Switch
                          id="slack-integration"
                          checked={localSettings.integrations.enableSlackIntegration}
                          onCheckedChange={(checked) => updateSetting('integrations', 'enableSlackIntegration', checked)}
                        />
                      </div>
                      {localSettings.integrations.enableSlackIntegration && (
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="slack-webhook">{t('Slack Webhook URL')}</Label>
                          <Input
                            id="slack-webhook"
                            placeholder="https://hooks.slack.com/services/..."
                            value={localSettings.integrations.slackWebhookURL || ''}
                            onChange={(e) => updateSetting('integrations', 'slackWebhookURL', e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("Get your webhook URL from Slack's Incoming Webhooks app")}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <div className="border-t px-6 py-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleResetToDefaults} className="text-destructive hover:text-destructive">{t('Reset to Defaults')}</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>{t('Discard Changes')}</Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                <FloppyDisk className="mr-2 h-4 w-4" weight="fill" />{t('Save Settings')}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
