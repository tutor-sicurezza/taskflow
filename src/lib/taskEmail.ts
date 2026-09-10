import { supabase } from '@/lib/supabase';

/**
 * Invio dell'email di assegnazione task.
 *
 * Prima questo percorso passava per il componente <TaskEmailNotification />,
 * che pero' non era montato da nessuna parte: l'email su task era codice
 * irraggiungibile. Il componente dipendeva inoltre da window.spark.kv per
 * leggere la configurazione, che fuori dal runtime GitHub Spark lancia.
 *
 * Qui si chiama direttamente /api/email/send, che e' l'unico punto in cui
 * vivono la chiave Resend e il mittente verificato: il browser non deve
 * vederli. L'endpoint impone da solo che il destinatario appartenga
 * all'organizzazione e che il chiamante sia almeno 'manager'.
 *
 * L'invio e' deliberatamente "best effort": una consegna fallita non deve far
 * fallire la creazione del task, che e' gia' salvato. L'esito viene loggato e
 * restituito al chiamante, che decide se dirlo all'utente.
 */
export type TaskEmailKind = 'assigned' | 'reassigned';

interface SendTaskEmailArgs {
  tenantId: string;
  recipientEmail: string;
  recipientName: string;
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
  priority?: string;
  assignedByName: string;
  kind: TaskEmailKind;
  /**
   * I campi seguenti riempiono i segnaposto dei modelli email personalizzabili
   * dall'organizzazione. Sono facoltativi di proposito: il server ha un
   * valore di ripiego per ciascuno, e renderli obbligatori romperebbe i
   * chiamanti che non hanno il dato sotto mano.
   */
  taskId?: string;
  taskStatus?: string;
  applicationName?: string;
}

/**
 * Il modello parla di `type` (`task_assigned` / `task_reassigned`), il resto
 * del client di `kind`: la traduzione sta qui e non nel chiamante, cosi' se i
 * modelli cambiano nomenclatura si tocca un punto solo.
 */
const TIPO_NOTIFICA: Record<TaskEmailKind, string> = {
  assigned: 'task_assigned',
  reassigned: 'task_reassigned',
};

/**
 * Link con cui il destinatario apre il task dall'email.
 *
 * Il formato `#task-<id>` non e' inventato qui: e' lo stesso che
 * `desktopNotifications.ts` mette in `data.url` per portare l'utente sul task
 * dalla notifica di sistema. Se manca l'id si manda la sola origine, perche'
 * un link a una rotta inesistente dentro un'email vera e' peggio di un link
 * alla home.
 */
function costruisciTaskUrl(taskId?: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const origine = window.location.origin;
  return taskId ? `${origine}/#task-${taskId}` : origine;
}

export async function sendTaskAssignmentEmail(
  args: SendTaskEmailArgs
): Promise<{ ok: boolean; error?: string }> {
  const {
    tenantId,
    recipientEmail,
    recipientName,
    taskTitle,
    taskDescription,
    dueDate,
    priority,
    assignedByName,
    kind,
    taskId,
    taskStatus,
    applicationName,
  } = args;

  if (!tenantId || !recipientEmail) {
    return { ok: false, error: 'Destinatario o organizzazione mancanti' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { ok: false, error: 'Sessione non valida' };
  }

  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        tenantId,
        to: recipientEmail,
        // Si mandano i DATI, non il messaggio: oggetto e corpo li compone il
        // server nella lingua del destinatario, che il browser di chi assegna
        // il task non puo' conoscere (user_state e' leggibile solo dal
        // proprietario). Prima il testo era italiano fisso per tutti.
        // Per lo stesso motivo si manda ogni dato che i modelli
        // personalizzabili dell'organizzazione possono citare come segnaposto:
        // il server non ha modo di ricavarli da solo, e un segnaposto senza
        // dato finisce vuoto nell'email consegnata.
        template: 'task',
        kind,
        type: TIPO_NOTIFICA[kind],
        recipientName,
        taskId,
        taskTitle,
        taskDescription,
        taskStatus,
        taskUrl: costruisciTaskUrl(taskId),
        dueDate,
        priority,
        assignedByName,
        applicationName,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = payload?.error || `HTTP ${response.status}`;
      console.warn('[taskEmail] invio fallito:', error);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Errore di rete';
    console.warn('[taskEmail] invio fallito:', error);
    return { ok: false, error };
  }
}
