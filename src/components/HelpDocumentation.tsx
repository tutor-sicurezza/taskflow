import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Question, ListChecks, Users, ChartBar, Sparkle, Buildings, Bell } from '@phosphor-icons/react';

export function HelpDocumentation() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Question className="mr-2 h-4 w-4" weight="duotone" />{t('Help')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('TaskFlow Help & Documentation')}</DialogTitle>
          <DialogDescription>{t('Everything you need to know about using TaskFlow effectively')}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tasks">
              <ListChecks className="h-4 w-4 mr-2" />{t('Tasks')}</TabsTrigger>
            <TabsTrigger value="team">
              <Users className="h-4 w-4 mr-2" />{t('Team')}</TabsTrigger>
            <TabsTrigger value="analytics">
              <ChartBar className="h-4 w-4 mr-2" />{t('Analytics')}</TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkle className="h-4 w-4 mr-2" />
              AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4 pt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="create-task">
                <AccordionTrigger>{t('How do I create a new task?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>1. Click the <strong>"Add Task"</strong> button in the header</p>
                  <p>2. Fill in the task details:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>{t('Title')}</strong>: Brief description of the task</li>
                    <li><strong>{t('Description')}</strong>: Detailed information (optional)</li>
                    <li><strong>{t('Assignee')}</strong>: Team member responsible</li>
                    <li><strong>{t('Priority')}</strong>: High, Medium, or Low</li>
                    <li><strong>{t('Due Date')}</strong>: When the task should be completed</li>
                  </ul>
                  <p>3. Click <strong>"Create Task"</strong> to save</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="edit-task">
                <AccordionTrigger>{t('How do I edit an existing task?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Click the <strong>edit icon</strong> (pencil) on any task card, make your changes, and click <strong>"Save Changes"</strong>.</p>
                  <p>{t("All changes are automatically tracked in the task's activity history.")}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="bulk-operations">
                <AccordionTrigger>{t('How do bulk operations work?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>1. Click <strong>"Bulk Select"</strong> in the header</p>
                  <p>2. Check the boxes next to tasks you want to modify</p>
                  <p>3. Choose an action:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>{t('Complete')}</strong>: Mark all as completed</li>
                    <li><strong>{t('In Progress')}</strong>: Set all to in-progress</li>
                    <li><strong>{t('Not Started')}</strong>: Reset all to not-started</li>
                    <li><strong>{t('Delete')}</strong>: Remove all selected tasks</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="comments">
                <AccordionTrigger>{t('How do I add comments to tasks?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Click on any task card to open the details dialog, then:</p>
                  <p>1. Navigate to the <strong>"Comments"</strong> tab</p>
                  <p>2. Type your comment in the text field</p>
                  <p>3. Click <strong>"Add Comment"</strong></p>
                  <p>{t('Team members will be notified of new comments on their assigned tasks.')}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="attachments">
                <AccordionTrigger>{t('Can I attach files to tasks?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Yes! Open the task details dialog and go to the <strong>"Attachments"</strong> tab.</p>
                  <p>Click <strong>"Attach File"</strong> to upload documents, images, or other files (max 10MB per file).</p>
                  <p>{t('Files are stored securely and can be downloaded or deleted by authorized users.')}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="team" className="space-y-4 pt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="add-user">
                <AccordionTrigger>{t('How do I add team members?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>1. Click the <strong>"Users"</strong> button in the header</p>
                  <p>2. Click <strong>"Add Team Member"</strong></p>
                  <p>3. Enter their information:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>{t('Name')}</strong>: Full name</li>
                    <li><strong>{t('Email')}</strong>: Contact email</li>
                    <li><strong>{t('Role')}</strong>: Job title or position</li>
                    <li><strong>{t('User Role')}</strong>: Admin, Manager, or Member</li>
                    <li><strong>{t('Departments')}</strong>: Which teams they belong to</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="roles">
                <AccordionTrigger>{t('What are the different user roles?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p><strong>{t('Admin (Super Admin)')}</strong>:</p>
                  <ul className="list-disc pl-6 mb-2">
                    <li>{t('Full system access')}</li>
                    <li>{t('Manage all users and departments')}</li>
                    <li>{t('Access email settings and system configuration')}</li>
                    <li>{t('View all analytics and reports')}</li>
                  </ul>
                  <p><strong>{t('Manager (Department Admin)')}</strong>:</p>
                  <ul className="list-disc pl-6 mb-2">
                    <li>{t('Manage tasks within their department(s)')}</li>
                    <li>{t('View department analytics')}</li>
                    <li>{t('Create announcements')}</li>
                    <li>{t('Use AI features')}</li>
                  </ul>
                  <p><strong>{t('Member')}</strong>:</p>
                  <ul className="list-disc pl-6">
                    <li>{t('View and update their own tasks')}</li>
                    <li>{t('Add comments and attachments')}</li>
                    <li>{t('Receive notifications')}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="departments">
                <AccordionTrigger>{t('How do I manage departments?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Click the <strong>"Departments"</strong> button to:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>{t('Create new departments with details (name, description, color, lead, budget)')}</li>
                    <li>{t('Assign employees to multiple departments')}</li>
                    <li>{t('Set department leads')}</li>
                    <li>{t('Archive inactive departments')}</li>
                    <li>{t('Filter tasks by department')}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 pt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="view-analytics">
                <AccordionTrigger>{t('How do I access analytics?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Click the <strong>"Analytics"</strong> button in the header to view:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>{t('Team Performance')}</strong>: Completion rates, workload distribution, task trends</li>
                    <li><strong>{t('Department Analytics')}</strong>: Department-specific metrics and comparisons</li>
                    <li><strong>{t('AI Insights')}</strong>: Automated recommendations and trend analysis</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="export-reports">
                <AccordionTrigger>{t('Can I export analytics reports?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>Yes! In the analytics view, click the <strong>"Export"</strong> button to download reports as:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>PDF</strong>: Formatted report with charts</li>
                    <li><strong>CSV</strong>: Raw data for further analysis</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4 pt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="ai-assistant">
                <AccordionTrigger>{t('What can the AI Assistant do?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>The AI Assistant helps you with:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>{t('Task Creation')}</strong>: Describe a task naturally and AI will create it</li>
                    <li><strong>{t('Smart Suggestions')}</strong>: Get recommendations for task reassignment or priority changes</li>
                    <li><strong>{t('Workload Analysis')}</strong>: Identify overloaded team members</li>
                    <li><strong>{t('Task Questions')}</strong>: Ask about specific tasks or team status</li>
                  </ul>
                  <p className="mt-2">Click <strong>"AI Assistant"</strong> in the header to start chatting!</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="auto-assign">
                <AccordionTrigger>{t('How does AI Auto-Assignment work?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>When you have unassigned tasks, click <strong>"AI Auto-Assign"</strong> to:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>{t('Analyze team member workloads')}</li>
                    <li>{t('Consider task priorities and deadlines')}</li>
                    <li>{t('Match skills and departments')}</li>
                    <li>{t('Generate optimal assignment suggestions')}</li>
                  </ul>
                  <p className="mt-2">{t('Review the suggestions before applying them.')}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ai-insights">
                <AccordionTrigger>{t('What are AI Insights?')}</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>AI Insights appear in the Analytics view and provide:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>{t('Workload Alerts')}</strong>: Identify overworked team members</li>
                    <li><strong>{t('Performance Patterns')}</strong>: Spot trends in completion rates</li>
                    <li><strong>{t('Priority Warnings')}</strong>: Flag urgent overdue tasks</li>
                    <li><strong>{t('Recommendations')}</strong>: Actionable suggestions to improve workflow</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-primary mt-0.5" weight="duotone" />
            <div className="flex-1">
              <h4 className="font-medium mb-1">{t('Notifications')}</h4>
              <p className="text-sm text-muted-foreground">
                Configure your notification preferences by clicking the bell icon in the header. 
                You can customize which events trigger notifications, set quiet hours, and choose notification sounds.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-3">
            <Buildings className="h-5 w-5 text-primary mt-0.5" weight="duotone" />
            <div className="flex-1">
              <h4 className="font-medium mb-1">{t('Data Safety')}</h4>
              <p className="text-sm text-muted-foreground">
                Your data is automatically saved in your browser. Use <strong>"Backup & Restore"</strong> to export 
                your data before making major changes. You can also import data from previous backups.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
