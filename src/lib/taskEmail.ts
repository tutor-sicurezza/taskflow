import { supabase } from '@/lib/supabase';
import type { TipoNotifica } from '@/lib/modelliEmail';

/**
 * Invio dell'email di notifica su un task.
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
 * fallire l'azione che l'ha provocata, che a quel punto e' gia' salvata.
 *
 * La funzione vale per TUTTI i tipi di notifica, non piu' per la sola
 * assegnazione: i modelli sono dieci, e la differenza fra uno e l'altro sta
 * nel `tipo`, non nel modo di spedirli.
 */
export interface DatiEmailNotifica {
  tenantId: string;
  tipo: TipoNotifica;
  recipientEmail: string;
  recipientName: string;
  /** Serve a costruire il link con cui si apre il task dall'email. */
  taskId?: string;
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
  priority?: string;
  taskStatus?: string;
  /** Solo per commenti e menzioni: il testo citato nell'email. */
  commentText?: string;
  /** Chi ha compiuto l'azione. */
  assignedByName: string;
  applicationName?: string;
}

/**
 * Link con cui il destinatario apre il task dall'email.
 *
 * Il formato `#task-<id>` non e' inventato qui: e' lo stesso che
 * `desktopNotifications.ts` mette in `data.url` per portare l'utente sul task
 * dalla notifica di sistema, ed e' letto in `App.tsx`. Se manca l'id si manda
 * la sola origine, perche' un link a una rotta inesistente dentro un'email
 * vera e' peggio di un link alla schermata iniziale.
 */
function costruisciTaskUrl(taskId?: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const origine = window.location.origin;
  return taskId ? `${origine}/#task-${taskId}` : origine;
}

export async function inviaEmailNotifica(
  dati: DatiEmailNotifica
): Promise<{ ok: boolean; error?: string }> {
  if (!dati.tenantId || !dati.recipientEmail) {
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
        tenantId: dati.tenantId,
        to: dati.recipientEmail,
        /**
         * Si mandano i DATI, non il messaggio.
         *
         * Oggetto e corpo li compone il server: servono la lingua del
         * destinatario e le sue preferenze di notifica, che stanno in
         * `user_state` e che le policy RLS rendono leggibili solo al
         * proprietario — il browser di chi agisce non puo' conoscerle. Sul
         * server c'e' anche il modello personalizzato dall'organizzazione, che
         * ha la precedenza su quello predefinito.
         */
        template: 'task',
        type: dati.tipo,
        recipientName: dati.recipientName,
        taskId: dati.taskId,
        taskTitle: dati.taskTitle,
        taskDescription: dati.taskDescription,
        taskStatus: dati.taskStatus,
        taskUrl: costruisciTaskUrl(dati.taskId),
        commentText: dati.commentText,
        dueDate: dati.dueDate,
        priority: dati.priority,
        assignedByName: dati.assignedByName,
        applicationName: dati.applicationName,
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
