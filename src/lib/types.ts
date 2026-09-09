export type TaskStatus = 'not-started' | 'in-progress' | 'completed';
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

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
  comments?: TaskComment[];
  activities?: TaskActivity[];
  attachments?: TaskAttachment[];
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
  notificationFrequency: 'instant' | 'daily' | 'weekly';
  emailSchedule: {
    digestEnabled: boolean;
    digestFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    digestTime: string;
    digestDays: number[];
    includeOnlyUnread: boolean;
    groupByTask: boolean;
    maxNotificationsPerDigest: number;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  soundEnabled: boolean;
  soundVolume: number;
}

export interface SystemSettings {
  general: {
    applicationName: string;
    companyName: string;
    timezone: string;
    dateFormat: string;
    weekStartDay: 'monday' | 'sunday';
    language: string;
  };
  tasks: {
    defaultTaskDuration: number;
    allowTaskDeletion: boolean;
    requireTaskApproval: boolean;
    autoArchiveCompletedAfterDays: number;
    maxAttachmentSize: number;
    allowedFileTypes: string[];
    enableSubtasks: boolean;
    enableTaskDependencies: boolean;
  };
  notifications: {
    enableSystemNotifications: boolean;
    dailyDigestTime: string;
    reminderBeforeDueDays: number;
    escalateOverdueAfterDays: number;
    notificationRetentionDays: number;
  };
  users: {
    requireEmailVerification: boolean;
    allowSelfRegistration: boolean;
    defaultUserRole: UserRole;
    passwordExpiryDays: number;
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
  };
  departments: {
    requireDepartmentAssignment: boolean;
    allowMultipleDepartments: boolean;
    enableDepartmentBudgets: boolean;
  };
  ai: {
    enableAIFeatures: boolean;
    aiModel: 'gpt-4o' | 'gpt-4o-mini';
    maxAIRequestsPerDay: number;
    enableAutoAssignment: boolean;
    enableSmartSuggestions: boolean;
  };
  security: {
    enableTwoFactorAuth: boolean;
    requireStrongPasswords: boolean;
    enableAuditLog: boolean;
    dataRetentionDays: number;
    enableIPWhitelist: boolean;
    allowedIPs: string[];
  };
  integrations: {
    enableAPIAccess: boolean;
    webhookURL?: string;
    enableSlackIntegration: boolean;
    slackWebhookURL?: string;
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
