export const runtime = 'edge';

import { createSupabaseAdminClient, ensureTenantRole, getAuthenticatedUser, jsonResponse, withErrors } from '../_lib/supabase.js';
import { getRequiredEnv } from '../_lib/env.js';
import {
  componiEmailTask,
  formattaData,
  linguaValida,
  traduciPriorita,
  type ParametriTask,
} from '../_lib/emailTemplates.js';
import { rendiModello, scegliModello } from '../_lib/modelliOrganizzazione.js';

/** Accetta un indirizzo solo se e' http o https; altrimenti niente link. */
function urlSicuro(valore: unknown): string | undefined {
  if (typeof valore !== 'string' || !valore) return undefined;
  try {
    const schema = new URL(valore).protocol;
    return schema === 'http:' || schema === 'https:' ? valore : undefined;
  } catch {
    return undefined;
  }
}

async function sendViaSendGrid(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  from: string,
  tenantId: string,
  userId: string
) {
  // `globalThis.fetch`: in questo modulo l'export si chiama `fetch` e farebbe ombra al fetch globale.
  const response = await globalThis.fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
          custom_args: {
            tenant_id: tenantId,
            sent_by: userId,
          },
        },
      ],
      from: {
        email: from.includes('<') ? from.match(/<(.+)>/)?.[1] || from : from,
        name: from.includes('<') ? from.split('<')[0].trim() : 'TaskFlow',
      },
      subject,
      content: [
        ...(text ? [{ type: 'text/plain', value: text }] : []),
        ...(html ? [{ type: 'text/html', value: html }] : []),
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${response.status} ${errorText}`);
  }

  const messageId = response.headers.get('X-Message-Id');
  return { id: messageId, provider: 'sendgrid' };
}

async function sendViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  from: string,
  tenantId: string,
  userId: string
) {
  // `globalThis.fetch`: vedi nota in sendViaSendGrid.
  const response = await globalThis.fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: html || undefined,
      text: text || undefined,
      tags: [
        { name: 'tenant_id', value: tenantId },
        { name: 'sent_by', value: userId },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Resend API error: ${response.status} ${JSON.stringify(payload)}`);
  }

  return { id: payload?.id, provider: 'resend' };
}

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

  // Il mittente NON e' piu' scegliibile dal chiamante. Accettando body.from
  // questo endpoint era un relay autenticato: qualunque membro poteva spedire
  // a qualunque indirizzo del mondo apparendo come "billing@<dominio
  // verificato>", con SPF e DKIM validi — phishing perfettamente allineato,
  // a carico della reputazione del dominio e della quota del titolare.
  //
  // Il default originale era no-reply@taskflow.local, un dominio inesistente
  // che i provider rifiutano; onboarding@resend.dev funziona senza
  // configurazione ma consegna solo al titolare dell'account Resend.
  const from = process.env.EMAIL_FROM || 'TaskFlow <onboarding@resend.dev>';
  const preferredProvider = body.provider || (sendgridApiKey ? 'sendgrid' : 'resend');

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
  const recipientCheck = createSupabaseAdminClient();
  const { data: recipient, error: recipientError } = await recipientCheck
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

  /**
   * Composizione nella lingua del DESTINATARIO.
   *
   * Prima il messaggio veniva scritto dal browser di chi assegnava il task,
   * con le stringhe italiane fisse: chi aveva scelto l'inglese riceveva
   * comunque un'email in italiano. La preferenza sta in `user_state`, che le
   * policy RLS rendono leggibile solo al proprietario — quindi il mittente non
   * puo' conoscerla e la composizione non puo' stare nel client. Qui si', con
   * il service role.
   *
   * Il chiamante manda `template` piu' i dati; oggetto e corpo li decide il
   * server. Il percorso con contenuto grezzo resta per l'invio di prova.
   */
  if (body.template === 'task') {
    const { data: preferenza } = await recipientCheck
      .from('user_state')
      .select('value')
      .eq('user_id', recipient.user_id)
      .eq('key', 'lingua')
      .maybeSingle();

    const lingua = linguaValida(preferenza?.value);

    const parametri: ParametriTask = {
      recipientName: typeof body.recipientName === 'string' ? body.recipientName : '',
      taskTitle: typeof body.taskTitle === 'string' ? body.taskTitle : '',
      taskDescription:
        typeof body.taskDescription === 'string' ? body.taskDescription : undefined,
      dueDate: typeof body.dueDate === 'string' ? body.dueDate : undefined,
      priority: typeof body.priority === 'string' ? body.priority : undefined,
      assignedByName:
        typeof body.assignedByName === 'string' ? body.assignedByName : '',
      kind: body.kind === 'reassigned' ? 'reassigned' : 'assigned',
    };

    /**
     * Prima i modelli dell'organizzazione, poi quelli di serie.
     *
     * I modelli personalizzabili dall'interfaccia erano decorativi: si
     * potevano modificare, ma l'email spedita non li guardava. Chi cambiava
     * il testo non cambiava nulla di cio' che arrivava davvero nella posta.
     *
     * Vengono letti qui e non nel client per lo stesso motivo per cui la
     * lingua viene letta qui: le policy RLS. Il chiamante e' un manager, i
     * modelli sono dati dell'organizzazione, ma il messaggio va composto con
     * dati del DESTINATARIO che il chiamante non puo' leggere.
     *
     * Un modello personalizzato vince sulla lingua del destinatario: e'
     * scritto in una lingua sola, quella scelta da chi l'ha modificato, e non
     * abbiamo modo di tradurre un testo libero. La lingua continua invece a
     * decidere il formato della data e il nome della priorita', che il
     * modello non contiene ma riceve gia' pronti.
     */
    const tipo =
      typeof body.type === 'string' && body.type
        ? body.type
        : parametri.kind === 'reassigned'
          ? 'task_reassigned'
          : 'task_assigned';

    const { data: rigaModelli } = await recipientCheck
      .from('app_state')
      .select('value')
      .eq('organization_id', tenantId)
      .eq('key', 'email-templates')
      .maybeSingle();

    const modello = scegliModello(rigaModelli?.value, tipo);

    if (modello) {
      const { data: organizzazione } = await recipientCheck
        .from('organizations')
        .select('name')
        .eq('id', tenantId)
        .maybeSingle();

      const adesso = new Date();
      const composta = rendiModello(modello, {
        recipientName: parametri.recipientName,
        recipientEmail: to,
        actionBy: parametri.assignedByName,
        taskTitle: parametri.taskTitle,
        taskDescription: parametri.taskDescription,
        taskPriority: parametri.priority
          ? traduciPriorita(lingua, parametri.priority)
          : undefined,
        taskDueDate: parametri.dueDate ? formattaData(lingua, parametri.dueDate) : undefined,
        taskStatus: typeof body.taskStatus === 'string' ? body.taskStatus : undefined,
        // Il link finisce dentro un `href`: si accettano solo http/https. Il
        // chiamante e' un manager autenticato, ma `javascript:` in un
        // attributo e' il genere di cosa che non ha mai una ragione legittima
        // di passare di qui.
        taskUrl: urlSicuro(body.taskUrl),
        commentText: typeof body.commentText === 'string' ? body.commentText : undefined,
        applicationName:
          typeof body.applicationName === 'string' && body.applicationName
            ? body.applicationName
            : 'TaskFlow',
        companyName: organizzazione?.name ?? undefined,
        currentDate: formattaData(lingua, adesso.toISOString()),
        currentYear: String(adesso.getFullYear()),
      });

      subject = composta.subject;
      html = composta.htmlContent;
      text = composta.textContent;
    } else {
      const composta = componiEmailTask(lingua, parametri);
      subject = composta.subject;
      html = composta.htmlContent;
      text = composta.textContent;
    }
  }

  // Controllo finale, valido sia per il contenuto grezzo sia per quello
  // composto dal template: senza oggetto o senza corpo non si spedisce.
  if (!subject || (!html && !text)) {
    return jsonResponse(
      { error: 'subject and textContent/htmlContent are required' },
      { status: 400 }
    );
  }

  try {
    let result: { id: string | null; provider: string };

    if (preferredProvider === 'sendgrid' && sendgridApiKey) {
      result = await sendViaSendGrid(sendgridApiKey, to, subject, html, text, from, tenantId, user.id);
    } else if (preferredProvider === 'resend' && resendApiKey) {
      result = await sendViaResend(resendApiKey, to, subject, html, text, from, tenantId, user.id);
    } else if (sendgridApiKey) {
      result = await sendViaSendGrid(sendgridApiKey, to, subject, html, text, from, tenantId, user.id);
    } else if (resendApiKey) {
      result = await sendViaResend(resendApiKey, to, subject, html, text, from, tenantId, user.id);
    } else {
      return jsonResponse({ error: 'No email provider available' }, { status: 503 });
    }

    const admin = createSupabaseAdminClient();
    await admin.from('email_delivery_logs').insert({
      organization_id: tenantId,
      user_id: user.id,
      recipient_email: to,
      subject,
      provider: result.provider,
      status: 'sent',
      provider_message_id: result.id || null,
    });

    return jsonResponse(
      {
        ok: true,
        provider: result.provider,
        messageId: result.id,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const admin = createSupabaseAdminClient();
    await admin.from('email_delivery_logs').insert({
      organization_id: tenantId,
      user_id: user.id,
      recipient_email: to,
      subject,
      provider: preferredProvider,
      status: 'failed',
      error: errorMessage,
    });

    return jsonResponse(
      {
        error: 'Email send failed',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
});
