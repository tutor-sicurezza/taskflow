/**
 * Consegna di un'email al provider, e registrazione dell'esito.
 *
 * Stava dentro la rotta /api/email/send. Da li' non era raggiungibile dal
 * lavoro pianificato dei promemoria, che deve spedire senza che ci sia un
 * utente collegato a premere un pulsante: copiarlo avrebbe significato due
 * implementazioni della scelta del provider e due formati diversi nel registro
 * degli invii.
 *
 * Il mittente NON e' scegliibile dal chiamante, ed e' il vincolo che regge
 * tutto il resto: accettarlo renderebbe questo un relay autenticato, con cui
 * spedire a chiunque apparendo come un indirizzo del dominio verificato, SPF e
 * DKIM inclusi.
 */

import { createSupabaseAdminClient } from './supabase.js';

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


export interface EsitoInvio {
  ok: boolean;
  provider: string;
  messageId?: string | null;
  errore?: string;
}

export interface Messaggio {
  to: string;
  subject: string;
  html: string;
  text: string;
  tenantId: string;
  /** Chi ha causato l'invio. Per i promemoria pianificati non c'e' nessuno. */
  userId: string | null;
}

/** Il mittente verificato, uguale per ogni percorso di invio. */
export function mittente(): string {
  // Il default originale era no-reply@taskflow.local, un dominio inesistente
  // che i provider rifiutano; onboarding@resend.dev funziona senza
  // configurazione ma consegna solo al titolare dell'account Resend.
  return process.env.EMAIL_FROM || 'TaskFlow <onboarding@resend.dev>';
}

export function chiaviProvider() {
  const resend = process.env.RESEND_API_KEY;
  const sendgrid = process.env.SENDGRID_API_KEY;
  return { resend, sendgrid, almenoUno: Boolean(resend || sendgrid) };
}

/**
 * Spedisce e registra, sempre: sia la consegna sia il fallimento finiscono in
 * `email_delivery_logs`. Un invio che sparisce senza lasciare traccia e' il
 * motivo per cui poi nessuno sa dire se un'email e' mai partita.
 */
export async function spedisci(
  messaggio: Messaggio,
  preferito?: string
): Promise<EsitoInvio> {
  const { resend, sendgrid } = chiaviProvider();
  const scelto = preferito || (sendgrid ? 'sendgrid' : 'resend');
  const from = mittente();
  const admin = createSupabaseAdminClient();

  const registra = async (
    stato: 'sent' | 'failed',
    provider: string,
    extra: Record<string, unknown>
  ) => {
    await admin.from('email_delivery_logs').insert({
      organization_id: messaggio.tenantId,
      user_id: messaggio.userId,
      recipient_email: messaggio.to,
      subject: messaggio.subject,
      provider,
      status: stato,
      ...extra,
    });
  };

  try {
    let esito: { id: string | null; provider: string };

    if (scelto === 'sendgrid' && sendgrid) {
      esito = await sendViaSendGrid(sendgrid, messaggio.to, messaggio.subject, messaggio.html, messaggio.text, from, messaggio.tenantId, messaggio.userId ?? '');
    } else if (scelto === 'resend' && resend) {
      esito = await sendViaResend(resend, messaggio.to, messaggio.subject, messaggio.html, messaggio.text, from, messaggio.tenantId, messaggio.userId ?? '');
    } else if (sendgrid) {
      esito = await sendViaSendGrid(sendgrid, messaggio.to, messaggio.subject, messaggio.html, messaggio.text, from, messaggio.tenantId, messaggio.userId ?? '');
    } else if (resend) {
      esito = await sendViaResend(resend, messaggio.to, messaggio.subject, messaggio.html, messaggio.text, from, messaggio.tenantId, messaggio.userId ?? '');
    } else {
      return { ok: false, provider: scelto, errore: 'No email provider available' };
    }

    await registra('sent', esito.provider, { provider_message_id: esito.id || null });
    return { ok: true, provider: esito.provider, messageId: esito.id };
  } catch (errore) {
    const messaggioErrore = errore instanceof Error ? errore.message : 'Unknown error';
    await registra('failed', scelto, { error: messaggioErrore });
    return { ok: false, provider: scelto, errore: messaggioErrore };
  }
}
