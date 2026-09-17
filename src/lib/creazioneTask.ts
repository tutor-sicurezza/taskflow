import { chiamataAutenticata } from '@/lib/apiClient';
import type { Task } from '@/lib/types';

/**
 * Crea un task passando da POST /api/tasks, non scrivendo sulla tabella.
 *
 * Il client inseriva direttamente su public.tasks, e la policy di insert
 * chiedeva solo di poter scrivere nell'organizzazione: un membro poteva creare
 * un'attivita' assegnata a un collega, firmarla con l'id di un altro, o
 * assegnarla a qualcuno di un'altra organizzazione. La rotta fa quei
 * controlli — e la migrazione 0024 li fa fare anche al database, per chi la
 * rotta la salta — e in piu' verifica osservatori e dipendenze.
 *
 * La riga che torna e' quella scritta davvero (con `created_at` e `created_by`
 * decisi dal server): chi chiama la usa per allineare l'anteprima locale.
 */
export async function creaTaskSulServer(
  tenantId: string,
  task: Task
): Promise<Record<string, unknown>> {
  const payload = await chiamataAutenticata(
    `/api/tasks?tenantId=${encodeURIComponent(tenantId)}`,
    {
      body: {
        id: task.id,
        title: task.title,
        description: task.description ?? '',
        assigneeId: task.assigneeId ?? null,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate || null,
        department: task.department ?? null,
        labels: task.labels ?? [],
        estimateMinutes: task.estimateMinutes ?? null,
        spentMinutes: task.spentMinutes ?? null,
        watchers: task.watchers ?? [],
        subtasks: task.subtasks ?? [],
        blockedBy: task.blockedBy ?? [],
        recurrence: task.recurrence ?? null,
        requiresApproval: task.requiresApproval ?? false,
        comments: task.comments ?? [],
        activities: task.activities ?? [],
        // Solo se ci sono davvero: la stessa cautela di `taskToRow`.
        ...(task.attachments !== undefined ? { attachments: task.attachments } : {}),
      },
    }
  );

  const riga = payload?.task;
  if (!riga || typeof riga !== 'object') {
    throw new Error('comune.rispostaIncompleta');
  }

  return riga as Record<string, unknown>;
}
