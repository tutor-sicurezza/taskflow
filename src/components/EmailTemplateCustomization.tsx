import { useState, useEffect } from 'react';
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

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'task_assigned', label: 'Task Assigned' },
  { value: 'task_reassigned', label: 'Task Reassigned' },
  { value: 'task_updated', label: 'Task Updated' },
  { value: 'task_comment', label: 'Task Comment' },
  { value: 'task_due_soon', label: 'Task Due Soon' },
  { value: 'task_overdue', label: 'Task Overdue' },
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'task_status_changed', label: 'Task Status Changed' },
  { value: 'task_priority_changed', label: 'Task Priority Changed' },
  { value: 'mention', label: 'Mention' },
];

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

const DEFAULT_TEMPLATES: Record<NotificationType, Omit<EmailTemplate, 'id' | 'lastModifiedAt' | 'lastModifiedBy'>> = {
  task_assigned: {
    name: 'Task Assigned',
    type: 'task_assigned',
    subject: 'New Task Assigned: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2c3e50; margin-bottom: 20px;">New Task Assigned</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">You have been assigned a new task by {{actionBy}}.</p>
  
  <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 18px;">{{taskTitle}}</h2>
    <p style="margin: 5px 0; color: #7f8c8d;"><strong>Priority:</strong> {{taskPriority}}</p>
    <p style="margin: 5px 0; color: #7f8c8d;"><strong>Due Date:</strong> {{taskDueDate}}</p>
    <p style="margin: 10px 0 0 0; color: #34495e;">{{taskDescription}}</p>
  </div>
  
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Task</a>
  
  <p style="margin-top: 30px; font-size: 14px; color: #7f8c8d;">Best regards,<br>The {{applicationName}} Team</p>
</div>`,
    textContent: `Hi {{recipientName}},

You have been assigned a new task by {{actionBy}}.

Task: {{taskTitle}}
Priority: {{taskPriority}}
Due Date: {{taskDueDate}}

Description:
{{taskDescription}}

View task: {{taskUrl}}

Best regards,
The {{applicationName}} Team`,
    isActive: true,
    variables: ['recipientName', 'actionBy', 'taskTitle', 'taskPriority', 'taskDueDate', 'taskDescription', 'taskUrl', 'applicationName'],
  },
  task_reassigned: {
    name: 'Task Reassigned',
    type: 'task_reassigned',
    subject: 'Task Reassigned: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2c3e50; margin-bottom: 20px;">Task Reassigned to You</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">A task has been reassigned to you by {{actionBy}}.</p>
  
  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 18px;">{{taskTitle}}</h2>
    <p style="margin: 5px 0; color: #7f8c8d;"><strong>Priority:</strong> {{taskPriority}}</p>
    <p style="margin: 5px 0; color: #7f8c8d;"><strong>Due Date:</strong> {{taskDueDate}}</p>
  </div>
  
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #ffc107; color: #2c3e50; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Task</a>
</div>`,
    textContent: `Hi {{recipientName}},

A task has been reassigned to you by {{actionBy}}.

Task: {{taskTitle}}
Priority: {{taskPriority}}
Due Date: {{taskDueDate}}

View task: {{taskUrl}}`,
    isActive: true,
    variables: ['recipientName', 'actionBy', 'taskTitle', 'taskPriority', 'taskDueDate', 'taskUrl'],
  },
  task_updated: {
    name: 'Task Updated',
    type: 'task_updated',
    subject: 'Task Updated: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2c3e50; margin-bottom: 20px;">Task Updated</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">{{actionBy}} updated the task "{{taskTitle}}".</p>
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Task</a>
</div>`,
    textContent: `Hi {{recipientName}},

{{actionBy}} updated the task "{{taskTitle}}".

View task: {{taskUrl}}`,
    isActive: true,
    variables: ['recipientName', 'actionBy', 'taskTitle', 'taskUrl'],
  },
  task_comment: {
    name: 'Task Comment',
    type: 'task_comment',
    subject: 'New Comment on: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2c3e50; margin-bottom: 20px;">New Comment</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">{{actionBy}} commented on "{{taskTitle}}".</p>
  
  <div style="background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 15px; margin: 20px 0;">
    <p style="font-style: italic; color: #495057; margin: 0;">"{{commentText}}"</p>
  </div>
  
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Comment</a>
</div>`,
    textContent: `Hi {{recipientName}},

{{actionBy}} commented on "{{taskTitle}}".

Comment: "{{commentText}}"

View task: {{taskUrl}}`,
    isActive: true,
    variables: ['recipientName', 'actionBy', 'taskTitle', 'commentText', 'taskUrl'],
  },
  task_due_soon: {
    name: 'Task Due Soon',
    type: 'task_due_soon',
    subject: 'Reminder: {{taskTitle}} is due soon',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2c3e50; margin-bottom: 20px;">⏰ Task Due Soon</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">This is a reminder that your task is due soon.</p>
  
  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 18px;">{{taskTitle}}</h2>
    <p style="margin: 5px 0; color: #7f8c8d;"><strong>Due Date:</strong> {{taskDueDate}}</p>
    <p style="margin: 5px 0; color: #7f8c8d;"><strong>Status:</strong> {{taskStatus}}</p>
  </div>
  
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #ffc107; color: #2c3e50; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Task</a>
</div>`,
    textContent: `Hi {{recipientName}},

This is a reminder that your task is due soon.

Task: {{taskTitle}}
Due Date: {{taskDueDate}}
Status: {{taskStatus}}

View task: {{taskUrl}}`,
    isActive: true,
    variables: ['recipientName', 'taskTitle', 'taskDueDate', 'taskStatus', 'taskUrl'],
  },
  task_overdue: {
    name: 'Task Overdue',
    type: 'task_overdue',
    subject: 'Overdue: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #dc3545; margin-bottom: 20px;">⚠️ Task Overdue</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">Your task is now overdue and requires immediate attention.</p>
  
  <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #721c24; font-size: 18px;">{{taskTitle}}</h2>
    <p style="margin: 5px 0; color: #721c24;"><strong>Due Date:</strong> {{taskDueDate}}</p>
    <p style="margin: 5px 0; color: #721c24;"><strong>Priority:</strong> {{taskPriority}}</p>
  </div>
  
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Task Now</a>
</div>`,
    textContent: `Hi {{recipientName}},

⚠️ Your task is now overdue and requires immediate attention.

Task: {{taskTitle}}
Due Date: {{taskDueDate}}
Priority: {{taskPriority}}

View task: {{taskUrl}}`,
    isActive: true,
    variables: ['recipientName', 'taskTitle', 'taskDueDate', 'taskPriority', 'taskUrl'],
  },
  task_completed: {
    name: 'Task Completed',
    type: 'task_completed',
    subject: 'Task Completed: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #28a745; margin-bottom: 20px;">✅ Task Completed</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">Your task "{{taskTitle}}" has been marked as completed by {{actionBy}}.</p>
  
  <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
    <h2 style="margin: 0 0 10px 0; color: #155724; font-size: 18px;">{{taskTitle}}</h2>
    <p style="margin: 5px 0; color: #155724;">Great work! 🎉</p>
  </div>
  
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Task</a>
</div>`,
    textContent: `Hi {{recipientName}},

✅ Your task "{{taskTitle}}" has been marked as completed by {{actionBy}}.

Great work! 🎉

View task: {{taskUrl}}`,
    isActive: true,
    variables: ['recipientName', 'taskTitle', 'actionBy', 'taskUrl'],
  },
  task_status_changed: {
    name: 'Task Status Changed',
    type: 'task_status_changed',
    subject: 'Task Status Changed: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2c3e50; margin-bottom: 20px;">Task Status Updated</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">The status of "{{taskTitle}}" has been changed to {{taskStatus}} by {{actionBy}}.</p>
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Task</a>
</div>`,
    textContent: `Hi {{recipientName}},

The status of "{{taskTitle}}" has been changed to {{taskStatus}} by {{actionBy}}.

View task: {{taskUrl}}`,
    isActive: true,
    variables: ['recipientName', 'taskTitle', 'taskStatus', 'actionBy', 'taskUrl'],
  },
  task_priority_changed: {
    name: 'Task Priority Changed',
    type: 'task_priority_changed',
    subject: 'Task Priority Changed: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2c3e50; margin-bottom: 20px;">Task Priority Updated</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">The priority of "{{taskTitle}}" has been changed to {{taskPriority}} by {{actionBy}}.</p>
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Task</a>
</div>`,
    textContent: `Hi {{recipientName}},

The priority of "{{taskTitle}}" has been changed to {{taskPriority}} by {{actionBy}}.

View task: {{taskUrl}}`,
    isActive: true,
    variables: ['recipientName', 'taskTitle', 'taskPriority', 'actionBy', 'taskUrl'],
  },
  mention: {
    name: 'Mention',
    type: 'mention',
    subject: 'You were mentioned in: {{taskTitle}}',
    htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2c3e50; margin-bottom: 20px;">You Were Mentioned</h1>
  <p style="font-size: 16px; color: #34495e;">Hi {{recipientName}},</p>
  <p style="font-size: 16px; color: #34495e;">{{actionBy}} mentioned you in "{{taskTitle}}".</p>
  <a href="{{taskUrl}}" style="display: inline-block; background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">View Task</a>
</div>`,
    textContent: `Hi {{recipientName}},

{{actionBy}} mentioned you in "{{taskTitle}}".

View task: {{taskUrl}}`,
    isActive: true,
    variables: ['recipientName', 'actionBy', 'taskTitle', 'taskUrl'],
  },
};

interface EmailTemplateCustomizationProps {
  currentUserId?: string;
  currentUserName?: string;
}

export function EmailTemplateCustomization({ currentUserId, currentUserName }: EmailTemplateCustomizationProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useKV<EmailTemplate[]>('email-templates', []);
  const [selectedType, setSelectedType] = useState<NotificationType>('task_assigned');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewMode, setPreviewMode] = useState<'html' | 'text'>('html');
  const [showVariables, setShowVariables] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if ((templates || []).length === 0) {
      const defaultTemplates = Object.values(DEFAULT_TEMPLATES).map((template, index) => ({
        ...template,
        id: newId('template'),
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: currentUserName || 'System',
      }));
      setTemplates(defaultTemplates);
    }
  }, []);

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
    toast.success('Email template saved successfully!');
  };

  const handleResetTemplate = () => {
    const defaultTemplate = DEFAULT_TEMPLATES[selectedType];
    if (defaultTemplate && editingTemplate) {
      const resetTemplate: EmailTemplate = {
        ...editingTemplate,
        ...defaultTemplate,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: currentUserName || 'Admin',
      };
      setEditingTemplate(resetTemplate);
      setHasChanges(true);
      toast.info('Template reset to default. Click Save to apply changes.');
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
          <Envelope className="h-4 w-4" weight="bold" />
          Email Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Envelope className="h-5 w-5" weight="fill" />
            Email Template Customization
          </DialogTitle>
          <DialogDescription>
            Customize email notifications sent to users for various task events
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          <div className="w-64 flex-shrink-0 space-y-2">
            <Label className="text-sm font-medium">Notification Type</Label>
            <ScrollArea className="h-[calc(90vh-200px)]">
              <div className="space-y-1 pr-4">
                {NOTIFICATION_TYPES.map(({ value, label }) => {
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
                          <Badge variant="secondary" className="h-5 text-xs">Active</Badge>
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
                        Last modified: {new Date(editingTemplate.lastModifiedAt).toLocaleString()} by {editingTemplate.lastModifiedBy}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="template-active" className="text-sm">Active</Label>
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
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={editingTemplate.subject}
                      onChange={(e) => handleFieldChange('subject', e.target.value)}
                      placeholder="Email subject..."
                    />
                  </div>
                </div>

                <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as 'html' | 'text')} className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between">
                    <TabsList>
                      <TabsTrigger value="html" className="gap-2">
                        <Code className="h-4 w-4" />
                        HTML Template
                      </TabsTrigger>
                      <TabsTrigger value="text" className="gap-2">
                        <Code className="h-4 w-4" />
                        Plain Text
                      </TabsTrigger>
                    </TabsList>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowVariables(!showVariables)}
                      className="gap-2"
                    >
                      {showVariables ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      Variables
                    </Button>
                  </div>

                  <div className="flex-1 overflow-hidden mt-4">
                    <div className="grid grid-cols-2 gap-4 h-full">
                      <div className="space-y-2 flex flex-col">
                        <Label>Editor</Label>
                        <Textarea
                          id={previewMode === 'html' ? 'html-content' : 'text-content'}
                          value={previewMode === 'html' ? editingTemplate.htmlContent : editingTemplate.textContent}
                          onChange={(e) => handleFieldChange(previewMode === 'html' ? 'htmlContent' : 'textContent', e.target.value)}
                          className="flex-1 font-mono text-xs resize-none"
                          placeholder={previewMode === 'html' ? 'HTML content...' : 'Plain text content...'}
                        />
                      </div>

                      <div className="space-y-2 flex flex-col">
                        <Label className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Preview
                        </Label>
                        <ScrollArea className="flex-1 border rounded-md">
                          {previewMode === 'html' ? (
                            <div
                              className="p-4"
                              dangerouslySetInnerHTML={{ __html: sanitizeEmailPreview(generatePreview()) }}
                            />
                          ) : (
                            <pre className="p-4 text-xs whitespace-pre-wrap font-sans">
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
                      <CardTitle className="text-sm">Available Variables</CardTitle>
                      <CardDescription className="text-xs">
                        Click a variable to insert it at cursor position
                      </CardDescription>
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
                              className="justify-start text-xs font-mono h-auto py-1 px-2"
                              title={variable.description}
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
                  <AlertDescription className="text-xs">
                    <strong>Note:</strong> Email notifications are sent when enabled in user notification preferences.
                    Variables will be automatically replaced with actual values when emails are sent.
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
            <ArrowCounterClockwise className="h-4 w-4" />
            Reset to Default
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveTemplate}
            disabled={!hasChanges}
            className="gap-2"
          >
            <FloppyDisk className="h-4 w-4" weight="fill" />
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
