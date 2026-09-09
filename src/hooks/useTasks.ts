import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';

/**
 * I task, letti e scritti sulla tabella public.tasks, una riga per task.
 *
 * Perche' non stanno piu' in app_state: li' erano un unico blob JSON, e la
 * policy di quella tabella ragiona per riga — dove la riga e' l'intero elenco.
 * Chiunque potesse scrivere poteva quindi sostituirlo per intero: una sola
 * chiamata a PostgREST azzerava tutti i task dell'organizzazione, ed e' stato
 * verificato con un account 'member' reale. Nessuna policy sul blob puo'
 * impedirlo, perche' a quel livello "modifico il mio task" e "li cancello
 * tutti" sono la stessa operazione.
 *
 * Con una riga per task valgono finalmente le policy della 0008: crea chi puo'
 * scrivere, modifica l'autore o l'assegnatario o un manager, cancella l'autore
 * o un manager. Il database rifiuta il resto, senza dipendere dall'interfaccia.
 *
 * L'hook espone di proposito la STESSA firma di useKV — `[tasks, setTasks]`
 * con updater sull'array — cosi' i diciannove punti di App.tsx che modificano
 * i task restano invariati. La differenza sta qui dentro: l'array nuovo viene
 * confrontato con quello precedente e tradotto in insert/update/delete per
 * riga.
 */

interface TaskRow {
  id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  priority: string;
  status: string;
  due_date: string;
  created_at: string;
  comments: unknown;
  activities: unknown;
  attachments: unknown;
}

const COLONNE =
  'id, title, description, assignee_id, priority, status, due_date, created_at, comments, activities, attachments';

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    assigneeId: row.assignee_id,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    dueDate: row.due_date,
    createdAt: row.created_at,
    comments: (row.comments as Task['comments']) ?? [],
    activities: (row.activities as Task['activities']) ?? [],
    attachments: (row.attachments as Task['attachments']) ?? [],
  };
}

/** Campi scrivibili. `organization_id` e `created_by` li mette solo l'insert. */
function taskToRow(task: Task) {
  return {
    title: task.title,
    description: task.description ?? '',
    assignee_id: task.assigneeId || null,
    priority: task.priority,
    status: task.status,
    due_date: task.dueDate,
    comments: task.comments ?? [],
    activities: task.activities ?? [],
    attachments: task.attachments ?? [],
    updated_at: new Date().toISOString(),
  };
}

export function useTasks() {
  const { user, organization } = useAuth();
  const [tasks, setTasksState] = useState<Task[]>([]);

  // L'elenco corrente serve dentro `setTasks` senza rientrare nelle dipendenze:
  // altrimenti ogni modifica ricreerebbe la funzione e con essa gli effetti dei
  // componenti che la ricevono.
  const correnti = useRef<Task[]>([]);
  correnti.current = tasks;

  const reload = useCallback(async () => {
    if (!organization?.id) return;

    const { data, error } = await supabase
      .from('tasks')
      .select(COLONNE)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[useTasks] lettura fallita:', error.message);
      return;
    }

    setTasksState((data ?? []).map((r) => rowToTask(r as unknown as TaskRow)));
  }, [organization?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Consegna in tempo reale: le modifiche dei colleghi arrivano senza ricaricare.
  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel(`tasks-${organization.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `organization_id=eq.${organization.id}`,
        },
        () => {
          void reload();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organization?.id, reload]);

  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  /**
   * Traduce la differenza fra l'array precedente e quello nuovo in operazioni
   * per riga. Il confronto per id e' affidabile perche' gli id sono uuid
   * generati una volta sola (vedi newId in lib/utils).
   */
  const applica = useCallback(
    async (precedenti: Task[], successivi: Task[]) => {
      if (!organization?.id) return;

      const primaPerId = new Map(precedenti.map((t) => [t.id, t]));
      const dopoPerId = new Map(successivi.map((t) => [t.id, t]));

      const aggiunti = successivi.filter((t) => !primaPerId.has(t.id));
      const rimossi = precedenti.filter((t) => !dopoPerId.has(t.id));
      const modificati = successivi.filter((t) => {
        const prima = primaPerId.get(t.id);
        return prima && JSON.stringify(prima) !== JSON.stringify(t);
      });

      const errori: string[] = [];

      for (const t of aggiunti) {
        const { error } = await supabase.from('tasks').insert({
          id: t.id,
          organization_id: organization.id,
          created_by: user?.id ?? null,
          created_at: t.createdAt,
          ...taskToRow(t),
        });
        if (error) errori.push(`creazione "${t.title}": ${error.message}`);
      }

      for (const t of modificati) {
        // Nessun .select(): il RETURNING passa dalla policy di lettura e non
        // serve a nulla qui. Una modifica rifiutata dalle policy non e' un
        // errore del programma: e' un permesso mancante, e va detto.
        const { error } = await supabase.from('tasks').update(taskToRow(t)).eq('id', t.id);
        if (error) errori.push(`modifica "${t.title}": ${error.message}`);
      }

      for (const t of rimossi) {
        const { error } = await supabase.from('tasks').delete().eq('id', t.id);
        if (error) errori.push(`eliminazione "${t.title}": ${error.message}`);
      }

      if (errori.length > 0) {
        console.error('[useTasks]', errori.join(' | '));
        toast.error(
          errori.length === 1
            ? `Operazione non consentita: ${errori[0]}`
            : `${errori.length} operazioni non consentite sui task`
        );
        // Lo stato ottimistico non rispecchia piu' il database: si rilegge,
        // cosi' l'utente vede la realta' invece di una modifica che crede
        // salvata.
        await reload();
      }
    },
    [organization?.id, user?.id, reload]
  );

  const setTasks = useCallback(
    (valore: Task[] | ((precedenti: Task[]) => Task[])) => {
      const precedenti = correnti.current;
      const successivi =
        typeof valore === 'function'
          ? (valore as (p: Task[]) => Task[])(precedenti)
          : valore;

      // Anteprima immediata, poi la sincronizzazione riga per riga.
      setTasksState(successivi);
      correnti.current = successivi;
      void applica(precedenti, successivi);
    },
    [applica]
  );

  return [tasks, setTasks] as const;
}
