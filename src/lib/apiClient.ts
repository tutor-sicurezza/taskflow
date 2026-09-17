import { supabase } from '@/lib/supabase';
import { traduci, linguaIniziale } from '@/lib/i18n';

/*
  Una chiamata a una rotta in api/, con il token della sessione.

  Era una funzione privata di orgMembers.ts; ora la usa anche la creazione dei
  task, e due copie della stessa gestione degli errori sono il modo piu'
  sicuro di farle divergere.

  Gli errori portano una CHIAVE di traduzione, non una frase: qui la lingua di
  chi guarda non si puo' sapere, quindi si rimanda la decisione a chi mostra il
  messaggio (vedi la nota in orgMembers.ts). Gli errori restituiti dal server
  attraversano immutati.

  Nota operativa: le rotte in api/ non rispondono con `npm run dev`, che serve
  solo il frontend. Servono `vercel dev` o un deploy.
*/

interface OpzioniChiamata {
  method?: 'POST' | 'DELETE';
  body?: unknown;
}

export async function chiamataAutenticata(
  path: string,
  { method = 'POST', body }: OpzioniChiamata = {}
): Promise<Record<string, unknown>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('comune.sessioneScaduta');
  }

  const response = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${session.access_token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      (typeof payload?.error === 'string' && payload.error) ||
        traduci(linguaIniziale(), 'comune.richiestaFallita', { stato: response.status })
    );
  }

  return payload;
}
