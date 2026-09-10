import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendario } from '@/components/CalendarioPigro';
import { SelettoreRicorrenza } from '@/components/SelettoreRicorrenza';
import { SelettoreEtichette } from '@/components/SelettoreEtichette';
import { SelettoreOsservatori } from '@/components/SelettoreOsservatori';
import { etichetteUsate } from '@/lib/etichette';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { CalendarBlank } from '@phosphor-icons/react';
import { useState, useMemo } from 'react';
import { Employee, Task, TaskPriority, RegolaRicorrenza } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AITaskEstimator } from '@/components/AITaskEstimator';
import { useAIAvailability } from '@/lib/ai';
import { Sanitizer } from '@/lib/sanitization';
import { toast } from 'sonner';

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
    dueDate: string | null;
    recurrence: RegolaRicorrenza | null;
    labels: string[];
    watchers: string[];
  }) => void;
}

export function CreateTaskDialog({ open, onOpenChange, employees, tasks = [], onCreateTask }: CreateTaskDialogProps) {
  const { t, lingua } = useTranslation();
  const [ricorrenza, setRicorrenza] = useState<RegolaRicorrenza | null>(null);
  const [etichette, setEtichette] = useState<string[]>([]);
  const [osservatori, setOsservatori] = useState<string[]>([]);

  /*
    Le etichette gia' in uso arrivano dai task esistenti: e' l'unico modo per
    suggerire invece di far inventare, che e' cio' che evita trenta varianti
    della stessa etichetta nel giro di un mese.
  */
  const etichetteEsistenti = useMemo(
    () => etichetteUsate(tasks).map((e) => e.etichetta),
    [tasks]
  );
  const [title, setTitle] = useState('');
  // La stima AI compare solo se il server ha la chiave configurata.
  const { available: aiAvailable } = useAIAvailability();
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<Date>();
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);

  const handleSubmit = () => {
    // `!title` e' falso per una stringa di soli spazi: senza trim si creava un
    // task con la riga del titolo vuota.
    // La scadenza NON e' piu' obbligatoria: chi non ne ha una vera se la
    // inventava, e quella data finta faceva poi scattare promemoria e conteggi
    // "in ritardo" su lavori che in ritardo non erano.
    if (!title.trim()) {
      toast.error(t('Please enter a task title'));
      return;
    }

    const sanitizedTitle = Sanitizer.taskTitle(title.trim());
    const sanitizedDescription = Sanitizer.taskDescription(description);

    // Un titolo fatto solo di markup si riduce a stringa vuota: prima si
    // usciva in silenzio, quindi il pulsante "Crea" sembrava rotto per sempre.
    if (!sanitizedTitle) {
      toast.error(t('Please enter a task title'));
      return;
    }
    
    onCreateTask({
      title: sanitizedTitle,
      description: sanitizedDescription,
      assigneeId,
      priority,
      dueDate: dueDate ? dueDate.toISOString() : null,
      recurrence: ricorrenza,
      labels: etichette,
      watchers: osservatori,
    });
    
    setTitle('');
    setRicorrenza(null);
    setEtichette([]);
    setOsservatori([]);
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
          <DialogTitle className="text-2xl">{t('Create New Task')}</DialogTitle>
          <DialogDescription>{t("Add a new task to your team's workflow. Fill in the details below.")}</DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('Enter task title...')}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="description">{t('Description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('Add task details...')}
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="priority">{t('Priority')}</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger id="priority">
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
              <Label>{t('Due Date')}</Label>
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
                    {dueDate ? dueDate.toLocaleDateString(lingua) : t('No due date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendario
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <SelettoreEtichette
              value={etichette}
              onChange={setEtichette}
              esistenti={etichetteEsistenti}
            />

            <SelettoreOsservatori
              value={osservatori}
              onChange={setOsservatori}
              employees={employees}
              assigneeId={assigneeId}
            />

            <SelettoreRicorrenza value={ricorrenza} onChange={setRicorrenza} />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="assignee">{t('Assign To')}</Label>
            <Select value={assigneeId || 'unassigned'} onValueChange={(value) => setAssigneeId(value === 'unassigned' ? null : value)}>
              <SelectTrigger id="assignee">
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>{t('Create Task')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
