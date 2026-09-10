import { Card } from '@/components/ui/card';
import { useTranslation } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { coloreEtichetta } from '@/lib/etichette';
import { avanzamento } from '@/lib/sottoattivita';
import { StatoBlocco } from '@/components/StatoBlocco';
import { StatoApprovazione } from '@/components/StatoApprovazione';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash, Clock, Circle, CircleHalf, CheckCircle, PencilSimple, ChatCircle, Eye, Paperclip, Warning, Prohibit, ListChecks } from '@phosphor-icons/react';
import { Task, Employee, TaskStatus, TaskPriority } from '@/lib/types';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { eInRitardo, scadenzaFormattata } from '@/lib/scadenze';

/*
  Tabelle costanti: stanno fuori dal componente perche' non dipendono da
  nessuna prop. Dentro venivano ricostruite a ogni render di ogni scheda —
  tre oggetti per riga, moltiplicati per le migliaia di righe dell'elenco.
*/
const priorityColors: Record<TaskPriority, string> = {
  high: 'bg-accent text-accent-foreground',
  medium: 'bg-amber-500 text-white',
  low: 'bg-slate-400 text-white'
};

const statusIcons: Record<TaskStatus, typeof Circle> = {
  'not-started': Circle,
  'in-progress': CircleHalf,
  blocked: Prohibit,
  'completed': CheckCircle
};

const borderColors: Record<TaskPriority, string> = {
  high: 'border-l-accent',
  medium: 'border-l-amber-500',
  low: 'border-l-slate-400'
};

interface TaskCardProps {
  task: Task;
  /**
   * Tutti i task, solo per dire se questo e' bloccato.
   *
   * Arriva gia' memoizzato da App: la scheda e' memoizzata a sua volta, e un
   * `tasks || []` ricreato a ogni render la farebbe ridisegnare tutta.
   */
  tuttiITask?: Task[];
  /**
   * L'assegnatario GIA' risolto dal chiamante.
   *
   * Prima la scheda faceva `employees.find(...)` da sola: con trenta persone
   * e qualche migliaio di task erano decine di migliaia di confronti a ogni
   * render dell'elenco. Chi possiede la lista puo' risolverlo in O(1) con una
   * mappa costruita una volta sola, quindi il lavoro si sposta li'.
   */
  assignee: Employee | null;
  /**
   * Serve ancora, ma solo per il menu a tendina "assegna a": e' l'elenco
   * completo delle persone selezionabili, che la scheda non puo' dedurre
   * dall'assegnatario. Perche' non annulli il memo deve essere un riferimento
   * stabile (in App e' memoizzato), non un `employees || []` ricreato a ogni
   * render.
   */
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

function TaskCardBase({ task, assignee, employees, tuttiITask = [], onStatusChange, onAssigneeChange, onDelete, onEdit, onViewDetails, bulkMode = false, isSelected = false, onToggleSelect }: TaskCardProps) {
  const { t, lingua } = useTranslation();
  const isOverdue = eInRitardo(task);

  const StatusIcon = statusIcons[task.status];
  const avanzamentoPassi = avanzamento(task.subtasks ?? []);

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
              {/* Ritorna null da solo quando non c'e' niente da dire. */}
              <StatoApprovazione task={task} employees={employees} size="sm" />
              {assignee?.department && (
                <DepartmentBadge 
                  departmentName={assignee.department} 
                  size="sm"
                  variant="default"
                />
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>

            {/*
              Le etichette stanno fra la descrizione e i dati operativi: sono
              un modo di raggruppare il lavoro, non un dato del singolo task.
              Oltre la quarta si conta e basta — una scheda non deve diventare
              piu' alta della sua descrizione.
            */}
            {task.labels && task.labels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                {task.labels.slice(0, 4).map((etichetta) => (
                  <span
                    key={etichetta}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] leading-tight',
                      coloreEtichetta(etichetta)
                    )}
                  >
                    {etichetta}
                  </span>
                ))}
                {task.labels.length > 4 && (
                  <span className="text-[11px] text-muted-foreground">
                    +{task.labels.length - 4}
                  </span>
                )}
              </div>
            )}
            
            {/* Perche' non si puo' andare avanti: qui e' informazione, non azione. */}
            <StatoBlocco task={task} tuttiITask={tuttiITask} compatto className="mb-3" />

            {/*
              L'avanzamento dei passi in una riga sola: su una scheda d'elenco
              serve sapere QUANTO manca, non quali passi siano. Chi vuole i
              passi apre il dettaglio.
            */}
            {avanzamentoPassi.totale > 0 && (
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                <ListChecks weight="bold" className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {t('{done} of {total} done', {
                    done: avanzamentoPassi.fatte,
                    total: avanzamentoPassi.totale,
                  })}
                </span>
                <div className="h-1.5 flex-1 max-w-[120px] overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${avanzamentoPassi.percentuale ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock weight="bold" className="w-4 h-4" />
                <span className={cn(isOverdue && 'text-destructive font-medium')}>
                  {/*
                    Era fisso su 'en-US': in tutte e cinque le lingue usciva
                    "Mar 3, 2026". I codici di LINGUE (it/en/fr/de/es) sono gia'
                    tag BCP-47 validi, quindi bastano cosi' come sono.
                  */}
                  {scadenzaFormattata(task, lingua) ?? t('No due date')}
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
                  <SelectItem value="blocked">
                    <div className="flex items-center gap-2">
                      <Prohibit weight="fill" className="w-4 h-4" />{t('Blocked')}</div>
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

/**
 * Memoizzata: l'elenco ne rende una per task, e senza memo bastava un
 * qualunque cambiamento di stato in App (aprire un filtro, spuntare una
 * casella in selezione multipla) per ridisegnarle tutte — ognuna e' un
 * `motion.div` con due Select, un Avatar e una Checkbox di Radix, cioe'
 * quindici-venti nodi DOM e un contesto ciascuna.
 *
 * Il memo funziona solo se le prop mantengono l'identita': i sei handler
 * arrivano da `useCallback` e `employees` da un `useMemo`, in App. Il
 * confronto predefinito (superficiale) basta: `task` cambia identita' solo
 * quando cambia davvero, perche' i riduttori in App riscrivono l'oggetto del
 * solo task toccato.
 */
export const TaskCard = memo(TaskCardBase);
