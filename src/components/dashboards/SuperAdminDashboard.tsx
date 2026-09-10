import { useMemo } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Task, Employee, Announcement, TaskNotification } from '@/lib/types';
import { Users, ChartBar, ListChecks, Buildings, Sparkle, CheckCircle, Warning, Plus, Megaphone, UsersThree, Robot, FolderOpen } from '@phosphor-icons/react';
import { TeamAnalytics, DepartmentAnalytics } from '@/components/AnalisiPigre';
import { AIInsights } from '@/components/AIInsights';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { eInRitardo } from '@/lib/scadenze';

interface SuperAdminDashboardProps {
  tasks: Task[];
  employees: Employee[];
  announcements: Announcement[];
  notifications: TaskNotification[];
  onNavigateToTasks: () => void;
  onNavigateToUsers: () => void;
  onNavigateToAnnouncements: () => void;
  onCreateTask?: () => void;
  onCreateAnnouncement?: () => void;
  onManageDepartments?: () => void;
  onOpenAIAssistant?: () => void;
  onAutoAssignTasks?: () => void;
}

export function SuperAdminDashboard({
  tasks,
  employees,
  announcements,
  notifications,
  onNavigateToTasks,
  onNavigateToUsers,
  onNavigateToAnnouncements,
  onCreateTask,
  onCreateAnnouncement,
  onManageDepartments,
  onOpenAIAssistant,
  onAutoAssignTasks,
}: SuperAdminDashboardProps) {
  const { t } = useTranslation();
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const overdue = tasks.filter(t => 
      eInRitardo(t)
    ).length;
    const unassigned = tasks.filter(t => !t.assigneeId).length;

    const activeEmployees = employees.filter(e => e.status === 'active').length;
    const inactiveEmployees = employees.filter(e => e.status === 'inactive').length;

    const departments = new Set(employees.flatMap(e => e.departments || [])).size;

    const activeAnnouncements = announcements.filter(a => {
      if (!a.expiresAt) return true;
      return new Date(a.expiresAt) > new Date();
    }).length;

    const unreadNotifications = notifications.filter(n => !n.read).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const avgTasksPerEmployee = activeEmployees > 0 
      ? Math.round(total / activeEmployees * 10) / 10 
      : 0;

    return {
      total,
      completed,
      inProgress,
      overdue,
      unassigned,
      activeEmployees,
      inactiveEmployees,
      departments,
      activeAnnouncements,
      unreadNotifications,
      completionRate,
      avgTasksPerEmployee,
    };
  }, [tasks, employees, announcements, notifications]);

  const departmentPerformance = useMemo(() => {
    const deptMap = new Map<string, { total: number; completed: number; overdue: number }>();

    tasks.forEach(task => {
      if (!task.assigneeId) return;
      const employee = employees.find(e => e.id === task.assigneeId);
      const departments = employee?.departments || [];
      
      departments.forEach(dept => {
        if (!deptMap.has(dept)) {
          deptMap.set(dept, { total: 0, completed: 0, overdue: 0 });
        }
        const stats = deptMap.get(dept)!;
        stats.total++;
        if (task.status === 'completed') stats.completed++;
        if (eInRitardo(task)) {
          stats.overdue++;
        }
      });
    });

    return Array.from(deptMap.entries())
      .map(([dept, stats]) => ({
        department: dept,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        total: stats.total,
        completed: stats.completed,
        overdue: stats.overdue,
      }))
      .sort((a, b) => b.completionRate - a.completionRate);
  }, [tasks, employees]);

  const topPerformers = useMemo(() => {
    const empMap = new Map<string, { completed: number; total: number }>();

    tasks.forEach(task => {
      if (!task.assigneeId) return;
      if (!empMap.has(task.assigneeId)) {
        empMap.set(task.assigneeId, { completed: 0, total: 0 });
      }
      const stats = empMap.get(task.assigneeId)!;
      stats.total++;
      if (task.status === 'completed') stats.completed++;
    });

    return Array.from(empMap.entries())
      .map(([empId, stats]) => {
        const employee = employees.find(e => e.id === empId);
        return {
          employee,
          completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
          completed: stats.completed,
          total: stats.total,
        };
      })
      .filter(item => item.employee && item.total > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);
  }, [tasks, employees]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('Super Admin Dashboard')}</h2>
        <p className="text-muted-foreground">{t('Complete system overview and analytics')}</p>
      </div>

      <Card className="p-6 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-primary/20">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkle className="w-5 h-5 text-primary" weight="fill" />{t('Quick Actions')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
          {onCreateAnnouncement && (
            <Button 
              onClick={onCreateAnnouncement} 
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <Megaphone className="w-6 h-6" weight="bold" />
              <span className="text-sm font-medium">{t('New Announcement')}</span>
            </Button>
          )}
          {onNavigateToUsers && (
            <Button 
              onClick={onNavigateToUsers} 
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <UsersThree className="w-6 h-6" weight="bold" />
              <span className="text-sm font-medium">{t('Manage Team')}</span>
            </Button>
          )}
          {onManageDepartments && (
            <Button 
              onClick={onManageDepartments} 
              className="h-auto flex-col gap-2 py-4"
              variant="outline"
            >
              <FolderOpen className="w-6 h-6" weight="bold" />
              <span className="text-sm font-medium">{t('Departments')}</span>
            </Button>
          )}
          {onAutoAssignTasks && (
            <Button 
              onClick={onAutoAssignTasks} 
              className="h-auto flex-col gap-2 py-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-300 hover:from-purple-500/20 hover:to-pink-500/20"
              variant="outline"
            >
              <Robot className="w-6 h-6 text-purple-600" weight="bold" />
              <span className="text-sm font-medium text-purple-900">{t('AI Auto-Assign')}</span>
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
              <div className="text-3xl font-bold text-blue-900">{stats.total}</div>
              <div className="text-sm text-blue-700">{t('Total Tasks')}</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-700">{t('{n}% complete', { n: stats.completionRate })}</span>
            <Button variant="ghost" size="sm" onClick={onNavigateToTasks} className="h-7 px-2 text-blue-700 hover:text-blue-900 hover:bg-blue-200">{t('View All')}</Button>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-green-500 rounded-lg">
              <Users className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-900">{stats.activeEmployees}</div>
              <div className="text-sm text-green-700">{t('Active Users')}</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-700">{t('{n} tasks/user', { n: stats.avgTasksPerEmployee })}</span>
            <Button variant="ghost" size="sm" onClick={onNavigateToUsers} className="h-7 px-2 text-green-700 hover:text-green-900 hover:bg-green-200">{t('Manage')}</Button>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-purple-500 rounded-lg">
              <Buildings className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-purple-900">{stats.departments}</div>
              <div className="text-sm text-purple-700">{t('Departments')}</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-700">{t('{n} announcements', { n: stats.activeAnnouncements })}</span>
            <Button variant="ghost" size="sm" onClick={onNavigateToAnnouncements} className="h-7 px-2 text-purple-700 hover:text-purple-900 hover:bg-purple-200">{t('View')}</Button>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-orange-500 rounded-lg">
              <Warning className="w-6 h-6 text-white" weight="bold" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-900">{stats.overdue}</div>
              <div className="text-sm text-orange-700">{t('Overdue Tasks')}</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-orange-700">{t('{n} unassigned', { n: stats.unassigned })}</span>
            <Button variant="ghost" size="sm" onClick={onNavigateToTasks} className="h-7 px-2 text-orange-700 hover:text-orange-900 hover:bg-orange-200">{t('Review')}</Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ChartBar className="w-5 h-5" weight="bold" />{t('Department Performance')}</h3>
          {departmentPerformance.length > 0 ? (
            <div className="space-y-4">
              {departmentPerformance.map(dept => (
                <div key={dept.department}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{dept.department}</span>
                    <span className="text-sm text-muted-foreground">
                      {dept.completed}/{dept.total} tasks
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${dept.completionRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{dept.completionRate}%</span>
                  </div>
                  {dept.overdue > 0 && (
                    <div className="mt-1 text-xs text-destructive flex items-center gap-1">
                      <Warning className="w-3 h-3" weight="bold" />
                      {dept.overdue} overdue
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t('No department data available')}</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkle className="w-5 h-5 text-yellow-500" weight="fill" />{t('Top Performers')}</h3>
          {topPerformers.length > 0 ? (
            <div className="space-y-4">
              {topPerformers.map((item, index) => (
                <div key={item.employee?.id} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {index + 1}
                  </div>
                  <img 
                    src={item.employee?.avatar} 
                    alt={item.employee?.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.employee?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.completed} completed • {item.completionRate}% rate
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-600" weight="fill" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t('No performance data available')}</p>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <AIInsights tasks={tasks} employees={employees} />
      </Card>

      <Card className="p-6">
        <Tabs defaultValue="team" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="team">
              <Users className="w-4 h-4 mr-2" />{t('Team Analytics')}</TabsTrigger>
            <TabsTrigger value="departments">
              <Buildings className="w-4 h-4 mr-2" />{t('Department Analytics')}</TabsTrigger>
          </TabsList>
          <TabsContent value="team">
            <TeamAnalytics tasks={tasks} employees={employees} />
          </TabsContent>
          <TabsContent value="departments">
            <DepartmentAnalytics tasks={tasks} employees={employees} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
