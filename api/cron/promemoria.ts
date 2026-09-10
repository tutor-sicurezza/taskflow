export const runtime = 'edge';

import { createSupabaseAdminClient, jsonResponse, withErrors } from '../_lib/supabase.js';
import { getRequiredEnv } from '../_lib/env.js';
import { componiPerDestinatario } from '../_lib/composizione.js';
import { spedisci } from '../_lib/invio.js';
import {
  FINESTRA_DUE_SOON_MS,
  MAX_TASK_LETTI,
  TETTO_EMAIL_PER_ESECUZIONE,
  classificaTask,
  costruisciTaskUrl,
  type Conteggi,
  type Promemoria,
} from '../_lib/promemoriaLogica.js';

/**
 * Promemoria di scadenza, spediti da un lavoro pianificato.
 *
 * `task_due_soon` e `task_overdue` sono le uniche due notifiche che non
 * dipendono da un'azione: nessuno "provoca" una scadenza. I modelli
 * esistevano gia' ma non li spediva nessuno, perche' mancava il pezzo che
 * guarda l'orologio. Questo e' quel pezzo, invocato dallo scheduler di Vercel
 * (vedi la sezione `crons` in vercel.json).
 *
 * Tutto cio' che riguarda COSA scrivere resta in `composizione.ts` e COME
 * consegnarlo in `invio.ts`: qui si decide solo QUALI task meritano un
 * promemoria e si tiene il conto di quelli gia' avvisati.
 */

export const fetch = withErrors(async (request: Request) => {
  /**
   * Autenticazione dello scheduler.
   *
   * Vercel aggiunge `Authorization: Bearer <CRON_SECRET>` solo se la variabile
   * e' configurata. Se non lo e', questa rotta resterebbe un endpoint pubblico
   * capace di spedire posta a tutti gli assegnatari: rifiutare e non
   * funzionare e' di gran lunga preferibile.
   */
  const segreto = process.env.CRON_SECRET;
  if (!segreto) {
    return jsonResponse(
      { error: 'CRON_SECRET non configurata: il lavoro pianificato resta disabilitato' },
      { status: 503 }
    );
  }

  // Confronto secco con `===`. Un confronto a tempo costante qui non
  // aggiungerebbe nulla: il segreto e' generato dalla piattaforma e non e' una
  // password indovinabile, e la variabilita' della rete verso una funzione
  // serverless copre ampiamente le differenze misurabili. In cambio, `===` e'
  // l'unica versione che si legge senza dubbi su cosa sta confrontando.
  const atteso = `Bearer ${segreto}`;
  if (request.headers.get('authorization') !== atteso) {
    return jsonResponse({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { appUrl } = getRequiredEnv();
  const admin = createSupabaseAdminClient();
  const adesso = new Date();
  const limiteSuperiore = new Date(adesso.getTime() + FINESTRA_DUE_SOON_MS);

  const conteggi: Conteggi = {
    esaminati: 0,
    spediti: 0,
    saltati: {
      nienteDaFare: 0,
      giaAvvisati: 0,
      senzaEmail: 0,
      preferenzeOModello: 0,
      invioFallito: 0,
    },
    tettoRaggiunto: false,
  };

  // Il filtro sul database e' volutamente largo (tutto cio' che scade entro il
  // limite superiore): la classificazione fine, e i suoi casi limite, stanno
  // in `classificaTask`, dove sono verificabili senza un database.
  const { data: task, error: erroreTask } = await admin
    .from('tasks')
    .select('id, organization_id, title, description, assignee_id, priority, status, due_date')
    .neq('status', 'completed')
    .not('assignee_id', 'is', null)
    .lte('due_date', limiteSuperiore.toISOString())
    // I piu' in ritardo per primi: se si tocca il tetto, e' meglio che le
    // email uscite siano quelle che pesano di piu'.
    .order('due_date', { ascending: true })
    .limit(MAX_TASK_LETTI);

  if (erroreTask) {
    return jsonResponse({ error: erroreTask.message }, { status: 500 });
  }

  const righe = task ?? [];
  conteggi.esaminati = righe.length;

  const candidati: { riga: (typeof righe)[number]; tipo: Promemoria }[] = [];
  for (const riga of righe) {
    const tipo = classificaTask(riga, adesso);
    if (tipo) candidati.push({ riga, tipo });
    else conteggi.saltati.nienteDaFare += 1;
  }

  if (candidati.length === 0) {
    return jsonResponse(conteggi);
  }

  /**
   * Memoria degli invii gia' fatti.
   *
   * Senza, il lavoro rispedirebbe la stessa email a ogni esecuzione, per tutti
   * i giorni in cui il task resta scaduto. Si legge in blocco e non un task
   * alla volta: sono al piu' MAX_TASK_LETTI id, e una query per ciascuno
   * moltiplicherebbe per mille la durata dell'esecuzione.
   */
  const { data: gia, error: erroreGia } = await admin
    .from('email_promemoria_inviati')
    .select('task_id, tipo')
    .in(
      'task_id',
      candidati.map((voce) => voce.riga.id)
    );

  if (erroreGia) {
    return jsonResponse({ error: erroreGia.message }, { status: 500 });
  }

  const giaAvvisati = new Set((gia ?? []).map((r) => `${r.task_id}:${r.tipo}`));

  // I destinatari, in una sola lettura per lo stesso motivo di sopra.
  const idAssegnatari = Array.from(
    new Set(candidati.map((voce) => voce.riga.assignee_id as string))
  );
  const { data: profili } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', idAssegnatari);

  const perId = new Map((profili ?? []).map((p) => [p.id, p]));

  for (const { riga, tipo } of candidati) {
    if (conteggi.spediti >= TETTO_EMAIL_PER_ESECUZIONE) {
      conteggi.tettoRaggiunto = true;
      break;
    }

    if (giaAvvisati.has(`${riga.id}:${tipo}`)) {
      conteggi.saltati.giaAvvisati += 1;
      continue;
    }

    const destinatario = perId.get(riga.assignee_id as string);
    if (!destinatario?.email) {
      conteggi.saltati.senzaEmail += 1;
      continue;
    }

    /**
     * Un task che va storto non deve fermare gli altri: il ciclo spedisce
     * decine di email indipendenti, e una singola risposta strana del provider
     * lascerebbe senza promemoria tutti quelli in coda — ogni giorno, finche'
     * qualcuno non se ne accorge.
     */
    try {
      const composta = await componiPerDestinatario(admin, {
        tenantId: riga.organization_id,
        destinatarioId: riga.assignee_id as string,
        tipo,
        dati: {
          recipientName: destinatario.full_name ?? undefined,
          recipientEmail: destinatario.email,
          taskTitle: riga.title ?? undefined,
          taskDescription: riga.description ?? undefined,
          priority: riga.priority ?? undefined,
          dueDate: riga.due_date ?? undefined,
          taskStatus: riga.status ?? undefined,
          taskUrl: costruisciTaskUrl(appUrl, riga.id),
        },
      });

      if (!composta.spedibile) {
        // Comprende il caso normale in cui il destinatario ha spento questo
        // tipo di notifica: non e' un errore e non va contato come tale.
        conteggi.saltati.preferenzeOModello += 1;
        continue;
      }

      const esito = await spedisci({
        to: destinatario.email,
        subject: composta.subject,
        html: composta.htmlContent,
        text: composta.textContent,
        tenantId: riga.organization_id,
        // Nessun utente ha agito: e' l'orologio ad aver deciso. `invio.ts`
        // registra comunque l'esito in email_delivery_logs.
        userId: null,
      });

      if (!esito.ok) {
        conteggi.saltati.invioFallito += 1;
        continue;
      }

      /**
       * Si registra DOPO un invio riuscito: un fallimento deve poter essere
       * ritentato alla prossima esecuzione.
       *
       * La riga e' legata a (task, tipo) e non alla scadenza: se `due_date`
       * viene spostata in avanti il promemoria NON riparte. E' una scelta, non
       * una dimenticanza — includere la data renderebbe il vincolo di unicita'
       * inefficace e riaprirebbe la porta ai doppioni ogni volta che qualcuno
       * ritocca una scadenza.
       */
      await admin
        .from('email_promemoria_inviati')
        .upsert({ task_id: riga.id, tipo }, { onConflict: 'task_id,tipo' });

      conteggi.spediti += 1;
    } catch {
      conteggi.saltati.invioFallito += 1;
    }
  }

  return jsonResponse(conteggi);
});
