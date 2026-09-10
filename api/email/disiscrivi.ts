export const runtime = 'edge';

import { createSupabaseAdminClient, jsonResponse, withErrors } from '../_lib/supabase.js';
import { verificaGettone } from '../_lib/disiscrizione.js';
import { chiavePreferenze } from '../_lib/preferenzeNotifiche.js';

/**
 * Spegne le email di notifica per chi arriva dal collegamento in fondo a
 * un'email.
 *
 * Due modi di arrivarci, ed e' voluto. Il POST senza corpo e' quello che usano
 * Gmail e gli altri quando l'utente preme "Annulla iscrizione" nell'interfaccia
 * della posta (RFC 8058): deve funzionare senza che nessuno apra una pagina.
 * Il GET e' per chi clicca il collegamento nel testo, e restituisce una pagina
 * leggibile invece di un JSON.
 *
 * Non c'e' autenticazione, e non puo' essercene: chi riceve un'email non e'
 * detto che abbia una sessione aperta, e pretendere l'accesso significherebbe
 * non avere una disiscrizione. Al suo posto c'e' la firma del gettone, che
 * solo il server sa produrre. Senza, cambiare una cifra nell'indirizzo
 * basterebbe a zittire le notifiche di un collega.
 *
 * L'operazione e' volutamente minima: spegne le email, non tocca le notifiche
 * dentro l'applicazione. Chi si disiscrive non vuole posta, non vuole sparire.
 */
async function spegniEmail(gettone: string | null): Promise<boolean> {
  if (!gettone) return false;

  const userId = await verificaGettone(gettone);
  if (!userId) return false;

  const admin = createSupabaseAdminClient();
  const chiave = chiavePreferenze(userId);

  const { data: esistenti } = await admin
    .from('user_state')
    .select('value')
    .eq('user_id', userId)
    .eq('key', chiave)
    .maybeSingle();

  // Si conserva il resto delle preferenze: chi disattiva le email non sta
  // chiedendo di azzerare suoni, orari di silenzio e scelte per tipo.
  const precedenti =
    esistenti?.value && typeof esistenti.value === 'object' && !Array.isArray(esistenti.value)
      ? (esistenti.value as Record<string, unknown>)
      : {};

  const { error } = await admin.from('user_state').upsert(
    {
      user_id: userId,
      key: chiave,
      /*
        Anche il riepilogo, non solo le email immediate.

        Chi preme "Annulla iscrizione" dentro Gmail sta dicendo "non scrivetemi
        piu'", non "scrivetemi una volta al giorno invece che a ogni evento".
        Spegnendo il solo `emailNotifications` il lavoro pianificato del
        riepilogo continuava a spedire — a una persona che si e' disiscritta.
        E' il modo piu' rapido per farsi segnalare come posta indesiderata e
        rovinare la reputazione del dominio per tutti gli altri.
      */
      value: { ...precedenti, emailNotifications: false, digestEnabled: false },
    },
    { onConflict: 'user_id,key' }
  );

  return !error;
}

function pagina(titolo: string, messaggio: string, stato: number) {
  // Pagina minima e autosufficiente: la vede chi ha appena cliccato dentro un
  // client di posta, spesso in una finestra senza il resto dell'applicazione.
  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titolo}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #f6f7f9;
         color: #1f2937; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 24px; }
  main { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
         padding: 32px; max-width: 30rem; }
  h1 { font-size: 1.25rem; margin: 0 0 12px; }
  p { line-height: 1.6; margin: 0; color: #4b5563; }
</style>
</head>
<body><main><h1>${titolo}</h1><p>${messaggio}</p></main></body>
</html>`;

  return new Response(html, {
    status: stato,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const fetch = withErrors(async (request: Request) => {
  const gettone = new URL(request.url).searchParams.get('g');
  const riuscito = await spegniEmail(gettone);

  // Il POST arriva dal client di posta, non da una persona: si risponde in
  // JSON e non con una pagina, che nessuno vedrebbe.
  if (request.method === 'POST') {
    return riuscito
      ? jsonResponse({ ok: true })
      : jsonResponse({ error: 'Collegamento non valido' }, { status: 400 });
  }

  return riuscito
    ? pagina(
        'Email disattivate',
        'Non riceverai piu’ email di notifica da TaskFlow. Le notifiche dentro l’applicazione restano attive: puoi riaccendere le email quando vuoi dalle preferenze di notifica.'
      , 200)
    : pagina(
        'Collegamento non valido',
        'Questo collegamento di disiscrizione non e’ valido o e’ scaduto. Puoi disattivare le email dalle preferenze di notifica dentro l’applicazione.',
        400
      );
});
