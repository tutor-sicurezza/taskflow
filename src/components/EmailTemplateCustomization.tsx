import { useState, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useKV } from '@/hooks/useKV';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Envelope, Eye, FloppyDisk, ArrowCounterClockwise, Code, Plus, Check, Info } from '@phosphor-icons/react';
import { EmailTemplate, EmailTemplateVariable, NotificationType } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { newId } from '@/lib/utils';
import { sanitizeEmailPreview } from '@/lib/sanitization';
import {
  modelliPredefiniti,
  modelloPredefinito,
  tipiNotifica,
} from '@/lib/modelliEmail';

const TEMPLATE_VARIABLES: Record<string, EmailTemplateVariable[]> = {
  common: [
    { name: '{{recipientName}}', description: 'Name of the email recipient', example: 'John Doe' },
    { name: '{{recipientEmail}}', description: 'Email address of the recipient', example: 'john@example.com' },
    { name: '{{applicationName}}', description: 'Name of the application', example: 'TaskFlow' },
    { name: '{{companyName}}', description: 'Name of the company', example: 'Acme Corp' },
    { name: '{{currentDate}}', description: 'Current date', example: 'January 15, 2024' },
    { name: '{{currentYear}}', description: 'Current year', example: '2024' },
  ],
  task: [
    { name: '{{taskTitle}}', description: 'Title of the task', example: 'Complete project documentation' },
    { name: '{{taskDescription}}', description: 'Description of the task', example: 'Write comprehensive documentation...' },
    { name: '{{taskPriority}}', description: 'Priority level of the task', example: 'High' },
    { name: '{{taskStatus}}', description: 'Current status of the task', example: 'In Progress' },
    { name: '{{taskDueDate}}', description: 'Due date of the task', example: 'January 20, 2024' },
    { name: '{{taskAssignee}}', description: 'Name of the person assigned', example: 'Jane Smith' },
    { name: '{{taskUrl}}', description: 'Link to view the task', example: 'https://app.example.com/tasks/123' },
  ],
  action: [
    { name: '{{actionBy}}', description: 'Name of the person who performed the action', example: 'Bob Johnson' },
    { name: '{{actionType}}', description: 'Type of action performed', example: 'assigned' },
    { name: '{{actionDate}}', description: 'Date when the action occurred', example: 'January 15, 2024' },
    { name: '{{commentText}}', description: 'Content of a comment', example: 'Please review this by tomorrow' },
  ],
};

interface EmailTemplateCustomizationProps {
  currentUserId?: string;
  currentUserName?: string;
}

export function EmailTemplateCustomization({ currentUserId, currentUserName }: EmailTemplateCustomizationProps) {
  const { t, lingua } = useTranslation();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates, , modelliCaricati] = useKV<EmailTemplate[]>('email-templates', []);
  const [selectedType, setSelectedType] = useState<NotificationType>('task_assigned');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');
  const [showVariables, setShowVariables] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  /**
   * I modelli nascono nella lingua di chi apre per primo questa schermata,
   * cioe' di chi ha creato l'organizzazione.
   *
   * Vengono creati una volta sola e poi restano dati dell'organizzazione: se
   * qualcuno cambia lingua NON si riscrivono, perche' sono modificabili e
   * rigenerarli cancellerebbe le personalizzazioni. Per rifarli in un'altra
   * lingua c'e' "Ripristina il valore predefinito", modello per modello.
   */
  useEffect(() => {
    // SOLO dopo che il server ha risposto. Prima, `templates` e' il valore
    // iniziale — un array vuoto — e seminare li' significa sovrascrivere i
    // modelli veri dell'organizzazione con quelli di serie. Accadeva a ogni
    // accesso di un amministratore, e ha cancellato modelli gia' tradotti.
    if (!modelliCaricati) return;
    if ((templates || []).length > 0) return;

    setTemplates(
      modelliPredefiniti(lingua).map((modello) => ({
        ...modello,
        id: newId('template'),
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: currentUserName || 'System',
      }))
    );
  }, [modelliCaricati]);

  useEffect(() => {
    if ((templates || []).length > 0) {
      const template = (templates || []).find(t => t.type === selectedType);
      if (template) {
        setEditingTemplate({ ...template });
        setHasChanges(false);
      }
    }
  }, [selectedType, templates]);

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;

    setTemplates((currentTemplates) =>
      (currentTemplates || []).map(t =>
        t.id === editingTemplate.id
          ? {
              ...editingTemplate,
              lastModifiedAt: new Date().toISOString(),
              lastModifiedBy: currentUserName || 'Admin',
            }
          : t
      )
    );

    setHasChanges(false);
    toast.success(t('Email template saved successfully!'));
  };

  const handleResetTemplate = () => {
    const defaultTemplate = modelloPredefinito(lingua, selectedType);
    if (defaultTemplate && editingTemplate) {
      const resetTemplate: EmailTemplate = {
        ...editingTemplate,
        ...defaultTemplate,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: currentUserName || 'Admin',
      };
      setEditingTemplate(resetTemplate);
      setHasChanges(true);
      toast.info(t('Template reset to default. Click Save to apply changes.'));
    }
  };

  const handleFieldChange = (field: keyof EmailTemplate, value: any) => {
    if (!editingTemplate) return;
    setEditingTemplate({ ...editingTemplate, [field]: value });
    setHasChanges(true);
  };

  const insertVariable = (variable: string) => {
    if (!editingTemplate) return;
    
    const textarea = document.getElementById(previewMode === 'html' ? 'html-content' : 'text-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const content = previewMode === 'html' ? editingTemplate.htmlContent : editingTemplate.textContent;
      const newContent = content.substring(0, start) + variable + content.substring(end);
      
      handleFieldChange(previewMode === 'html' ? 'htmlContent' : 'textContent', newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const generatePreview = () => {
    if (!editingTemplate) return '';
    
    const sampleData: Record<string, string> = {
      '{{recipientName}}': 'John Doe',
      '{{recipientEmail}}': 'john.doe@example.com',
      '{{applicationName}}': 'TaskFlow',
      '{{companyName}}': 'Acme Corporation',
      '{{currentDate}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      '{{currentYear}}': new Date().getFullYear().toString(),
      '{{taskTitle}}': 'Complete Q4 Financial Report',
      '{{taskDescription}}': 'Prepare and finalize the financial report for Q4 2024, including all revenue streams and expenses.',
      '{{taskPriority}}': 'High',
      '{{taskStatus}}': 'In Progress',
      '{{taskDueDate}}': new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      '{{taskAssignee}}': 'Jane Smith',
      '{{taskUrl}}': 'https://app.example.com/tasks/12345',
      '{{actionBy}}': 'Bob Johnson',
      '{{actionType}}': 'assigned',
      '{{actionDate}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      '{{commentText}}': 'Please review the attached documents and provide feedback by end of day.',
    };

    let content = previewMode === 'html' ? editingTemplate.htmlContent : editingTemplate.textContent;
    Object.entries(sampleData).forEach(([variable, value]) => {
      content = content.replace(new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    return content;
  };

  const allVariables = [...TEMPLATE_VARIABLES.common, ...TEMPLATE_VARIABLES.task, ...TEMPLATE_VARIABLES.action];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Envelope className="h-4 w-4" weight="bold" />{t('Email Templates')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Envelope className="h-5 w-5" weight="fill" />{t('Email Template Customization')}</DialogTitle>
          <DialogDescription>{t('Customize email notifications sent to users for various task events')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          <div className="w-64 flex-shrink-0 space-y-2">
            <Label className="text-sm font-medium">{t('Notification Type')}</Label>
            <ScrollArea className="h-[calc(90vh-200px)]">
              <div className="space-y-1 pr-4">
                {tipiNotifica(lingua).map(({ value, label }) => {
                  const template = (templates || []).find(t => t.type === value);
                  return (
                    <button
                      key={value}
                      onClick={() => setSelectedType(value)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        selectedType === value
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{label}</span>
                        {template?.isActive && (
                          <Badge variant="secondary" className="h-5 text-xs">{t('Active')}</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <Separator orientation="vertical" className="h-auto" />

          <div className="flex-1 overflow-hidden flex flex-col">
            {editingTemplate && (
              <>
                <div className="space-y-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold">{editingTemplate.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t('Last modified: {data} by {autore}', {
                          data: new Date(editingTemplate.lastModifiedAt).toLocaleString(),
                          autore: editingTemplate.lastModifiedBy,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="template-active" className="text-sm">{t('Active')}</Label>
                      <input
                        id="template-active"
                        type="checkbox"
                        checked={editingTemplate.isActive}
                        onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">{t('Subject Line')}</Label>
                    <Input
                      id="subject"
                      value={editingTemplate.subject}
                      onChange={(e) => handleFieldChange('subject', e.target.value)}
                      placeholder={t('Email subject...')}
                    />
                  </div>
                </div>

                <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as 'html' | 'text')} className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between">
                    <TabsList>
                      <TabsTrigger value="html" className="gap-2">
                        <Code className="h-4 w-4" />{t('HTML Template')}</TabsTrigger>
                      <TabsTrigger value="text" className="gap-2">
                        <Code className="h-4 w-4" />{t('Plain Text')}</TabsTrigger>
                    </TabsList>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowVariables(!showVariables)}
                      className="gap-2"
                    >
                      {showVariables ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {t('Variables')}
                    </Button>
                  </div>

                  <div className="flex-1 overflow-hidden mt-4">
                    <div className="grid grid-cols-2 gap-4 h-full">
                      <div className="space-y-2 flex flex-col">
                        <Label>{t('Editor')}</Label>
                        <Textarea
                          id={previewMode === 'html' ? 'html-content' : 'text-content'}
                          value={previewMode === 'html' ? editingTemplate.htmlContent : editingTemplate.textContent}
                          onChange={(e) => handleFieldChange(previewMode === 'html' ? 'htmlContent' : 'textContent', e.target.value)}
                          className="flex-1 font-mono text-sm leading-relaxed resize-none"
                          placeholder={previewMode === 'html' ? 'HTML content...' : 'Plain text content...'}
                        />
                      </div>

                      <div className="space-y-2 flex flex-col">
                        <Label className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />{t('Preview')}</Label>
                        <ScrollArea className="flex-1 border rounded-md">
                          {previewMode === 'html' ? (
                            <div
                              className="p-4"
                              dangerouslySetInnerHTML={{ __html: sanitizeEmailPreview(generatePreview()) }}
                            />
                          ) : (
                            <pre className="p-4 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                              {generatePreview()}
                            </pre>
                          )}
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                </Tabs>

                {showVariables && (
                  <Card className="mt-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">{t('Available Variables')}</CardTitle>
                      <CardDescription className="text-sm">{t('Click a variable to insert it at cursor position')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-32">
                        <div className="grid grid-cols-3 gap-2">
                          {allVariables.map((variable) => (
                            <Button
                              key={variable.name}
                              variant="outline"
                              size="sm"
                              onClick={() => insertVariable(variable.name)}
                              className="justify-start text-sm font-mono h-auto py-1.5 px-2.5"
                              title={t(variable.description)}
                            >
                              {variable.name}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}

                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>{t('Note:')}</strong>{' '}
                    {t(
                      'Email notifications are sent when enabled in user notification preferences. Variables will be automatically replaced with actual values when emails are sent.'
                    )}
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleResetTemplate}
            className="gap-2"
          >
            <ArrowCounterClockwise className="h-4 w-4" />{t('Reset to Default')}</Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
          >{t('Cancel')}</Button>
          <Button
            onClick={handleSaveTemplate}
            disabled={!hasChanges}
            className="gap-2"
          >
            <FloppyDisk className="h-4 w-4" weight="fill" />{t('Save Template')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
