import { Card } from '@/components/ui/card';
import { useTranslation } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash, Clock, Circle, CircleHalf, CheckCircle, PencilSimple, ChatCircle, Eye, Paperclip, Warning } from '@phosphor-icons/react';
import { Task, Employee, TaskStatus, TaskPriority } from '@/lib/types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DepartmentBadge } from '@/components/DepartmentBadge';

interface TaskCardProps {
  task: Task;
  employees: Employee[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onAssigneeChange: (taskId: string, assigneeId: string | null) => void;
  onDelete: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onViewDetails: (taskId: string) => void;
  bulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
}

export function TaskCard({ task, employees, onStatusChange, onAssigneeChange, onDelete, onEdit, onViewDetails, bulkMode = false, isSelected = false, onToggleSelect }: TaskCardProps) {
  const { t, lingua } = useTranslation();
  const assignee = employees.find(e => e.id === task.assigneeId);
  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'completed';
  
  const priorityColors: Record<TaskPriority, string> = {
    high: 'bg-accent text-accent-foreground',
    medium: 'bg-amber-500 text-white',
    low: 'bg-slate-400 text-white'
  };
  
  const statusIcons = {
    'not-started': Circle,
    'in-progress': CircleHalf,
    'completed': CheckCircle
  };
  
  const StatusIcon = statusIcons[task.status];
  
  const borderColors: Record<TaskPriority, string> = {
    high: 'border-l-accent',
    medium: 'border-l-amber-500',
    low: 'border-l-slate-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn(
        'p-4 border-l-4 transition-all duration-200',
        borderColors[task.priority],
        isOverdue && 'task-card-overdue border-destructive',
        'hover:shadow-lg',
        isSelected && 'ring-2 ring-primary bg-primary/5'
      )}>
        <div className="flex items-start justify-between gap-3">
          {bulkMode && (
            <div className="pt-1">
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.(task.id)}
                className="h-5 w-5"
                // Senza etichetta il lettore di schermo annuncia solo "casella":
                // il titolo del task e' l'unica cosa che la rende distinguibile.
                aria-label={t('Select task')}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="font-medium text-base truncate">{task.title}</h3>
              <Badge variant="secondary" className={cn('text-xs', priorityColors[task.priority])}>
                {task.priority.toUpperCase()}
              </Badge>
              {assignee?.department && (
                <DepartmentBadge 
                  departmentName={assignee.department} 
                  size="sm"
                  variant="default"
                />
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
            
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock weight="bold" className="w-4 h-4" />
                <span className={cn(isOverdue && 'text-destructive font-medium')}>
                  {/*
                    Era fisso su 'en-US': in tutte e cinque le lingue usciva
                    "Mar 3, 2026". I codici di LINGUE (it/en/fr/de/es) sono gia'
                    tag BCP-47 validi, quindi bastano cosi' come sono.
                  */}
                  {new Date(task.dueDate).toLocaleDateString(lingua, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {/*
                  Il ritardo era comunicato dal solo rosso: con una deuteranopia
                  non si distingue da una data normale, e un lettore di schermo
                  non legge affatto il colore. L'icona da' il segnale visivo non
                  cromatico, lo sr-only quello sonoro.
                */}
                {isOverdue && (
                  <span className="flex items-center gap-1 text-destructive font-medium">
                    <Warning weight="fill" className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">{t('Overdue')}</span>
                  </span>
                )}
              </div>
              
              <Select value={task.status} onValueChange={(value) => onStatusChange(task.id, value as TaskStatus)}>
                {/*
                  w-[140px] fisso tagliava a meta' "In Bearbeitung" in tedesco.
                  Larghezza piena sul telefono, 180px da sm in su, e min-w-0 per
                  evitare che il contenuto del flex la faccia debordare.
                */}
                <SelectTrigger className="w-full sm:w-[180px] min-w-0 h-7 text-xs" aria-label={t('Status')}>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon weight="fill" className="w-3.5 h-3.5" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not-started">
                    <div className="flex items-center gap-2">
                      <Circle weight="fill" className="w-4 h-4" />{t('Not Started')}</div>
                  </SelectItem>
                  <SelectItem value="in-progress">
                    <div className="flex items-center gap-2">
                      <CircleHalf weight="fill" className="w-4 h-4" />{t('In Progress')}</div>
                  </SelectItem>
                  <SelectItem value="completed">
                    <div className="flex items-center gap-2">
                      <CheckCircle weight="fill" className="w-4 h-4" />{t('Completed')}</div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={task.assigneeId || 'unassigned'} onValueChange={(value) => onAssigneeChange(task.id, value === 'unassigned' ? null : value)}>
                {/* Stessa ragione: "Nicht zugewiesen" non ci stava in 160px. */}
                <SelectTrigger className="w-full sm:w-[180px] min-w-0 h-7 text-xs" aria-label={t('Assignee')}>
                  <SelectValue>
                    {assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={assignee.avatar} alt={assignee.name} />
                          <AvatarFallback className="text-[10px]">{assignee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{assignee.name}</span>
                      </div>
                    ) : (
                      t('Unassigned')
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{t('Unassigned')}</SelectItem>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={employee.avatar} alt={employee.name} />
                          <AvatarFallback className="text-xs">{employee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start gap-0.5">
                          <span>{employee.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{employee.role}</span>
                            {employee.department && (
                              <>
                                <span className="text-[10px] text-muted-foreground">•</span>
                                <DepartmentBadge 
                                  departmentName={employee.department} 
                                  size="sm"
                                  showLabel={false}
                                  className="scale-75"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(task.comments && task.comments.length > 0) && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ChatCircle weight="fill" className="w-3.5 h-3.5" />
                  <span>{task.comments.length}</span>
                </div>
              )}

              {(task.attachments?.length ?? task.attachmentsCount ?? 0) > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Paperclip weight="fill" className="w-3.5 h-3.5" />
                  {/*
                    Il numero viene dalla colonna calcolata quando gli allegati
                    non sono stati caricati: la lista non li scarica, e senza
                    questo la graffetta sarebbe sparita.
                  */}
                  <span>{task.attachments?.length ?? task.attachmentsCount}</span>
                </div>
              )}
            </div>
          </div>
          
          {/*
            Tre bersagli da 32px a 4px di distanza, e il terzo cancella il task:
            un pollice impreciso cancellava mentre voleva modificare. h-10 sul
            touch con gap-2, compatti da sm in su dove si punta col mouse.
            Ogni pulsante ha solo un'icona, quindi senza aria-label un lettore di
            schermo annunciava "pulsante, pulsante, pulsante"; `title` da solo
            non basta perche' su mobile viene spesso ignorato.
          */}
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8 text-accent hover:text-accent hover:bg-accent/10"
              onClick={() => onViewDetails(task.id)}
              title={t('View details & comments')}
              aria-label={t('View details & comments')}
            >
              <Eye className="w-4 h-4" weight="bold" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8 text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => onEdit(task.id)}
              aria-label={t('Edit task')}
            >
              <PencilSimple className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(task.id)}
              aria-label={t('Delete task')}
            >
              <Trash className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
