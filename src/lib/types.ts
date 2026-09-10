/**
 * `blocked` non e' uno stato terminale: un task bloccato puo' essere anche in
 * ritardo, e i conteggi devono continuare a dirlo. Serve a distinguere "fermo
 * perche' nessuno ci lavora" da "fermo perche' non si puo' procedere", che a
 * chi guarda un elenco sembrano la stessa cosa.
 */
export type TaskStatus = 'not-started' | 'in-progress' | 'blocked' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ActivityType = 'created' | 'status_changed' | 'priority_changed' | 'assignee_changed' | 'due_date_changed' | 'title_changed' | 'description_changed' | 'comment_added' | 'attachment_added' | 'attachment_removed';

export type UserRole = 'admin' | 'manager' | 'member' | 'viewer';

export interface Permission {
  tasks: {
    create: boolean;
    edit_own: boolean;
    edit_any: boolean;
    delete_own: boolean;
    delete_any: boolean;
    view_own: boolean;
    view_team: boolean;
    view_all: boolean;
    assign: boolean;
    change_status: boolean;
    comment: boolean;
    attach_files: boolean;
    bulk_operations: boolean;
  };
  employees: {
    view: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
    manage_roles: boolean;
  };
  announcements: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  analytics: {
    view_own: boolean;
    view_team: boolean;
    view_all: boolean;
  };
  ai_features: {
    use_assistant: boolean;
    auto_assign: boolean;
    get_insights: boolean;
    estimate_duration: boolean;
  };
}

export interface RoleDefinition {
  role: UserRole;
  name: string;
  description: string;
  permissions: Permission;
}

export interface Employee {
  id: string;
  name: string;
  avatar: string;
  role: string;
  userRole?: UserRole;
  email?: string;
  department?: string;
  departments?: string[];
  phone?: string;
  status: 'active' | 'inactive';
  joinedDate: string;
  location?: string;
  bio?: string;
  skills?: string[];
  teamLead?: boolean;
  customPermissions?: Partial<Permission>;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: ActivityType;
  oldValue?: string;
  newValue?: string;
  details?: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedByAvatar: string;
  uploadedAt: string;
}

/**
 * Come si ripete un task.
 *
 * Un oggetto e non colonne separate perche' le regole hanno forme diverse — a
 * intervallo, mensile lo stesso giorno, settimanale in certi giorni — e
 * appiattirle darebbe una colonna vuota per ogni forma non in uso.
 */
export interface RegolaRicorrenza {
  tipo: 'giorni' | 'settimane' | 'mesi';
  /** Ogni quanti giorni/settimane/mesi. */
  ogni: number;
  /** Solo per `settimane`: 0 = domenica. Vuoto significa "lo stesso giorno". */
  giorniSettimana?: number[];
  /** Data oltre la quale la serie non si rinnova piu'. */
  fine?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  /**
   * Facoltativa. Era obbligatoria, e chi non aveva una scadenza vera se ne
   * inventava una: quella data finta faceva poi scattare promemoria e conteggi
   * di ritardo su lavori che in ritardo non erano.
   */
  dueDate?: string | null;
  createdAt: string;
  /** Il reparto del LAVORO, non di chi lo esegue. */
  department?: string | null;
  labels?: string[];
  estimateMinutes?: number | null;
  spentMinutes?: number | null;
  /** Chi vuole essere avvisato pur non essendo l'assegnatario. */
  watchers?: string[];
  recurrence?: RegolaRicorrenza | null;
  /** La prima occorrenza della serie, per le occorrenze successive. */
  recurrenceParent?: string | null;
  /** Archiviato non e' cancellato: esce dalle viste correnti, resta nei conti. */
  archivedAt?: string | null;
  requiresApproval?: boolean;
  approvedBy?: string | null;
  approvedAt?: string | null;
  comments?: TaskComment[];
  activities?: TaskActivity[];
  attachments?: TaskAttachment[];
  /**
   * Quanti allegati ha il task, senza averli letti.
   *
   * La lista non scarica `attachments` (sono file in base64), quindi il numero
   * non si puo' ricavare contando: lo calcola Postgres a ogni scrittura.
   */
  attachmentsCount?: number;
}

export type AnnouncementPriority = 'info' | 'important' | 'urgent';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  departments: string[];
  priority: AnnouncementPriority;
  createdBy: string;
  createdByName: string;
  createdByAvatar: string;
  createdAt: string;
  expiresAt?: string;
  isPinned: boolean;
  readBy: string[];
}

export type NotificationType = 
  | 'task_assigned'
  | 'task_reassigned'
  | 'task_updated'
  | 'task_comment'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_completed'
  | 'task_status_changed'
  | 'task_priority_changed'
  | 'mention';

export interface TaskNotification {
  id: string;
  userId: string;
  taskId: string;
  taskTitle: string;
  type: NotificationType;
  message: string;
  actionBy?: string;
  actionByName?: string;
  actionByAvatar?: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

export interface NotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  enabledNotifications: {
    task_assigned: boolean;
    task_reassigned: boolean;
    task_updated: boolean;
    task_comment: boolean;
    task_due_soon: boolean;
    task_overdue: boolean;
    task_completed: boolean;
    task_status_changed: boolean;
    task_priority_changed: boolean;
    mention: boolean;
  };
  /**
   * Riepilogo giornaliero al posto delle email evento per evento.
   *
   * Tre campi, e non i sette di prima. Il blocco `emailSchedule`
   * (`digestFrequency`, `digestDays`, `includeOnlyUnread`, `groupByTask`,
   * `maxNotificationsPerDigest`) e' stato tolto perche' nessun invio lo
   * consultava: l'utente sceglieva "digest giornaliero" e continuava a ricevere
   * un'email per ogni evento. Ora il lavoro che li implementa esiste
   * (`api/cron/digest.ts`), ma implementa questi tre e basta — rimettere un
   * campo che non pilota nulla sarebbe di nuovo lo stesso errore.
   *
   * `digestEnabled` falso e' il predefinito e significa "email immediate",
   * cioe' il comportamento di oggi. Lo legge il server in due punti:
   * `api/_lib/digest.ts` per scegliere chi servire, e
   * `api/_lib/preferenzeNotifiche.ts` per smettere di spedire evento per
   * evento a chi ha acceso il riepilogo — senza quel secondo filtro il
   * riepilogo sarebbe posta in PIU', non in meno.
   *
   * Le notifiche in applicazione restano immediate in ogni caso: il riepilogo
   * riguarda solo la posta.
   */
  digestEnabled: boolean;
  /** L'ora locale del riepilogo, "HH:MM". Solo ore intere: il lavoro pianificato si sveglia una volta all'ora. */
  digestTime: string;
  /**
   * Il fuso in cui leggere `digestTime`, come identificativo IANA
   * ("Europe/Rome"). Non e' un selettore da compilare: il browser lo sa gia' e
   * l'interfaccia lo salva da solo, mostrando quale ha rilevato. Serve perche'
   * il lavoro pianificato gira in UTC mentre l'ora scelta e' quella di casa di
   * chi la sceglie — e un nome IANA, a differenza di uno scostamento fisso,
   * segue l'ora legale senza che nessuno debba correggere niente due volte
   * l'anno.
   */
  digestTimezone: string;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  soundEnabled: boolean;
  soundVolume: number;
}

/**
 * Impostazioni di sistema: un solo campo, e la brevita' e' voluta.
 *
 * L'interfaccia ne dichiarava quarantadue, ma un controllo campo per campo ha
 * trovato un solo consumatore in tutto il progetto: `applicationName`, letto da
 * `src/App.tsx` per l'intestazione e da `api/_lib/composizione.ts` per
 * intestare e firmare le email. Gli altri quarantuno venivano scritti su
 * `app_state` e mai riletti — compresi `enableIPWhitelist`, `allowedIPs`,
 * `enableTwoFactorAuth`, `requireStrongPasswords`, `maxLoginAttempts` e
 * `sessionTimeoutMinutes`, che promettevano controlli di sicurezza inesistenti.
 * Un tipo che dichiara un campo di sicurezza fa credere a chi legge il codice
 * che qualcosa lo applichi: sono stati tolti finche' non sara' vero.
 *
 * I record gia' salvati contengono ancora le chiavi vecchie: `conImpostazioni-
 * Predefinite` in `SuperAdminSettings.tsx` copia solo i campi previsti qui,
 * quindi quei dati non causano errori e smettono di essere riscritti.
 */
export interface SystemSettings {
  general: {
    applicationName: string;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  category: 'user' | 'task' | 'system' | 'security' | 'settings';
  details: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  type: NotificationType;
  subject: string;
  htmlContent: string;
  textContent: string;
  isActive: boolean;
  lastModifiedAt: string;
  lastModifiedBy: string;
  variables: string[];
}

export interface EmailTemplateVariable {
  name: string;
  description: string;
  example: string;
}

export interface EmailDeliveryLog {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  emailType: NotificationType | 'digest';
  subject: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'pending' | 'bounced';
  error?: string;
  openedAt?: string;
  openCount: number;
  clicks: EmailClickEvent[];
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  userAgent?: string;
  ipAddress?: string;
}

export interface EmailClickEvent {
  id: string;
  url: string;
  clickedAt: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  userAgent?: string;
}

export interface EmailAnalytics {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  bounceRate: number;
  byType: {
    [key: string]: {
      sent: number;
      opened: number;
      clicked: number;
      openRate: number;
      clickRate: number;
    };
  };
  byDevice: {
    desktop: number;
    mobile: number;
    tablet: number;
    unknown: number;
  };
  topLinks: Array<{
    url: string;
    clicks: number;
    uniqueClicks: number;
  }>;
  recentDeliveries: EmailDeliveryLog[];
}

export interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  category: 'feature' | 'bug' | 'improvement' | 'praise' | 'other';
  rating: number;
  title: string;
  description: string;
  createdAt: string;
  status: 'new' | 'reviewing' | 'planned' | 'completed' | 'declined';
  upvotes: string[];
}
