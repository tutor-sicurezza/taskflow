import { NotificationType } from './types';

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: any;
}

export class DesktopNotificationManager {
  private static instance: DesktopNotificationManager;
  private permission: NotificationPermission = 'default';
  private notificationQueue: DesktopNotificationOptions[] = [];
  private isProcessingQueue = false;

  private constructor() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  static getInstance(): DesktopNotificationManager {
    if (!DesktopNotificationManager.instance) {
      DesktopNotificationManager.instance = new DesktopNotificationManager();
    }
    return DesktopNotificationManager.instance;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  getPermission(): NotificationPermission {
    return this.permission;
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }

  async showNotification(options: DesktopNotificationOptions): Promise<Notification | null> {
    if (!this.isSupported()) {
      console.warn('Desktop notifications not supported');
      return null;
    }

    if (this.permission !== 'granted') {
      this.notificationQueue.push(options);
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        badge: options.badge || '/icon-96.png',
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        data: options.data,
      });

      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error showing desktop notification:', error);
      return null;
    }
  }

  async processQueuedNotifications(): Promise<void> {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.notificationQueue.length > 0) {
      const options = this.notificationQueue.shift();
      if (options) {
        await this.showNotification(options);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.isProcessingQueue = false;
  }

  getNotificationConfig(type: NotificationType): { icon: string; requireInteraction: boolean } {
    const configs: Record<NotificationType, { icon: string; requireInteraction: boolean }> = {
      task_assigned: { icon: '📋', requireInteraction: false },
      task_reassigned: { icon: '🔄', requireInteraction: false },
      task_updated: { icon: '✏️', requireInteraction: false },
      task_comment: { icon: '💬', requireInteraction: false },
      task_due_soon: { icon: '⏰', requireInteraction: true },
      task_overdue: { icon: '🚨', requireInteraction: true },
      task_completed: { icon: '✅', requireInteraction: false },
      task_status_changed: { icon: '🔄', requireInteraction: false },
      task_priority_changed: { icon: '⚡', requireInteraction: false },
      mention: { icon: '👋', requireInteraction: false },
    };

    return configs[type] || { icon: '🔔', requireInteraction: false };
  }

  async showTaskNotification(
    type: NotificationType,
    taskTitle: string,
    message: string,
    taskId?: string
  ): Promise<Notification | null> {
    const config = this.getNotificationConfig(type);
    
    return this.showNotification({
      title: `${config.icon} ${this.getNotificationTitle(type)}`,
      body: `${taskTitle}\n${message}`,
      tag: taskId ? `task-${taskId}` : undefined,
      requireInteraction: config.requireInteraction,
      data: taskId ? { taskId, url: `#task-${taskId}` } : undefined,
    });
  }

  private getNotificationTitle(type: NotificationType): string {
    const titles: Record<NotificationType, string> = {
      task_assigned: 'New Task Assigned',
      task_reassigned: 'Task Reassigned',
      task_updated: 'Task Updated',
      task_comment: 'New Comment',
      task_due_soon: 'Task Due Soon',
      task_overdue: 'Task Overdue!',
      task_completed: 'Task Completed',
      task_status_changed: 'Status Changed',
      task_priority_changed: 'Priority Changed',
      mention: 'You were mentioned',
    };

    return titles[type] || 'Notification';
  }

  clearNotificationsByTag(tag: string): void {
    if ('Notification' in window && 'getNotifications' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker?.ready.then((registration) => {
        registration.getNotifications({ tag }).then((notifications) => {
          notifications.forEach((notification) => notification.close());
        });
      });
    }
  }
}

export const desktopNotificationManager = DesktopNotificationManager.getInstance();
