import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useKV } from '@/hooks/useKV';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FunnelSimple, ArrowsDownUp, CheckCircle, CheckSquare, Square, Trash, X, PlayCircle, Circle, ChartBar, ListChecks, Sparkle, Users, Buildings, House, Rocket } from '@phosphor-icons/react';
import { TaskCard } from '@/components/TaskCard';
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
import { EmailAttachmentSettings } from '@/components/EmailAttachmentSettings';
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
  updates: { title: string; description: string; priority: TaskPriority; dueDate: string },
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
  const [tasks, setTasks] = useTasks();
  const [employees, setEmployees] = useKV<Employee[]>('employees', []);
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
  const [viewMode, setViewMode] = useState<'dashboard' | 'tasks' | 'analytics'>('dashboard');
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
  }, []);

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
    commentText?: string
  ) => {
    if (!organization?.id) return;

    const destinatario = (employees || []).find((e) => e.id === notifica.userId);
    if (!destinatario?.email) return;

    const task = (tasks || []).find((t) => t.id === notifica.taskId);

    await inviaEmailNotifica({
      tenantId: organization.id,
      tipo: notifica.type,
      recipientEmail: destinatario.email,
      recipientName: destinatario.name,
      taskId: notifica.taskId,
      taskTitle: notifica.taskTitle || task?.title || '',
      taskDescription: task?.description,
      dueDate: task?.dueDate,
      priority: task?.priority,
      taskStatus: task?.status,
      commentText,
      assignedByName: notifica.actionByName || currentUser?.name || '',
      applicationName: nomeApplicazione,
    });
  };

  const addNotification = async (
    notification: TaskNotification,
    extra?: { commentText?: string }
  ) => {
    await pushNotification(notification);
    // Best effort: un'email non consegnata non deve far fallire l'azione che
    // l'ha provocata, che a questo punto e' gia' salvata.
    void inviaEmailDellaNotifica(notification, extra?.commentText);
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
      });

    }

    toast.success(t('Task created successfully!'));
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    const task = (tasks || []).find(t => t.id === taskId);
    if (!task || !currentUser) return;

    const oldStatus = task.status;
    const wasCompleted = oldStatus === 'completed';
    const isNowCompleted = status === 'completed';
    
    setTasks((currentTasks) =>
      (currentTasks || []).map(task =>
        task.id === taskId ? { ...task, status } : task
      )
    );
    
    addActivity(taskId, 'status_changed', oldStatus.replace('-', ' '), status.replace('-', ' '));
    
    if (!wasCompleted && isNowCompleted) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success(t('Task completed!'));
      
      if (task.assigneeId && task.assigneeId !== currentUser.id) {
        addNotification({
          id: `notif-${taskId}-completed-${task.assigneeId}`,
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

      // Avvisa chi ha creato il task che e' stato completato. Mancava del
      // tutto: se l'assegnatario chiudeva il proprio task, nessuno lo sapeva.
      // Il tipo Task non ha un campo createdBy, quindi l'autore si ricava
      // dall'attivita' 'created', registrata alla creazione.
      const creatorId = (task.activities || []).find(a => a.type === 'created')?.userId;
      if (creatorId && creatorId !== currentUser.id && creatorId !== task.assigneeId) {
        addNotification({
          id: `notif-${taskId}-completed-creator-${creatorId}`,
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
        'completed': 'Completed'
      };
      addNotification({
        id: `notif-${taskId}-status-${oldStatus}-${status}-${task.assigneeId}`,
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
    }
  };

  const handleAssigneeChange = (taskId: string, assigneeId: string | null) => {
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
    
    if (assigneeId) {
      const isReassign = task.assigneeId !== null;
      addNotification({
        id: `notif-${taskId}-assign-${task.assigneeId ?? 'nessuno'}-${assigneeId}`,
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
  };

  const handleEditTask = (taskId: string) => {
    const task = (tasks || []).find(t => t.id === taskId);
    if (task) {
      setEditingTask(task);
      setEditDialogOpen(true);
    }
  };

  const handleViewDetails = (taskId: string) => {
    const task = (tasks || []).find(t => t.id === taskId);
    if (task) {
      setViewingTask(task);
      setDetailsDialogOpen(true);
    }
  };

  const handleUpdateTask = (taskId: string, updates: {
    title: string;
    description: string;
    assigneeId: string | null;
    priority: TaskPriority;
    dueDate: string;
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
    if (task.dueDate !== updates.dueDate) {
      addActivity(taskId, 'due_date_changed',
        new Date(task.dueDate).toLocaleDateString(),
        new Date(updates.dueDate).toLocaleDateString()
      );
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
          id: `notif-${taskId}-${tipo}-${Date.now()}`,
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

  const handleDeleteTask = (taskId: string) => {
    setDeleteTaskId(taskId);
  };

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

  const handleToggleTaskSelect = (taskId: string) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const visibleTaskIds = filteredAndSortedTasks.map(t => t.id);
    setSelectedTasks(new Set(visibleTaskIds));
  };

  const handleDeselectAll = () => {
    setSelectedTasks(new Set());
  };

  const handleBulkComplete = () => {
    if (selectedTasks.size === 0) return;
    
    const completedCount = Array.from(selectedTasks).filter(taskId => {
      const task = (tasks || []).find(t => t.id === taskId);
      return task?.status !== 'completed';
    }).length;

    selectedTasks.forEach(taskId => {
      const task = (tasks || []).find(t => t.id === taskId);
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
    
    const changedCount = Array.from(selectedTasks).filter(taskId => {
      const task = (tasks || []).find(t => t.id === taskId);
      return task?.status !== status;
    }).length;

    selectedTasks.forEach(taskId => {
      const task = (tasks || []).find(t => t.id === taskId);
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
      toast.error(e instanceof Error ? e.message : 'Creazione utente fallita');
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
        toast.error(e instanceof Error ? e.message : 'Aggiornamento non salvato');
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
      toast.error(e instanceof Error ? e.message : 'Rimozione fallita');
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
      toast.error(e instanceof Error ? e.message : 'Reimpostazione fallita');
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

    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === filterPriority);
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(task => {
        if (!task.assigneeId) return false;
        const assignee = (employees || []).find(e => e.id === task.assigneeId);
        return assignee?.department === filterDepartment;
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority': {
          const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        case 'status': {
          const statusOrder: Record<TaskStatus, number> = { 'not-started': 0, 'in-progress': 1, completed: 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [tasks, activeTab, filterStatus, filterPriority, filterDepartment, sortBy, employees]);

  const stats = useMemo(() => {
    const taskList = tasks || [];
    const total = taskList.length;
    const completed = taskList.filter(t => t.status === 'completed').length;
    const inProgress = taskList.filter(t => t.status === 'in-progress').length;
    const overdue = taskList.filter(t => 
      new Date(t.dueDate) < new Date() && t.status !== 'completed'
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

  const unassignedCount = (tasks || []).filter(t => !t.assigneeId).length;

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
                  <EmailAttachmentSettings />
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
                      {bulkMode ? 'Exit Bulk Mode' : 'Bulk Select'}
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
        </div>

        {viewMode === 'dashboard' ? (
          <>
            {currentEmployee && (
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
            )}
          </>
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
                      {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
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
                All Tasks ({(tasks || []).length})
              </TabsTrigger>
              {tabEmployees.map(({ employee, taskCount }) => (
                <TabsTrigger key={employee.id} value={employee.id} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {employee.name} ({taskCount})
                </TabsTrigger>
              ))}
              <TabsTrigger value="unassigned" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Unassigned ({unassignedCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {filteredAndSortedTasks.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" weight="light" />
                  <h3 className="text-lg font-medium mb-2">{t('No tasks found')}</h3>
                  <p className="text-muted-foreground mb-4">
                    {(tasks || []).length === 0
                      ? 'Get started by creating your first task'
                      : 'Try adjusting your filters'}
                  </p>
                  {(tasks || []).length === 0 && (
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />{t('Create Task')}</Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredAndSortedTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      employees={employees || []}
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
        task={viewingTask}
        employees={employees || []}
        currentUser={currentUser}
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
