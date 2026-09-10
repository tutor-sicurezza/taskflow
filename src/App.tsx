import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useKV } from '@/hooks/useKV';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FunnelSimple, ArrowsDownUp, CheckCircle, CheckSquare, Square, Trash, X, PlayCircle, Circle, ChartBar, ListChecks, Sparkle, Users, Buildings, House, Rocket, CalendarBlank, DownloadSimple, SealWarning } from '@phosphor-icons/react';
import { TaskCard } from '@/components/TaskCard';
import {
  ScheletroSchedeStatistiche,
  ScheletroElencoTask,
  ScheletroCruscotto,
} from '@/components/Scheletri';
import { SchermataVuota } from '@/components/SchermateVuote';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { TaskDetailsDialog } from '@/components/TaskDetailsDialog';
import { UsersManagement } from '@/components/UsersManagement';
import { TeamAnalytics, DepartmentAnalytics } from '@/components/AnalisiPigre';
import { AIAssistant, AISuggestion } from '@/components/AIAssistant';
import { AIInsights } from '@/components/AIInsights';
import { AIAutoAssign } from '@/components/AIAutoAssign';
import { AnnouncementsDialog } from '@/components/AnnouncementsDialog';
import { TaskNotifications } from '@/components/TaskNotifications';
import { NotificationPreferences } from '@/components/NotificationPreferences';
import { PermissionsOverview } from '@/components/PermissionsOverview';
import { DepartmentManagement } from '@/components/DepartmentManagement';
import { DepartmentColorLegend } from '@/components/DepartmentColorLegend';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SuperAdminDashboard } from '@/components/dashboards/SuperAdminDashboard';
import { DepartmentAdminDashboard } from '@/components/dashboards/DepartmentAdminDashboard';
import { UserDashboard } from '@/components/dashboards/UserDashboard';
import { SuperAdminSettings } from '@/components/SuperAdminSettings';
import { EmailTemplateCustomization } from '@/components/EmailTemplateCustomization';
import { EmailDeliveryAnalytics } from '@/components/AnalisiPigre';
import { WelcomeGuide } from '@/components/WelcomeGuide';
import { DataManagement } from '@/components/DataManagement';
import { HelpDocumentation } from '@/components/HelpDocumentation';
import { LaunchCelebration } from '@/components/LaunchCelebration';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { FeedbackBoard } from '@/components/FeedbackBoard';
import { LaunchAnnouncement } from '@/components/LaunchAnnouncement';
import { Task, Employee, TaskStatus, TaskPriority, TaskActivity, TaskComment, TaskAttachment, Announcement, TaskNotification, NotificationPreferences as NotificationPreferencesType, FeedbackItem, UserRole, SystemSettings, NotificationType } from '@/lib/types';
import { playNotificationSound } from '@/lib/notificationSounds';
import { desktopNotificationManager } from '@/lib/desktopNotifications';
import { DesktopNotificationSettings } from '@/components/DesktopNotificationSettings';
import { canPerformAction } from '@/lib/permissions';
import { newId } from '@/lib/utils';
import { traduci, linguaIniziale } from '@/lib/i18n';
import { VistaCalendario } from '@/components/VistaCalendario';
import {
  eChiusoDavvero,
  campiApprovazione,
  campiRifiuto,
  campiCambioStato,
  inAttesaDiApprovazione,
  puoApprovare,
} from '@/lib/approvazione';
import { CaricoDiLavoro } from '@/components/CaricoDiLavoro';
import { EsportaTaskDialog } from '@/components/EsportaTaskDialog';
import { FiltriSalvati } from '@/components/FiltriSalvati';
import type { Filtro } from '@/lib/filtriSalvati';
import { inviaEmailNotifica } from '@/lib/taskEmail';
import { trovaMenzioni } from '@/lib/menzioni';
import { upsertOrgMember, removeOrgMember, resetMemberPassword } from '@/lib/orgMembers';
import { Toaster, toast } from 'sonner';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperPlaneTilt, Megaphone, SignOut } from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useSyncEmployees } from '@/hooks/useSyncEmployees';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { useAIAvailability } from '@/lib/ai';
import { confrontaScadenze, dataScadenza, eInRitardo } from '@/lib/scadenze';

/**
 * Il database ha un ruolo `owner` in piu' rispetto al tipo `UserRole` usato
 * dalla UI: lo mappiamo su `admin`, che ne e' l'equivalente lato interfaccia.
 */
function mapOrgRoleToUserRole(orgRole: string | null | undefined): UserRole {
  switch (orgRole) {
    case 'owner':
    case 'admin':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'viewer':
      return 'viewer';
    case 'member':
    default:
      return 'member';
  }
}

/**
 * Avvisa che un'email di notifica non e' partita.
 *
 * Con il freno: una chiave del provider mancante o una rete che cade fanno
 * fallire ogni invio, e un'azione ne provoca anche due o tre. Senza,
 * l'utente riceverebbe una raffica di messaggi identici per un solo gesto.
 */
let ultimoAvvisoEmail = 0;

function segnalaEmailNonPartita(dettaglio: string | undefined) {
  const adesso = Date.now();
  if (adesso - ultimoAvvisoEmail < 10000) return;
  ultimoAvvisoEmail = adesso;

  toast.warning(traduci(linguaIniziale(), 'email.nonPartita'), {
    description: dettaglio,
  });
}

/**
 * Marca temporale grossolana per le chiavi degli eventi ripetibili.
 *
 * La deduplica delle notifiche e' un indice unico sul database: due schede che
 * generano lo stesso evento nello stesso istante producono una voce sola,
 * ed e' il comportamento voluto. Ma per eventi che si ripetono davvero —
 * completare un task, riaprirlo e ricompletarlo; rimbalzarlo fra due persone;
 * farlo tornare "in corso" — una chiave fissa rende il blocco PERMANENTE: la
 * seconda volta nessuno viene avvisato, e chi agisce non ha modo di
 * accorgersene.
 *
 * Un blocco al minuto separa i due casi: copre le schede simultanee e il
 * doppio clic, non lo stesso evento a giorni di distanza.
 */
function bloccoMinuto(): number {
  return Math.floor(Date.now() / 60000);
}

/**
 * Il cambiamento piu' significativo di una modifica, o `null` se non e'
 * cambiato niente che valga un avviso.
 *
 * L'ordine non e' arbitrario: cambiare la persona a cui tocca il lavoro conta
 * piu' di cambiarne la priorita', che conta piu' di correggere una
 * descrizione. Serve perche' una sola schermata di modifica puo' cambiare
 * tutto insieme, e avvisare per ogni campo significherebbe quattro email per
 * un solo salvataggio.
 */
function scegliTipoModifica(
  task: Task,
  updates: { title: string; description: string; priority: TaskPriority; dueDate: string | null },
  assegnatarioCambiato: boolean
): NotificationType | null {
  if (assegnatarioCambiato) {
    return task.assigneeId ? 'task_reassigned' : 'task_assigned';
  }
  if (task.priority !== updates.priority) return 'task_priority_changed';
  if (
    task.title !== updates.title ||
    task.description !== updates.description ||
    task.dueDate !== updates.dueDate
  ) {
    return 'task_updated';
  }
  return null;
}

/**
 * Quanti task si mostrano prima di chiedere "mostra altri".
 *
 * L'elenco non e' virtualizzato di proposito: la virtualizzazione romperebbe
 * selezione multipla, scorciatoie da tastiera e ricerca nella pagina, che qui
 * ci sono tutte. Con la paginazione il DOM resta quello di cento schede —
 * qualche migliaio di nodi, non decine di migliaia — e tutto il resto
 * continua a funzionare come prima.
 *
 * Cento e non venti perche' la soglia deve stare SOPRA il numero di task che
 * si guardano davvero in una sessione normale: chi filtra per persona o per
 * stato vede quasi sempre meno di cento risultati e non incontra mai il
 * pulsante. Il costo si paga solo dove il problema esiste.
 */
const TASK_PER_PAGINA = 100;

/**
 * Una funzione dall'identita' STABILE che chiama sempre la versione piu'
 * recente di `handler`.
 *
 * Serve per le prop di `TaskCard`, che e' memoizzata: un `useCallback` con le
 * dipendenze reali non basterebbe, perche' quasi tutti questi handler leggono
 * `tasks`, e con `[tasks]` in dipendenza l'identita' cambierebbe a ogni
 * modifica di un task qualsiasi — cioe' tutte le schede si ridisegnerebbero
 * per una spunta su una sola.
 *
 * Non e' una dipendenza "dimenticata": il valore letto non e' congelato, e'
 * sempre l'ultimo, perche' la chiamata passa dal ref. E' lecito solo perche'
 * questi handler vengono invocati da eventi (un clic, un menu a tendina),
 * mai durante il render o dentro un effetto, dove il ref potrebbe essere
 * ancora quello del render precedente.
 */
function useHandlerStabile<Args extends unknown[], R>(handler: (...args: Args) => R) {
  const riferimento = useRef(handler);

  useEffect(() => {
    riferimento.current = handler;
  });

  return useCallback((...args: Args) => riferimento.current(...args), []);
}

function App() {
  const { user, profile, orgRole, organization, signOut } = useAuth();
  const { t, lingua } = useTranslation();
  /**
   * I task arrivano dalla tabella public.tasks, una riga ciascuno.
   *
   * In app_state erano un blob unico che qualunque membro poteva sostituire
   * per intero — cioe' cancellare tutti i task con una sola chiamata. Con una
   * riga per task valgono le policy per riga della 0008. La firma dell'hook e'
   * identica a quella di useKV, quindi tutti i punti che modificano i task qui
   * sotto restano invariati.
   */
  /**
   * `caricaAllegati` esiste perche' gli allegati NON viaggiano piu' con la
   * lista: sono file interi in base64 dentro la riga, e leggerli a ogni
   * ricarica significava scaricare decine di MB per mostrare dei titoli.
   * Si prendono quando si apre il dettaglio, cioe' quando servono davvero.
   */
  const [tasks, setTasks, caricaAllegati, taskCaricati] = useTasks();
  const [employees, setEmployees, , employeesCaricati] = useKV<Employee[]>('employees', []);
  /**
   * Il nome dell'applicazione era modificabile nelle impostazioni di sistema e
   * non veniva usato da nessuna parte: ne' qui in testata, ne' nelle email.
   * Un'organizzazione che si rinominava continuava a leggere "TaskFlow"
   * ovunque, e l'impostazione era di fatto un campo di testo scollegato.
   */
  const [impostazioni] = useKV<SystemSettings | null>('system-settings', null);
  const nomeApplicazione =
    impostazioni?.general?.applicationName?.trim() || 'TaskFlow';

  // Popola `employees` dai membri reali dell'organizzazione: senza questo il
  // menu "Assign To" resta vuoto e i task non sono assegnabili a nessuno.
  useSyncEmployees();

  /**
   * La lista delle persone con identita' stabile.
   *
   * `employees || []` costruisce un array NUOVO a ogni render: passato a una
   * scheda memoizzata annullerebbe il memo da solo, perche' il confronto
   * superficiale vede una prop diversa ogni volta pur essendo gli stessi dati.
   */
  const listaEmployees = useMemo(() => employees || [], [employees]);

  /**
   * id -> persona, per risolvere l'assegnatario in tempo costante.
   *
   * Ogni scheda faceva `employees.find(...)`: con 30 persone e 3.000 task
   * sono 90.000 confronti a ogni render dell'elenco. La mappa si ricostruisce
   * solo quando cambia l'anagrafica, non a ogni render.
   */
  const employeesById = useMemo(
    () => new Map(listaEmployees.map((e) => [e.id, e])),
    [listaEmployees]
  );

  /**
   * id -> task. Stessa ragione, ma per i cicli: le azioni in blocco
   * scorrevano i task selezionati cercando ognuno dentro l'array intero,
   * cioe' un prodotto fra selezione ed elenco ("seleziona tutto" e poi
   * "completa" su 3.000 task erano nove milioni di confronti).
   */
  const tasksById = useMemo(
    () => new Map((tasks || []).map((t) => [t.id, t])),
    [tasks]
  );

  const [announcements, setAnnouncements] = useKV<Announcement[]>('announcements', []);

  /**
   * Le notifiche non stanno piu' in app_state.
   *
   * Erano un blob JSON per organizzazione, quindi leggibile da qualunque
   * membro via PostgREST: il filtro "solo le mie" viveva solo qui nel client
   * e non proteggeva nulla. Ora arrivano dalla tabella public.notifications,
   * dove la policy `user_id = auth.uid()` fa il filtro nel database, e il
   * dedup e' un indice unico invece di un controllo in memoria.
   */
  /**
   * Annuncio di una notifica APPENA ARRIVATA per l'utente corrente.
   *
   * Le preferenze si applicano qui: tipo disattivato od orario di silenzio
   * significano nessun suono e nessuna notifica desktop, ma la voce resta
   * comunque nell'elenco, cosi' non si perde nulla.
   */
  const annunciaNotifica = useCallback(
    async (notification: TaskNotification) => {
      if (prefsRef.current?.enabledNotifications?.[notification.type] === false) return;
      if (isWithinQuietHours(prefsRef.current)) return;

      if (prefsRef.current?.soundEnabled !== false) {
        await playNotificationSound(
          notification.type,
          prefsRef.current?.soundVolume ?? 0.3
        );
      }

      if (desktopNotificationManager.getPermission() === 'granted') {
        await desktopNotificationManager.showTaskNotification(
          notification.type,
          notification.taskTitle,
          notification.message,
          notification.taskId
        );
      }
    },
    []
  );

  const {
    notifications: myNotifications,
    addNotification: pushNotification,
    markAsRead: markNotificationRead,
    markAllAsRead: markAllNotificationsRead,
    removeNotification,
    removeAllNotifications,
  } = useNotifications(annunciaNotifica);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | TaskStatus>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | TaskPriority>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [soloDaApprovare, setSoloDaApprovare] = useState(false);
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'status'>('dueDate');
  const [activeTab, setActiveTab] = useState('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const currentUser = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: profile?.full_name ?? user.email ?? 'Utente',
      avatar:
        profile?.avatar_url ??
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.id)}`,
    };
  }, [user, profile]);

  const currentEmployee = useMemo<Employee | null>(() => {
    if (!user || !currentUser) return null;

    const existing = (employees || []).find(e => e.id === user.id);
    if (existing) return existing;

    return {
      id: user.id,
      name: currentUser.name,
      avatar: currentUser.avatar,
      role: profile?.job_title || 'User',
      userRole: mapOrgRoleToUserRole(orgRole),
      email: profile?.email ?? user.email ?? undefined,
      departments: profile?.departments ?? [],
      department: profile?.departments?.[0],
      status: profile?.status ?? 'active',
      joinedDate: user.created_at ?? new Date().toISOString(),
      teamLead: profile?.team_lead ?? false,
      customPermissions:
        (profile?.custom_permissions as Employee['customPermissions']) ?? undefined,
    };
  }, [user, profile, orgRole, employees, currentUser]);
  const [viewMode, setViewMode] = useState<'dashboard' | 'tasks' | 'calendario' | 'carico' | 'analytics'>('dashboard');
  const [analyticsView, setAnalyticsView] = useState<'team' | 'departments'>('team');
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [welcomeGuideOpen, setWelcomeGuideOpen] = useState(false);
  const [hasCompletedWelcome, setHasCompletedWelcome] = useKV<boolean>('has-completed-welcome', false);
  const [launchCelebrationOpen, setLaunchCelebrationOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackBoardOpen, setFeedbackBoardOpen] = useState(false);
  const [launchAnnouncementOpen, setLaunchAnnouncementOpen] = useState(false);
  const [hasSeenLaunchAnnouncement, setHasSeenLaunchAnnouncement] = useKV<boolean>('has-seen-launch-announcement', false);
  const [feedback, setFeedback] = useKV<FeedbackItem[]>('feedback', []);
  // Chiave per-utente: useKV la instrada su user_state, dove le policy RLS
  // permettono al solo proprietario di leggere e scrivere.
  const [myNotificationPrefs] = useKV<NotificationPreferencesType | undefined>(
    `notification-preferences-${user?.id ?? 'anonimo'}`
  );

  // In un ref perche' `annunciaNotifica` viene passata a useNotifications una
  // volta sola: leggendo la variabile direttamente resterebbe legata al valore
  // del primo render, cioe' alle preferenze non ancora caricate.
  const prefsRef = useRef(myNotificationPrefs);
  prefsRef.current = myNotificationPrefs;
  /**
   * Rende nota al server la lingua scelta.
   *
   * Serve alle email: vengono composte nella lingua del destinatario, e il
   * server la legge da user_state. Senza questa riga la preferenza resterebbe
   * confinata nel localStorage del browser, invisibile a chi deve scrivere il
   * messaggio.
   */
  const [linguaSalvata, setLinguaSalvata] = useKV<string>('lingua', 'it');

  useEffect(() => {
    if (lingua !== linguaSalvata) setLinguaSalvata(lingua);
  }, [lingua, linguaSalvata, setLinguaSalvata]);

  const [newAccountCredentials, setNewAccountCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  /**
   * I comandi AI compaiono solo se il server sa davvero rispondere.
   *
   * Senza ANTHROPIC_API_KEY l'endpoint risponde 503: prima i pulsanti erano
   * comunque li' e l'errore arrivava solo dopo averli premuti. Proporre una
   * funzione che non esiste e' peggio che non proporla.
   */
  const { available: aiAvailable } = useAIAvailability();

  /**
   * Normalizza le anagrafiche salvate da versioni precedenti.
   *
   * Le dipendenze erano vuote, quindi l'effetto girava una volta sola al
   * montaggio — quando `employees` e' ancora l'array iniziale, perche' i dati
   * dal server non sono arrivati. La condizione era sempre falsa e la
   * normalizzazione non e' MAI stata eseguita. La guardia `needsMigration`
   * impedisce il ciclo: dopo la prima passata non c'e' piu' niente da
   * normalizzare e l'effetto non riscrive nulla.
   */
  useEffect(() => {
    if (employees && employees.length > 0) {
      const needsMigration = employees.some(emp => 
        !emp.status || 
        !emp.joinedDate || 
        emp.teamLead === undefined ||
        (emp.department && !emp.departments)
      );
      if (needsMigration) {
        setEmployees((currentEmployees) =>
          (currentEmployees || []).map(emp => {
            const departments = emp.departments 
              ? emp.departments 
              : emp.department 
                ? [emp.department] 
                : [];
            
            return {
              ...emp,
              status: emp.status || 'active',
              joinedDate: emp.joinedDate || new Date().toISOString(),
              teamLead: emp.teamLead || false,
              location: emp.location || undefined,
              bio: emp.bio || undefined,
              skills: emp.skills || undefined,
              departments: departments,
              department: departments[0] || undefined,
            };
          })
        );
      }
    }
  }, [employees, setEmployees]);

  useEffect(() => {
    if (!hasCompletedWelcome && currentUser) {
      const timer = setTimeout(() => {
        setWelcomeGuideOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedWelcome, currentUser]);

  useEffect(() => {
    if (!hasSeenLaunchAnnouncement && currentUser && hasCompletedWelcome) {
      const timer = setTimeout(() => {
        setLaunchAnnouncementOpen(true);
        setHasSeenLaunchAnnouncement(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasSeenLaunchAnnouncement, currentUser, hasCompletedWelcome]);

  // Anche la scheda del browser: e' il posto dove il nome dell'applicazione si
  // vede piu' a lungo, ed era l'unico rimasto con il titolo scritto nell'HTML.
  useEffect(() => {
    document.title = nomeApplicazione;
  }, [nomeApplicazione]);

  /**
   * Apertura di un task dal link `#task-<id>`.
   *
   * Quella convenzione esisteva gia' — la scrive `desktopNotifications` nel
   * click della notifica di sistema, e ora anche il link dentro le email — ma
   * NESSUNO la leggeva: si arrivava sull'applicazione e l'hash veniva
   * ignorato. Chi cliccava la notifica o il pulsante nell'email restava sulla
   * schermata iniziale a cercare il task a mano.
   *
   * Si aspetta che i task siano caricati, altrimenti l'id non trova ancora
   * riscontro e il link sembrerebbe rotto proprio al primo accesso, che e' il
   * caso piu' comune per un'email. L'hash viene ripulito dopo l'apertura, cosi'
   * chiudere la finestra e ricaricare non la riapre all'infinito.
   */
  useEffect(() => {
    if (!currentUser || !(tasks || []).length) return;

    const apriDaHash = () => {
      const corrispondenza = /^#task-(.+)$/.exec(window.location.hash);
      if (!corrispondenza) return;

      const task = (tasks || []).find((t) => t.id === corrispondenza[1]);
      if (!task) return;

      setViewingTask(task);
      setDetailsDialogOpen(true);
      void caricaAllegati(task.id);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };

    apriDaHash();
    window.addEventListener('hashchange', apriDaHash);
    return () => window.removeEventListener('hashchange', apriDaHash);
  }, [currentUser, tasks]);

  const handleExportData = useCallback(async () => {
    const data = {
      tasks: tasks || [],
      employees: employees || [],
      announcements: announcements || [],
      // Le notifiche non entrano piu' nel backup applicativo: sono per
      // destinatario e vivono in una tabella con le proprie policy. Un export
      // fatto da un admin non deve contenere la posta dei colleghi.
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskflow-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [tasks, employees, announcements]);

  const handleImportData = useCallback(async (dataStr: string) => {
    const data = JSON.parse(dataStr);
    
    if (data.tasks) {
      setTasks(data.tasks);
    }
    if (data.employees) {
      setEmployees(data.employees);
    }
    if (data.announcements) {
      setAnnouncements(data.announcements);
    }
  }, [setTasks, setEmployees, setAnnouncements]);

  const handleClearAllData = useCallback(async () => {
    setTasks([]);
    setEmployees([]);
    setAnnouncements([]);
    void removeAllNotifications();
  }, [setTasks, setEmployees, setAnnouncements, removeAllNotifications]);

  /**
   * Le preferenze si applicano SOLO a quelle dell'utente corrente.
   *
   * Prima questa funzione leggeva `notification-preferences-<destinatario>` da
   * window.spark.kv, cioe' da un endpoint (/_spark/kv) che fuori dal runtime
   * GitHub Spark non esiste: la lettura falliva, il catch restituiva `true` e
   * le preferenze non avevano alcun effetto — orari di silenzio compresi.
   *
   * Non bastava cambiare la fonte: sotto RLS un utente non puo' leggere
   * user_state di un collega, quindi chi CREA la notifica non potra' mai
   * sapere cosa ha disattivato il destinatario. Il filtro va dove i dati sono
   * leggibili e dove serve davvero, cioe' sul client del destinatario, prima
   * di suono e notifica desktop.
   */
  const isWithinQuietHours = (prefs: NotificationPreferencesType | undefined) => {
    if (!prefs?.quietHours?.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = prefs.quietHours.startTime.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHours.endTime.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Intervallo che scavalca la mezzanotte (es. 22:00-07:00).
    return startTime < endTime
      ? currentTime >= startTime && currentTime < endTime
      : currentTime >= startTime || currentTime < endTime;
  };

  /**
   * Crea la notifica per il destinatario. Nient'altro.
   *
   * Suono e notifica desktop NON stanno piu' qui: li faceva scattare chi
   * scriveva, cioe' la persona sbagliata. La condizione era "se la notifica e'
   * per me", ma tutti i punti di creazione escludono se stessi (non ci si
   * notifica da soli), quindi in pratica non suonava mai nulla. Ora se ne
   * occupa il client del destinatario, in `annunciaNotifica`.
   */
  /**
   * L'email segue la notifica.
   *
   * Prima l'email esisteva solo per l'assegnazione, ricordata a mano in un
   * punto: gli altri otto modelli erano personalizzabili dall'interfaccia e non
   * partivano mai. Agganciarla qui, dove passano TUTTE le notifiche, evita che
   * la prossima notifica aggiunta si dimentichi di nuovo dell'email.
   *
   * Il destinatario e' quello della notifica, non chi agisce: i punti che
   * creano notifiche escludono gia' se stessi. Chi ha spento quel tipo di
   * email non la riceve, ma il controllo sta sul server — le preferenze sono
   * leggibili solo dal proprietario.
   */
  const inviaEmailDellaNotifica = async (
    notifica: TaskNotification,
    extra?: { commentText?: string; task?: Task }
  ) => {
    if (!organization?.id) return;

    const destinatario = (employees || []).find((e) => e.id === notifica.userId);
    if (!destinatario?.email) return;

    /**
     * Il task lo passa il chiamante, quando ce l'ha in mano.
     *
     * Cercarlo in `tasks` non basta: quella variabile e' quella della chiusura
     * del render corrente, e chi crea o modifica un task chiama questa
     * funzione PRIMA che React abbia riprodotto lo stato. Alla creazione il
     * task non c'era ancora (l'email partiva senza descrizione, scadenza e
     * priorita'); alla modifica c'era ma con i valori vecchi, quindi l'email
     * "priorita' cambiata" annunciava la priorita' di prima.
     */
    const task = extra?.task ?? (tasks || []).find((t) => t.id === notifica.taskId);
    const commentText = extra?.commentText;

    const esito = await inviaEmailNotifica({
      tenantId: organization.id,
      tipo: notifica.type,
      recipientEmail: destinatario.email,
      recipientName: destinatario.name,
      taskId: notifica.taskId,
      taskTitle: notifica.taskTitle || task?.title || '',
      taskDescription: task?.description,
      dueDate: task?.dueDate ?? undefined,
      priority: task?.priority,
      taskStatus: task?.status,
      commentText,
      assignedByName: notifica.actionByName || currentUser?.name || '',
      applicationName: nomeApplicazione,
    });

    /**
     * Un'email non partita va DETTA.
     *
     * Prima l'esito veniva ignorato: se l'organizzazione non avesse mai
     * configurato una chiave del provider, si sarebbe continuato a leggere
     * "Attività creata" per settimane senza che a nessuno arrivasse niente.
     *
     * Non si avvisa quando e' il destinatario ad aver spento quelle email: li'
     * il non-invio e' l'esito corretto, il server risponde 200 e chi ha agito
     * non deve vedere un allarme per una scelta legittima di un collega.
     * L'avviso e' discreto e non un errore, perche' la notifica in
     * applicazione c'e' comunque: la persona verra' avvisata, solo non per
     * posta.
     */
    if (!esito.ok) segnalaEmailNonPartita(esito.error);
  };

  /**
   * Avvisa chi SEGUE il task, oltre a chi lo ha in carico.
   *
   * Un task ha un solo assegnatario, quindi chi lo ha creato o chi ci ha
   * commentato non sapeva piu' nulla: erano tre buchi distinti — chi commenta
   * non sa delle risposte, chi perde un task non viene avvisato, chi ha creato
   * un lavoro non sa quando viene chiuso. Gli osservatori li chiudono tutti e
   * tre con un meccanismo solo, invece di rattoppare i tre casi.
   *
   * Si escludono chi ha agito (sa cosa ha fatto) e l'assegnatario, che riceve
   * gia' la notifica principale: senza queste due esclusioni la stessa persona
   * riceverebbe due avvisi per lo stesso evento.
   */
  const avvisaOsservatori = (
    task: Task | undefined,
    tipo: NotificationType,
    messaggio: string,
    extra?: { commentText?: string }
  ) => {
    if (!task || !currentUser) return;

    for (const osservatoreId of task.watchers ?? []) {
      if (osservatoreId === currentUser.id) continue;
      if (osservatoreId === task.assigneeId) continue;

      addNotification(
        {
          // L'id dell'osservatore fa parte della chiave: senza, l'indice unico
          // su `event_key` lascerebbe passare un solo osservatore e gli altri
          // resterebbero senza avviso, in silenzio.
          id: `notif-${task.id}-osserva-${tipo}-${osservatoreId}-${bloccoMinuto()}`,
          userId: osservatoreId,
          taskId: task.id,
          taskTitle: task.title,
          type: tipo,
          message: messaggio,
          actionBy: currentUser.id,
          actionByName: currentUser.name,
          actionByAvatar: currentUser.avatar,
          createdAt: new Date().toISOString(),
          read: false,
        },
        { ...extra, task }
      );
    }
  };

  const addNotification = async (
    notification: TaskNotification,
    extra?: { commentText?: string; task?: Task }
  ) => {
    /**
     * Se la notifica era gia' stata annunciata, niente email.
     *
     * L'indice unico su `event_key` respinge i doppioni: in app la campanella
     * mostrava giustamente una voce sola, ma l'email partiva lo stesso —
     * completare un task, annullare e ricompletarlo mandava due messaggi
     * identici. Un fallimento vero e' l'opposto: la notifica in app non c'e',
     * quindi l'email e' l'unico modo per avvisare, e va spedita comunque.
     */
    const esito = await pushNotification(notification);
    if (esito === 'duplicata') return;

    // Best effort: un'email non consegnata non deve far fallire l'azione che
    // l'ha provocata, che a questo punto e' gia' salvata.
    void inviaEmailDellaNotifica(notification, extra);
  };

  const addActivity = (taskId: string, type: TaskActivity['type'], oldValue?: string, newValue?: string, details?: string) => {
    if (!currentUser) return;

    const activity: TaskActivity = {
      id: newId('activity'),
      taskId,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      type,
      oldValue,
      newValue,
      details,
      createdAt: new Date().toISOString(),
    };

    setTasks((currentTasks) =>
      (currentTasks || []).map(task => {
        if (task.id === taskId) {
          const activities = task.activities || [];
          return { ...task, activities: [...activities, activity] };
        }
        return task;
      })
    );
  };

  const handleCreateTask = (taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'comments' | 'activities'>) => {
    if (!currentUser) return;

    // L'id si calcola PRIMA: l'attivita' 'created' deve riferirsi a questo
    // task. Prima erano due chiamate distinte a Date.now(), che coincidevano
    // solo perche' cadevano nello stesso millisecondo — un legame che si
    // reggeva sulla fortuna, e che con id univoci si sarebbe rotto del tutto.
    const taskId = newId();

    const newTask: Task = {
      ...taskData,
      id: taskId,
      status: 'not-started',
      createdAt: new Date().toISOString(),
      comments: [],
      activities: [{
        id: newId('activity'),
        taskId,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        type: 'created',
        createdAt: new Date().toISOString(),
      }],
    };
    
    setTasks((currentTasks) => [...(currentTasks || []), newTask]);

    // Creare un task gia' assegnato non generava alcuna notifica: solo la
    // riassegnazione lo faceva. Era il percorso piu' comune a restare muto,
    // quindi l'assegnatario non veniva mai avvisato.
    if (newTask.assigneeId && newTask.assigneeId !== currentUser.id) {
      addNotification({
        id: `notif-${newTask.id}-assigned-${newTask.assigneeId}`,
        userId: newTask.assigneeId,
        taskId: newTask.id,
        taskTitle: newTask.title,
        type: 'task_assigned',
        message: `New task assigned to you by ${currentUser.name}`,
        actionBy: currentUser.id,
        actionByName: currentUser.name,
        actionByAvatar: currentUser.avatar,
        createdAt: new Date().toISOString(),
        read: false,
      }, { task: newTask });
    }

    toast.success(t('Task created successfully!'));
  };

  // Handler passato a `TaskCard`: identita' stabile, altrimenti il memo della
  // scheda non serve a niente (vedi `useHandlerStabile`). Il corpo e' invariato.
  const handleStatusChange = useHandlerStabile((taskId: string, status: TaskStatus) => {
    const task = (tasks || []).find(t => t.id === taskId);
    if (!task || !currentUser) return;

    const oldStatus = task.status;
    const wasCompleted = oldStatus === 'completed';
    const isNowCompleted = status === 'completed';
    
    /*
      `campiCambioStato` azzera il visto insieme allo stato, ma solo sui task
      che l'approvazione la richiedono: senza, un task approvato, riaperto e
      richiuso resterebbe approvato dalla volta prima, e nessuno andrebbe piu'
      a guardarlo.
    */
    setTasks((currentTasks) =>
      (currentTasks || []).map(task =>
        task.id === taskId ? { ...task, ...campiCambioStato(task, status) } : task
      )
    );

    addActivity(taskId, 'status_changed', oldStatus.replace('-', ' '), status.replace('-', ' '));

    /*
      Un task che richiede approvazione non e' completato quando l'assegnatario
      lo sposta: e' consegnato. Coriandoli e "completato!" arrivano
      all'approvazione, non qui — festeggiare un lavoro che qualcuno deve
      ancora guardare e' il modo piu' rapido per far credere che il visto sia
      una formalita'.
    */
    const consegnatoInAttesa =
      !wasCompleted && isNowCompleted &&
      inAttesaDiApprovazione({ ...task, status, approvedBy: null, approvedAt: null });

    if (consegnatoInAttesa) {
      toast.success(t('Marked as done, waiting for approval'));

      /*
        Avvisare chi puo' approvare, non l'assegnatario: e' lui che ha appena
        premuto il pulsante. Senza questa notifica il lavoro resta fermo finche'
        un responsabile non passa per caso dalla bacheca, ed e' il modo tipico
        in cui un flusso di approvazione diventa un intralcio invece che un
        controllo.
      */
      const inAttesa = { ...task, status, approvedBy: null, approvedAt: null };
      for (const approvatore of listaEmployees) {
        if (!puoApprovare(inAttesa, approvatore)) continue;
        if (approvatore.id === currentUser.id) continue;
        addNotification({
          id: `notif-${taskId}-approvazione-${approvatore.id}-${bloccoMinuto()}`,
          userId: approvatore.id,
          taskId: task.id,
          taskTitle: task.title,
          type: 'task_status_changed',
          message: `"${task.title}" is waiting for your approval`,
          actionBy: currentUser.id,
          actionByName: currentUser.name,
          actionByAvatar: currentUser.avatar,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }

      avvisaOsservatori(task, 'task_status_changed', `"${task.title}" is waiting for approval`);
    } else if (!wasCompleted && isNowCompleted) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success(t('Task completed!'));
      
      if (task.assigneeId && task.assigneeId !== currentUser.id) {
        addNotification({
          id: `notif-${taskId}-completed-${task.assigneeId}-${bloccoMinuto()}`,
          userId: task.assigneeId,
          taskId: task.id,
          taskTitle: task.title,
          type: 'task_completed',
          message: `Your task "${task.title}" was marked as completed`,
          actionBy: currentUser.id,
          actionByName: currentUser.name,
          actionByAvatar: currentUser.avatar,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }

      avvisaOsservatori(task, 'task_completed', `"${task.title}" was completed`);

      // Avvisa chi ha creato il task che e' stato completato. Mancava del
      // tutto: se l'assegnatario chiudeva il proprio task, nessuno lo sapeva.
      // Il tipo Task non ha un campo createdBy, quindi l'autore si ricava
      // dall'attivita' 'created', registrata alla creazione.
      const creatorId = (task.activities || []).find(a => a.type === 'created')?.userId;
      if (creatorId && creatorId !== currentUser.id && creatorId !== task.assigneeId) {
        addNotification({
          id: `notif-${taskId}-completed-creator-${creatorId}-${bloccoMinuto()}`,
          userId: creatorId,
          taskId: task.id,
          taskTitle: task.title,
          type: 'task_completed',
          message: `${currentUser.name} ha completato "${task.title}"`,
          actionBy: currentUser.id,
          actionByName: currentUser.name,
          actionByAvatar: currentUser.avatar,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    } else if (oldStatus !== status && task.assigneeId && task.assigneeId !== currentUser.id) {
      const statusLabels: Record<TaskStatus, string> = {
        'not-started': 'Not Started',
        'in-progress': 'In Progress',
        'blocked': 'Blocked',
        'completed': 'Completed'
      };
      addNotification({
        id: `notif-${taskId}-status-${oldStatus}-${status}-${task.assigneeId}-${bloccoMinuto()}`,
        userId: task.assigneeId,
        taskId: task.id,
        taskTitle: task.title,
        type: 'task_status_changed',
        message: `Task status changed from ${statusLabels[oldStatus]} to ${statusLabels[status]}`,
        actionBy: currentUser.id,
        actionByName: currentUser.name,
        actionByAvatar: currentUser.avatar,
        createdAt: new Date().toISOString(),
        read: false,
      });

      avvisaOsservatori(
        task,
        'task_status_changed',
        `"${task.title}": ${statusLabels[oldStatus]} → ${statusLabels[status]}`
      );
    }
  });

  // Anche questo va a una scheda memoizzata: stessa ragione, stesso corpo.
  const handleAssigneeChange = useHandlerStabile((taskId: string, assigneeId: string | null) => {
    const task = (tasks || []).find(t => t.id === taskId);
    if (!task || !currentUser) return;

    const oldAssignee = task.assigneeId ? (employees || []).find(e => e.id === task.assigneeId)?.name : 'Unassigned';
    const newAssignee = assigneeId ? (employees || []).find(e => e.id === assigneeId)?.name : 'Unassigned';

    setTasks((currentTasks) =>
      (currentTasks || []).map(task =>
        task.id === taskId ? { ...task, assigneeId } : task
      )
    );

    addActivity(taskId, 'assignee_changed', oldAssignee, newAssignee);
    
    // Prendersi in carico un task da soli non e' una notizia per se stessi:
    // gli altri percorsi escludono gia' chi agisce, questo se n'era dimenticato.
    if (assigneeId && assigneeId !== currentUser.id) {
      const isReassign = task.assigneeId !== null;
      addNotification({
        id: `notif-${taskId}-assign-${task.assigneeId ?? 'nessuno'}-${assigneeId}-${bloccoMinuto()}`,
        userId: assigneeId,
        taskId: task.id,
        taskTitle: task.title,
        type: isReassign ? 'task_reassigned' : 'task_assigned',
        message: isReassign 
          ? `Task was reassigned to you by ${currentUser.name}`
          : `New task assigned to you by ${currentUser.name}`,
        actionBy: currentUser.id,
        actionByName: currentUser.name,
        actionByAvatar: currentUser.avatar,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
    
    toast.success(t('Task reassigned successfully!'));
  });

  const handleEditTask = useHandlerStabile((taskId: string) => {
    const task = tasksById.get(taskId);
    if (task) {
      setEditingTask(task);
      setEditDialogOpen(true);
    }
  });

  /**
   * Approvare chiude davvero il lavoro.
   *
   * I campi li calcola `campiApprovazione`, non questo gestore: la regola su
   * cosa significhi "approvato" — un visto ha bisogno di CHI e di QUANDO,
   * altrimenti non e' un visto — sta in un posto solo, con i suoi test.
   */
  const handleApprovaTask = useHandlerStabile((task: Task) => {
    if (!currentUser) return;

    const campi = campiApprovazione(currentUser.id);
    setTasks((currentTasks) =>
      (currentTasks || []).map((t) => (t.id === task.id ? { ...t, ...campi } : t))
    );

    addActivity(task.id, 'approved');
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    toast.success(t('Task approved'));

    if (task.assigneeId && task.assigneeId !== currentUser.id) {
      addNotification({
        id: `notif-${task.id}-approvato-${task.assigneeId}-${bloccoMinuto()}`,
        userId: task.assigneeId,
        taskId: task.id,
        taskTitle: task.title,
        type: 'task_completed',
        message: `Your task "${task.title}" was approved`,
        actionBy: currentUser.id,
        actionByName: currentUser.name,
        actionByAvatar: currentUser.avatar,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    avvisaOsservatori(task, 'task_completed', `"${task.title}" was approved`);
  });

  /**
   * Rimandare indietro riporta il task in corso e cancella i visti.
   *
   * Il motivo finisce nella cronologia e nella notifica: "rimandato indietro"
   * senza dire perche' obbliga chi ha fatto il lavoro a indovinare, ed e' il
   * motivo per cui i flussi di approvazione vengono odiati.
   */
  const handleRifiutaTask = useHandlerStabile((task: Task, motivo: string) => {
    if (!currentUser) return;

    const campi = campiRifiuto();
    setTasks((currentTasks) =>
      (currentTasks || []).map((t) => (t.id === task.id ? { ...t, ...campi } : t))
    );

    addActivity(task.id, 'approval_rejected', undefined, undefined, motivo || undefined);
    toast.success(t('Task sent back for changes'));

    if (task.assigneeId && task.assigneeId !== currentUser.id) {
      addNotification({
        id: `notif-${task.id}-rimandato-${task.assigneeId}-${bloccoMinuto()}`,
        userId: task.assigneeId,
        taskId: task.id,
        taskTitle: task.title,
        type: 'task_status_changed',
        message: motivo
          ? `"${task.title}" was sent back: ${motivo}`
          : `"${task.title}" was sent back for changes`,
        actionBy: currentUser.id,
        actionByName: currentUser.name,
        actionByAvatar: currentUser.avatar,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  });

  const handleViewDetails = useHandlerStabile((taskId: string) => {
    const task = tasksById.get(taskId);
    if (task) {
      setViewingTask(task);
      setDetailsDialogOpen(true);
      // Best effort: la finestra si apre subito e gli allegati compaiono
      // quando arrivano. Farla aspettare renderebbe lento il caso comune,
      // che e' aprire un task per leggerne i commenti.
      void caricaAllegati(taskId);
    }
  });

  const handleUpdateTask = (taskId: string, updates: {
    title: string;
    description: string;
    assigneeId: string | null;
    priority: TaskPriority;
    dueDate: string | null;
    labels: string[];
    watchers: string[];
    estimateMinutes: number | null;
    spentMinutes: number | null;
    requiresApproval: boolean;
  }) => {
    const task = (tasks || []).find(t => t.id === taskId);
    if (!task) return;

    if (task.title !== updates.title) {
      addActivity(taskId, 'title_changed');
    }
    if (task.description !== updates.description) {
      addActivity(taskId, 'description_changed');
    }
    if (task.priority !== updates.priority) {
      addActivity(taskId, 'priority_changed', task.priority, updates.priority);
    }
    if (task.assigneeId !== updates.assigneeId) {
      const oldAssignee = task.assigneeId ? (employees || []).find(e => e.id === task.assigneeId)?.name : 'Unassigned';
      const newAssignee = updates.assigneeId ? (employees || []).find(e => e.id === updates.assigneeId)?.name : 'Unassigned';
      addActivity(taskId, 'assignee_changed', oldAssignee, newAssignee);
    }
    /*
      Il confronto e' fra ISTANTI, non fra stringhe.

      Il database restituisce "2026-09-22T22:00:00+00:00", il selettore della
      data produce "2026-09-22T22:00:00.000Z": stesso momento, testo diverso.
      Confrontandoli come stringhe ogni salvataggio registrava uno spostamento
      di scadenza da una data a se stessa — cronologia sporca, e soprattutto
      una seconda scrittura sulla riga che correva contro quella vera (vedi la
      coda in useTasks).
    */
    const istante = (valore?: string | null) => dataScadenza({ dueDate: valore })?.getTime() ?? null;

    if (istante(task.dueDate) !== istante(updates.dueDate)) {
      // Una delle due puo' mancare: togliere la scadenza e' un cambiamento da
      // registrare quanto lo e' spostarla, e "nessuna" e' l'informazione.
      const mostra = (valore?: string | null) =>
        dataScadenza({ dueDate: valore })?.toLocaleDateString() ?? '—';
      addActivity(taskId, 'due_date_changed', mostra(task.dueDate), mostra(updates.dueDate));
    }

    setTasks((currentTasks) =>
      (currentTasks || []).map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );

    /**
     * Una modifica, una notifica sola.
     *
     * Un'unica schermata di modifica puo' cambiare titolo, priorita', scadenza
     * e assegnatario insieme: avvisare per ognuno significherebbe quattro email
     * per un solo salvataggio. Si sceglie il cambiamento piu' significativo, in
     * quest'ordine — cambiare la persona a cui tocca il lavoro conta piu' di
     * cambiarne la priorita', che conta piu' di correggere una descrizione.
     *
     * Nessuna notifica se a modificare e' l'assegnatario stesso: sa gia' cosa
     * ha fatto.
     */
    const nuovoAssegnatario = updates.assigneeId;
    const assegnatarioCambiato = task.assigneeId !== nuovoAssegnatario;
    const destinatario = assegnatarioCambiato ? nuovoAssegnatario : task.assigneeId;

    if (currentUser && destinatario && destinatario !== currentUser.id) {
      const tipo = scegliTipoModifica(task, updates, assegnatarioCambiato);

      if (tipo) {
        addNotification({
          id: `notif-${taskId}-${tipo}-${bloccoMinuto()}`,
          userId: destinatario,
          taskId,
          taskTitle: updates.title,
          type: tipo,
          message: `${currentUser.name} updated "${updates.title}"`,
          actionBy: currentUser.id,
          actionByName: currentUser.name,
          actionByAvatar: currentUser.avatar,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    }

    toast.success(t('Task updated successfully!'));
  };

  const handleAddComment = (taskId: string, content: string) => {
    if (!currentUser) return;

    const comment: TaskComment = {
      id: newId('comment'),
      taskId,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      content,
      createdAt: new Date().toISOString(),
    };

    const task = (tasks || []).find(t => t.id === taskId);

    setTasks((currentTasks) =>
      (currentTasks || []).map(task => {
        if (task.id === taskId) {
          const comments = task.comments || [];
          return { ...task, comments: [...comments, comment] };
        }
        return task;
      })
    );

    addActivity(taskId, 'comment_added', undefined, undefined, content);
    
    /**
     * Le persone citate con @ nel commento.
     *
     * Il tipo di notifica `mention` esisteva ovunque — icona, suono,
     * interruttore nelle preferenze, modello email in cinque lingue — ma
     * nessuno lo generava: era una funzionalita' dichiarata e mai scritta.
     */
    const menzionati = task ? trovaMenzioni(content, employees || []) : [];

    if (task && task.assigneeId && task.assigneeId !== currentUser.id) {
      // Chi e' gia' stato citato riceve la menzione, che dice la stessa cosa
      // in modo piu' diretto: due email per un commento solo sarebbero di
      // troppo.
      if (!menzionati.includes(task.assigneeId)) {
        addNotification(
          {
            id: `notif-${taskId}-comment-${comment.id}`,
            userId: task.assigneeId,
            taskId: task.id,
            taskTitle: task.title,
            type: 'task_comment',
            message: `${currentUser.name} commented: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
            actionBy: currentUser.id,
            actionByName: currentUser.name,
            actionByAvatar: currentUser.avatar,
            createdAt: new Date().toISOString(),
            read: false,
          },
          { commentText: content }
        );
      }
    }

    // Chi segue il task senza averlo in carico: e' il caso di chi ha commentato
    // prima e vuole sapere delle risposte, che finora restava all'oscuro.
    avvisaOsservatori(
      task,
      'task_comment',
      `${currentUser.name} commented on "${task?.title ?? ''}"`,
      { commentText: content }
    );

    for (const menzionatoId of menzionati) {
      if (menzionatoId === currentUser.id) continue;

      addNotification(
        {
          id: `notif-${taskId}-mention-${comment.id}-${menzionatoId}`,
          userId: menzionatoId,
          taskId,
          taskTitle: task?.title || '',
          type: 'mention',
          message: `${currentUser.name} mentioned you: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
          actionBy: currentUser.id,
          actionByName: currentUser.name,
          actionByAvatar: currentUser.avatar,
          createdAt: new Date().toISOString(),
          read: false,
        },
        { commentText: content }
      );
    }
    
    toast.success(t('Comment added!'));
  };

  const handleEditComment = (taskId: string, commentId: string, newContent: string) => {
    if (!currentUser) return;

    setTasks((currentTasks) =>
      (currentTasks || []).map(task => {
        if (task.id === taskId) {
          const comments = (task.comments || []).map(comment =>
            comment.id === commentId
              ? { ...comment, content: newContent }
              : comment
          );
          return { ...task, comments };
        }
        return task;
      })
    );

    toast.success(t('Comment updated!'));
  };

  const handleDeleteComment = (taskId: string, commentId: string) => {
    if (!currentUser) return;

    setTasks((currentTasks) =>
      (currentTasks || []).map(task => {
        if (task.id === taskId) {
          const comments = (task.comments || []).filter(comment => comment.id !== commentId);
          return { ...task, comments };
        }
        return task;
      })
    );

    toast.success(t('Comment deleted'));
  };

  const handleAddAttachment = async (taskId: string, file: File) => {
    if (!currentUser) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('File size must be less than 10MB'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const attachment: TaskAttachment = {
        id: newId('attachment'),
        taskId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileData: reader.result as string,
        uploadedBy: currentUser.id,
        uploadedByName: currentUser.name,
        uploadedByAvatar: currentUser.avatar,
        uploadedAt: new Date().toISOString(),
      };

      setTasks((currentTasks) =>
        (currentTasks || []).map(task => {
          if (task.id === taskId) {
            const attachments = task.attachments || [];
            return { ...task, attachments: [...attachments, attachment] };
          }
          return task;
        })
      );

      addActivity(taskId, 'attachment_added', undefined, undefined, file.name);
      toast.success(t('File attached successfully!'));
    };

    reader.onerror = () => {
      toast.error(t('Failed to read file'));
    };

    reader.readAsDataURL(file);
  };

  const handleDeleteAttachment = (taskId: string, attachmentId: string) => {
    const task = (tasks || []).find(t => t.id === taskId);
    if (!task) return;

    const attachment = task.attachments?.find(a => a.id === attachmentId);
    if (!attachment) return;

    setTasks((currentTasks) =>
      (currentTasks || []).map(task => {
        if (task.id === taskId) {
          const attachments = task.attachments || [];
          return { ...task, attachments: attachments.filter(a => a.id !== attachmentId) };
        }
        return task;
      })
    );

    addActivity(taskId, 'attachment_removed', undefined, undefined, attachment.fileName);
    toast.success(t('Attachment removed'));
  };

  // Qui basta `useCallback` con dipendenze vuote, ed e' davvero completo:
  // il corpo usa solo `setDeleteTaskId`, che React garantisce stabile.
  const handleDeleteTask = useCallback((taskId: string) => {
    setDeleteTaskId(taskId);
  }, []);

  const confirmDelete = () => {
    if (deleteTaskId) {
      setTasks((currentTasks) => (currentTasks || []).filter(task => task.id !== deleteTaskId));
      toast.success(t('Task deleted'));
      setDeleteTaskId(null);
    }
  };

  const handleToggleBulkMode = () => {
    setBulkMode(!bulkMode);
    setSelectedTasks(new Set());
  };

  // Dipendenze vuote e complete: l'insieme precedente arriva dall'aggiornamento
  // funzionale, quindi non serve leggere `selectedTasks` dalla chiusura.
  const handleToggleTaskSelect = useCallback((taskId: string) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = () => {
    const visibleTaskIds = filteredAndSortedTasks.map(t => t.id);
    setSelectedTasks(new Set(visibleTaskIds));
  };

  const handleDeselectAll = () => {
    setSelectedTasks(new Set());
  };

  const handleBulkComplete = () => {
    if (selectedTasks.size === 0) return;
    
    // Lookup dalla mappa invece che una scansione dell'array per ogni task
    // selezionato: con "seleziona tutto" i due cicli erano quadratici.
    const completedCount = Array.from(selectedTasks).filter(taskId => {
      const task = tasksById.get(taskId);
      return task?.status !== 'completed';
    }).length;

    selectedTasks.forEach(taskId => {
      const task = tasksById.get(taskId);
      if (task && task.status !== 'completed') {
        addActivity(taskId, 'status_changed', task.status.replace('-', ' '), 'completed');
      }
    });

    setTasks((currentTasks) =>
      (currentTasks || []).map(task =>
        selectedTasks.has(task.id) ? { ...task, status: 'completed' as TaskStatus } : task
      )
    );
    
    if (completedCount > 0) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
      });
      toast.success(`${completedCount} task${completedCount > 1 ? 's' : ''} marked as complete! 🎉`);
    }
    
    setSelectedTasks(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedTasks.size === 0) return;
    
    setTasks((currentTasks) => 
      (currentTasks || []).filter(task => !selectedTasks.has(task.id))
    );
    
    toast.success(`${selectedTasks.size} task${selectedTasks.size > 1 ? 's' : ''} deleted`);
    setSelectedTasks(new Set());
  };

  const handleAISuggestion = (suggestion: AISuggestion) => {
    if (!suggestion.action) return;

    switch (suggestion.type) {
      case 'create_task':
        if (suggestion.action.taskData) {
          handleCreateTask(suggestion.action.taskData);
        }
        break;
      case 'reassign':
        if (suggestion.action.taskId && suggestion.action.newAssigneeId) {
          handleAssigneeChange(suggestion.action.taskId, suggestion.action.newAssigneeId);
        }
        break;
      case 'priority_change':
        if (suggestion.action.taskId && suggestion.action.newPriority) {
          const task = (tasks || []).find(t => t.id === suggestion.action!.taskId);
          if (task) {
            setTasks((currentTasks) =>
              (currentTasks || []).map(t =>
                t.id === suggestion.action!.taskId
                  ? { ...t, priority: suggestion.action!.newPriority! }
                  : t
              )
            );
            addActivity(suggestion.action.taskId, 'priority_changed', task.priority, suggestion.action.newPriority);
          }
        }
        break;
    }
  };

  const handleAutoAssign = (assignments: Array<{ taskId: string; employeeId: string }>) => {
    assignments.forEach(({ taskId, employeeId }) => {
      const task = (tasks || []).find(t => t.id === taskId);
      const employee = (employees || []).find(e => e.id === employeeId);
      if (task && employee) {
        addActivity(taskId, 'assignee_changed', 'Unassigned', employee.name);
      }
    });

    setTasks((currentTasks) =>
      (currentTasks || []).map(task => {
        const assignment = assignments.find(a => a.taskId === task.id);
        return assignment ? { ...task, assigneeId: assignment.employeeId } : task;
      })
    );
  };

  const handleBulkStatusChange = (status: TaskStatus) => {
    if (selectedTasks.size === 0) return;
    
    // Come sopra: mappa al posto di una `find` per ogni task selezionato.
    const changedCount = Array.from(selectedTasks).filter(taskId => {
      const task = tasksById.get(taskId);
      return task?.status !== status;
    }).length;

    selectedTasks.forEach(taskId => {
      const task = tasksById.get(taskId);
      if (task && task.status !== status) {
        addActivity(taskId, 'status_changed', task.status.replace('-', ' '), status.replace('-', ' '));
      }
    });

    setTasks((currentTasks) =>
      (currentTasks || []).map(task =>
        selectedTasks.has(task.id) ? { ...task, status } : task
      )
    );
    
    if (changedCount > 0) {
      const statusLabels: Record<TaskStatus, string> = {
        'not-started': 'Not Started',
        'in-progress': 'In Progress',
        'blocked': 'Blocked',
        'completed': 'Completed'
      };
      toast.success(`${changedCount} task${changedCount > 1 ? 's' : ''} set to ${statusLabels[status]}`);
    }
    
    setSelectedTasks(new Set());
  };

  /**
   * Aggiunge un membro creandone davvero l'account.
   *
   * Prima qui si generava soltanto `id: Date.now().toString()` e si appendeva
   * l'oggetto all'array `employees`: nessun account, nessuna riga in
   * organization_members. L'utente "creato" non poteva accedere e i task che
   * gli venivano assegnati puntavano a un id che non apparteneva a nessuno,
   * quindi non comparivano a nessuno e non generavano notifiche recapitabili.
   * L'unico percorso di creazione reale — POST /api/tenants/<id>/members —
   * non era chiamato da nessuna parte dell'interfaccia.
   *
   * L'id del membro e' ora quello dell'account (auth.users/profiles): e' cio'
   * che rende assegnazioni, notifiche e RLS coerenti fra loro.
   */
  const handleAddEmployee = async (employeeData: Omit<Employee, 'id'>) => {
    if (!organization?.id) {
      toast.error('Nessuna organizzazione attiva');
      return;
    }

    if (!employeeData.email?.trim()) {
      toast.error("L'email e' obbligatoria: senza account l'utente non puo' accedere");
      return;
    }

    try {
      const result = await upsertOrgMember({
        tenantId: organization.id,
        email: employeeData.email,
        // Ruolo minimo alla creazione: si alza dalla gestione ruoli, che ora
        // scrive anch'essa su organization_members.
        role: 'member',
        fullName: employeeData.name,
        jobTitle: employeeData.role,
        departments: employeeData.departments,
      });

      const newEmployee: Employee = {
        ...employeeData,
        id: result.userId,
        userRole: mapOrgRoleToUserRole(result.role),
        status: employeeData.status || 'active',
        joinedDate: employeeData.joinedDate || new Date().toISOString(),
      };

      setEmployees((currentEmployees) => {
        const list = currentEmployees || [];
        const index = list.findIndex((e) => e.id === newEmployee.id);
        // L'account puo' esistere gia' (utente reinvitato, oppure riga creata
        // da useSyncEmployees): in quel caso si aggiorna, non si duplica.
        if (index === -1) return [...list, newEmployee];
        const next = [...list];
        next[index] = { ...list[index], ...newEmployee };
        return next;
      });

      if (result.temporaryPassword) {
        // Non esiste ancora un invito via email: la password provvisoria la
        // consegna l'amministratore, quindi deve restare a schermo finche' non
        // la chiude lui (un toast sparirebbe da solo).
        setNewAccountCredentials({
          email: employeeData.email.trim().toLowerCase(),
          password: result.temporaryPassword,
        });
      } else {
        toast.success('Utente aggiunto all\'organizzazione');
      }
    } catch (e) {
      toast.error(t(e instanceof Error ? e.message : 'Could not create the user'));
    }
  };

  /**
   * Modifica l'anagrafica di un membro, scrivendo anche sul database.
   *
   * Prima aggiornava solo l'array `employees`: qualifica, dipartimenti e
   * soprattutto lo STATO (attivo/disattivato) non arrivavano mai su profiles.
   * Il risultato e' che "disattiva utente" non bloccava nulla e non durava
   * neppure — useSyncEmployees rilegge quei campi dal database a ogni avvio e
   * riportava tutti ad 'active'.
   *
   * I campi che il database non conosce (bio, competenze, permessi
   * personalizzati) restano nello stato applicativo, dove hanno senso.
   */
  const handleEditEmployee = async (id: string, updates: Omit<Employee, 'id'>) => {
    const precedente = (employees || []).find((e) => e.id === id);
    const email = updates.email ?? precedente?.email;

    if (organization?.id && email) {
      try {
        await upsertOrgMember({
          tenantId: organization.id,
          email,
          // Nessun ruolo: questa e' una modifica di anagrafica e il ruolo si
          // cambia dalla gestione ruoli. Ometterlo lo lascia invariato.
          fullName: updates.name,
          jobTitle: updates.role,
          departments: updates.departments,
          status: updates.status,
          teamLead: updates.teamLead,
          phone: updates.phone,
          location: updates.location,
        });
      } catch (e) {
        toast.error(t(e instanceof Error ? e.message : 'comune.modificaNonSalvata'));
        return;
      }
    }

    setEmployees((currentEmployees) =>
      (currentEmployees || []).map(employee =>
        employee.id === id ? { ...employee, ...updates } : employee
      )
    );
    toast.success(t('Team member updated successfully!'));
  };

  /**
   * Rimuove davvero la persona dall'organizzazione.
   *
   * Prima qui si toglieva solo la voce dall'array `employees`: la membership
   * restava, quindi l'interessato continuava ad accedere e a vedere tutti i
   * dati, e alla ricarica successiva useSyncEmployees lo rimetteva in elenco
   * — la rimozione non revocava nulla e non durava nemmeno. Lo stato locale si
   * aggiorna solo dopo che il server ha confermato la revoca.
   */
  const handleDeleteEmployee = async (id: string) => {
    if (!organization?.id) {
      toast.error('Nessuna organizzazione attiva');
      return;
    }

    if (id === user?.id) {
      toast.error("Non puoi rimuovere te stesso dall'organizzazione");
      return;
    }

    try {
      await removeOrgMember(organization.id, id);

      setTasks((currentTasks) =>
        (currentTasks || []).map(task =>
          task.assigneeId === id ? { ...task, assigneeId: null } : task
        )
      );

      setEmployees((currentEmployees) =>
        (currentEmployees || []).filter(employee => employee.id !== id)
      );

      toast.success(t('Accesso revocato e membro rimosso'));
    } catch (e) {
      toast.error(t(e instanceof Error ? e.message : 'Could not remove'));
    }
  };

  /**
   * Assegna una nuova password provvisoria e la mostra all'amministratore,
   * che la consegna di persona. E' l'unico modo di far rientrare chi ha perso
   * l'accesso: prima non ne esisteva nessuno.
   */
  const handleResetPassword = async (employee: Employee) => {
    if (!organization?.id || !employee.email) {
      toast.error("Questo membro non ha un'email collegata");
      return;
    }

    try {
      const password = await resetMemberPassword(organization.id, employee.email);
      setNewAccountCredentials({ email: employee.email, password });
    } catch (e) {
      toast.error(t(e instanceof Error ? e.message : 'Could not reset the password'));
    }
  };

  const handleCreateAnnouncement = (announcementData: Omit<Announcement, 'id' | 'createdAt' | 'readBy'>) => {
    const newAnnouncement: Announcement = {
      ...announcementData,
      id: newId(),
      createdAt: new Date().toISOString(),
      readBy: [],
    };
    
    setAnnouncements((currentAnnouncements) => [...(currentAnnouncements || []), newAnnouncement]);
  };

  const handleEditAnnouncement = (id: string, updates: Omit<Announcement, 'id' | 'createdAt' | 'readBy' | 'createdBy' | 'createdByName' | 'createdByAvatar'>) => {
    setAnnouncements((currentAnnouncements) =>
      (currentAnnouncements || []).map(announcement =>
        announcement.id === id ? { ...announcement, ...updates } : announcement
      )
    );
    toast.success(t('Announcement updated successfully!'));
  };

  const handleDeleteAnnouncement = (id: string) => {
    setAnnouncements((currentAnnouncements) =>
      (currentAnnouncements || []).filter(announcement => announcement.id !== id)
    );
    toast.success(t('Announcement deleted'));
  };

  const handlePinAnnouncement = (id: string) => {
    setAnnouncements((currentAnnouncements) =>
      (currentAnnouncements || []).map(announcement =>
        announcement.id === id ? { ...announcement, isPinned: !announcement.isPinned } : announcement
      )
    );
  };

  const handleMarkAnnouncementAsRead = (id: string) => {
    if (!currentUser) return;
    
    setAnnouncements((currentAnnouncements) =>
      (currentAnnouncements || []).map(announcement => {
        if (announcement.id === id && !announcement.readBy.includes(currentUser.id)) {
          return { ...announcement, readBy: [...announcement.readBy, currentUser.id] };
        }
        return announcement;
      })
    );
  };

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...(tasks || [])];

    if (activeTab !== 'all') {
      if (activeTab === 'unassigned') {
        filtered = filtered.filter(task => !task.assigneeId);
      } else {
        filtered = filtered.filter(task => task.assigneeId === activeTab);
      }
    }

    /*
      Il lavoro fermo che aspetta ME.

      Senza questa vista il flusso di approvazione funziona ma non se ne
      accorge nessuno in tempo: il task resta chiuso a meta' finche' un
      responsabile non passa per caso dalla bacheca.
    */
    if (soloDaApprovare) {
      filtered = filtered.filter((task) => puoApprovare(task, currentEmployee));
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === filterPriority);
    }

    if (filterDepartment !== 'all') {
      // Con la `find` questo filtro costava "task per persone": era il punto
      // piu' caro del memo, e scattava a ogni cambio di filtro o di ordinamento.
      filtered = filtered.filter(task => {
        if (!task.assigneeId) return false;
        return employeesById.get(task.assigneeId)?.department === filterDepartment;
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          return confrontaScadenze(a, b);
        case 'priority': {
          const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        case 'status': {
          // 'blocked' sta fra "in corso" e "completato": e' lavoro iniziato e
          // non concluso, ed e' li' che chi ordina per stato lo cerca.
          const statusOrder: Record<TaskStatus, number> = {
            'not-started': 0,
            'in-progress': 1,
            blocked: 2,
            completed: 3,
          };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [tasks, activeTab, filterStatus, filterPriority, filterDepartment, sortBy, employeesById, soloDaApprovare, currentEmployee]);

  /**
   * Quanti task dell'elenco filtrato sono effettivamente resi.
   *
   * Il numero mostrato all'utente resta comunque quello TOTALE dei risultati:
   * chi filtra vuole sapere quanti ce ne sono, non quanti se ne vedono.
   */
  const [taskVisibili, setTaskVisibili] = useState(TASK_PER_PAGINA);
  const [esportaAperto, setEsportaAperto] = useState(false);

  /*
    I filtri salvati sono PER UTENTE e non condivisi: sono un modo personale di
    guardare il lavoro, non una configurazione dell'organizzazione. La chiave
    e' fra quelle per-utente di useKV.
  */
  const [filtriSalvati, setFiltriSalvati] = useKV<Filtro[]>('filtri-salvati', []);

  /**
   * I filtri attivi in questo momento, nella forma che il salvataggio capisce.
   *
   * `activeTab` fa da assegnatario: nell'interfaccia e' una scheda, ma per chi
   * salva una vista e' a tutti gli effetti "i task di questa persona".
   */
  const filtriAttivi = useMemo<Partial<Filtro>>(
    () => ({
      stato: filterStatus,
      priorita: filterPriority,
      reparto: filterDepartment,
      assegnatario: activeTab,
      ordine: sortBy,
    }),
    [filterStatus, filterPriority, filterDepartment, activeTab, sortBy]
  );

  /**
   * Applicare un filtro salvato scrive TUTTI i campi, anche quelli che il
   * filtro non ha: un campo assente significa "nessun filtro", e lasciarlo
   * com'era darebbe una vista diversa da quella salvata.
   */
  const applicaFiltro = useCallback((filtro: Filtro) => {
    setFilterStatus((filtro.stato as typeof filterStatus) || 'all');
    setFilterPriority((filtro.priorita as typeof filterPriority) || 'all');
    setFilterDepartment(filtro.reparto || 'all');
    setActiveTab(filtro.assegnatario || 'all');
    setSortBy((filtro.ordine as typeof sortBy) || 'dueDate');
  }, []);

  const salvaFiltro = useCallback((filtro: Filtro) => {
    setFiltriSalvati((correnti) => [...(correnti || []), filtro]);
  }, [setFiltriSalvati]);

  const eliminaFiltro = useCallback((id: string) => {
    setFiltriSalvati((correnti) => (correnti || []).filter((f) => f.id !== id));
  }, [setFiltriSalvati]);

  const rinominaFiltro = useCallback((id: string, nome: string) => {
    setFiltriSalvati((correnti) =>
      (correnti || []).map((f) => (f.id === id ? { ...f, nome } : f))
    );
  }, [setFiltriSalvati]);

  /**
   * Ogni cambio di filtro, scheda o ordinamento riparte dalla prima pagina.
   *
   * Senza questo, chi avesse premuto "mostra altri" su "tutti i task" si
   * ritroverebbe l'ampliamento anche su un filtro che ne restituisce dieci,
   * e — peggio — il ritorno a un elenco lungo mostrerebbe seicento schede
   * tutte insieme, cioe' esattamente il problema che stiamo togliendo.
   */
  useEffect(() => {
    setTaskVisibili(TASK_PER_PAGINA);
  }, [activeTab, filterStatus, filterPriority, filterDepartment, sortBy, soloDaApprovare]);

  /* Quante attivita' aspettano proprio me: il numero sul pulsante. */
  const daApprovare = useMemo(
    () => (tasks || []).filter((task) => puoApprovare(task, currentEmployee)).length,
    [tasks, currentEmployee]
  );

  const taskDaMostrare = useMemo(
    () => filteredAndSortedTasks.slice(0, taskVisibili),
    [filteredAndSortedTasks, taskVisibili]
  );

  const mostraAltriTask = useCallback(() => {
    setTaskVisibili((precedente) => precedente + TASK_PER_PAGINA);
  }, []);

  /**
   * Il task aperto nel dettaglio, sempre nella sua versione viva.
   *
   * Era una `find` sull'intero elenco eseguita a ogni render di App, anche
   * con la finestra chiusa: dalla mappa costa quanto una lettura.
   */
  const taskInVisione = useMemo(
    () => (viewingTask ? tasksById.get(viewingTask.id) ?? viewingTask : null),
    [tasksById, viewingTask]
  );

  const stats = useMemo(() => {
    const taskList = tasks || [];
    const total = taskList.length;
    /*
      "Completate" qui significa CHIUSE, non "spostate nella colonna finita":
      un'attivita' che aspetta un'approvazione ha ancora bisogno di qualcuno,
      e contarla fra quelle concluse racconta un avanzamento che non c'e'.
    */
    const completed = taskList.filter(eChiusoDavvero).length;
    const inProgress = taskList.filter(t => t.status === 'in-progress').length;
    const overdue = taskList.filter(t => 
      eInRitardo(t)
    ).length;

    return { total, completed, inProgress, overdue };
  }, [tasks]);

  const tabEmployees = useMemo(() => {
    const employeeMap = new Map<string, { employee: Employee; taskCount: number }>();
    
    (employees || []).forEach(emp => {
      employeeMap.set(emp.id, { employee: emp, taskCount: 0 });
    });

    (tasks || []).forEach(task => {
      if (task.assigneeId && employeeMap.has(task.assigneeId)) {
        const entry = employeeMap.get(task.assigneeId)!;
        entry.taskCount++;
      }
    });

    return Array.from(employeeMap.values());
  }, [employees, tasks]);

  // Fuori da un memo questo rifiltrava l'intero elenco a ogni render, anche
  // quando cambiava solo il testo di ricerca.
  const unassignedCount = useMemo(
    () => (tasks || []).filter((t) => !t.assigneeId).length,
    [tasks]
  );

  const availableDepartments = useMemo(() => {
    const departments = new Set<string>();
    (employees || []).forEach(emp => {
      if (emp.department) {
        departments.add(emp.department);
      }
    });
    return Array.from(departments).sort();
  }, [employees]);

  const taskCountsByEmployee = useMemo(() => {
    const countMap = new Map<string, number>();
    (tasks || []).forEach(task => {
      if (task.assigneeId) {
        countMap.set(task.assigneeId, (countMap.get(task.assigneeId) || 0) + 1);
      }
    });
    return countMap;
  }, [tasks]);

  const handleMarkNotificationAsRead = (notificationId: string) => {
    void markNotificationRead(notificationId);
  };

  const handleMarkAllNotificationsAsRead = () => {
    void markAllNotificationsRead();
  };

  const handleDeleteNotification = (notificationId: string) => {
    void removeNotification(notificationId);
  };

  const handleDeleteAllNotifications = () => {
    void removeAllNotifications();
  };

  const handleNotificationClick = (notification: TaskNotification) => {
    handleViewDetails(notification.taskId);
  };

  const handleSubmitFeedback = (feedbackData: Omit<FeedbackItem, 'id' | 'createdAt' | 'status' | 'upvotes'>) => {
    const newFeedback: FeedbackItem = {
      ...feedbackData,
      id: newId('feedback'),
      createdAt: new Date().toISOString(),
      status: 'new',
      upvotes: [],
    };
    setFeedback((currentFeedback) => [...(currentFeedback || []), newFeedback]);
  };

  const handleUpvoteFeedback = (feedbackId: string) => {
    if (!currentUser) return;
    
    setFeedback((currentFeedback) =>
      (currentFeedback || []).map((item) => {
        if (item.id === feedbackId) {
          const hasUpvoted = item.upvotes.includes(currentUser.id);
          return {
            ...item,
            upvotes: hasUpvoted
              ? item.upvotes.filter(id => id !== currentUser.id)
              : [...item.upvotes, currentUser.id],
          };
        }
        return item;
      })
    );
  };

  const handleChangeFeedbackStatus = (feedbackId: string, status: FeedbackItem['status']) => {
    setFeedback((currentFeedback) =>
      (currentFeedback || []).map((item) =>
        item.id === feedbackId ? { ...item, status } : item
      )
    );
    toast.success(t('Feedback status updated'));
  };

  const unreadFeedbackCount = useMemo(() => {
    return (feedback || []).filter(f => f.status === 'new').length;
  }, [feedback]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-muted/30">
      <Toaster position="top-right" />
      
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
                {nomeApplicazione}
              </h1>
              <p className="text-muted-foreground">{t("Manage your team's work efficiently")}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <TaskNotifications
                notifications={myNotifications}
                onMarkAsRead={handleMarkNotificationAsRead}
                onMarkAllAsRead={handleMarkAllNotificationsAsRead}
                onDelete={handleDeleteNotification}
                onDeleteAll={handleDeleteAllNotifications}
                onNotificationClick={handleNotificationClick}
              />
              <DesktopNotificationSettings />
              {currentUser && <NotificationPreferences userId={currentUser.id} />}
              <PermissionsOverview employee={currentEmployee} />
              <Button
                variant="outline"
                onClick={() => setFeedbackDialogOpen(true)}
                className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-300 hover:from-blue-500/20 hover:to-cyan-500/20"
              >
                <PaperPlaneTilt className="mr-2 h-5 w-5 text-blue-600" weight="fill" />{t('Give Feedback')}</Button>
              {currentEmployee?.userRole === 'admin' && (
                <Button
                  variant="outline"
                  onClick={() => setFeedbackBoardOpen(true)}
                  className="relative"
                >
                  <Megaphone className="mr-2 h-5 w-5" weight="fill" />
                  {t('Feedback Board')}
                  {unreadFeedbackCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadFeedbackCount}
                    </span>
                  )}
                </Button>
              )}
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('dashboard')}
                  className="rounded-r-none"
                  size="sm"
                >
                  <House className="mr-2 h-4 w-4" weight={viewMode === 'dashboard' ? 'fill' : 'regular'} />{t('Dashboard')}</Button>
                <Button
                  variant={viewMode === 'tasks' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('tasks')}
                  className="rounded-none"
                  size="sm"
                >
                  <ListChecks className="mr-2 h-4 w-4" weight={viewMode === 'tasks' ? 'fill' : 'regular'} />{t('Tasks')}</Button>
                <Button
                  variant={viewMode === 'calendario' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('calendario')}
                  className="rounded-none"
                  size="sm"
                >
                  <CalendarBlank
                    className="mr-2 h-4 w-4"
                    weight={viewMode === 'calendario' ? 'fill' : 'regular'}
                  />
                  {t('Calendar')}
                </Button>
                <Button
                  variant={viewMode === 'carico' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('carico')}
                  className="rounded-none"
                  size="sm"
                >
                  <Users
                    className="mr-2 h-4 w-4"
                    weight={viewMode === 'carico' ? 'fill' : 'regular'}
                  />
                  {t('Workload')}
                </Button>
                <Button
                  variant={viewMode === 'analytics' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('analytics')}
                  className="rounded-l-none"
                  size="sm"
                >
                  <ChartBar className="mr-2 h-4 w-4" weight={viewMode === 'analytics' ? 'fill' : 'regular'} />{t('Analytics')}</Button>
              </div>
              <AnnouncementsDialog
                announcements={announcements || []}
                employees={employees || []}
                currentUser={currentUser}
                onCreateAnnouncement={handleCreateAnnouncement}
                onEditAnnouncement={handleEditAnnouncement}
                onDeleteAnnouncement={handleDeleteAnnouncement}
                onPinAnnouncement={handlePinAnnouncement}
                onMarkAsRead={handleMarkAnnouncementAsRead}
              />
              {aiAvailable && canPerformAction(currentEmployee, 'ai_features', 'use_assistant') && (
                <Button
                  variant="outline"
                  onClick={() => setAiAssistantOpen(true)}
                  className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-300 hover:from-purple-500/20 hover:to-pink-500/20"
                >
                  <Sparkle className="mr-2 h-5 w-5 text-purple-600" weight="fill" />{t('AI Assistant')}</Button>
              )}
              {currentEmployee?.userRole === 'admin' && (
                <>
                  {/*
                    Tolto il pannello "Allegati email": la chiave che salvava
                    non era letta da nessuno e il suo Salva riscriveva lo
                    stesso valore mostrando "salvato". Un amministratore ci
                    alzava il limite convinto di aver cambiato qualcosa.
                  */}
                  <EmailDeliveryAnalytics currentUserId={currentUser?.id} employees={employees || []} />
                  <EmailTemplateCustomization
                    currentUserId={currentUser?.id}
                    currentUserName={currentUser?.name}
                  />
                  <SuperAdminSettings
                    currentUserId={currentUser?.id}
                    currentUserName={currentUser?.name}
                  />
                </>
              )}
              <Button
                onClick={() => setLaunchCelebrationOpen(true)}
                className="bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-accent-foreground"
              >
                <Rocket className="mr-2 h-5 w-5" weight="fill" />{t('Launch Info')}</Button>
              <HelpDocumentation />
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void signOut(); }}
                aria-label={t('comune.esci')}
                title={t('comune.esci')}
              >
                <SignOut className="mr-2 h-4 w-4" />
                {t('comune.esci')}
              </Button>
              <OrganizationSwitcher />
              <LanguageSwitcher compatto />
              <DepartmentColorLegend />
              {/*
                Backup, ripristino e "Clear All Data" erano visibili a
                CHIUNQUE, ruolo 'member' compreso. Non era solo una svista
                estetica: quelle azioni scrivono su app_state, dove la policy
                is_org_writer ammette anche i member, quindi un membro
                qualsiasi poteva azzerare i dati dell'intera organizzazione
                dall'interfaccia. Ora seguono il permesso di modifica
                dell'anagrafica, che di fatto significa amministratore.
              */}
              {canPerformAction(currentEmployee, 'employees', 'edit') && (
                <DataManagement
                  onExportData={handleExportData}
                  onImportData={handleImportData}
                  onClearAllData={handleClearAllData}
                />
              )}
              {canPerformAction(currentEmployee, 'employees', 'edit') && (
                <DepartmentManagement
                  employees={employees || []}
                  onEmployeeUpdate={handleEditEmployee}
                />
              )}
              {canPerformAction(currentEmployee, 'employees', 'view') && (
                <UsersManagement
                  employees={employees || []}
                  onAddEmployee={handleAddEmployee}
                  onEditEmployee={handleEditEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  taskCounts={taskCountsByEmployee}
                  canAddEmployee={canPerformAction(currentEmployee, 'employees', 'add')}
                  canEditEmployee={canPerformAction(currentEmployee, 'employees', 'edit')}
                  canDeleteEmployee={canPerformAction(currentEmployee, 'employees', 'delete')}
                  canManageRoles={canPerformAction(currentEmployee, 'employees', 'manage_roles')}
                  onResetPassword={handleResetPassword}
                />
              )}
              {viewMode === 'tasks' && (
                <>
                  {aiAvailable && canPerformAction(currentEmployee, 'ai_features', 'auto_assign') && (
                    <AIAutoAssign
                      tasks={tasks || []}
                      employees={employees || []}
                      onAssignTasks={handleAutoAssign}
                    />
                  )}
                  {canPerformAction(currentEmployee, 'tasks', 'bulk_operations') && (
                    <Button 
                      variant={bulkMode ? "secondary" : "outline"} 
                      onClick={handleToggleBulkMode}
                      className="w-full sm:w-auto"
                    >
                      <CheckSquare className="mr-2 h-5 w-5" weight={bulkMode ? "fill" : "regular"} />
                      {bulkMode ? t('Exit Bulk Mode') : t('Bulk Select')}
                    </Button>
                  )}
                  {canPerformAction(currentEmployee, 'tasks', 'create') && (
                    <Button size="lg" onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
                      <Plus className="mr-2 h-5 w-5" weight="bold" />{t('Add Task')}</Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/*
            Il flag prima dei numeri: `stats` si calcola su un array che
            all'avvio e' vuoto perche' la lettura non e' tornata, non perche'
            non ci sia lavoro. Chi ha sei attivita' leggeva "0 attivita'
            totali" e le vedeva comparire subito dopo: per un istante crede di
            aver perso tutto.
          */}
          {!taskCaricati ? (
            <ScheletroSchedeStatistiche />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-card rounded-lg p-4 border">
                <div className="text-2xl font-semibold mb-1">{stats.total}</div>
                <div className="text-sm text-muted-foreground">{t('Total Tasks')}</div>
              </div>
              <div className="bg-card rounded-lg p-4 border">
                <div className="text-2xl font-semibold mb-1 text-primary">{stats.inProgress}</div>
                <div className="text-sm text-muted-foreground">{t('In Progress')}</div>
              </div>
              <div className="bg-card rounded-lg p-4 border">
                <div className="text-2xl font-semibold mb-1 text-green-600">{stats.completed}</div>
                <div className="text-sm text-muted-foreground">{t('Completed')}</div>
              </div>
              <div className="bg-card rounded-lg p-4 border">
                <div className="text-2xl font-semibold mb-1 text-destructive">{stats.overdue}</div>
                <div className="text-sm text-muted-foreground">{t('Overdue')}</div>
              </div>
            </div>
          )}
        </div>

        {viewMode === 'dashboard' ? (
          <>
            {/*
              Il cruscotto e' tutto derivato: senza attivita' e senza anagrafica
              disegna grafici e percentuali a zero, che e' la forma piu'
              convincente di dato sbagliato. Servono entrambe le letture, non
              solo la prima: le ripartizioni per persona vengono da `employees`.
            */}
            {!taskCaricati || !employeesCaricati ? (
              <ScheletroCruscotto
                azioniRapide={
                  currentEmployee?.userRole === 'admin'
                    ? 5
                    : currentEmployee?.userRole === 'manager'
                      ? 4
                      : 3
                }
              />
            ) : (
              currentEmployee && (
              <>
                {currentEmployee.userRole === 'admin' ? (
                  <SuperAdminDashboard
                    tasks={tasks || []}
                    employees={employees || []}
                    announcements={announcements || []}
                    notifications={myNotifications}
                    onNavigateToTasks={() => setViewMode('tasks')}
                    onNavigateToUsers={() => {}}
                    onNavigateToAnnouncements={() => {}}
                    onCreateTask={() => setCreateDialogOpen(true)}
                    onCreateAnnouncement={() => {}}
                    onManageDepartments={() => {}}
                    onOpenAIAssistant={() => setAiAssistantOpen(true)}
                    onAutoAssignTasks={() => {}}
                  />
                ) : currentEmployee.userRole === 'manager' ? (
                  <DepartmentAdminDashboard
                    tasks={tasks || []}
                    employees={employees || []}
                    currentEmployee={currentEmployee}
                    onNavigateToTasks={() => setViewMode('tasks')}
                    onCreateTask={() => setCreateDialogOpen(true)}
                    onViewTasks={() => setViewMode('tasks')}
                    onCreateAnnouncement={() => {}}
                    onOpenAIAssistant={() => setAiAssistantOpen(true)}
                  />
                ) : (
                  <UserDashboard
                    tasks={tasks || []}
                    employees={employees || []}
                    currentEmployee={currentEmployee}
                    onNavigateToTasks={() => setViewMode('tasks')}
                    onViewTaskDetails={handleViewDetails}
                    onViewAllTasks={() => setViewMode('tasks')}
                  />
                )}
              </>
              )
            )}
          </>
        ) : viewMode === 'calendario' ? (
          /*
            Il calendario riceve TUTTI i task filtrati per assegnatario e
            stato, non solo la pagina visibile: la paginazione serve
            all'elenco, dove il costo e' il numero di schede renderizzate.
            Qui il punto e' vedere come il lavoro si distribuisce nel mese, e
            mostrarne solo cento darebbe un mese incompleto senza dirlo.
          */
          <VistaCalendario
            tasks={filteredAndSortedTasks}
            employees={listaEmployees}
            onViewTask={handleViewDetails}
          />
        ) : viewMode === 'carico' ? (
          /*
            Riceve TUTTI i task, non quelli filtrati: la domanda "chi e' carico"
            non ha senso su un sottoinsieme scelto da chi guarda.
          */
          <CaricoDiLavoro tasks={tasks || []} employees={listaEmployees} />
        ) : viewMode === 'analytics' ? (
          <>
            {aiAvailable && canPerformAction(currentEmployee, 'ai_features', 'get_insights') && (
              <div className="mb-6">
                <AIInsights tasks={tasks || []} employees={employees || []} />
              </div>
            )}
            <div className="bg-card rounded-xl border p-4 sm:p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">{t('Analytics Dashboard')}</h2>
                  <p className="text-muted-foreground text-sm mt-1">{t('Comprehensive performance insights')}</p>
                </div>
                <div className="flex border rounded-lg">
                  <Button
                    variant={analyticsView === 'team' ? 'default' : 'ghost'}
                    onClick={() => setAnalyticsView('team')}
                    className="rounded-r-none"
                    size="sm"
                  >
                    <Users className="mr-2 h-4 w-4" weight={analyticsView === 'team' ? 'fill' : 'regular'} />{t('Team')}</Button>
                  <Button
                    variant={analyticsView === 'departments' ? 'default' : 'ghost'}
                    onClick={() => setAnalyticsView('departments')}
                    className="rounded-l-none"
                    size="sm"
                  >
                    <Buildings className="mr-2 h-4 w-4" weight={analyticsView === 'departments' ? 'fill' : 'regular'} />{t('Departments')}</Button>
                </div>
              </div>
              {analyticsView === 'team' ? (
                <TeamAnalytics tasks={tasks || []} employees={employees || []} />
              ) : (
                <DepartmentAnalytics tasks={tasks || []} employees={employees || []} />
              )}
            </div>
          </>
        ) : (
          <div className="bg-card rounded-xl border p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex items-center gap-2 flex-1">
              <FunnelSimple className="w-4 h-4 text-muted-foreground" weight="bold" />
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t('Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Status')}</SelectItem>
                  <SelectItem value="not-started">{t('Not Started')}</SelectItem>
                  <SelectItem value="in-progress">{t('In Progress')}</SelectItem>
                  <SelectItem value="blocked">{t('Blocked')}</SelectItem>
                  <SelectItem value="completed">{t('Completed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-1">
              <FunnelSimple className="w-4 h-4 text-muted-foreground" weight="bold" />
              <Select value={filterPriority} onValueChange={(value) => setFilterPriority(value as typeof filterPriority)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t('Priority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Priority')}</SelectItem>
                  <SelectItem value="high">{t('High')}</SelectItem>
                  <SelectItem value="medium">{t('Medium')}</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-1">
              <FunnelSimple className="w-4 h-4 text-muted-foreground" weight="bold" />
              <Select value={filterDepartment} onValueChange={(value) => setFilterDepartment(value)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t('Department')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Departments')}</SelectItem>
                  {availableDepartments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-1">
              <ArrowsDownUp className="w-4 h-4 text-muted-foreground" weight="bold" />
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={t('Sort by')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">{t('Due Date')}</SelectItem>
                  <SelectItem value="priority">{t('Priority')}</SelectItem>
                  <SelectItem value="status">{t('Status')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <FiltriSalvati
              filtri={filtriSalvati || []}
              filtriAttivi={filtriAttivi}
              employees={listaEmployees}
              onApplica={applicaFiltro}
              onSalva={salvaFiltro}
              onElimina={eliminaFiltro}
              onRinomina={rinominaFiltro}
            />
            <div className="flex items-center gap-2">
              {/*
                Il pulsante resta anche a conteggio zero SE il filtro e' acceso:
                sparendo lascerebbe l'elenco vuoto e nessun modo di spegnerlo —
                cosa che succede appena si approva l'ultima attivita' rimasta.
              */}
              {(daApprovare > 0 || soloDaApprovare) && (
                <Button
                  variant={soloDaApprovare ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSoloDaApprovare((attivo) => !attivo)}
                >
                  <SealWarning className="mr-2 h-4 w-4" weight={soloDaApprovare ? 'fill' : 'regular'} />
                  {t('Awaiting my approval')}
                  <span className="ml-2 rounded-full bg-background/20 px-1.5 text-xs">{daApprovare}</span>
                </Button>
              )}
            <Button variant="outline" size="sm" onClick={() => setEsportaAperto(true)}>
              <DownloadSimple className="mr-2 h-4 w-4" weight="bold" />
              {t('Export')}
            </Button>
            </div>
          </div>

          <AnimatePresence>
            {bulkMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-4 overflow-hidden"
              >
                <div className="bg-primary/10 border-2 border-primary rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
                    <span className="text-sm font-medium">
                      {t('Selected tasks: {count}', { count: selectedTasks.size })}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSelectAll}
                        disabled={selectedTasks.size === filteredAndSortedTasks.length}
                      >
                        <CheckSquare className="mr-1 h-4 w-4" weight="bold" />{t('Select All')}</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDeselectAll}
                        disabled={selectedTasks.size === 0}
                      >
                        <Square className="mr-1 h-4 w-4" weight="bold" />{t('Deselect All')}</Button>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleBulkComplete}
                      disabled={selectedTasks.size === 0}
                      className="flex-1 sm:flex-none"
                    >
                      <CheckCircle className="mr-1 h-4 w-4" weight="bold" />{t('Complete')}</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleBulkStatusChange('in-progress')}
                      disabled={selectedTasks.size === 0}
                      className="flex-1 sm:flex-none"
                    >
                      <PlayCircle className="mr-1 h-4 w-4" weight="bold" />{t('In Progress')}</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkStatusChange('not-started')}
                      disabled={selectedTasks.size === 0}
                      className="flex-1 sm:flex-none"
                    >
                      <Circle className="mr-1 h-4 w-4" weight="bold" />{t('Not Started')}</Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkDelete}
                      disabled={selectedTasks.size === 0}
                      className="flex-1 sm:flex-none"
                    >
                      <Trash className="mr-1 h-4 w-4" weight="bold" />{t('Delete')}</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleToggleBulkMode}
                    >
                      <X className="h-4 w-4" weight="bold" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
              <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {t('All Tasks ({count})', { count: (tasks || []).length })}
              </TabsTrigger>
              {tabEmployees.map(({ employee, taskCount }) => (
                <TabsTrigger key={employee.id} value={employee.id} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {employee.name} ({taskCount})
                </TabsTrigger>
              ))}
              <TabsTrigger value="unassigned" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {t('Unassigned ({count})', { count: unassignedCount })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {/*
                Tre stati, in quest'ordine e non in un altro. Valutando la
                lunghezza prima del flag, chi ha sessanta attivita' si vedeva
                proporre di creare la prima per la frazione di secondo in cui
                l'elenco era ancora quello iniziale.
              */}
              {!taskCaricati ? (
                <ScheletroElencoTask />
              ) : (tasks || []).length === 0 ? (
                <SchermataVuota
                  icona={CheckCircle}
                  titolo="No tasks yet"
                  descrizione="Get started by creating your first task"
                  azione={{
                    etichetta: 'Create Task',
                    icona: Plus,
                    onClick: () => setCreateDialogOpen(true),
                  }}
                />
              ) : filteredAndSortedTasks.length === 0 ? (
                /*
                  Niente pulsante: qui le attivita' ci sono, e' la selezione a
                  non restituire niente. Offrire "crea attivita'" risponderebbe
                  a una domanda che nessuno ha fatto.
                */
                <SchermataVuota
                  icona={FunnelSimple}
                  titolo="No tasks found"
                  descrizione="Try adjusting your filters"
                />
              ) : (
                <div className="grid gap-4">
                  {taskDaMostrare.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      // Risolto qui una volta con la mappa, invece che dentro
                      // ogni scheda con una scansione dell'anagrafica.
                      assignee={task.assigneeId ? employeesById.get(task.assigneeId) ?? null : null}
                      employees={listaEmployees}
                      onStatusChange={handleStatusChange}
                      onAssigneeChange={handleAssigneeChange}
                      onEdit={handleEditTask}
                      onViewDetails={handleViewDetails}
                      onDelete={handleDeleteTask}
                      bulkMode={bulkMode}
                      isSelected={selectedTasks.has(task.id)}
                      onToggleSelect={handleToggleTaskSelect}
                    />
                  ))}

                  {/*
                    Il conteggio e' "visti su TOTALE filtrato": la paginazione
                    non deve far credere che i risultati siano meno di quanti
                    sono.
                  */}
                  {taskDaMostrare.length < filteredAndSortedTasks.length && (
                    <div className="flex flex-col items-center gap-2 pt-2">
                      <p className="text-sm text-muted-foreground">
                        {taskDaMostrare.length} / {filteredAndSortedTasks.length} {t('tasks shown')}
                      </p>
                      <Button variant="outline" onClick={mostraAltriTask}>
                        {t('Show more tasks')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        )}
      </div>

      <CreateTaskDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        employees={employees || []}
        tasks={tasks || []}
        onCreateTask={handleCreateTask}
      />

      {/*
        `tuttiITask` e' l'elenco completo, `tasks` quello filtrato: il dialogo
        offre entrambe le scelte, e senza il secondo elenco "tutti" avrebbe
        significato "tutti quelli che stavo gia' guardando".
      */}
      <EsportaTaskDialog
        tasks={filteredAndSortedTasks}
        tuttiITask={tasks || []}
        employees={listaEmployees}
        open={esportaAperto}
        onOpenChange={setEsportaAperto}
      />

      <EditTaskDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        employees={employees || []}
        tasks={tasks || []}
        task={editingTask}
        onEditTask={handleUpdateTask}
      />

      <TaskDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        /*
          Il task VIVO, non la copia catturata all'apertura: gli allegati
          arrivano dopo, e con la copia non sarebbero mai comparsi. Vale anche
          per un allegato appena aggiunto, che prima restava invisibile finche'
          non si richiudeva la finestra.
        */
        task={taskInVisione}
        employees={employees || []}
        currentUser={currentUser}
        currentEmployee={currentEmployee}
        onApprovaTask={handleApprovaTask}
        onRifiutaTask={handleRifiutaTask}
        onAddComment={handleAddComment}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        onAddAttachment={handleAddAttachment}
        onDeleteAttachment={handleDeleteAttachment}
      />

      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Task?')}</AlertDialogTitle>
            <AlertDialogDescription>{t('This action cannot be undone. This will permanently delete the task from your workspace.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('Delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
        Le credenziali del nuovo account vanno consegnate a mano: non c'e'
        ancora un invito via email. Restano quindi in un dialog che si chiude
        solo su azione dell'amministratore.
      */}
      <AlertDialog
        open={!!newAccountCredentials}
        onOpenChange={(open) => !open && setNewAccountCredentials(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('credenziali.titolo')}</AlertDialogTitle>
            <AlertDialogDescription>{t('credenziali.descrizione')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted rounded-md p-4 font-mono text-sm break-all">
            <div>
              <span className="text-muted-foreground">Email: </span>
              {newAccountCredentials?.email}
            </div>
            <div>
              <span className="text-muted-foreground">Password: </span>
              {newAccountCredentials?.password}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setNewAccountCredentials(null)}>
              {t('credenziali.annotate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AIAssistant
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        tasks={tasks || []}
        employees={employees || []}
        onSuggestionApply={handleAISuggestion}
      />

      <WelcomeGuide
        open={welcomeGuideOpen}
        onOpenChange={setWelcomeGuideOpen}
        onComplete={() => {
          setHasCompletedWelcome(true);
          setWelcomeGuideOpen(false);
        }}
      />

      <LaunchCelebration
        open={launchCelebrationOpen}
        onOpenChange={setLaunchCelebrationOpen}
      />

      <LaunchAnnouncement
        open={launchAnnouncementOpen}
        onOpenChange={setLaunchAnnouncementOpen}
        onGiveFeedback={() => setFeedbackDialogOpen(true)}
      />

      <FeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        currentUser={currentUser}
        onSubmitFeedback={handleSubmitFeedback}
      />

      <Dialog open={feedbackBoardOpen} onOpenChange={setFeedbackBoardOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" weight="fill" />{t('Team Feedback Board')}</DialogTitle>
            <DialogDescription>{t('Review and manage feedback from your team members')}</DialogDescription>
          </DialogHeader>
          <FeedbackBoard
            feedback={feedback || []}
            currentUserId={currentUser?.id}
            isAdmin={currentEmployee?.userRole === 'admin'}
            onUpvote={handleUpvoteFeedback}
            onStatusChange={handleChangeFeedbackStatus}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
