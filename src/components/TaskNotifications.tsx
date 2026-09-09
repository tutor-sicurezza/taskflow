import { useState, useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, Check, CheckCircle, Trash, WarningCircle, ClockCountdown, User, ArrowsClockwise, FlagBanner, ChatCircle } from '@phosphor-icons/react';
import { TaskNotification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskNotificationsProps {
  notifications: TaskNotification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (notificationId: string) => void;
  onDeleteAll: () => void;
  onNotificationClick: (notification: TaskNotification) => void;
}

export function TaskNotifications({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onDeleteAll,
  onNotificationClick,
}: TaskNotificationsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    const filtered = activeTab === 'unread' 
      ? notifications.filter(n => !n.read)
      : notifications;
    
    return [...filtered].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications, activeTab]);

  const getNotificationIcon = (type: TaskNotification['type']) => {
    switch (type) {
      case 'task_assigned':
      case 'task_reassigned':
        return <User className="w-5 h-5 text-blue-500" weight="fill" />;
      case 'task_due_soon':
        return <ClockCountdown className="w-5 h-5 text-amber-500" weight="fill" />;
      case 'task_overdue':
        return <WarningCircle className="w-5 h-5 text-destructive" weight="fill" />;
      case 'task_completed':
        return <CheckCircle className="w-5 h-5 text-green-500" weight="fill" />;
      case 'task_status_changed':
        return <ArrowsClockwise className="w-5 h-5 text-purple-500" weight="fill" />;
      case 'task_priority_changed':
        return <FlagBanner className="w-5 h-5 text-orange-500" weight="fill" />;
      case 'task_comment':
      case 'mention':
        return <ChatCircle className="w-5 h-5 text-teal-500" weight="fill" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" weight="fill" />;
    }
  };

  const handleNotificationClick = (notification: TaskNotification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    onNotificationClick(notification);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" weight={unreadCount > 0 ? 'fill' : 'regular'} />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1"
              >
                <Badge 
                  variant="destructive" 
                  className="h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{t('Notifications')}</span>
            {notifications.length > 0 && (
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMarkAllAsRead}
                  >
                    <Check className="mr-1 h-4 w-4" />{t('Mark all read')}</Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDeleteAll}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash className="mr-1 h-4 w-4" />{t('Clear all')}</Button>
              </div>
            )}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">
              All ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread ({unreadCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <ScrollArea className="h-[calc(100vh-220px)]">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-16">
                  <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground" weight="light" />
                  <h3 className="text-lg font-medium mb-2">{t('No notifications')}</h3>
                  <p className="text-muted-foreground text-sm">
                    {activeTab === 'unread' 
                      ? "You're all caught up!" 
                      : "We'll notify you when something important happens"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className={`
                        group relative rounded-lg border p-4 cursor-pointer transition-all
                        ${!notification.read ? 'bg-accent/50 border-accent' : 'bg-card hover:bg-muted/50'}
                      `}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-sm font-medium line-clamp-1">
                              {notification.taskTitle}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {notification.actionByAvatar && (
                                <Avatar className="w-5 h-5">
                                  <AvatarImage src={notification.actionByAvatar} />
                                  <AvatarFallback className="text-xs">
                                    {notification.actionByName?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkAsRead(notification.id);
                                  }}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(notification.id);
                                }}
                              >
                                <Trash className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
