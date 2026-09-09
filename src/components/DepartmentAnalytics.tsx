import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Task, Employee } from '@/lib/types';
import { Buildings, Users, Clock, ChartBar, TrendUp, ListChecks, Download, FileCsv, FilePdf } from '@phosphor-icons/react';
import { DepartmentBadge } from '@/components/DepartmentBadge';
import { getDepartmentColor } from '@/lib/departments';
import { exportDepartmentAnalyticsToCSV, exportDepartmentAnalyticsToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { isBefore, parseISO } from 'date-fns';

interface DepartmentAnalyticsProps {
  tasks: Task[];
  employees: Employee[];
}

interface DepartmentStats {
  name: string;
  totalEmployees: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  overdueTasks: number;
  completionRate: number;
  avgTasksPerEmployee: number;
  highPriorityTasks: number;
  employees: Array<{
    id: string;
    name: string;
    avatar: string;
    taskCount: number;
  }>;
}

const COLORS = [
  'oklch(0.65 0.20 250)',
  'oklch(0.70 0.18 180)', 
  'oklch(0.68 0.19 140)',
  'oklch(0.72 0.16 40)',
  'oklch(0.67 0.21 320)',
  'oklch(0.69 0.17 80)',
  'oklch(0.66 0.22 290)',
  'oklch(0.71 0.15 200)',
];

export function DepartmentAnalytics({ tasks, employees }: DepartmentAnalyticsProps) {
  const analytics = useMemo(() => {
    const now = new Date();
    
    const departmentMap = new Map<string, DepartmentStats>();
    
    const allDepartments = new Set<string>();
    employees.forEach(emp => {
      if (emp.departments && emp.departments.length > 0) {
        emp.departments.forEach(dept => allDepartments.add(dept));
      } else if (emp.department) {
        allDepartments.add(emp.department);
      }
    });
    
    const departmentNames = Array.from(allDepartments).filter(Boolean);

    departmentNames.forEach(deptName => {
      const deptEmployees = employees.filter(emp => {
        const empDepts = emp.departments && emp.departments.length > 0 
          ? emp.departments 
          : emp.department 
            ? [emp.department] 
            : [];
        return empDepts.includes(deptName);
      });
      
      const deptEmployeeIds = new Set(deptEmployees.map(emp => emp.id));
      const deptTasks = tasks.filter(t => t.assigneeId && deptEmployeeIds.has(t.assigneeId));

      const completedTasks = deptTasks.filter(t => t.status === 'completed').length;
      const inProgressTasks = deptTasks.filter(t => t.status === 'in-progress').length;
      const notStartedTasks = deptTasks.filter(t => t.status === 'not-started').length;
      const overdueTasks = deptTasks.filter(t => 
        t.status !== 'completed' && isBefore(parseISO(t.dueDate), now)
      ).length;
      const highPriorityTasks = deptTasks.filter(t => 
        t.priority === 'high' && t.status !== 'completed'
      ).length;

      const completionRate = deptTasks.length > 0 
        ? (completedTasks / deptTasks.length) * 100 
        : 0;

      const avgTasksPerEmployee = deptEmployees.length > 0 
        ? deptTasks.length / deptEmployees.length 
        : 0;

      const employeeDetails = deptEmployees.map(emp => ({
        id: emp.id,
        name: emp.name,
        avatar: emp.avatar,
        taskCount: deptTasks.filter(t => t.assigneeId === emp.id).length,
      })).sort((a, b) => b.taskCount - a.taskCount);

      departmentMap.set(deptName, {
        name: deptName,
        totalEmployees: deptEmployees.length,
        totalTasks: deptTasks.length,
        completedTasks,
        inProgressTasks,
        notStartedTasks,
        overdueTasks,
        completionRate,
        avgTasksPerEmployee,
        highPriorityTasks,
        employees: employeeDetails,
      });
    });

    const departments = Array.from(departmentMap.values()).sort(
      (a, b) => b.totalTasks - a.totalTasks
    );

    const workloadByDept = departments.map(dept => ({
      name: dept.name,
      completed: dept.completedTasks,
      inProgress: dept.inProgressTasks,
      notStarted: dept.notStartedTasks,
      total: dept.totalTasks,
    }));

    const taskDistributionByDept = departments.map((dept) => ({
      name: dept.name,
      value: dept.totalTasks,
      color: getDepartmentColor(dept.name),
    }));

    const completionRateByDept = departments.map(dept => ({
      name: dept.name,
      rate: dept.completionRate,
    }));

    const employeeCountByDept = departments.map((dept) => ({
      name: dept.name,
      employees: dept.totalEmployees,
      color: getDepartmentColor(dept.name),
    }));

    const radarData = departments.map(dept => ({
      department: dept.name,
      completionRate: dept.completionRate,
      avgTasksPerEmp: Math.min(dept.avgTasksPerEmployee * 10, 100),
      efficiency: dept.overdueTasks === 0 ? 100 : Math.max(0, 100 - (dept.overdueTasks / dept.totalTasks) * 100),
    }));

    const busiestDepartments = [...departments]
      .filter(d => d.totalTasks > 0)
      .sort((a, b) => b.avgTasksPerEmployee - a.avgTasksPerEmployee)
      .slice(0, 5);

    const topPerformingDepartments = [...departments]
      .filter(d => d.totalTasks > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);

    const needsAttentionDepartments = [...departments]
      .filter(d => d.overdueTasks > 0 || d.highPriorityTasks > 0)
      .sort((a, b) => (b.overdueTasks + b.highPriorityTasks * 0.5) - (a.overdueTasks + a.highPriorityTasks * 0.5))
      .slice(0, 5);

    const totalDepartments = departments.length;
    const totalAssignedTasks = tasks.filter(t => t.assigneeId).length;
    const unassignedTasks = tasks.filter(t => !t.assigneeId).length;

    return {
      departments,
      workloadByDept,
      taskDistributionByDept,
      completionRateByDept,
      employeeCountByDept,
      radarData,
      busiestDepartments,
      topPerformingDepartments,
      needsAttentionDepartments,
      totalDepartments,
      totalAssignedTasks,
      unassignedTasks,
    };
  }, [tasks, employees]);

  const handleExportCSV = () => {
    try {
      exportDepartmentAnalyticsToCSV({
        departments: analytics.departments,
        totalDepartments: analytics.totalDepartments,
        totalAssignedTasks: analytics.totalAssignedTasks,
        unassignedTasks: analytics.unassignedTasks,
      });
      toast.success('CSV report downloaded successfully!');
    } catch {
      toast.error('Failed to export CSV report');
    }
  };

  const handleExportPDF = () => {
    try {
      exportDepartmentAnalyticsToPDF({
        departments: analytics.departments,
        totalDepartments: analytics.totalDepartments,
        totalAssignedTasks: analytics.totalAssignedTasks,
        unassignedTasks: analytics.unassignedTasks,
      });
      toast.success('PDF report will open in print dialog');
    } catch {
      toast.error('Failed to export PDF report');
    }
  };

  if (analytics.departments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Buildings className="w-16 h-16 mx-auto mb-4 text-muted-foreground" weight="light" />
            <h3 className="text-lg font-medium mb-2">No Department Data</h3>
            <p className="text-muted-foreground">
              Add departments to team members to see department analytics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Department Performance Overview</h3>
          <p className="text-sm text-muted-foreground">Analytics across all departments</p>
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
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Buildings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalDepartments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active departments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assigned Tasks</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalAssignedTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.unassignedTasks} unassigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Busiest Department</CardTitle>
            <ChartBar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {analytics.busiestDepartments[0]?.name || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.busiestDepartments[0]
                ? `${analytics.busiestDepartments[0].avgTasksPerEmployee.toFixed(1)} tasks/person`
                : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <TrendUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {analytics.topPerformingDepartments[0]?.name || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.topPerformingDepartments[0]
                ? `${analytics.topPerformingDepartments[0].completionRate.toFixed(0)}% completion`
                : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workload by Department</CardTitle>
            <CardDescription>Task status distribution across departments</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.workloadByDept}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
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

        <Card>
          <CardHeader>
            <CardTitle>Task Distribution by Department</CardTitle>
            <CardDescription>Total tasks per department</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.taskDistributionByDept}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.taskDistributionByDept.map((entry, index) => (
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
            <CardTitle>Employee Count by Department</CardTitle>
            <CardDescription>Team size distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.employeeCountByDept} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="employees" name="Employees">
                  {analytics.employeeCountByDept.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department Performance Radar</CardTitle>
            <CardDescription>Multi-metric comparison across departments</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={analytics.radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="department" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar 
                  name="Completion Rate" 
                  dataKey="completionRate" 
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.3} 
                />
                <Radar 
                  name="Efficiency" 
                  dataKey="efficiency" 
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.3} 
                />
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendUp className="h-5 w-5 text-green-600" />
              Top Performing
            </CardTitle>
            <CardDescription>Highest completion rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topPerformingDepartments.length > 0 ? (
                analytics.topPerformingDepartments.map((dept, idx) => (
                  <div key={dept.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="text-lg font-bold text-muted-foreground w-8">
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <DepartmentBadge 
                        departmentName={dept.name}
                        size="sm"
                        variant="default"
                        className="mb-1"
                      />
                      <div className="text-sm text-muted-foreground">
                        {dept.completedTasks}/{dept.totalTasks} tasks
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600 text-lg">
                        {dept.completionRate.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar className="h-5 w-5 text-primary" />
              Busiest Departments
            </CardTitle>
            <CardDescription>Highest workload per employee</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.busiestDepartments.length > 0 ? (
                analytics.busiestDepartments.map((dept, idx) => (
                  <div key={dept.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="text-lg font-bold text-muted-foreground w-8">
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <DepartmentBadge 
                        departmentName={dept.name}
                        size="sm"
                        variant="default"
                        className="mb-1"
                      />
                      <div className="text-sm text-muted-foreground">
                        {dept.totalEmployees} employee{dept.totalEmployees !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary text-lg">
                        {dept.avgTasksPerEmployee.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">tasks/person</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No data available
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
            <CardDescription>Departments with issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.needsAttentionDepartments.length > 0 ? (
                analytics.needsAttentionDepartments.map((dept) => (
                  <div key={dept.name} className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="flex-1 min-w-0">
                      <DepartmentBadge 
                        departmentName={dept.name}
                        size="sm"
                        variant="default"
                        className="mb-1.5"
                      />
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {dept.overdueTasks > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {dept.overdueTasks} overdue
                          </Badge>
                        )}
                        {dept.highPriorityTasks > 0 && (
                          <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                            {dept.highPriorityTasks} high priority
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  All departments on track! 🎉
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Details</CardTitle>
          <CardDescription>Complete breakdown by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {analytics.departments.map((dept) => (
              <div key={dept.name} className="border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <DepartmentBadge 
                        departmentName={dept.name}
                        size="lg"
                        variant="default"
                        className="mb-2"
                      />
                      <div className="text-sm text-muted-foreground">
                        {dept.totalEmployees} team member{dept.totalEmployees !== 1 ? 's' : ''} · {dept.totalTasks} task{dept.totalTasks !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {dept.totalTasks > 0 ? dept.completionRate.toFixed(0) : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">completion</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Completed</div>
                    <div className="text-lg font-semibold text-green-600">{dept.completedTasks}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">In Progress</div>
                    <div className="text-lg font-semibold text-primary">{dept.inProgressTasks}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Not Started</div>
                    <div className="text-lg font-semibold text-muted-foreground">{dept.notStartedTasks}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Overdue</div>
                    <div className={`text-lg font-semibold ${dept.overdueTasks > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {dept.overdueTasks}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Avg Tasks</div>
                    <div className="text-lg font-semibold">{dept.avgTasksPerEmployee.toFixed(1)}</div>
                  </div>
                </div>

                <Progress value={dept.completionRate} className="h-2 mb-4" />

                {dept.employees.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" weight="bold" />
                      Team Members
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {dept.employees.map((emp) => (
                        <div key={emp.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={emp.avatar} alt={emp.name} />
                            <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{emp.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {emp.taskCount} task{emp.taskCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
