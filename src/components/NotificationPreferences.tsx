import { useState, useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useKV } from '@/hooks/useKV';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Gear, EnvelopeSimple, Bell, ClockCountdown, User, ArrowsClockwise, FlagBanner, ChatCircle, CheckCircle, WarningCircle, Moon, SpeakerHigh, SpeakerX } from '@phosphor-icons/react';
import { NotificationPreferences as NotificationPreferencesType, NotificationType } from '@/lib/types';
import { playNotificationSound, getSoundDescription } from '@/lib/notificationSounds';
import { toast } from 'sonner';

const defaultPreferences: Omit<NotificationPreferencesType, 'userId'> = {
  emailNotifications: true,
  notificationFrequency: 'instant',
  enabledNotifications: {
    task_assigned: true,
    task_reassigned: true,
    task_updated: true,
    task_comment: true,
    task_due_soon: true,
    task_overdue: true,
    task_completed: true,
    task_status_changed: true,
    task_priority_changed: true,
    mention: true,
  },
  emailSchedule: {
    digestEnabled: false,
    digestFrequency: 'daily',
    digestTime: '09:00',
    digestDays: [1, 2, 3, 4, 5],
    includeOnlyUnread: true,
    groupByTask: true,
    maxNotificationsPerDigest: 50,
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
  soundEnabled: true,
  soundVolume: 0.3,
};

const quietHoursPresets = [
  { label: 'Early Bird (9 PM - 6 AM)', start: '21:00', end: '06:00' },
  { label: 'Working Hours (6 PM - 9 AM)', start: '18:00', end: '09:00' },
  { label: 'Night Owl (12 AM - 10 AM)', start: '00:00', end: '10:00' },
  { label: 'Sleep Time (10 PM - 7 AM)', start: '22:00', end: '07:00' },
];

function isInQuietHours(startTime: string, endTime: string): boolean {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  
  if (start < end) {
    return currentTime >= start && currentTime < end;
  }
  return currentTime >= start || currentTime < end;
}

export function NotificationPreferences({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useKV<NotificationPreferencesType>(
    `notification-preferences-${userId}`,
    { ...defaultPreferences, userId }
  );

  const currentPreferences = useMemo(() => {
    return {
      ...defaultPreferences,
      ...preferences,
      userId,
      enabledNotifications: {
        ...defaultPreferences.enabledNotifications,
        ...(preferences?.enabledNotifications || {}),
      },
      emailSchedule: {
        ...defaultPreferences.emailSchedule,
        ...(preferences?.emailSchedule || {}),
      },
      quietHours: {
        ...defaultPreferences.quietHours,
        ...(preferences?.quietHours || {}),
      },
    };
  }, [preferences, userId]);

  const inQuietHours = useMemo(() => {
    return isInQuietHours(
      currentPreferences.quietHours.startTime,
      currentPreferences.quietHours.endTime
    );
  }, [currentPreferences.quietHours]);

  const handleToggleEmailNotifications = (checked: boolean) => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      emailNotifications: checked,
    }));
    toast.success(checked ? 'Email notifications enabled' : 'Email notifications disabled');
  };

  const handleToggleNotificationType = (type: keyof NotificationPreferencesType['enabledNotifications'], checked: boolean) => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      enabledNotifications: {
        ...(current?.enabledNotifications || defaultPreferences.enabledNotifications),
        [type]: checked,
      },
    }));
  };

  const handleChangeFrequency = (frequency: NotificationPreferencesType['notificationFrequency']) => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      notificationFrequency: frequency,
    }));
    toast.success(`Notification frequency set to ${frequency}`);
  };

  const handleToggleQuietHours = (checked: boolean) => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      quietHours: {
        ...(current?.quietHours || defaultPreferences.quietHours),
        enabled: checked,
      },
    }));
    toast.success(checked ? 'Quiet hours enabled - notifications paused during sleep times' : 'Quiet hours disabled');
  };

  const handleChangeQuietHours = (field: 'startTime' | 'endTime', value: string) => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      quietHours: {
        ...(current?.quietHours || defaultPreferences.quietHours),
        [field]: value,
      },
    }));
  };

  const handleApplyPreset = (preset: typeof quietHoursPresets[0]) => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      quietHours: {
        enabled: true,
        startTime: preset.start,
        endTime: preset.end,
      },
    }));
    toast.success(`Quiet hours set: ${preset.label}`);
  };

  const handleEnableAll = () => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      enabledNotifications: {
        task_assigned: true,
        task_reassigned: true,
        task_updated: true,
        task_comment: true,
        task_due_soon: true,
        task_overdue: true,
        task_completed: true,
        task_status_changed: true,
        task_priority_changed: true,
        mention: true,
      },
    }));
    toast.success(t('All notification types enabled'));
  };

  const handleDisableAll = () => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      enabledNotifications: {
        task_assigned: false,
        task_reassigned: false,
        task_updated: false,
        task_comment: false,
        task_due_soon: false,
        task_overdue: false,
        task_completed: false,
        task_status_changed: false,
        task_priority_changed: false,
        mention: false,
      },
    }));
    toast.success(t('All notification types disabled'));
  };

  const handleToggleSound = (checked: boolean) => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      soundEnabled: checked,
    }));
    toast.success(checked ? 'Notification sounds enabled' : 'Notification sounds muted');
  };

  const handleChangeVolume = (value: number[]) => {
    setPreferences((current) => ({
      ...(current || { ...defaultPreferences, userId }),
      soundVolume: value[0],
    }));
  };

  const handleTestSound = async (notificationType: NotificationType) => {
    await playNotificationSound(notificationType, currentPreferences.soundVolume);
    toast.success(`Playing ${getSoundDescription(notificationType)}`);
  };

  const notificationTypes = [
    {
      key: 'task_assigned' as const,
      label: 'Task Assigned',
      description: 'When a task is assigned to you',
      icon: <User className="w-4 h-4 text-primary" weight="fill" />,
    },
    {
      key: 'task_reassigned' as const,
      label: 'Task Reassigned',
      description: 'When a task is reassigned to you',
      icon: <ArrowsClockwise className="w-4 h-4 text-blue-500" weight="fill" />,
    },
    {
      key: 'task_updated' as const,
      label: 'Task Updated',
      description: 'When task details are modified',
      icon: <Bell className="w-4 h-4 text-orange-500" weight="fill" />,
    },
    {
      key: 'task_comment' as const,
      label: 'Comments',
      description: 'When someone comments on your task',
      icon: <ChatCircle className="w-4 h-4 text-green-500" weight="fill" />,
    },
    {
      key: 'task_due_soon' as const,
      label: 'Due Soon',
      description: 'When a task is due within 24 hours',
      icon: <ClockCountdown className="w-4 h-4 text-yellow-500" weight="fill" />,
    },
    {
      key: 'task_overdue' as const,
      label: 'Overdue',
      description: 'When a task becomes overdue',
      icon: <WarningCircle className="w-4 h-4 text-red-500" weight="fill" />,
    },
    {
      key: 'task_completed' as const,
      label: 'Task Completed',
      description: 'When a task is marked as complete',
      icon: <CheckCircle className="w-4 h-4 text-green-600" weight="fill" />,
    },
    {
      key: 'task_status_changed' as const,
      label: 'Status Changed',
      description: 'When task status is updated',
      icon: <FlagBanner className="w-4 h-4 text-purple-500" weight="fill" />,
    },
    {
      key: 'task_priority_changed' as const,
      label: 'Priority Changed',
      description: 'When task priority is modified',
      icon: <FlagBanner className="w-4 h-4 text-red-500" weight="fill" />,
    },
    {
      key: 'mention' as const,
      label: 'Mentions',
      description: 'When you are mentioned in comments',
      icon: <ChatCircle className="w-4 h-4 text-pink-500" weight="fill" />,
    },
  ];

  const allEnabled = Object.values(currentPreferences.enabledNotifications).every(v => v === true);
  const allDisabled = Object.values(currentPreferences.enabledNotifications).every(v => v === false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Gear className="h-5 w-5" weight="fill" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center">
            Notification Preferences
            {inQuietHours && (
              <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 border-purple-200">
                <Moon className="w-3 h-3 mr-1" weight="fill" />{t('Quiet Hours Active')}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>{t('Control when and how you receive notifications')}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4 px-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <EnvelopeSimple className="w-4 h-4" weight="fill" />{t('Email Notifications')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('Receive notifications via email')}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications" className="text-sm font-medium">{t('Enable Email Notifications')}</Label>
                  <p className="text-xs text-muted-foreground">{t('Get notified via email about task updates')}</p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={currentPreferences.emailNotifications}
                  onCheckedChange={handleToggleEmailNotifications}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <Bell className="w-4 h-4" weight="fill" />{t('Notification Types')}</h3>
                  <p className="text-xs text-muted-foreground">{t('Choose which events trigger notifications')}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnableAll}
                    disabled={allEnabled}
                  >{t('Enable All')}</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisableAll}
                    disabled={allDisabled}
                  >{t('Disable All')}</Button>
                </div>
              </div>

              <div className="space-y-2">
                {notificationTypes.map((type) => (
                  <div
                    key={type.key}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-0.5">
                        {type.icon}
                      </div>
                      <div className="space-y-0.5 flex-1">
                        <Label
                          htmlFor={`notification-${type.key}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {type.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={`notification-${type.key}`}
                      checked={currentPreferences.enabledNotifications[type.key]}
                      onCheckedChange={(checked) => handleToggleNotificationType(type.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <ClockCountdown className="w-4 h-4" weight="fill" />{t('Notification Frequency')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('Control how often you receive notifications')}</p>
              </div>
              <div className="rounded-lg border p-4 bg-muted/50">
                <Label htmlFor="frequency" className="text-sm font-medium mb-2 block">{t('Delivery Frequency')}</Label>
                <Select
                  value={currentPreferences.notificationFrequency}
                  onValueChange={handleChangeFrequency}
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">{t('Real-time')}</SelectItem>
                    <SelectItem value="batched">{t('Batched (every 15 min)')}</SelectItem>
                    <SelectItem value="hourly">{t('Hourly')}</SelectItem>
                    <SelectItem value="daily">{t('Daily digest')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <SpeakerHigh className="w-4 h-4" weight="fill" />{t('Notification Sounds')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('Play sounds when notifications arrive')}</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="sound-enabled" className="text-sm font-medium flex items-center gap-2">
                      Enable Sounds
                      {!currentPreferences.soundEnabled && (
                        <Badge variant="secondary" className="bg-muted">
                          <SpeakerX className="w-3 h-3 mr-1" />{t('Muted')}</Badge>
                      )}
                    </Label>
                  </div>
                  <Switch
                    id="sound-enabled"
                    checked={currentPreferences.soundEnabled}
                    onCheckedChange={handleToggleSound}
                  />
                </div>
                {currentPreferences.soundEnabled && (
                  <>
                    <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">{t('Volume')}</Label>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(currentPreferences.soundVolume * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[currentPreferences.soundVolume]}
                        onValueChange={handleChangeVolume}
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="rounded-lg border p-4 bg-muted/50">
                      <Label className="text-sm font-medium mb-3 block">{t('Test Sounds')}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {notificationTypes.slice(0, 6).map((type) => (
                          <Button
                            key={type.key}
                            variant="outline"
                            size="sm"
                            className="h-auto py-2 px-3 text-left justify-start"
                            onClick={() => handleTestSound(type.key)}
                          >
                            <div className="flex items-center gap-2 w-full">
                              {type.icon}
                              <span className="text-xs truncate">{type.label}</span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <Moon className="w-4 h-4" weight="fill" />{t('Quiet Hours')}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t('Pause notifications during specific times')}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="quiet-hours" className="text-sm font-medium flex items-center gap-2">
                    Enable Quiet Hours
                    {currentPreferences.quietHours.enabled && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">{t('Active')}</Badge>
                    )}
                  </Label>
                </div>
                <Switch
                  id="quiet-hours"
                  checked={currentPreferences.quietHours.enabled}
                  onCheckedChange={handleToggleQuietHours}
                />
              </div>
              {currentPreferences.quietHours.enabled && (
                <>
                  <div className="pt-2 space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground">{t('Quick Presets')}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {quietHoursPresets.map((preset) => (
                        <Button
                          key={preset.label}
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyPreset(preset)}
                          className="h-auto py-3 flex flex-col items-start"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium">{preset.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {preset.start} - {preset.end}
                            </span>
                          </div>
                        </Button>
                      ))}
                    </div>
                    <Separator className="my-2" />
                    <div className="space-y-3">
                      <Label className="text-xs font-medium text-muted-foreground">{t('Custom Time Range')}</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="start-time" className="text-xs">{t('Start Time')}</Label>
                          <input
                            type="time"
                            id="start-time"
                            value={currentPreferences.quietHours.startTime}
                            onChange={(e) => handleChangeQuietHours('startTime', e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-time" className="text-xs">{t('End Time')}</Label>
                          <input
                            type="time"
                            id="end-time"
                            value={currentPreferences.quietHours.endTime}
                            onChange={(e) => handleChangeQuietHours('endTime', e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('Notifications will be paused between these times')}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 pt-4 px-6 pb-6 border-t">
          <Button onClick={() => setOpen(false)}>{t('Close')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}