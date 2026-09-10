import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useKV } from '@/hooks/useKV';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Paperclip, Info, Warning, Check } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface EmailAttachmentSettings {
  includeAttachmentsInEmails: boolean;
  maxAttachmentSize: number;
  maxTotalAttachmentSize: number;
  allowedFileTypes: string[];
  notifyWhenAttachmentsExcluded: boolean;
}

export function EmailAttachmentSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useKV<EmailAttachmentSettings>('email-attachment-settings', {
    includeAttachmentsInEmails: true,
    maxAttachmentSize: 5 * 1024 * 1024,
    maxTotalAttachmentSize: 10 * 1024 * 1024,
    allowedFileTypes: ['image/*', 'application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.*'],
    notifyWhenAttachmentsExcluded: true,
  });

  const [open, setOpen] = useState(false);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleSave = () => {
    setSettings((current) => ({ ...current }));
    toast.success(t('Email attachment settings saved'));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Paperclip className="mr-2 h-4 w-4" />{t('Email Attachments')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />{t('Email Attachment Settings')}</DialogTitle>
          <DialogDescription>{t('Configure how task attachments are included in email notifications')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('Attachment Inclusion')}</CardTitle>
              <CardDescription>{t('Control whether task attachments are sent with email notifications')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>{t('Include attachments in emails')}</Label>
                  <p className="text-sm text-muted-foreground">{t('When enabled, task attachments will be included in notification emails')}</p>
                </div>
                <Switch
                  checked={settings.includeAttachmentsInEmails}
                  onCheckedChange={(checked) =>
                    setSettings((current) => ({ ...current, includeAttachmentsInEmails: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {settings.includeAttachmentsInEmails && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('Size Limits')}</CardTitle>
                  <CardDescription>{t('Set maximum file sizes for email attachments')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t('Maximum single attachment size')}</Label>
                      <Badge variant="secondary">{formatBytes(settings.maxAttachmentSize)}</Badge>
                    </div>
                    <Slider
                      value={[settings.maxAttachmentSize / (1024 * 1024)]}
                      onValueChange={([value]) =>
                        setSettings((current) => ({ 
                          ...current, 
                          maxAttachmentSize: value * 1024 * 1024 
                        }))
                      }
                      min={1}
                      max={10}
                      step={0.5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">{t('Individual files larger than this will be excluded from emails')}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t('Maximum total attachment size per email')}</Label>
                      <Badge variant="secondary">{formatBytes(settings.maxTotalAttachmentSize)}</Badge>
                    </div>
                    <Slider
                      value={[settings.maxTotalAttachmentSize / (1024 * 1024)]}
                      onValueChange={([value]) =>
                        setSettings((current) => ({ 
                          ...current, 
                          maxTotalAttachmentSize: value * 1024 * 1024 
                        }))
                      }
                      min={5}
                      max={25}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">{t('Total size of all attachments in a single email cannot exceed this limit')}</p>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">{t('Most email providers have attachment size limits. SendGrid and Resend both support up to 25MB total.')}</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('Allowed File Types')}</CardTitle>
                  <CardDescription>{t('Currently allowed file types for email attachments')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="secondary">
                      <span className="mr-1">📷</span>{t('Images')}</Badge>
                    <Badge variant="secondary">
                      <span className="mr-1">📄</span>{t('PDF Documents')}</Badge>
                    <Badge variant="secondary">
                      <span className="mr-1">📝</span>{t('Text Files')}</Badge>
                    <Badge variant="secondary">
                      <span className="mr-1">📊</span>{t('Office Documents')}</Badge>
                  </div>
                  <Alert>
                    <Warning className="h-4 w-4" />
                    <AlertDescription className="text-sm">{t('Executable files (.exe, .bat, .sh) are automatically excluded for security reasons')}</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('Exclusion Notifications')}</CardTitle>
                  <CardDescription>{t('Alert users when attachments cannot be included')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>{t('Notify when attachments are excluded')}</Label>
                      <p className="text-sm text-muted-foreground">{t('Include a note in the email when some attachments exceed size limits')}</p>
                    </div>
                    <Switch
                      checked={settings.notifyWhenAttachmentsExcluded}
                      onCheckedChange={(checked) =>
                        setSettings((current) => ({ ...current, notifyWhenAttachmentsExcluded: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  <strong>Best Practices:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Keep individual attachments under 5MB for reliable delivery</li>
                    <li>• Total email size (including attachments) should stay under 10MB</li>
                    <li>• Large files should be shared via cloud storage links instead</li>
                    <li>• Consider compression for multiple attachments</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>{t('Cancel')}</Button>
          <Button onClick={handleSave}>
            <Check className="mr-2 h-4 w-4" />{t('Save Settings')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
