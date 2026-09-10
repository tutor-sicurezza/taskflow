import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, BellSlash, Desktop, CheckCircle, XCircle, Warning } from '@phosphor-icons/react';
import { desktopNotificationManager } from '@/lib/desktopNotifications';
import { toast } from 'sonner';

export function DesktopNotificationSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const supported = desktopNotificationManager.isSupported();
    setIsSupported(supported);
    
    if (supported) {
      const perm = desktopNotificationManager.getPermission();
      setPermission(perm);
      setIsEnabled(perm === 'granted');
    }
  }, [open]);

  const handleRequestPermission = async () => {
    const result = await desktopNotificationManager.requestPermission();
    setPermission(result);
    setIsEnabled(result === 'granted');
    
    if (result === 'granted') {
      toast.success(t('Desktop notifications enabled!'));
      await desktopNotificationManager.showNotification({
        title: '🎉 Desktop Notifications Enabled',
        body: 'You will now receive desktop notifications for important updates!',
        requireInteraction: false,
      });
    } else if (result === 'denied') {
      toast.error(t('Desktop notifications were blocked. Please enable them in your browser settings.'));
    }
  };

  const handleTestNotification = async () => {
    await desktopNotificationManager.showNotification({
      title: '🔔 Test Notification',
      body: 'This is a test notification from TaskFlow!',
      requireInteraction: false,
    });
    toast.success(t('Test notification sent!'));
  };

  const getPermissionIcon = () => {
    switch (permission) {
      case 'granted':
        return <CheckCircle className="h-5 w-5 text-green-600" weight="fill" />;
      case 'denied':
        return <XCircle className="h-5 w-5 text-destructive" weight="fill" />;
      default:
        return <Warning className="h-5 w-5 text-amber-600" weight="fill" />;
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return { text: 'Enabled', variant: 'default' as const };
      case 'denied':
        return { text: 'Blocked', variant: 'destructive' as const };
      default:
        return { text: 'Not Set', variant: 'secondary' as const };
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {isEnabled ? (
            <Bell className="h-4 w-4" weight="fill" />
          ) : (
            <BellSlash className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      {/* max-h + overflow: DialogContent e' `fixed` e centrato, quindi senza
          tetto d'altezza su uno schermo basso il contenuto esce sopra e sotto,
          la testata e i pulsanti in fondo diventano irraggiungibili e la pagina
          non scorre perche' l'elemento e' fuori dal flusso. */}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Desktop className="h-6 w-6" weight="duotone" />{t('Desktop Notifications')}</DialogTitle>
          <DialogDescription>{t('Receive real-time alerts on your desktop for important task updates')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isSupported ? (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{t('Your browser does not support desktop notifications')}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{t('Permission Status')}</CardTitle>
                    <div className="flex items-center gap-2">
                      {getPermissionIcon()}
                      <Badge variant={getPermissionStatus().variant}>
                        {getPermissionStatus().text}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">
                    {permission === 'granted' && 'Desktop notifications are enabled and working.'}
                    {permission === 'denied' && 'Desktop notifications are blocked. Check your browser settings to enable them.'}
                    {permission === 'default' && 'Click "Enable Notifications" to receive desktop alerts.'}
                  </CardDescription>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{t('Desktop Alerts')}</div>
                    <div className="text-xs text-muted-foreground">{t('Show notifications outside the browser')}</div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => {
                      if (checked && permission !== 'granted') {
                        handleRequestPermission();
                      }
                    }}
                    disabled={permission === 'denied'}
                  />
                </div>

                {permission === 'granted' && (
                  <Alert>
                    <Bell className="h-4 w-4" weight="fill" />
                    <AlertDescription className="text-xs">
                      You'll receive desktop notifications for:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>{t('Task assignments and updates')}</li>
                        <li>{t('Overdue tasks (priority)')}</li>
                        <li>{t('Tasks due within 24 hours (priority)')}</li>
                        <li>{t('Comments and mentions')}</li>
                        <li>{t('Status changes')}</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex gap-2">
                {permission !== 'granted' && permission !== 'denied' && (
                  <Button
                    onClick={handleRequestPermission}
                    className="flex-1"
                  >
                    <Bell className="mr-2 h-4 w-4" weight="fill" />{t('Enable Notifications')}</Button>
                )}
                
                {permission === 'granted' && (
                  <Button
                    onClick={handleTestNotification}
                    variant="outline"
                    className="flex-1"
                  >{t('Send Test Notification')}</Button>
                )}

                {permission === 'denied' && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      To enable notifications, please allow them in your browser settings:
                      <br />
                      Settings → Privacy → Site Settings → Notifications
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
