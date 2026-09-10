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
        template: 'task',
        kind,
        recipientName,
        taskTitle,
        taskDescription,
        dueDate,
        priority,
        assignedByName,
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
