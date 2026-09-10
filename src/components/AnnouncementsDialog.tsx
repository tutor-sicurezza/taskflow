import { useState, useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Megaphone, Plus, Trash, PushPin, Check, Info, Warning, SealWarning, X, Calendar, PencilSimple } from '@phosphor-icons/react';
import { Announcement, AnnouncementPriority, Employee } from '@/lib/types';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Sanitizer } from '@/lib/sanitization';

interface AnnouncementsDialogProps {
  announcements: Announcement[];
  employees: Employee[];
  currentUser: { id: string; name: string; avatar: string } | null;
  onCreateAnnouncement: (announcement: Omit<Announcement, 'id' | 'createdAt' | 'readBy'>) => void;
  onEditAnnouncement?: (id: string, updates: Omit<Announcement, 'id' | 'createdAt' | 'readBy' | 'createdBy' | 'createdByName' | 'createdByAvatar'>) => void;
  onDeleteAnnouncement: (id: string) => void;
  onPinAnnouncement: (id: string) => void;
  onMarkAsRead: (id: string) => void;
}

export function AnnouncementsDialog({
  announcements,
  employees,
  currentUser,
  onCreateAnnouncement,
  onEditAnnouncement,
  onDeleteAnnouncement,
  onPinAnnouncement,
  onMarkAsRead,
}: AnnouncementsDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'view' | 'create'>('view');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('info');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');

  const availableDepartments = useMemo(() => {
    const departments = new Set<string>();
    employees.forEach(emp => {
      if (emp.departments) {
        emp.departments.forEach(dept => departments.add(dept));
      } else if (emp.department) {
        departments.add(emp.department);
      }
    });
    return Array.from(departments).sort();
  }, [employees]);

  const userDepartments = useMemo(() => {
    if (!currentUser) return [];
    const user = employees.find(e => e.id === currentUser.id);
    return user?.departments || (user?.department ? [user.department] : []);
  }, [currentUser, employees]);

  const filteredAnnouncements = useMemo(() => {
    return announcements
      .filter(ann => {
        if (isPast(new Date(ann.expiresAt || Date.now() + 1000000))) {
          return false;
        }
        if (ann.departments.includes('all')) return true;
        return ann.departments.some(dept => userDepartments.includes(dept));
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [announcements, userDepartments]);

  const unreadCount = useMemo(() => {
    if (!currentUser) return 0;
    return filteredAnnouncements.filter(ann => !ann.readBy.includes(currentUser.id)).length;
  }, [filteredAnnouncements, currentUser]);

  const handleToggleDepartment = (dept: string) => {
    setSelectedDepartments(prev =>
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  const handleSelectAllDepartments = () => {
    setSelectedDepartments(['all']);
  };

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error(t('Please enter a title'));
      return;
    }
    if (!message.trim()) {
      toast.error(t('Please enter a message'));
      return;
    }
    if (selectedDepartments.length === 0) {
      toast.error(t('Please select at least one department'));
      return;
    }
    if (hasExpiry && !expiryDate) {
      toast.error(t('Please set an expiry date'));
      return;
    }
    if (!currentUser) {
      toast.error(t('User not loaded'));
      return;
    }

    const sanitizedTitle = Sanitizer.text(title.trim());
    const sanitizedMessage = Sanitizer.announcementContent(message.trim());
    
    if (!sanitizedTitle || !sanitizedMessage) {
      toast.error(t('Invalid title or message'));
      return;
    }

    if (editingAnnouncementId && onEditAnnouncement) {
      onEditAnnouncement(editingAnnouncementId, {
        title: sanitizedTitle,
        message: sanitizedMessage,
        departments: selectedDepartments,
        priority,
        expiresAt: hasExpiry ? expiryDate : undefined,
        isPinned: false,
      });
      toast.success(t('Announcement updated!'));
    } else {
      onCreateAnnouncement({
        title: sanitizedTitle,
        message: sanitizedMessage,
        departments: selectedDepartments,
        priority,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        createdByAvatar: currentUser.avatar,
        expiresAt: hasExpiry ? expiryDate : undefined,
        isPinned: false,
      });
      toast.success(t('Announcement posted!'));
    }

    resetForm();
    setActiveTab('view');
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setPriority('info');
    setSelectedDepartments([]);
    setHasExpiry(false);
    setExpiryDate('');
    setEditingAnnouncementId(null);
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setTitle(announcement.title);
    setMessage(announcement.message);
    setPriority(announcement.priority);
    setSelectedDepartments(announcement.departments);
    setHasExpiry(!!announcement.expiresAt);
    setExpiryDate(announcement.expiresAt || '');
    setEditingAnnouncementId(announcement.id);
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    resetForm();
    setActiveTab('view');
  };

  const handleMarkAsRead = (id: string) => {
    onMarkAsRead(id);
  };

  const getPriorityIcon = (priority: AnnouncementPriority) => {
    switch (priority) {
      case 'info':
        return <Info weight="fill" className="h-5 w-5" />;
      case 'important':
        return <Warning weight="fill" className="h-5 w-5" />;
      case 'urgent':
        return <SealWarning weight="fill" className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: AnnouncementPriority) => {
    switch (priority) {
      case 'info':
        return 'text-blue-600 bg-blue-100';
      case 'important':
        return 'text-amber-600 bg-amber-100';
      case 'urgent':
        return 'text-red-600 bg-red-100';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative">
          <Megaphone className="mr-2 h-5 w-5" weight="bold" />
          {t('Announcements')}
          {unreadCount > 0 && (
            <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-destructive text-destructive-foreground">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-6 w-6" weight="bold" />{t('Department Announcements')}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'view' | 'create')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="view">
              View Announcements
              {unreadCount > 0 && (
                <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="mr-1 h-4 w-4" weight="bold" />{t('Create New')}</TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {filteredAnnouncements.length === 0 ? (
                <div className="text-center py-12">
                  <Megaphone className="w-16 h-16 mx-auto mb-4 text-muted-foreground" weight="light" />
                  <h3 className="text-lg font-medium mb-2">{t('No announcements')}</h3>
                  <p className="text-muted-foreground mb-4">{t('There are no active announcements for your departments')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredAnnouncements.map((announcement) => {
                      const isUnread = currentUser && !announcement.readBy.includes(currentUser.id);
                      const isCreator = currentUser && announcement.createdBy === currentUser.id;

                      return (
                        <motion.div
                          key={announcement.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                        >
                          <Card className={`p-4 ${isUnread ? 'border-primary border-2 bg-primary/5' : ''}`}>
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${getPriorityColor(announcement.priority)}`}>
                                {getPriorityIcon(announcement.priority)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold text-lg">{announcement.title}</h3>
                                    {announcement.isPinned && (
                                      <Badge variant="outline" className="text-xs">
                                        <PushPin className="mr-1 h-3 w-3" weight="fill" />{t('Pinned')}</Badge>
                                    )}
                                    {isUnread && (
                                      <Badge className="text-xs bg-primary">New</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {isUnread && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleMarkAsRead(announcement.id)}
                                        title={t('Mark as read')}
                                      >
                                        <Check className="h-4 w-4" weight="bold" />
                                      </Button>
                                    )}
                                    {isCreator && (
                                      <>
                                        {onEditAnnouncement && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleEditAnnouncement(announcement)}
                                            title={t('Edit announcement')}
                                          >
                                            <PencilSimple className="h-4 w-4" weight="bold" />
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => onPinAnnouncement(announcement.id)}
                                          title={announcement.isPinned ? 'Unpin' : 'Pin'}
                                        >
                                          <PushPin 
                                            className="h-4 w-4" 
                                            weight={announcement.isPinned ? 'fill' : 'regular'} 
                                          />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => onDeleteAnnouncement(announcement.id)}
                                          className="text-destructive hover:text-destructive"
                                          title={t('Delete')}
                                        >
                                          <Trash className="h-4 w-4" weight="bold" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-foreground whitespace-pre-wrap mb-3">
                                  {announcement.message}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                                  <span className="font-medium">{announcement.createdByName}</span>
                                  <span>•</span>
                                  <span>{formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}</span>
                                  <span>•</span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {announcement.departments.includes('all') ? (
                                      <Badge variant="secondary" className="text-xs">{t('All Departments')}</Badge>
                                    ) : (
                                      announcement.departments.map(dept => (
                                        <Badge key={dept} variant="secondary" className="text-xs">
                                          {dept}
                                        </Badge>
                                      ))
                                    )}
                                  </div>
                                  {announcement.expiresAt && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Expires {format(new Date(announcement.expiresAt), 'MMM d, yyyy')}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="create" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {editingAnnouncementId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PencilSimple className="h-4 w-4 text-blue-600" weight="bold" />
                      <span className="text-sm font-medium text-blue-900">{t('Editing announcement')}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4" weight="bold" />{t('Cancel')}</Button>
                  </div>
                )}
                <div>
                  <Label htmlFor="announcement-title">{t('Title')}</Label>
                  <Input
                    id="announcement-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('Enter announcement title')}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="announcement-message">{t('Message')}</Label>
                  <Textarea
                    id="announcement-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('Enter your announcement message...')}
                    className="mt-1.5 min-h-[120px]"
                  />
                </div>

                <div>
                  <Label htmlFor="announcement-priority">{t('Priority')}</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as AnnouncementPriority)}>
                    <SelectTrigger id="announcement-priority" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">
                        <div className="flex items-center gap-2">
                          <Info weight="fill" className="h-4 w-4 text-blue-600" />{t('Info')}</div>
                      </SelectItem>
                      <SelectItem value="important">
                        <div className="flex items-center gap-2">
                          <Warning weight="fill" className="h-4 w-4 text-amber-600" />{t('Important')}</div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <SealWarning weight="fill" className="h-4 w-4 text-red-600" />{t('Urgent')}</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('Target Departments')}</Label>
                  <div className="mt-2 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllDepartments}
                      className="w-full"
                    >{t('Select All Departments')}</Button>
                    {selectedDepartments.includes('all') && (
                      <Badge className="w-full justify-center">{t('All Departments Selected')}</Badge>
                    )}
                    {!selectedDepartments.includes('all') && (
                      <div className="grid grid-cols-2 gap-2">
                        {availableDepartments.map(dept => (
                          <div key={dept} className="flex items-center space-x-2">
                            <Checkbox
                              id={`dept-${dept}`}
                              checked={selectedDepartments.includes(dept)}
                              onCheckedChange={() => handleToggleDepartment(dept)}
                            />
                            <Label
                              htmlFor={`dept-${dept}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {dept}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-expiry"
                    checked={hasExpiry}
                    onCheckedChange={(checked) => setHasExpiry(checked as boolean)}
                  />
                  <Label htmlFor="has-expiry" className="font-normal cursor-pointer">{t('Set expiration date')}</Label>
                </div>

                {hasExpiry && (
                  <div>
                    <Label htmlFor="expiry-date">{t('Expiration Date')}</Label>
                    <Input
                      id="expiry-date"
                      type="datetime-local"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="mt-1.5"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreate} className="flex-1">
                    {editingAnnouncementId ? (
                      <>
                        <PencilSimple className="mr-2 h-4 w-4" weight="bold" />{t('Update Announcement')}</>
                    ) : (
                      <>
                        <Megaphone className="mr-2 h-4 w-4" weight="bold" />{t('Post Announcement')}</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTitle('');
                      setMessage('');
                      setPriority('info');
                      setSelectedDepartments([]);
                      setHasExpiry(false);
                      setExpiryDate('');
                    }}
                  >
                    <X className="mr-2 h-4 w-4" weight="bold" />{t('Clear')}</Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
