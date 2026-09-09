import { Card } from '@/components/ui/card';
import { useTranslation } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash, Clock, Circle, CircleHalf, CheckCircle, PencilSimple, ChatCircle, Eye, Paperclip } from '@phosphor-icons/react';
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
  const { t } = useTranslation();
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
                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              
              <Select value={task.status} onValueChange={(value) => onStatusChange(task.id, value as TaskStatus)}>
                <SelectTrigger className="w-[140px] h-7 text-xs">
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
                <SelectTrigger className="w-[160px] h-7 text-xs">
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
                      'Unassigned'
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

              {(task.attachments && task.attachments.length > 0) && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Paperclip weight="fill" className="w-3.5 h-3.5" />
                  <span>{task.attachments.length}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-start gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-accent hover:text-accent hover:bg-accent/10"
              onClick={() => onViewDetails(task.id)}
              title={t('View details & comments')}
            >
              <Eye className="w-4 h-4" weight="bold" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => onEdit(task.id)}
            >
              <PencilSimple className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(task.id)}
            >
              <Trash className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
