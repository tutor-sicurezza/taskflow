export const runtime = 'edge';

import { createSupabaseAdminClient, jsonResponse, withErrors } from '../_lib/supabase.js';
import { verificaGettone } from '../_lib/disiscrizione.js';
import { chiavePreferenze } from '../_lib/preferenzeNotifiche.js';

/**
 * Spegne le email di notifica per chi arriva dal collegamento in fondo a
 * un'email.
 *
 * Due modi di arrivarci, ed e' voluto — ma solo uno dei due scrive.
 *
 * Il POST senza corpo e' quello che usano Gmail e gli altri quando l'utente
 * preme "Annulla iscrizione" nell'interfaccia della posta (RFC 8058): deve
 * funzionare senza che nessuno apra una pagina, e infatti spegne subito.
 *
 * Il GET, invece, NON SCRIVE PIU' NIENTE: mostra una pagina con un pulsante.
 * Prima spegneva direttamente, ed era un difetto serio anche se non lo
 * sembrava. Quel collegamento vive dentro un'email, e i sistemi di scansione
 * dei link lo seguono da soli: Outlook ATP Safe Links, i gateway antispam
 * aziendali, i prefetcher dei client di posta. Risultato: la persona veniva
 * disiscritta senza aver cliccato niente e senza ricevere nessun avviso, e
 * poi "non mi arrivano piu' le notifiche" diventava un problema che nessuno
 * sapeva spiegare, perche' nell'applicazione non c'e' niente che dica che
 * qualcosa le ha spente.
 *
 * Regola generale, non un caso particolare: una GET non cambia lo stato.
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

function pagina(titolo: string, messaggio: string, stato: number, extra = '') {
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
  button { margin-top: 20px; font: inherit; font-weight: 600; color: #fff;
           background: #1f2937; border: 0; border-radius: 8px;
           padding: 10px 18px; cursor: pointer; }
</style>
</head>
<body><main><h1>${titolo}</h1><p>${messaggio}</p>${extra}</main></body>
</html>`;

  return new Response(html, {
    status: stato,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

const NON_VALIDO =
  'Questo collegamento di disiscrizione non e’ valido o e’ scaduto. Puoi disattivare le email dalle preferenze di notifica dentro l’applicazione.';

const FATTO =
  'Non riceverai piu’ email di notifica da TaskFlow. Le notifiche dentro l’applicazione restano attive: puoi riaccendere le email quando vuoi dalle preferenze di notifica.';

export const fetch = withErrors(async (request: Request) => {
  const gettone = new URL(request.url).searchParams.get('g');

  if (request.method === 'POST') {
    /*
      Da chi arriva questo POST.

      Senza corpo e' il client di posta (RFC 8058), e si risponde in JSON:
      nessuno vedrebbe una pagina. Con `conferma=web` e' il pulsante della
      pagina qui sotto, e allora si risponde con una pagina, altrimenti la
      persona si troverebbe davanti del JSON crudo.
    */
    const corpo = await request.text().catch(() => '');
    const dalPulsante = new URLSearchParams(corpo).get('conferma') === 'web';

    const riuscito = await spegniEmail(gettone);

    if (dalPulsante) {
      return riuscito
        ? pagina('Email disattivate', FATTO, 200)
        : pagina('Collegamento non valido', NON_VALIDO, 400);
    }

    return riuscito
      ? jsonResponse({ ok: true })
      : jsonResponse({ error: 'Collegamento non valido' }, { status: 400 });
  }

  /*
    GET: si controlla che il gettone valga, e non si scrive niente.

    Il modulo non ha `action`, quindi manda il POST a QUESTO stesso indirizzo,
    gettone compreso: cosi' il gettone non va riscritto dentro l'HTML, e non
    c'e' niente da ripulire.
  */
  const valido = gettone ? Boolean(await verificaGettone(gettone)) : false;

  if (!valido) {
    return pagina('Collegamento non valido', NON_VALIDO, 400);
  }

  return pagina(
    'Vuoi disattivare le email?',
    'Smetterai di ricevere email di notifica da TaskFlow. Le notifiche dentro l’applicazione restano attive.',
    200,
    '<form method="post"><input type="hidden" name="conferma" value="web">' +
      '<button type="submit">Disattiva le email</button></form>'
  );
});
