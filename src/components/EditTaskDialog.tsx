import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { CalendarBlank } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { Employee, Task, TaskPriority } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AITaskEstimator } from '@/components/AITaskEstimator';
import { useAIAvailability } from '@/lib/ai';
import { Sanitizer } from '@/lib/sanitization';

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  tasks?: Task[];
  task: Task | null;
  onEditTask: (taskId: string, updates: {
    title: string;
    description: string;
    assigneeId: string | null;
    priority: TaskPriority;
    dueDate: string;
  }) => void;
}

export function EditTaskDialog({ open, onOpenChange, employees, tasks = [], task, onEditTask }: EditTaskDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  // La stima AI compare solo se il server ha la chiave configurata.
  const { available: aiAvailable } = useAIAvailability();
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<Date>();
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssigneeId(task.assigneeId);
      setPriority(task.priority);
      setDueDate(new Date(task.dueDate));
    }
  }, [task]);

  const handleSubmit = () => {
    if (!title || !dueDate || !task) return;
    
    const sanitizedTitle = Sanitizer.taskTitle(title);
    const sanitizedDescription = Sanitizer.taskDescription(description);
    
    if (!sanitizedTitle) {
      return;
    }
    
    onEditTask(task.id, {
      title: sanitizedTitle,
      description: sanitizedDescription,
      assigneeId,
      priority,
      dueDate: dueDate.toISOString(),
    });
    
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssigneeId(task.assigneeId);
      setPriority(task.priority);
      setDueDate(new Date(task.dueDate));
      setEstimatedDuration(null);
    }
    onOpenChange(false);
  };

  const handleApplyAISuggestion = (suggestedDate: Date, duration: number) => {
    setDueDate(suggestedDate);
    setEstimatedDuration(duration);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('Edit Task')}</DialogTitle>
          <DialogDescription>{t('Update the task details below.')}</DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Task Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('Enter task title...')}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="edit-description">{t('Description')}</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('Add task details...')}
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-priority">{t('Priority')}</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger id="edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">{t('Medium')}</SelectItem>
                  <SelectItem value="high">{t('High')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>Due Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarBlank className="mr-2 h-4 w-4" />
                    {dueDate ? dueDate.toLocaleDateString() : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="edit-assignee">{t('Assign To')}</Label>
            <Select value={assigneeId || 'unassigned'} onValueChange={(value) => setAssigneeId(value === 'unassigned' ? null : value)}>
              <SelectTrigger id="edit-assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">{t('Unassigned')}</SelectItem>
                {employees.map(employee => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name} - {employee.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator className="my-2" />

          {aiAvailable && <AITaskEstimator
            title={title}
            description={description}
            priority={priority}
            assigneeId={assigneeId}
            employees={employees}
            tasks={tasks}
            onApplySuggestion={handleApplyAISuggestion}
          />}

          {estimatedDuration && (
            <div className="text-xs text-muted-foreground bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
              💡 AI suggests this task will take approximately <span className="font-semibold text-purple-900">{estimatedDuration} day{estimatedDuration !== 1 ? 's' : ''}</span> to complete
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>{t('Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!title || !dueDate}>{t('Save Changes')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
