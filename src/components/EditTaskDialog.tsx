import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendario } from '@/components/CalendarioPigro';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { CalendarBlank } from '@phosphor-icons/react';
import { useState, useEffect, useMemo } from 'react';
import { Employee, Task, TaskPriority } from '@/lib/types';
import { SelettoreEtichette } from '@/components/SelettoreEtichette';
import { SelettoreOsservatori } from '@/components/SelettoreOsservatori';
import { CampiTempo } from '@/components/CampiTempo';
import { SelettoreDipendenze } from '@/components/SelettoreDipendenze';
import { etichetteUsate } from '@/lib/etichette';
import { cn } from '@/lib/utils';
import { AITaskEstimator } from '@/components/AITaskEstimator';
import { useAIAvailability } from '@/lib/ai';
import { Sanitizer } from '@/lib/sanitization';
import { toast } from 'sonner';
import { dataScadenza } from '@/lib/scadenze';
import { inAttesaDiApprovazione } from '@/lib/approvazione';

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
    dueDate: string | null;
    labels: string[];
    watchers: string[];
    estimateMinutes: number | null;
    spentMinutes: number | null;
    requiresApproval: boolean;
    blockedBy: string[];
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
  const [etichette, setEtichette] = useState<string[]>([]);
  const [osservatori, setOsservatori] = useState<string[]>([]);
  const [stima, setStima] = useState<number | null>(null);
  const [impiegato, setImpiegato] = useState<number | null>(null);
  const [richiedeApprovazione, setRichiedeApprovazione] = useState(false);
  const [dipendenze, setDipendenze] = useState<string[]>([]);

  /*
    Su un task gia' in attesa la spunta si blocca.

    Toglierla lo chiuderebbe di fatto senza che nessuno lo guardi — cioe'
    esattamente la regola che il flusso esiste per imporre, aggirata da una
    casella. Chi ha il potere di sbloccarlo lo fa dal dettaglio, approvando o
    rimandando indietro: sono gesti che lasciano traccia, questo no.
  */
  const approvazioneBloccata = task ? inAttesaDiApprovazione(task) : false;

  // Le etichette da suggerire sono quelle gia' in uso negli altri task.
  const etichetteEsistenti = useMemo(
    () => etichetteUsate(tasks).map((e) => e.etichetta),
    [tasks]
  );

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssigneeId(task.assigneeId);
      setPriority(task.priority);
      // Un task senza scadenza apre il modulo con il campo vuoto, non con oggi.
      setDueDate(dataScadenza(task) ?? undefined);
      setEtichette(task.labels ?? []);
      setOsservatori(task.watchers ?? []);
      setStima(task.estimateMinutes ?? null);
      setImpiegato(task.spentMinutes ?? null);
      setRichiedeApprovazione(task.requiresApproval ?? false);
      setDipendenze(task.blockedBy ?? []);
    }
  }, [task]);

  const handleSubmit = () => {
    if (!task) return;

    // `!title` e' falso per una stringa di soli spazi: senza trim si salvava
    // un task con la riga del titolo vuota.
    if (!title.trim()) {
      toast.error(t('Please enter a task title'));
      return;
    }

    const sanitizedTitle = Sanitizer.taskTitle(title.trim());
    const sanitizedDescription = Sanitizer.taskDescription(description);

    // Un titolo fatto solo di markup si riduce a stringa vuota: prima si
    // usciva in silenzio, quindi il pulsante di salvataggio sembrava rotto.
    if (!sanitizedTitle) {
      toast.error(t('Please enter a task title'));
      return;
    }
    
    onEditTask(task.id, {
      title: sanitizedTitle,
      description: sanitizedDescription,
      assigneeId,
      priority,
      dueDate: dueDate ? dueDate.toISOString() : null,
      labels: etichette,
      watchers: osservatori,
      estimateMinutes: stima,
      spentMinutes: impiegato,
      requiresApproval: approvazioneBloccata ? (task.requiresApproval ?? false) : richiedeApprovazione,
      blockedBy: dipendenze,
    });
    
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssigneeId(task.assigneeId);
      setPriority(task.priority);
      setDueDate(dataScadenza(task) ?? undefined);
      setEstimatedDuration(null);
      setEtichette(task.labels ?? []);
      setOsservatori(task.watchers ?? []);
      setStima(task.estimateMinutes ?? null);
      setImpiegato(task.spentMinutes ?? null);
      setRichiedeApprovazione(task.requiresApproval ?? false);
      setDipendenze(task.blockedBy ?? []);
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
            <Label htmlFor="edit-title">{t('Task Title')} *</Label>
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
                  <SelectItem value="low">{t('Low')}</SelectItem>
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
                    {dueDate ? dueDate.toLocaleDateString() : t('No due date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendario
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                  {dueDate && (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setDueDate(undefined)}
                      >
                        {t('Remove due date')}
                      </Button>
                    </div>
                  )}
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

          {task && (
            <SelettoreDipendenze
              value={dipendenze}
              onChange={setDipendenze}
              taskCorrente={task}
              tuttiITask={tasks}
              employees={employees}
            />
          )}

          <CampiTempo
            stima={stima}
            impiegato={impiegato}
            onChangeStima={setStima}
            onChangeImpiegato={setImpiegato}
          />

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Switch
              id="edit-richiede-approvazione"
              checked={richiedeApprovazione}
              onCheckedChange={setRichiedeApprovazione}
              disabled={approvazioneBloccata}
            />
            <div className="grid gap-1">
              <Label htmlFor="edit-richiede-approvazione" className="cursor-pointer">
                {t('Require approval before this task can be closed')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {approvazioneBloccata
                  ? t('This task is waiting for approval: approve it or send it back to change this.')
                  : t('When the assignee marks it done, a manager has to approve it.')}
              </p>
            </div>
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
          <Button onClick={handleSubmit} disabled={!title.trim()}>{t('Save Changes')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
