import { useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Task, Employee } from '@/lib/types';
import { Users, ListChecks, CheckCircle, Clock, Warning, TrendUp, Plus, Eye, Sparkle, Megaphone } from '@phosphor-icons/react';
import { Progress } from '@/components/ui/progress';

interface DepartmentAdminDashboardProps {
  tasks: Task[];
  employees: Employee[];
  currentEmployee: Employee;
  onNavigateToTasks: () => void;
  onCreateTask?: () => void;
  onViewTasks?: () => void;
  onCreateAnnouncement?: () => void;
  onOpenAIAssistant?: () => void;
}

export function DepartmentAdminDashboard({
  tasks,
  employees,
  currentEmployee,
  onNavigateToTasks,
  onCreateTask,
  onViewTasks,
  onCreateAnnouncement,
  onOpenAIAssistant,
}: DepartmentAdminDashboardProps) {
  const { t } = useTranslation();
  const myDepartments = currentEmployee.departments || [];

  const departmentData = useMemo(() => {
    const deptTasks = tasks.filter(task => {
      if (!task.assigneeId) return false;
      const assignee = employees.find(e => e.id === task.assigneeId);
      return assignee?.departments?.some(d => myDepartments.includes(d));
    });

    const deptEmployees = employees.filter(emp => 
      emp.departments?.some(d => myDepartments.includes(d)) && emp.status === 'active'
    );

    const completed = deptTasks.filter(t => t.status === 'completed').length;
    const inProgress = deptTasks.filter(t => t.status === 'in-progress').length;
    const overdue = deptTasks.filter(t => 
      new Date(t.dueDate) < new Date() && t.status !== 'completed'
    ).length;
    const completionRate = deptTasks.length > 0 
      ? Math.round((completed / deptTasks.length) * 100) 
      : 0;

    return {
      tasks: deptTasks,
      totalTasks: deptTasks.length,
      completed,
      inProgress,
      overdue,
      employees: deptEmployees,
      completionRate,
    };
  }, [tasks, employees, myDepartments]);

  const teamMembers = useMemo(() => {
    return departmentData.employees.map(emp => {
      const empTasks = departmentData.tasks.filter(t => t.assigneeId === emp.id);
      const completedTasks = empTasks.filter(t => t.status === 'completed').length;
      const activeTasks = empTasks.filter(t => t.status !== 'completed').length;
      const overdueTasks = empTasks.filter(t => 
        new Date(t.dueDate) < new Date() && t.status !== 'completed'
      ).length;

      return {
        employee: emp,
        totalTasks: empTasks.length,
        completedTasks,
        activeTasks,
        overdueTasks,
        completionRate: empTasks.length > 0 
          ? Math.round((completedTasks / empTasks.length) * 100) 
          : 0,
      };
    }).sort((a, b) => b.completionRate - a.completionRate);
  }, [departmentData]);

  const priorityBreakdown = useMemo(() => {
    const high = departmentData.tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;
    const medium = departmentData.tasks.filter(t => t.priority === 'medium' && t.status !== 'completed').length;
    const low = departmentData.tasks.filter(t => t.priority === 'low' && t.status !== 'completed').length;
    
    return { high, medium, low };
  }, [departmentData.tasks]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('Department Admin Dashboard')}</h2>
        <p className="text-muted-foreground">
          Managing: {myDepartments.join(', ')}
        </p>
      </div>

      <Card className="p-6 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-primary/20">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkle className="w-5 h-5 text-primary" weight="fill" />{t('Quick Actions')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {onCreateTask && (
            <Button 
              onClick={onCreateTask} 
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <Plus className="w-6 h-6" weight="bold" />
              <span className="text-sm font-medium">{t('Create Task')}</span>
            </Button>
          )}
          {onViewTasks && (
            <Button 
              onClick={onViewTasks} 
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <Eye className="w-6 h-6" weight="bold" />
              <span className="text-sm font-medium">{t('View All Tasks')}</span>
            </Button>
          )}
          {onCreateAnnouncement && (
            <Button 
              onClick={onCreateAnnouncement} 
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <Megaphone className="w-6 h-6" weight="bold" />
              <span className="text-sm font-medium">{t('Announcement')}</span>
            </Button>
          )}
          {onOpenAIAssistant && (
            <Button 
              onClick={onOpenAIAssistant} 
              className="h-auto flex-col gap-2 py-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-300 hover:from-purple-500/20 hover:to-pink-500/20"
              variant="outline"
            >
              <Sparkle className="w-6 h-6 text-purple-600" weight="fill" />
              <span className="text-sm font-medium text-purple-900">{t('AI Assistant')}</span>
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
              <div className="text-3xl font-bold text-blue-900">{departmentData.totalTasks}</div>
              <div className="text-sm text-blue-700">{t('Department Tasks')}</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-700">{t('{n}% complete', { n: departmentData.completionRate })}</span>
            <Button variant="ghost" size="sm" onClick={onNavigateToTasks} className="h-7 px-2 text-blue-700 hover:text-blue-900 hover:bg-blue-200">{t('View All')}</Button>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-green-500 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-900">{departmentData.completed}</div>
              <div className="text-sm text-green-700">{t('Completed')}</div>
            </div>
          </div>
          <Progress value={departmentData.completionRate} className="h-2" />
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-amber-500 rounded-lg">
              <Clock className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-amber-900">{departmentData.inProgress}</div>
              <div className="text-sm text-amber-700">{t('In Progress')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-red-500 rounded-lg">
              <Warning className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-red-900">{departmentData.overdue}</div>
              <div className="text-sm text-red-700">{t('Overdue')}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" weight="bold" />{t('Team Performance')}</h3>
          <div className="space-y-4">
            {teamMembers.length > 0 ? (
              teamMembers.map(member => (
                <div key={member.employee.id} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <img 
                      src={member.employee.avatar} 
                      alt={member.employee.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{member.employee.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.activeTasks} active • {member.completedTasks} done
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{member.completionRate}%</div>
                      {member.overdueTasks > 0 && (
                        <div className="text-xs text-destructive flex items-center gap-1">
                          <Warning className="w-3 h-3" />
                          {member.overdueTasks}
                        </div>
                      )}
                    </div>
                  </div>
                  <Progress value={member.completionRate} className="h-2" />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">{t('No team members found')}</p>
            )}
          </div>
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
                value={departmentData.totalTasks > 0 ? (priorityBreakdown.high / departmentData.totalTasks) * 100 : 0} 
                className="h-2 bg-red-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-amber-600">{t('Medium Priority')}</span>
                <span className="text-2xl font-bold text-amber-600">{priorityBreakdown.medium}</span>
              </div>
              <Progress 
                value={departmentData.totalTasks > 0 ? (priorityBreakdown.medium / departmentData.totalTasks) * 100 : 0} 
                className="h-2 bg-amber-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-blue-600">{t('Low Priority')}</span>
                <span className="text-2xl font-bold text-blue-600">{priorityBreakdown.low}</span>
              </div>
              <Progress 
                value={departmentData.totalTasks > 0 ? (priorityBreakdown.low / departmentData.totalTasks) * 100 : 0} 
                className="h-2 bg-blue-100"
              />
            </div>

            {departmentData.totalTasks > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('Active Tasks')}</span>
                  <span className="text-lg font-semibold">
                    {priorityBreakdown.high + priorityBreakdown.medium + priorityBreakdown.low}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{t('Department Summary')}</h3>
            <p className="text-sm text-muted-foreground">{t('Quick insights for your departments')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">{t('Total Team Members')}</div>
            <div className="text-2xl font-bold">{departmentData.employees.length}</div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">{t('Avg Tasks per Member')}</div>
            <div className="text-2xl font-bold">
              {departmentData.employees.length > 0 
                ? Math.round((departmentData.totalTasks / departmentData.employees.length) * 10) / 10
                : 0
              }
            </div>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">{t('Department Health')}</div>
            <div className="text-2xl font-bold">
              {departmentData.completionRate >= 80 ? '🟢 Excellent' : 
               departmentData.completionRate >= 60 ? '🟡 Good' : 
               departmentData.completionRate >= 40 ? '🟠 Fair' : '🔴 Needs Attention'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
