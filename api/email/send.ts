export const runtime = 'edge';

import {
  createSupabaseAdminClient,
  ensureTenantRole,
  getAuthenticatedUser,
  jsonResponse,
  withErrors,
} from '../_lib/supabase.js';
import { getRequiredEnv } from '../_lib/env.js';
import { componiPerDestinatario } from '../_lib/composizione.js';
import { spedisci } from '../_lib/invio.js';
import type { TipoNotifica } from '../_lib/modelliEmail.js';

/**
 * Invio di un'email di notifica, provocato dall'azione di una persona.
 *
 * Questa rotta e' rimasta un guscio: decide CHI puo' spedire e A CHI, poi
 * passa la palla. Cosa spedire lo stabilisce `composizione.ts` e come
 * consegnarlo `invio.ts`, perche' gli stessi due passaggi servono anche al
 * lavoro pianificato dei promemoria, dove nessuno ha premuto un pulsante.
 */
export const fetch = withErrors(async (request: Request) => {
  const { resendApiKey, sendgridApiKey } = getRequiredEnv();

  if (!resendApiKey && !sendgridApiKey) {
    return jsonResponse(
      {
        error: 'Email service not configured',
        message: 'Neither RESEND_API_KEY nor SENDGRID_API_KEY is configured',
      },
      { status: 503 }
    );
  }

  const user = await getAuthenticatedUser(request);
  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';

  if (!tenantId) {
    return jsonResponse({ error: 'tenantId is required' }, { status: 400 });
  }

  // Inviare posta a nome del dominio verificato dell'azienda non e' una normale
  // azione da membro. Il livello e' 'manager' e non 'admin' perche' assegnare
  // task e' gia' una prerogativa da manager in su (vedi api/tasks/index.ts) e
  // l'email di assegnazione parte proprio da li': richiedere 'admin' avrebbe
  // reso quel percorso un 403 per i manager. Restano attivi i due vincoli che
  // contano davvero: il mittente non e' scegliibile dal chiamante e il
  // destinatario deve appartenere all'organizzazione.
  await ensureTenantRole(user.id, tenantId, 'manager');

  const to = typeof body.to === 'string' ? body.to.trim() : '';
  let subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  let html = typeof body.htmlContent === 'string' ? body.htmlContent : '';
  let text = typeof body.textContent === 'string' ? body.textContent : '';

  if (!to) {
    return jsonResponse({ error: 'to is required' }, { status: 400 });
  }

  if (!body.template && !subject) {
    return jsonResponse(
      { error: 'subject and textContent/htmlContent are required without a template' },
      { status: 400 }
    );
  }

  // Il destinatario deve appartenere all'organizzazione: l'app manda notifiche
  // ai colleghi, non messaggi arbitrari verso l'esterno.
  const admin = createSupabaseAdminClient();
  const { data: recipient, error: recipientError } = await admin
    .from('organization_members')
    .select('user_id, profiles!inner(email)')
    .eq('organization_id', tenantId)
    .eq('profiles.email', to.toLowerCase())
    .maybeSingle();

  if (recipientError) {
    return jsonResponse({ error: recipientError.message }, { status: 500 });
  }

  if (!recipient) {
    return jsonResponse(
      { error: 'Recipient is not a member of this organization' },
      { status: 403 }
    );
  }

  if (body.template === 'task') {
    /**
     * Il tipo decide quale modello si usa. `kind` resta accettato perche' e'
     * cio' che mandava il client prima che i tipi fossero dieci: una versione
     * vecchia rimasta aperta in una scheda non deve smettere di funzionare.
     */
    const tipo: TipoNotifica =
      typeof body.type === 'string' && body.type
        ? (body.type as TipoNotifica)
        : body.kind === 'reassigned'
          ? 'task_reassigned'
          : 'task_assigned';

    const composta = await componiPerDestinatario(admin, {
      tenantId,
      destinatarioId: recipient.user_id,
      tipo,
      dati: {
        recipientName: typeof body.recipientName === 'string' ? body.recipientName : '',
        recipientEmail: to,
        actionBy: typeof body.assignedByName === 'string' ? body.assignedByName : '',
        taskTitle: typeof body.taskTitle === 'string' ? body.taskTitle : '',
        taskDescription:
          typeof body.taskDescription === 'string' ? body.taskDescription : undefined,
        priority: typeof body.priority === 'string' ? body.priority : undefined,
        dueDate: typeof body.dueDate === 'string' ? body.dueDate : undefined,
        taskStatus: typeof body.taskStatus === 'string' ? body.taskStatus : undefined,
        taskUrl: typeof body.taskUrl === 'string' ? body.taskUrl : undefined,
        commentText: typeof body.commentText === 'string' ? body.commentText : undefined,
        applicationName:
          typeof body.applicationName === 'string' ? body.applicationName : undefined,
      },
    });

    /**
     * Il destinatario ha spento queste email, oppure il modello e' vuoto.
     *
     * Si risponde 200 e non un errore: il non-invio e' l'esito corretto, non un
     * fallimento, e chi ha assegnato il task non deve vedere un avviso rosso
     * per una scelta legittima di un collega.
     */
    if (!composta.spedibile) {
      return jsonResponse({ skipped: true, reason: composta.motivo });
    }

    subject = composta.subject;
    html = composta.htmlContent;
    text = composta.textContent;
  }

  // Controllo finale, valido sia per il contenuto grezzo sia per quello
  // composto dal modello: senza oggetto o senza corpo non si spedisce.
  if (!subject || (!html && !text)) {
    return jsonResponse(
      { error: 'subject and textContent/htmlContent are required' },
      { status: 400 }
    );
  }

  const esito = await spedisci(
    { to, subject, html, text, tenantId, userId: user.id },
    typeof body.provider === 'string' ? body.provider : undefined
  );

  if (!esito.ok) {
    return jsonResponse(
      { error: 'Email send failed', message: esito.errore },
      { status: esito.errore === 'No email provider available' ? 503 : 500 }
    );
  }

  return jsonResponse(
    { ok: true, provider: esito.provider, messageId: esito.messageId },
    { status: 201 }
  );
});
