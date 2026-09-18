import type { Employee, Task } from '@/lib/types';

export interface AISuggestion {
  type: 'create_task' | 'reassign' | 'priority_change';
  title: string;
  description: string;
  action?: {
    taskId?: string;
    newAssigneeId?: string;
    newPriority?: 'low' | 'medium' | 'high';
    taskData?: Omit<Task, 'id' | 'status' | 'createdAt' | 'comments' | 'activities'>;
  };
}

export const AI_ASSISTANT_SUGGESTIONS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['create_task', 'reassign', 'priority_change'] },
          title: { type: 'string' },
          description: { type: 'string' },
          action: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              newAssigneeId: { type: 'string' },
              newPriority: { type: 'string', enum: ['low', 'medium', 'high'] },
              taskData: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  assigneeId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                  dueDate: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                },
                required: ['title', 'description', 'assigneeId', 'priority', 'dueDate'],
                additionalProperties: false,
              },
            },
            additionalProperties: false,
          },
        },
        required: ['type', 'title', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPriority(value: unknown): value is 'low' | 'medium' | 'high' {
  return value === 'low' || value === 'medium' || value === 'high';
}

function normalizeSuggestionAction(
  type: AISuggestion['type'],
  action: unknown,
  validTaskIds: Set<string>,
  validEmployeeIds: Set<string>
): AISuggestion['action'] | null {
  if (!isRecord(action)) return null;

  if (type === 'reassign') {
    return typeof action.taskId === 'string' &&
      validTaskIds.has(action.taskId) &&
      typeof action.newAssigneeId === 'string' &&
      validEmployeeIds.has(action.newAssigneeId)
      ? { taskId: action.taskId, newAssigneeId: action.newAssigneeId }
      : null;
  }

  if (type === 'priority_change') {
    return typeof action.taskId === 'string' &&
      validTaskIds.has(action.taskId) &&
      isPriority(action.newPriority)
      ? { taskId: action.taskId, newPriority: action.newPriority }
      : null;
  }

  const taskData = action.taskData;
  if (!isRecord(taskData)) return null;

  const assigneeId =
    taskData.assigneeId === null
      ? null
      : typeof taskData.assigneeId === 'string' && validEmployeeIds.has(taskData.assigneeId)
        ? taskData.assigneeId
        : null;
  const dueDate =
    taskData.dueDate === null
      ? null
      : typeof taskData.dueDate === 'string' && taskData.dueDate.trim()
        ? taskData.dueDate
        : null;

  return typeof taskData.title === 'string' &&
    taskData.title.trim() &&
    typeof taskData.description === 'string' &&
    isPriority(taskData.priority)
    ? {
        taskData: {
          title: taskData.title.trim(),
          description: taskData.description,
          assigneeId,
          priority: taskData.priority,
          dueDate,
        },
      }
    : null;
}

export function normalizeActionableSuggestions(
  payload: unknown,
  tasks: Pick<Task, 'id'>[],
  employees: Pick<Employee, 'id' | 'status'>[]
): AISuggestion[] {
  if (!isRecord(payload) || !Array.isArray(payload.suggestions)) return [];

  const validTaskIds = new Set(tasks.map((task) => task.id));
  const validEmployeeIds = new Set(
    employees.filter((employee) => employee.status === 'active').map((employee) => employee.id)
  );

  return payload.suggestions.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    if (
      (raw.type !== 'create_task' &&
        raw.type !== 'reassign' &&
        raw.type !== 'priority_change') ||
      typeof raw.title !== 'string' ||
      !raw.title.trim() ||
      typeof raw.description !== 'string' ||
      !raw.description.trim()
    ) {
      return [];
    }

    const action = normalizeSuggestionAction(
      raw.type,
      raw.action,
      validTaskIds,
      validEmployeeIds
    );

    return action
      ? [
          {
            type: raw.type,
            title: raw.title.trim(),
            description: raw.description.trim(),
            action,
          },
        ]
      : [];
  });
}
