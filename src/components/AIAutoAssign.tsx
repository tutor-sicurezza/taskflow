import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Task, Employee } from '@/lib/types';
import { useAI } from '@/lib/ai';
import { Sparkle, UserCircleGear } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AIAutoAssignProps {
  tasks: Task[];
  employees: Employee[];
  onAssignTasks: (assignments: Array<{ taskId: string; employeeId: string }>) => void;
}

interface AssignmentSuggestion {
  taskId: string;
  taskTitle: string;
  employeeId: string;
  employeeName: string;
  reason: string;
}

const ASSIGNMENTS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The id of the task being assigned' },
          taskTitle: { type: 'string', description: 'The title of the task being assigned' },
          employeeId: { type: 'string', description: 'The id of the employee receiving the task' },
          employeeName: { type: 'string', description: 'The name of the employee receiving the task' },
          reason: { type: 'string', description: 'Brief explanation why this assignment makes sense' },
        },
        required: ['taskId', 'taskTitle', 'employeeId', 'employeeName', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['assignments'],
  additionalProperties: false,
};

export function AIAutoAssign({ tasks, employees, onAssignTasks }: AIAutoAssignProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AssignmentSuggestion[]>([]);
  const { ask } = useAI();

  const unassignedTasks = tasks.filter(t => !t.assigneeId && t.status !== 'completed');
  const activeEmployees = employees.filter(e => e.status === 'active');

  const generateAssignments = async () => {
    if (unassignedTasks.length === 0) {
      toast.error(t('No unassigned tasks to assign'));
      return;
    }

    if (activeEmployees.length === 0) {
      toast.error(t('No active employees available'));
      return;
    }

    setIsLoading(true);
    try {
      const workloadByEmployee = activeEmployees.map(emp => ({
        id: emp.id,
        name: emp.name,
        role: emp.role,
        department: emp.department,
        currentTasks: tasks.filter(t => t.assigneeId === emp.id && t.status !== 'completed').length,
      }));

      const tasksToAssign = unassignedTasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueDate: t.dueDate,
      }));

      const prompt = `You are an AI assistant that helps assign tasks to team members based on workload balance, skills, and task requirements.

Available employees and their current workload:
${JSON.stringify(workloadByEmployee, null, 2)}

Unassigned tasks:
${JSON.stringify(tasksToAssign, null, 2)}

Analyze the tasks and employees, then suggest optimal assignments. Consider:
1. Current workload balance (distribute evenly)
2. Task priority (high priority to less busy members)
3. Employee role/department match to task requirements
4. Due dates (urgent tasks to available members)

For each assignment, include a brief explanation of why it makes sense.`;

      const response = await ask(prompt, { json: true, schema: ASSIGNMENTS_SCHEMA });
      const data = JSON.parse(response);

      if (data.assignments && Array.isArray(data.assignments)) {
        setSuggestions(data.assignments);
        setIsOpen(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate assignments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyAssignments = () => {
    const assignments = suggestions.map(s => ({
      taskId: s.taskId,
      employeeId: s.employeeId,
    }));
    
    onAssignTasks(assignments);
    setIsOpen(false);
    setSuggestions([]);
    toast.success(`${assignments.length} tasks assigned!`);
  };

  if (unassignedTasks.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={generateAssignments}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Sparkle className="w-4 h-4 animate-spin" weight="fill" />
        ) : (
          <UserCircleGear className="w-4 h-4" weight="fill" />
        )}
        AI Auto-Assign
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkle className="w-4 h-4 text-white" weight="fill" />
              </div>{t('AI Assignment Suggestions')}</AlertDialogTitle>
            <AlertDialogDescription>{t('Review the suggested task assignments below. These are optimized for workload balance and task requirements.')}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-4">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="bg-muted rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm mb-1">{suggestion.taskTitle}</h4>
                    <p className="text-sm text-muted-foreground">
                      Assign to: <span className="font-medium text-foreground">{suggestion.employeeName}</span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {suggestion.reason}
                </p>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSuggestions([])}>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyAssignments}>{t('Apply All Assignments')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
