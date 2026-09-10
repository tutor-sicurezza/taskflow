import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useKV } from '@/hooks/useKV';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Gear, FloppyDisk, Warning, ShieldCheck, Robot, Globe, ClockCounterClockwise, CloudArrowDown, CloudArrowUp, ChartBar, Envelope, Database, WarningCircle } from '@phosphor-icons/react';
import { SystemSettings, AuditLogEntry } from '@/lib/types';
import { SendGridConfiguration } from '@/components/SendGridConfiguration';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAIAvailability } from '@/lib/ai';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { newId } from '@/lib/utils';

/**
 * Le impostazioni di sistema si sono ridotte a un campo, e non e' un errore.
 *
 * Il pannello ne offriva quarantadue: manutenzione, whitelist di IP, 2FA,
 * scadenza password, limiti di allegati, digest, budget di reparto. Un'ispezione
 * campo per campo ha trovato UN SOLO consumatore in tutto il codice —
 * `general.applicationName`, letto da `src/App.tsx` e da
 * `api/_lib/composizione.ts` per intestare le email. Tutti gli altri venivano
 * scritti su `app_state` e mai piu' riletti: l'amministratore li configurava,
 * leggeva "Settings saved successfully!" e non cambiava assolutamente nulla.
 *
 * Su un interruttore di comodita' sarebbe stato solo inutile. Su
 * `enableIPWhitelist`, `enableTwoFactorAuth` o `maxLoginAttempts` era una
 * bugia su una funzione di sicurezza: chi compilava la whitelist credeva di
 * aver ristretto l'accesso e non aveva ristretto niente. Meglio non offrire
 * l'interruttore che offrirne uno scollegato; il giorno in cui una di queste
 * funzioni esistera' davvero, il campo tornera' insieme al codice che lo legge.
 */
const DEFAULT_SETTINGS: SystemSettings = {
  general: {
    applicationName: 'TaskFlow',
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
 *
 * Copia solo i campi previsti dai predefiniti, e questo e' anche il percorso di
 * migrazione: nelle organizzazioni gia' avviate `app_state` contiene ancora gli
 * oggetti con le quarantadue chiavi di prima. Ignorandole si evita sia
 * l'errore, sia il caso peggiore — riscriverle al primo salvataggio, tenendo in
 * vita per sempre dei dati che nessuno legge piu'.
 */
export function conImpostazioniPredefinite(salvate: SystemSettings | undefined): SystemSettings {
  if (!salvate || typeof salvate !== 'object') return DEFAULT_SETTINGS;

  const unite = { ...DEFAULT_SETTINGS } as unknown as Record<string, unknown>;

  for (const [sezione, predefiniti] of Object.entries(DEFAULT_SETTINGS)) {
    const valore = (salvate as unknown as Record<string, unknown>)[sezione];

    if (!valore || typeof valore !== 'object' || Array.isArray(valore)) {
      unite[sezione] = predefiniti;
      continue;
    }

    const salvataSezione = valore as Record<string, unknown>;
    const fusa: Record<string, unknown> = { ...(predefiniti as object) };

    for (const campo of Object.keys(predefiniti as object)) {
      if (campo in salvataSezione) fusa[campo] = salvataSezione[campo];
    }

    unite[sezione] = fusa;
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
    // Il confronto e' con le impostazioni gia' ripulite: altrimenti un record
    // vecchio, pieno di campi rimossi, risulterebbe "modificato" all'apertura
    // del pannello e mostrerebbe il badge senza che nessuno abbia toccato nulla.
    if (JSON.stringify(localSettings) !== JSON.stringify(conImpostazioniPredefinite(settings))) {
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
    setLocalSettings(conImpostazioniPredefinite(settings));
    setHasChanges(false);
    toast.info(t('Changes discarded'));
  };

  const handleResetToDefaults = () => {
    if (window.confirm(t('Are you sure you want to reset all settings to default values? This cannot be undone.'))) {
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
    value: SystemSettings[K][keyof SystemSettings[K]]
  ) => {
    setLocalSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
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

  const handleClearAuditLog = () => {
    if (confirm(t('Are you sure you want to clear all audit log entries? This cannot be undone.'))) {
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
      <DialogContent className="sm:max-w-5xl max-h-[85vh] p-0 flex flex-col">
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

        {/*
          L'altezza era calcolata a mano — 85vh meno 180px di intestazione e
          pulsanti. Bastava una riga in piu' nella barra delle schede perche' il
          contenuto finisse sotto i pulsanti, tagliato. Con flex-1 e min-h-0
          l'area di scorrimento prende lo spazio che avanza, qualunque sia
          l'altezza delle parti fisse.
        */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 pb-6">
            <Tabs defaultValue="overview" className="w-full">
              {/*
                Restano le schede con un contenuto vero: stato del sistema,
                backup/ripristino, configurazione SendGrid, nome
                dell'applicazione e registro di audit. Le altre sette —
                Tasks, Notifications, Users, Departments, AI, Security,
                Integrations — mostravano solo campi che nessuno rileggeva.
              */}
              <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value="overview">
                  <ChartBar className="h-4 w-4 mr-1" />{t('Overview')}</TabsTrigger>
                <TabsTrigger value="data">
                  <Database className="h-4 w-4 mr-1" />{t('Data')}</TabsTrigger>
                <TabsTrigger value="email">
                  <Envelope className="h-4 w-4 mr-1" />{t('Email')}</TabsTrigger>
                <TabsTrigger value="general">
                  <Globe className="h-4 w-4 mr-1" />{t('General')}</TabsTrigger>
                <TabsTrigger value="audit">
                  <ClockCounterClockwise className="h-4 w-4 mr-1" />{t('Audit Log')}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
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
                    <CardTitle className="flex items-center gap-2">
                      <ChartBar className="h-5 w-5" weight="fill" />{t('System Overview')}</CardTitle>
                    <CardDescription>{t('Current system status and statistics')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/*
                      Solo dati misurati: il nome che finisce davvero nelle
                      email, quante voci ha il registro, e lo stato che il
                      server dichiara per l'AI. I riquadri precedenti
                      ("Security Status: Active") riportavano una costante
                      scritta a mano, che restava verde comunque.
                    */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground mb-1">{t('Application Name')}</div>
                          <div className="text-2xl font-bold truncate">{localSettings.general.applicationName}</div>
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
                          <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                            <Robot className="h-4 w-4" weight="fill" />{t('AI Service')}</div>
                          <div className="text-2xl font-bold">
                            {statoAI.available === undefined
                              ? t('Checking...')
                              : statoAI.available
                                ? t('Available')
                                : t('Unavailable')}
                          </div>
                        </CardContent>
                      </Card>
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
                                <strong>{t('Warning:')}</strong>{t('This will overwrite all existing data. Make sure to export current data first.')}</AlertDescription>
                            </Alert>
                            <Button onClick={handleImportData} disabled={isImporting} variant="secondary" className="w-full sm:w-auto">
                              <CloudArrowUp className="mr-2 h-4 w-4" weight="fill" />
                              {isImporting ? t('Importing...') : t('Import Data')}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/*
                        Qui stava la "Modalita' Manutenzione": scriveva la
                        chiave `maintenance-mode`, registrava un audit, mostrava
                        un banner rosso e avvisava che "Users may experience
                        limited functionality". Nessuno leggeva quella chiave:
                        nessun utente e' mai stato bloccato. Un amministratore
                        che la attivava per aggiornare il sistema credeva di
                        aver messo tutti fuori mentre tutti continuavano a
                        scrivere. Una manutenzione che non blocca nessuno e'
                        peggio di nessuna manutenzione, quindi il comando e'
                        sparito: rimetterlo richiede prima una guardia
                        all'avvio, in `src/main.tsx`.
                      */}

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
                              {t('Clear Audit Log ({count} entries)', { count: (auditLog || []).length })}
                            </Button>
                          </div>
                        </div>
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
                    <div className="space-y-2">
                      <Label htmlFor="app-name">{t('Application Name')}</Label>
                      <Input
                        id="app-name"
                        value={localSettings.general.applicationName}
                        onChange={(e) => updateSetting('general', 'applicationName', e.target.value)}
                      />
                      {/*
                        L'unica impostazione con un consumatore reale: la legge
                        `src/App.tsx` per l'intestazione e
                        `api/_lib/composizione.ts` per l'oggetto e la firma
                        delle email di notifica.
                      */}
                      <p className="text-sm text-muted-foreground">{t('Shown in the application header and used in notification emails.')}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="space-y-4">
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
                                {t('by {name}', { name: entry.userName })} • {new Date(entry.timestamp).toLocaleString()}
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
            </Tabs>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t px-6 py-4 bg-muted/30">
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
