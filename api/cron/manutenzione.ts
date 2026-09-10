export const runtime = 'edge';

import { createSupabaseAdminClient, jsonResponse, withErrors } from '../_lib/supabase.js';
import { getRequiredEnv } from '../_lib/env.js';
import { componiPerDestinatario } from '../_lib/composizione.js';
import { spedisci } from '../_lib/invio.js';
import { costruisciTaskUrl } from '../_lib/promemoriaLogica.js';
import {
  GIORNI_ARCHIVIAZIONE,
  GIORNI_ESCALATION,
  MAX_TASK_COMPLETATI_LETTI,
  MAX_TASK_RITARDO_LETTI,
  RUOLI_ESCALATION,
  TETTO_ARCHIVIAZIONI_PER_ESECUZIONE,
  TETTO_EMAIL_ESCALATION_PER_ESECUZIONE,
  TETTO_TASK_SCALATI_PER_ESECUZIONE,
  TIPO_ESCALATION,
  TIPO_NOTIFICA_ESCALATION,
  daArchiviare,
  daScalare,
  dataCompletamento,
  giorniDiRitardo,
  messaggioEscalation,
  sogliaRitardo,
  type ConteggiManutenzione,
  type TaskDaManutenere,
} from '../_lib/manutenzioneTask.js';

/**
 * Manutenzione periodica dei task: archiviazione ed escalation.
 *
 * Due funzioni che l'autore aveva dichiarato nelle impostazioni di sistema e
 * mai costruito — gli interruttori c'erano, non pilotavano niente. Qui si
 * fanno davvero:
 *
 *   1. ARCHIVIAZIONE. I task completati restano nell'elenco per sempre. Dopo
 *      GIORNI_ARCHIVIAZIONE dal completamento si scrive `archived_at = now()`.
 *      Archiviare NON e' cancellare: la riga resta con tutta la sua
 *      cronologia, esce dalle viste correnti (l'indice parziale
 *      `tasks_org_attivi_idx` della 0020 esiste per quello) e continua a
 *      contare nelle analisi storiche. Nessun dato se ne va.
 *   2. ESCALATION. Un task in ritardo da GIORNI_ESCALATION viene segnalato ai
 *      responsabili dell'organizzazione, non all'assegnatario: lui e' gia'
 *      stato avvisato dai promemoria, e se dopo una settimana il task e'
 *      ancora aperto e' perche' da solo non lo chiude.
 *
 * Le due soglie, i tetti e le regole pure stanno in `_lib/manutenzioneTask.ts`,
 * dove sono verificabili senza un database; qui c'e' solo l'esecuzione.
 *
 * Invocata dallo scheduler di Vercel alle 06:00 UTC (vedi `crons` in
 * vercel.json). L'orario non e' casuale: sta PRIMA dei promemoria delle 07:00,
 * cosi' un task archiviato stamattina non genera nello stesso giorno un
 * promemoria per una scadenza che non riguarda piu' nessuno, e resta fuori
 * dall'ora di punta delle 03:30, quando gira la pulizia. Prima dell'inizio
 * della giornata lavorativa europea, perche' un'escalation serve a chi la
 * trova aprendo la posta, non a chi la riceve a meta' pomeriggio.
 */

/** Quante righe per UPDATE. Un `in (...)` con 500 uuid supera i limiti di URL. */
const BLOCCO_ARCHIVIAZIONE = 100;

export const fetch = withErrors(async (request: Request) => {
  /**
   * Autenticazione dello scheduler, identica a quella delle altre due rotte
   * pianificate. Qui serve per entrambi i compiti: senza, questo endpoint
   * sarebbe insieme un pulsante "svuota l'elenco dei task" e un modo per far
   * partire posta ai dirigenti di ogni organizzazione. Se CRON_SECRET non e'
   * configurata la rotta si rifiuta di funzionare.
   */
  const segreto = process.env.CRON_SECRET;
  if (!segreto) {
    return jsonResponse(
      { error: 'CRON_SECRET non configurata: il lavoro pianificato resta disabilitato' },
      { status: 503 }
    );
  }

  const atteso = `Bearer ${segreto}`;
  if (request.headers.get('authorization') !== atteso) {
    return jsonResponse({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { appUrl } = getRequiredEnv();
  const admin = createSupabaseAdminClient();
  const adesso = new Date();
  const errori: string[] = [];

  const conteggi: ConteggiManutenzione = {
    archiviazione: {
      esaminati: 0,
      archiviati: 0,
      conRipiego: 0,
      giorni: GIORNI_ARCHIVIAZIONE,
      tettoRaggiunto: false,
    },
    escalation: {
      esaminati: 0,
      scalati: 0,
      emailSpedite: 0,
      notificheCreate: 0,
      saltati: {
        giaScalati: 0,
        nonPiuInRitardo: 0,
        senzaResponsabili: 0,
        preferenzeOModello: 0,
        invioFallito: 0,
      },
      giorni: GIORNI_ESCALATION,
      tettoRaggiunto: false,
    },
  };

  // -------------------------------------------------------------------------
  // 1) Archiviazione dei completati
  // -------------------------------------------------------------------------

  /**
   * Nessun filtro sulla data nella query, di proposito.
   *
   * La data di completamento NON e' una colonna: sta dentro `activities`, e
   * `updated_at` non la sostituisce — un task chiuso quaranta giorni fa e
   * ritoccato ieri ha `updated_at` di ieri ma va archiviato lo stesso. Un
   * filtro su `updated_at` sembrerebbe un'ottimizzazione e sarebbe invece un
   * insieme di task che non vengono archiviati mai.
   *
   * L'ordinamento crescente su `updated_at` mette davanti i piu' fermi, cioe'
   * quelli quasi certamente archiviabili: se il tetto morde, l'esecuzione ha
   * comunque fatto il lavoro che conta.
   */
  const { data: completati, error: erroreCompletati } = await admin
    .from('tasks')
    .select('id, status, updated_at, archived_at, activities, requires_approval, approved_by, approved_at')
    .eq('status', 'completed')
    .is('archived_at', null)
    .order('updated_at', { ascending: true })
    .limit(MAX_TASK_COMPLETATI_LETTI);

  if (erroreCompletati) {
    errori.push(`archiviazione/lettura: ${erroreCompletati.message}`);
  } else {
    const righe = (completati ?? []) as (TaskDaManutenere & { id: string })[];
    conteggi.archiviazione.esaminati = righe.length;

    const daChiudere: string[] = [];
    for (const riga of righe) {
      if (daChiudere.length >= TETTO_ARCHIVIAZIONI_PER_ESECUZIONE) {
        conteggi.archiviazione.tettoRaggiunto = true;
        break;
      }
      if (!daArchiviare(riga, GIORNI_ARCHIVIAZIONE, adesso)) continue;
      // Contato a parte perche' e' un dato di salute: se il ripiego riguarda
      // quasi tutto, vuol dire che la cronologia non viene scritta e il difetto
      // e' altrove.
      if (!dataCompletamento(riga)) conteggi.archiviazione.conRipiego += 1;
      daChiudere.push(riga.id);
    }

    const marcatore = adesso.toISOString();
    for (let i = 0; i < daChiudere.length; i += BLOCCO_ARCHIVIAZIONE) {
      const blocco = daChiudere.slice(i, i + BLOCCO_ARCHIVIAZIONE);
      /**
       * `.is('archived_at', null)` ripetuto anche nell'UPDATE: fra la lettura
       * e la scrittura qualcuno puo' aver archiviato a mano, e riscrivere la
       * sua data con quella di adesso cancellerebbe l'unica informazione che
       * la colonna porta.
       */
      const { error: erroreUpdate } = await admin
        .from('tasks')
        .update({ archived_at: marcatore })
        .in('id', blocco)
        .is('archived_at', null);

      if (erroreUpdate) {
        errori.push(`archiviazione/scrittura: ${erroreUpdate.message}`);
        break;
      }
      conteggi.archiviazione.archiviati += blocco.length;
    }
  }

  // -------------------------------------------------------------------------
  // 2) Escalation dei task in ritardo
  // -------------------------------------------------------------------------

  const limite = sogliaRitardo(adesso, GIORNI_ESCALATION);

  /**
   * Il filtro fine (`daScalare`) e' verificato nei test; qui la query fa il
   * grosso del lavoro perche' senza filtro sul database si leggerebbe ogni
   * task scaduto dell'installazione. `due_date <= limite` su NULL e' falso:
   * un task senza scadenza non compare, che e' esattamente la regola voluta —
   * la scadenza e' facoltativa e chi non ce l'ha non e' in ritardo.
   */
  const { data: inRitardo, error: erroreRitardo } = await admin
    .from('tasks')
    .select(
      'id, organization_id, title, description, assignee_id, priority, status, due_date, archived_at, requires_approval, approved_by, approved_at'
    )
    /*
      Il filtro sullo stato NON si fa piu' qui: un task "completato" che aspetta
      un visto e' lavoro aperto, e escluderlo con la query lo rendeva invisibile
      prima ancora di arrivare a `daScalare`. La decisione sta li', in una
      funzione con i suoi test.
    */
    .or('status.neq.completed,and(requires_approval.is.true,approved_by.is.null)')
    .is('archived_at', null)
    .lte('due_date', limite)
    // I piu' vecchi per primi: se il tetto morde, escono le segnalazioni che
    // pesano di piu'.
    .order('due_date', { ascending: true })
    .limit(MAX_TASK_RITARDO_LETTI);

  if (erroreRitardo) {
    errori.push(`escalation/lettura: ${erroreRitardo.message}`);
    return rispondi(conteggi, errori);
  }

  const candidati = inRitardo ?? [];
  conteggi.escalation.esaminati = candidati.length;

  if (candidati.length === 0) {
    return rispondi(conteggi, errori);
  }

  /**
   * Memoria delle escalation gia' fatte.
   *
   * Si riusa `email_promemoria_inviati` con un `tipo` diverso: il vincolo di
   * unicita' su (task_id, tipo) e' esattamente la garanzia che serve, "una
   * escalation sola per task", e vive nel database invece che in una
   * convenzione. Letta in blocco e non un task alla volta, per lo stesso motivo
   * dei promemoria.
   */
  const { data: gia, error: erroreGia } = await admin
    .from('email_promemoria_inviati')
    .select('task_id, tipo')
    .eq('tipo', TIPO_ESCALATION)
    .in(
      'task_id',
      candidati.map((riga) => riga.id as string)
    );

  if (erroreGia) {
    errori.push(`escalation/memoria: ${erroreGia.message}`);
    return rispondi(conteggi, errori);
  }

  const giaScalati = new Set((gia ?? []).map((r) => r.task_id as string));

  // I responsabili di tutte le organizzazioni coinvolte, in una sola lettura.
  const organizzazioni = Array.from(
    new Set(candidati.map((riga) => riga.organization_id as string))
  );

  const { data: membri, error: erroreMembri } = await admin
    .from('organization_members')
    .select('organization_id, user_id, role')
    .in('organization_id', organizzazioni)
    .in('role', RUOLI_ESCALATION as unknown as string[]);

  if (erroreMembri) {
    errori.push(`escalation/responsabili: ${erroreMembri.message}`);
    return rispondi(conteggi, errori);
  }

  const responsabiliPerOrg = new Map<string, string[]>();
  for (const membro of membri ?? []) {
    const org = membro.organization_id as string;
    const elenco = responsabiliPerOrg.get(org) ?? [];
    elenco.push(membro.user_id as string);
    responsabiliPerOrg.set(org, elenco);
  }

  const { data: profili } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in(
      'id',
      Array.from(new Set((membri ?? []).map((m) => m.user_id as string)))
    );

  const profiloPerId = new Map((profili ?? []).map((p) => [p.id as string, p]));

  for (const riga of candidati) {
    if (
      conteggi.escalation.scalati >= TETTO_TASK_SCALATI_PER_ESECUZIONE ||
      conteggi.escalation.emailSpedite >= TETTO_EMAIL_ESCALATION_PER_ESECUZIONE
    ) {
      conteggi.escalation.tettoRaggiunto = true;
      break;
    }

    if (giaScalati.has(riga.id as string)) {
      conteggi.escalation.saltati.giaScalati += 1;
      continue;
    }

    /**
     * Il controllo fine, sulla stessa riga che la query ha gia' filtrato in
     * modo largo. Non e' una ripetizione inutile: la regola su cosa sia "in
     * ritardo da abbastanza" vive in una funzione pura e provata, e questo e'
     * il punto in cui viene applicata davvero. Se un giorno il filtro SQL e la
     * regola divergono, e' la regola a vincere.
     */
    if (!daScalare(riga as TaskDaManutenere, GIORNI_ESCALATION, adesso)) {
      conteggi.escalation.saltati.nonPiuInRitardo += 1;
      continue;
    }

    /**
     * L'assegnatario e' escluso anche quando e' lui stesso un responsabile:
     * ha gia' ricevuto il promemoria di scadenza, e l'escalation esiste per
     * portare il problema a un altro paio di occhi. Se dopo l'esclusione non
     * resta nessuno — un'organizzazione dove l'unico manager e' l'assegnatario
     * — non si spedisce niente e lo si conta: non c'e' nessuno a cui scalare, e
     * inventarsi un destinatario sarebbe peggio del silenzio.
     */
    const destinatari = (responsabiliPerOrg.get(riga.organization_id as string) ?? []).filter(
      (id) => id !== riga.assignee_id
    );

    if (destinatari.length === 0) {
      conteggi.escalation.saltati.senzaResponsabili += 1;
      continue;
    }

    /**
     * Il segno si scrive PRIMA di spedire, al contrario dei promemoria.
     *
     * Li' un invio fallito deve poter essere ritentato, perche' costa una
     * email. Qui il costo e' rovesciato: un'escalation ripetuta sono N email
     * per ogni responsabile, ogni giorno, e il modo tipico in cui si scopre e'
     * che qualcuno disattiva le notifiche. Un'escalation persa e' invece un
     * task che resta segnalato in applicazione e nei conteggi dei ritardi.
     * Fra i due errori possibili si sceglie deliberatamente quello reversibile.
     *
     * Effetto collaterale voluto: finche' il CHECK sulla colonna `tipo` non
     * ammette 'escalation' questo insert fallisce e NON parte nessuna email —
     * la funzione resta inerte e lo dice nella risposta, invece di spedire a
     * raffica senza memoria di averlo fatto.
     */
    const { error: erroreSegno } = await admin
      .from('email_promemoria_inviati')
      .insert({ task_id: riga.id, tipo: TIPO_ESCALATION });

    if (erroreSegno) {
      // 23505 = un'altra esecuzione ha scalato lo stesso task nel frattempo.
      // Non e' un guasto: e' il vincolo di unicita' che fa il suo lavoro.
      if (erroreSegno.code === '23505') {
        conteggi.escalation.saltati.giaScalati += 1;
        continue;
      }
      // Qualunque altro errore toglie la garanzia di non ripetersi: si ferma
      // qui invece di spedire senza memoria.
      errori.push(`escalation/segno: ${erroreSegno.message}`);
      break;
    }

    conteggi.escalation.scalati += 1;
    const giorni = giorniDiRitardo(riga as TaskDaManutenere, adesso);

    for (const destinatarioId of destinatari) {
      if (conteggi.escalation.emailSpedite >= TETTO_EMAIL_ESCALATION_PER_ESECUZIONE) {
        conteggi.escalation.tettoRaggiunto = true;
        break;
      }

      const profilo = profiloPerId.get(destinatarioId);

      /**
       * Un destinatario che va storto non deve fermare gli altri, e un task
       * che va storto non deve fermare i task successivi: qui si spediscono
       * decine di messaggi indipendenti, e una singola risposta strana del
       * provider lascerebbe senza segnalazione tutto cio' che sta in coda —
       * ogni giorno, finche' qualcuno non se ne accorge.
       */
      try {
        const composta = await componiPerDestinatario(admin, {
          tenantId: riga.organization_id as string,
          destinatarioId,
          tipo: TIPO_NOTIFICA_ESCALATION,
          dati: {
            recipientName: profilo?.full_name ?? undefined,
            recipientEmail: profilo?.email ?? '',
            taskTitle: riga.title ?? undefined,
            taskDescription: riga.description ?? undefined,
            priority: riga.priority ?? undefined,
            dueDate: riga.due_date ?? undefined,
            taskStatus: riga.status ?? undefined,
            taskUrl: costruisciTaskUrl(appUrl, riga.id as string),
          },
        });

        /**
         * La notifica in applicazione si scrive SEMPRE, anche quando l'email
         * non parte: e' il canale che chi ha spento la posta non puo' perdere.
         *
         * `event_key` include l'identificativo del destinatario, a differenza
         * dei promemoria: li' la notifica e' una sola (l'assegnatario), qui ce
         * n'e' una per responsabile, e senza l'id l'indice unico su
         * (organization_id, event_key) ne farebbe passare solo la prima —
         * cioe' un solo manager su cinque verrebbe avvisato, in silenzio.
         */
        const { error: erroreNotifica } = await admin.from('notifications').insert({
          organization_id: riga.organization_id,
          user_id: destinatarioId,
          task_ref: riga.id,
          task_title: riga.title ?? null,
          type: TIPO_NOTIFICA_ESCALATION,
          message: messaggioEscalation(composta.lingua, riga.title ?? '', giorni),
          read: false,
          event_key: `${riga.id}:${TIPO_ESCALATION}:${destinatarioId}`,
        });

        if (erroreNotifica && erroreNotifica.code !== '23505') {
          console.error(
            `[manutenzione] notifica non scritta per ${riga.id}/${destinatarioId}:`,
            erroreNotifica.message
          );
        } else if (!erroreNotifica) {
          conteggi.escalation.notificheCreate += 1;
        }

        if (!composta.spedibile || !profilo?.email) {
          // Caso normale: il responsabile ha spento questo tipo di email, o non
          // ha un recapito. Non e' un errore e l'avviso in applicazione c'e'.
          conteggi.escalation.saltati.preferenzeOModello += 1;
          continue;
        }

        const esito = await spedisci({
          to: profilo.email,
          subject: composta.subject,
          html: composta.htmlContent,
          text: composta.textContent,
          tenantId: riga.organization_id as string,
          // Nessun utente ha agito: e' l'orologio ad aver deciso.
          userId: null,
          destinatarioId,
        });

        if (!esito.ok) {
          conteggi.escalation.saltati.invioFallito += 1;
          continue;
        }

        conteggi.escalation.emailSpedite += 1;
      } catch {
        conteggi.escalation.saltati.invioFallito += 1;
      }
    }
  }

  return rispondi(conteggi, errori);
});

/**
 * Un guasto su un compito non annulla il lavoro fatto sull'altro: si risponde
 * 500 perche' qualcosa e' andato storto davvero — cosi' lo scheduler lo segna
 * come fallito e qualcuno lo vede — ma con dentro i conteggi di cio' che e'
 * comunque riuscito.
 */
function rispondi(conteggi: ConteggiManutenzione, errori: string[]) {
  if (errori.length > 0) {
    return jsonResponse({ ...conteggi, errori }, { status: 500 });
  }
  return jsonResponse(conteggi);
}
