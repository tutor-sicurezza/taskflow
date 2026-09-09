import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { CalendarBlank } from '@phosphor-icons/react';
import { useState } from 'react';
import { Employee, Task, TaskPriority } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AITaskEstimator } from '@/components/AITaskEstimator';
import { useAIAvailability } from '@/lib/ai';
import { Sanitizer } from '@/lib/sanitization';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  tasks?: Task[];
  onCreateTask: (task: {
    title: string;
    description: string;
    assigneeId: string | null;
    priority: TaskPriority;
    dueDate: string;
  }) => void;
}

export function CreateTaskDialog({ open, onOpenChange, employees, tasks = [], onCreateTask }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('');
  // La stima AI compare solo se il server ha la chiave configurata.
  const { available: aiAvailable } = useAIAvailability();
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<Date>();
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);

  const handleSubmit = () => {
    if (!title || !dueDate) return;
    
    const sanitizedTitle = Sanitizer.taskTitle(title);
    const sanitizedDescription = Sanitizer.taskDescription(description);
    
    if (!sanitizedTitle) {
      return;
    }
    
    onCreateTask({
      title: sanitizedTitle,
      description: sanitizedDescription,
      assigneeId,
      priority,
      dueDate: dueDate.toISOString(),
    });
    
    setTitle('');
    setDescription('');
    setAssigneeId(null);
    setPriority('medium');
    setDueDate(undefined);
    setEstimatedDuration(null);
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
          <DialogTitle className="text-2xl">Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to your team's workflow. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add task details..."
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
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
            <Label htmlFor="assignee">Assign To</Label>
            <Select value={assigneeId || 'unassigned'} onValueChange={(value) => setAssigneeId(value === 'unassigned' ? null : value)}>
              <SelectTrigger id="assignee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title || !dueDate}>
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
