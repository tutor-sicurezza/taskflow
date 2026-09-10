import { useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Task, Employee } from '@/lib/types';
import { ListChecks, CheckCircle, Clock, Warning, CalendarBlank, TrendUp, Eye, ClockCounterClockwise, ArrowRight } from '@phosphor-icons/react';
import { Progress } from '@/components/ui/progress';

interface UserDashboardProps {
  tasks: Task[];
  employees: Employee[];
  currentEmployee: Employee;
  onNavigateToTasks: () => void;
  onViewTaskDetails: (taskId: string) => void;
  onStartTask?: (taskId: string) => void;
  onViewAllTasks?: () => void;
}

export function UserDashboard({
  tasks,
  employees,
  currentEmployee,
  onNavigateToTasks,
  onViewTaskDetails,
  onStartTask,
  onViewAllTasks,
}: UserDashboardProps) {
  const { t } = useTranslation();
  const myTasks = useMemo(() => {
    return tasks.filter(task => task.assigneeId === currentEmployee.id);
  }, [tasks, currentEmployee.id]);

  const taskStats = useMemo(() => {
    const total = myTasks.length;
    const completed = myTasks.filter(t => t.status === 'completed').length;
    const inProgress = myTasks.filter(t => t.status === 'in-progress').length;
    const notStarted = myTasks.filter(t => t.status === 'not-started').length;
    const overdue = myTasks.filter(t => 
      new Date(t.dueDate) < new Date() && t.status !== 'completed'
    ).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, notStarted, overdue, completionRate };
  }, [myTasks]);

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    return myTasks
      .filter(task => {
        const dueDate = new Date(task.dueDate);
        return task.status !== 'completed' && dueDate >= now && dueDate <= threeDaysFromNow;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [myTasks]);

  const recentActivity = useMemo(() => {
    return myTasks
      .filter(task => task.activities && task.activities.length > 0)
      .flatMap(task => 
        (task.activities || []).map(activity => ({
          ...activity,
          taskTitle: task.title,
          taskId: task.id,
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [myTasks]);

  const priorityBreakdown = useMemo(() => {
    const activeTasks = myTasks.filter(t => t.status !== 'completed');
    const high = activeTasks.filter(t => t.priority === 'high').length;
    const medium = activeTasks.filter(t => t.priority === 'medium').length;
    const low = activeTasks.filter(t => t.priority === 'low').length;
    
    return { high, medium, low };
  }, [myTasks]);

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else if (diffHours === 0) {
      return 'today';
    } else if (diffDays === -1) {
      return 'yesterday';
    } else {
      return `${Math.abs(diffDays)} days ago`;
    }
  };

  const getActivityText = (activity: any) => {
    switch (activity.type) {
      case 'created':
        return 'Task created';
      case 'status_changed':
        return `Status changed to ${activity.newValue}`;
      case 'priority_changed':
        return `Priority changed to ${activity.newValue}`;
      case 'assignee_changed':
        return `Assigned to ${activity.newValue}`;
      case 'comment_added':
        return 'New comment added';
      default:
        return 'Task updated';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('My Dashboard')}</h2>
        <p className="text-muted-foreground">
          Welcome back, {currentEmployee.name}!
        </p>
      </div>

      <Card className="p-6 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-primary/20">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-primary" weight="bold" />{t('Quick Actions')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {onViewAllTasks && (
            <Button 
              onClick={onViewAllTasks} 
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <Eye className="w-6 h-6" weight="bold" />
              <span className="text-sm font-medium">{t('View My Tasks')}</span>
            </Button>
          )}
          {taskStats.overdue > 0 && (
            <Button 
              onClick={onNavigateToTasks} 
              className="h-auto flex-col gap-2 py-4 bg-red-50 border-red-200 hover:bg-red-100"
              variant="outline"
            >
              <Warning className="w-6 h-6 text-destructive" weight="bold" />
              <span className="text-sm font-medium text-destructive">{taskStats.overdue} Overdue</span>
            </Button>
          )}
          {taskStats.inProgress > 0 && (
            <Button 
              onClick={onNavigateToTasks} 
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <ClockCounterClockwise className="w-6 h-6" weight="bold" />
              <span className="text-sm font-medium">{taskStats.inProgress} In Progress</span>
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-blue-500 rounded-lg">
              <ListChecks className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-900">{taskStats.total}</div>
              <div className="text-sm text-blue-700">{t('My Tasks')}</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-700">{t('{n}% complete', { n: taskStats.completionRate })}</span>
            <Button variant="ghost" size="sm" onClick={onNavigateToTasks} className="h-7 px-2 text-blue-700 hover:text-blue-900 hover:bg-blue-200">{t('View All')}</Button>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-green-500 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-900">{taskStats.completed}</div>
              <div className="text-sm text-green-700">{t('Completed')}</div>
            </div>
          </div>
          <Progress value={taskStats.completionRate} className="h-2" />
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-amber-500 rounded-lg">
              <Clock className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-amber-900">{taskStats.inProgress}</div>
              <div className="text-sm text-amber-700">{t('In Progress')}</div>
            </div>
          </div>
          <div className="text-xs text-amber-700">{taskStats.notStarted} not started</div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-red-500 rounded-lg">
              <Warning className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-red-900">{taskStats.overdue}</div>
              <div className="text-sm text-red-700">{t('Overdue')}</div>
            </div>
          </div>
          {taskStats.overdue > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onNavigateToTasks} 
              className="h-7 px-2 text-red-700 hover:text-red-900 hover:bg-red-200 w-full"
            >{t('View Overdue')}</Button>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CalendarBlank className="w-5 h-5" weight="bold" />{t('Upcoming Deadlines')}</h3>
          {upcomingTasks.length > 0 ? (
            <div className="space-y-3">
              {upcomingTasks.map(task => {
                const dueDate = new Date(task.dueDate);
                const isUrgent = (dueDate.getTime() - new Date().getTime()) < 24 * 60 * 60 * 1000;
                
                return (
                  // Era un <div onClick>: da tastiera "Scadenze imminenti" non
                  // si raggiungeva affatto e non esisteva un percorso alternativo
                  // verso il dettaglio del task. role+tabIndex+onKeyDown la
                  // rendono un pulsante a tutti gli effetti.
                  <div
                    key={task.id}
                    className="p-3 bg-muted rounded-lg hover:bg-muted/80 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    role="button"
                    tabIndex={0}
                    onClick={() => onViewTaskDetails(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        // Senza preventDefault lo spazio scorrerebbe la pagina.
                        e.preventDefault();
                        onViewTaskDetails(task.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{task.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            task.priority === 'high' 
                              ? 'bg-destructive/10 text-destructive' 
                              : task.priority === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {task.priority}
                          </span>
                          <span className={`text-xs ${isUrgent ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                            Due {formatRelativeTime(task.dueDate)}
                          </span>
                        </div>
                      </div>
                      {isUrgent && <Warning className="w-5 h-5 text-destructive flex-shrink-0" weight="bold" />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t('No upcoming deadlines in the next 3 days')}</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendUp className="w-5 h-5" weight="bold" />{t('Priority Breakdown')}</h3>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-destructive">{t('High Priority')}</span>
                <span className="text-2xl font-bold text-destructive">{priorityBreakdown.high}</span>
              </div>
              <Progress 
                value={taskStats.total > 0 ? (priorityBreakdown.high / (taskStats.total - taskStats.completed)) * 100 : 0} 
                className="h-2 bg-red-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-amber-600">{t('Medium Priority')}</span>
                <span className="text-2xl font-bold text-amber-600">{priorityBreakdown.medium}</span>
              </div>
              <Progress 
                value={taskStats.total > 0 ? (priorityBreakdown.medium / (taskStats.total - taskStats.completed)) * 100 : 0} 
                className="h-2 bg-amber-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-blue-600">{t('Low Priority')}</span>
                <span className="text-2xl font-bold text-blue-600">{priorityBreakdown.low}</span>
              </div>
              <Progress 
                value={taskStats.total > 0 ? (priorityBreakdown.low / (taskStats.total - taskStats.completed)) * 100 : 0} 
                className="h-2 bg-blue-100"
              />
            </div>
          </div>
        </Card>
      </div>

      {recentActivity.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('Recent Activity')}</h3>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              // Stesso problema di "Scadenze imminenti": riga cliccabile solo
              // col mouse. Vedi il commento piu' sopra.
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                role="button"
                tabIndex={0}
                onClick={() => onViewTaskDetails(activity.taskId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onViewTaskDetails(activity.taskId);
                  }
                }}
              >
                <img 
                  src={activity.userAvatar} 
                  alt={activity.userName}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{activity.userName}</span>
                    {' '}
                    <span className="text-muted-foreground">{getActivityText(activity)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {activity.taskTitle}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex-shrink-0">
                  {formatRelativeTime(activity.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
