import { describe, expect, it } from 'vitest';
import type { Employee, Task } from '@/lib/types';
import { normalizeActionableSuggestions } from '@/lib/aiAssistantSuggestions';

const tasks: Pick<Task, 'id'>[] = [{ id: 'task-1' }, { id: 'task-2' }];
const employees: Pick<Employee, 'id' | 'status'>[] = [
  { id: 'emp-active', status: 'active' },
  { id: 'emp-inactive', status: 'inactive' },
];

describe('normalizeActionableSuggestions', () => {
  it('returns an empty array for invalid payloads', () => {
    expect(normalizeActionableSuggestions(null, tasks, employees)).toEqual([]);
    expect(normalizeActionableSuggestions({}, tasks, employees)).toEqual([]);
    expect(normalizeActionableSuggestions({ suggestions: 'nope' }, tasks, employees)).toEqual(
      []
    );
  });

  it('keeps only valid actionable suggestions', () => {
    const payload = {
      suggestions: [
        {
          type: 'reassign',
          title: ' Reassign API task ',
          description: ' Move it to the available engineer ',
          action: { taskId: 'task-1', newAssigneeId: 'emp-active' },
        },
        {
          type: 'reassign',
          title: 'Invalid employee',
          description: 'Should be dropped',
          action: { taskId: 'task-1', newAssigneeId: 'emp-inactive' },
        },
        {
          type: 'priority_change',
          title: 'Raise priority',
          description: 'Urgent customer issue',
          action: { taskId: 'task-2', newPriority: 'high' },
        },
        {
          type: 'insight',
          title: 'Not actionable',
          description: 'Should not appear',
        },
      ],
    };

    expect(normalizeActionableSuggestions(payload, tasks, employees)).toEqual([
      {
        type: 'reassign',
        title: 'Reassign API task',
        description: 'Move it to the available engineer',
        action: { taskId: 'task-1', newAssigneeId: 'emp-active' },
      },
      {
        type: 'priority_change',
        title: 'Raise priority',
        description: 'Urgent customer issue',
        action: { taskId: 'task-2', newPriority: 'high' },
      },
    ]);
  });

  /*
    I due casi qui sotto mancavano, e non e' un dettaglio: sono la garanzia
    principale del normalizzatore.

    Verificato per mutazione. Togliendo dal codice il controllo
    `validTaskIds.has(action.taskId)` la suite passava lo stesso, perche' ogni
    `taskId` nei test esisteva gia'. Cioe' il controllo che impedisce al modello
    di far riassegnare o ripriorizzare un task che non c'e' — o che appartiene a
    un'altra organizzazione, visto che `tasks` contiene solo i nostri — non era
    coperto da nulla.
  */
  it('scarta un task che non esiste, anche se il resto e valido', () => {
    const payload = {
      suggestions: [
        {
          type: 'reassign',
          title: 'Riassegna un fantasma',
          description: 'Il task non esiste in questa organizzazione',
          action: { taskId: 'task-inventato', newAssigneeId: 'emp-active' },
        },
        {
          type: 'priority_change',
          title: 'Alza la priorita di un fantasma',
          description: 'Stesso problema',
          action: { taskId: 'task-inventato', newPriority: 'high' },
        },
      ],
    };

    expect(normalizeActionableSuggestions(payload, tasks, employees)).toEqual([]);
  });

  it('azzera un assegnatario sconosciuto invece di crearci sopra un task', () => {
    const payload = {
      suggestions: [
        {
          type: 'create_task',
          title: 'Nuovo task',
          description: 'Con un assegnatario che non esiste',
          action: {
            taskData: {
              title: 'Task',
              description: 'Descrizione',
              assigneeId: 'emp-inventato',
              priority: 'low',
              dueDate: null,
            },
          },
        },
      ],
    };

    const esito = normalizeActionableSuggestions(payload, tasks, employees);
    // Il task si puo' creare — non assegnato. Tenere l'id inventato lo
    // renderebbe invisibile a chiunque, assegnato a nessuno ma non "da
    // assegnare".
    expect(esito).toHaveLength(1);
    expect(esito[0].action?.taskData?.assigneeId).toBeNull();
  });

  it('normalizes create-task suggestions and drops incomplete ones', () => {
    const payload = {
      suggestions: [
        {
          type: 'create_task',
          title: 'Create QA follow-up',
          description: 'Track post-release verification',
          action: {
            taskData: {
              title: ' QA follow-up ',
              description: 'Verify the hotfix in production',
              assigneeId: 'emp-active',
              priority: 'medium',
              dueDate: '',
            },
          },
        },
        {
          type: 'create_task',
          title: 'Broken create',
          description: 'Missing taskData title',
          action: {
            taskData: {
              title: '   ',
              description: 'No usable title',
              assigneeId: null,
              priority: 'medium',
              dueDate: null,
            },
          },
        },
      ],
    };

    expect(normalizeActionableSuggestions(payload, tasks, employees)).toEqual([
      {
        type: 'create_task',
        title: 'Create QA follow-up',
        description: 'Track post-release verification',
        action: {
          taskData: {
            title: 'QA follow-up',
            description: 'Verify the hotfix in production',
            assigneeId: 'emp-active',
            priority: 'medium',
            dueDate: null,
          },
        },
      },
    ]);
  });
});
