import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Task, Employee } from '@/lib/types';
import { TrendUp, CheckCircle, Clock, Timer, Target, User, Calendar, Download, FileCsv, FilePdf } from '@phosphor-icons/react';
import { exportTeamAnalyticsToCSV, exportTeamAnalyticsToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, isAfter, isBefore, differenceInDays, parseISO } from 'date-fns';

interface TeamAnalyticsProps {
  tasks: Task[];
  employees: Employee[];
}

interface EmployeeStats {
  id: string;
  name: string;
  avatar: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  overdueTasks: number;
  completionRate: number;
  avgCompletionTime: number;
  highPriorityTasks: number;
}

export function TeamAnalytics({ tasks, employees }: TeamAnalyticsProps) {
  const analytics = useMemo(() => {
    const now = new Date();
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const notStartedTasks = tasks.filter(t => t.status === 'not-started').length;
    const overdueTasks = tasks.filter(t => 
      t.status !== 'completed' && isBefore(parseISO(t.dueDate), now)
    ).length;

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const completedTasksWithTime = tasks.filter(t => t.status === 'completed');
    const avgCompletionTime = completedTasksWithTime.length > 0
      ? completedTasksWithTime.reduce((sum, task) => {
          const created = parseISO(task.createdAt);
          const dueDate = parseISO(task.dueDate);
          return sum + differenceInDays(dueDate, created);
        }, 0) / completedTasksWithTime.length
      : 0;

    const priorityBreakdown = {
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
    };

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const completedOnDay = tasks.filter(t => {
        if (t.status !== 'completed') return false;
        const completionActivity = t.activities?.find(a => a.type === 'status_changed' && a.newValue === 'completed');
        if (!completionActivity) return false;
        const activityDate = parseISO(completionActivity.createdAt);
        return isAfter(activityDate, dayStart) && isBefore(activityDate, dayEnd);
      }).length;

      return {
        date: format(date, 'MMM dd'),
        completed: completedOnDay,
      };
    });

    const employeeStats: EmployeeStats[] = employees.map(emp => {
      const empTasks = tasks.filter(t => t.assigneeId === emp.id);
      const empCompleted = empTasks.filter(t => t.status === 'completed').length;
      const empInProgress = empTasks.filter(t => t.status === 'in-progress').length;
      const empNotStarted = empTasks.filter(t => t.status === 'not-started').length;
      const empOverdue = empTasks.filter(t => 
        t.status !== 'completed' && isBefore(parseISO(t.dueDate), now)
      ).length;

      const completionRate = empTasks.length > 0 ? (empCompleted / empTasks.length) * 100 : 0;

      const empCompletedWithTime = empTasks.filter(t => t.status === 'completed');
      const avgCompletionTime = empCompletedWithTime.length > 0
        ? empCompletedWithTime.reduce((sum, task) => {
            const created = parseISO(task.createdAt);
            const dueDate = parseISO(task.dueDate);
            return sum + differenceInDays(dueDate, created);
          }, 0) / empCompletedWithTime.length
        : 0;

      const highPriorityTasks = empTasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;

      return {
        id: emp.id,
        name: emp.name,
        avatar: emp.avatar,
        totalTasks: empTasks.length,
        completedTasks: empCompleted,
        inProgressTasks: empInProgress,
        notStartedTasks: empNotStarted,
        overdueTasks: empOverdue,
        completionRate,
        avgCompletionTime,
        highPriorityTasks,
      };
    });

    const workloadData = employeeStats.map(emp => ({
      name: emp.name,
      completed: emp.completedTasks,
      inProgress: emp.inProgressTasks,
      notStarted: emp.notStartedTasks,
    }));

    const statusDistribution = [
      { name: 'Completed', value: completedTasks, color: '#10b981' },
      { name: 'In Progress', value: inProgressTasks, color: '#3b82f6' },
      { name: 'Not Started', value: notStartedTasks, color: '#94a3b8' },
    ];

    const priorityData = [
      { name: 'High', value: priorityBreakdown.high, color: '#ef4444' },
      { name: 'Medium', value: priorityBreakdown.medium, color: '#f59e0b' },
      { name: 'Low', value: priorityBreakdown.low, color: '#6b7280' },
    ];

    const topPerformers = [...employeeStats]
      .filter(emp => emp.totalTasks > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);

    const needsAttention = [...employeeStats]
      .filter(emp => emp.overdueTasks > 0 || emp.highPriorityTasks > 0)
      .sort((a, b) => (b.overdueTasks + b.highPriorityTasks * 0.5) - (a.overdueTasks + a.highPriorityTasks * 0.5))
      .slice(0, 5);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      notStartedTasks,
      overdueTasks,
      completionRate,
      avgCompletionTime,
      priorityBreakdown,
      last7Days,
      employeeStats,
      workloadData,
      statusDistribution,
      priorityData,
      topPerformers,
      needsAttention,
    };
  }, [tasks, employees]);

  const handleExportCSV = () => {
    try {
      exportTeamAnalyticsToCSV({
        totalTasks: analytics.totalTasks,
        completedTasks: analytics.completedTasks,
        inProgressTasks: analytics.inProgressTasks,
        notStartedTasks: analytics.notStartedTasks,
        overdueTasks: analytics.overdueTasks,
        completionRate: analytics.completionRate,
        avgCompletionTime: analytics.avgCompletionTime,
        employeeStats: analytics.employeeStats,
        priorityBreakdown: analytics.priorityBreakdown,
      });
      toast.success('CSV report downloaded successfully!');
    } catch {
      toast.error('Failed to export CSV report');
    }
  };

  const handleExportPDF = () => {
    try {
      exportTeamAnalyticsToPDF({
        totalTasks: analytics.totalTasks,
        completedTasks: analytics.completedTasks,
        inProgressTasks: analytics.inProgressTasks,
        notStartedTasks: analytics.notStartedTasks,
        overdueTasks: analytics.overdueTasks,
        completionRate: analytics.completionRate,
        avgCompletionTime: analytics.avgCompletionTime,
        employeeStats: analytics.employeeStats,
        priorityBreakdown: analytics.priorityBreakdown,
      });
      toast.success('PDF report will open in print dialog');
    } catch {
      toast.error('Failed to export PDF report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team Performance Overview</h3>
          <p className="text-sm text-muted-foreground">Comprehensive analytics for your team</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" weight="bold" />
              Export Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCSV}>
              <FileCsv className="mr-2 h-4 w-4" weight="fill" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPDF}>
              <FilePdf className="mr-2 h-4 w-4" weight="fill" />
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {employees.length} team member{employees.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.completionRate.toFixed(1)}%</div>
            <Progress value={analytics.completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{analytics.inProgressTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.notStartedTasks} not started
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.overdueTasks > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {analytics.overdueTasks}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Task Status Distribution</CardTitle>
                <CardDescription>Current state of all tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Priority Distribution</CardTitle>
                <CardDescription>Tasks by priority level</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.priorityData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Workload Distribution</CardTitle>
              <CardDescription>Task breakdown by team member</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.workloadData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
                  <Bar dataKey="inProgress" stackId="a" fill="#3b82f6" name="In Progress" />
                  <Bar dataKey="notStarted" stackId="a" fill="#94a3b8" name="Not Started" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendUp className="h-5 w-5 text-green-600" />
                  Top Performers
                </CardTitle>
                <CardDescription>Highest completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topPerformers.length > 0 ? (
                    analytics.topPerformers.map((emp, idx) => (
                      <div key={emp.id} className="flex items-center gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-lg font-semibold text-muted-foreground w-6">
                            #{idx + 1}
                          </div>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={emp.avatar} alt={emp.name} />
                            <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="font-medium">{emp.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {emp.completedTasks} of {emp.totalTasks} tasks
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">
                              {emp.completionRate.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No task data available yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-destructive" />
                  Needs Attention
                </CardTitle>
                <CardDescription>Team members with overdue or high-priority tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.needsAttention.length > 0 ? (
                    analytics.needsAttention.map((emp) => (
                      <div key={emp.id} className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={emp.avatar} alt={emp.name} />
                          <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">{emp.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {emp.overdueTasks > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {emp.overdueTasks} overdue
                              </Badge>
                            )}
                            {emp.highPriorityTasks > 0 && (
                              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                {emp.highPriorityTasks} high priority
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      All caught up! 🎉
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Team Member Details</CardTitle>
              <CardDescription>Complete performance breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {analytics.employeeStats.map((emp) => (
                  <div key={emp.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={emp.avatar} alt={emp.name} />
                          <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-lg">{emp.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {emp.totalTasks} total task{emp.totalTasks !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {emp.totalTasks > 0 ? emp.completionRate.toFixed(0) : 0}%
                        </div>
                        <div className="text-xs text-muted-foreground">completion</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Completed</div>
                        <div className="text-xl font-semibold text-green-600">{emp.completedTasks}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">In Progress</div>
                        <div className="text-xl font-semibold text-primary">{emp.inProgressTasks}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Not Started</div>
                        <div className="text-xl font-semibold text-muted-foreground">{emp.notStartedTasks}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Overdue</div>
                        <div className={`text-xl font-semibold ${emp.overdueTasks > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {emp.overdueTasks}
                        </div>
                      </div>
                    </div>

                    <Progress value={emp.completionRate} className="h-2" />
                  </div>
                ))}
                {analytics.employeeStats.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No team members yet. Add team members to see analytics.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Task Completion Trend</CardTitle>
              <CardDescription>Tasks completed over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.last7Days}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="completed" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Completed Tasks"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg. Completion Time</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.avgCompletionTime.toFixed(1)} days
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From creation to completion
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">High Priority Tasks</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {analytics.priorityBreakdown.high}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Requiring immediate attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Team Members</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.employeeStats.filter(e => e.totalTasks > 0).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Out of {employees.length} total
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
