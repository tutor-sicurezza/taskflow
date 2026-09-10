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
import { collegamentoDisiscrizione } from './disiscrizione.js';
import { getRequiredEnv } from './env.js';

async function sendViaSendGrid(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  from: string,
  tenantId: string,
  userId: string,
  intestazioni: Record<string, string>
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
            ...(userId ? { sent_by: userId } : {}),
          },
        },
      ],
      from: {
        email: from.includes('<') ? from.match(/<(.+)>/)?.[1] || from : from,
        name: from.includes('<') ? from.split('<')[0].trim() : 'TaskFlow',
      },
      subject,
      headers: intestazioni,
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
  userId: string,
  intestazioni: Record<string, string>
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
      headers: intestazioni,
      html: html || undefined,
      text: text || undefined,
      /*
        Il tag `sent_by` solo se c'e' davvero un mittente umano.

        Le email dei lavori pianificati non ne hanno uno — le manda il sistema —
        e finivano con `value: ''`. Resend valida i valori dei tag: una stringa
        vuota puo' far rifiutare l'intera richiesta, e fino a poco fa il
        fallimento non lasciava nemmeno traccia nel registro. Meglio un tag in
        meno che un'email in meno.
      */
      tags: [
        { name: 'tenant_id', value: tenantId },
        ...(userId ? [{ name: 'sent_by', value: userId }] : []),
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
  /**
   * Chi RICEVE. Serve a firmare il suo collegamento di disiscrizione: senza,
   * il messaggio parte senza `List-Unsubscribe` e Gmail lo tratta peggio.
   */
  destinatarioId?: string | null;
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
    /*
      L'errore dell'inserimento non si butta piu' via.

      `user_id` era NOT NULL, e i tre lavori pianificati passano `null` (chi
      spedisce e' il sistema, non una persona): l'inserimento falliva, l'errore
      veniva ignorato, e la funzione rispondeva "ok". Di un promemoria, di
      un'escalation o di un riepilogo non restava traccia ne' quando partiva
      ne' quando falliva — cioe' esattamente cio' che questo registro esiste
      per evitare. La colonna ora ammette il nullo; qui si scrive nel diario
      del server se anche cosi' non si riesce a scrivere.
    */
    const { error } = await admin.from('email_delivery_logs').insert({
      organization_id: messaggio.tenantId,
      user_id: messaggio.userId ?? null,
      recipient_email: messaggio.to,
      subject: messaggio.subject,
      provider,
      status: stato,
      ...extra,
    });

    if (error) {
      console.error('[invio] registro non scritto:', error.message);
    }
  };

  /**
   * `List-Unsubscribe` non e' un adempimento formale: dal 2024 la sua assenza
   * e' uno dei motivi per cui Gmail manda nello spam anche i messaggi
   * attesi. `One-Click` dice al client di posta che puo' disiscrivere da solo
   * con un POST, senza far aprire una pagina all'utente.
   */
  const intestazioni: Record<string, string> = {};
  const disiscrizione = await collegamentoDisiscrizione(
    getRequiredEnv().appUrl,
    messaggio.destinatarioId ?? null
  );
  if (disiscrizione) {
    intestazioni['List-Unsubscribe'] = `<${disiscrizione}>`;
    intestazioni['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  try {
    let esito: { id: string | null; provider: string };

    if (scelto === 'sendgrid' && sendgrid) {
      esito = await sendViaSendGrid(sendgrid, messaggio.to, messaggio.subject, messaggio.html, messaggio.text, from, messaggio.tenantId, messaggio.userId ?? '', intestazioni);
    } else if (scelto === 'resend' && resend) {
      esito = await sendViaResend(resend, messaggio.to, messaggio.subject, messaggio.html, messaggio.text, from, messaggio.tenantId, messaggio.userId ?? '', intestazioni);
    } else if (sendgrid) {
      esito = await sendViaSendGrid(sendgrid, messaggio.to, messaggio.subject, messaggio.html, messaggio.text, from, messaggio.tenantId, messaggio.userId ?? '', intestazioni);
    } else if (resend) {
      esito = await sendViaResend(resend, messaggio.to, messaggio.subject, messaggio.html, messaggio.text, from, messaggio.tenantId, messaggio.userId ?? '', intestazioni);
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
