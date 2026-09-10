export const runtime = 'edge';

import { createSupabaseAdminClient, jsonResponse, withErrors } from '../_lib/supabase.js';
import {
  MAX_SERIE_LETTE,
  TETTO_OCCORRENZE_PER_ESECUZIONE,
  prossimaOccorrenza,
  regolaValida,
} from '../_lib/ricorrenza.js';

/**
 * Rinnovo dei task ricorrenti, da un lavoro pianificato.
 *
 * I controlli periodici — estintori, impianti, planimetrie — non finiscono
 * quando si spunta la casella: si ripresentano. Finora la regola si poteva
 * salvare (`tasks.recurrence`, migrazione 0020) ma non la leggeva nessuno, e
 * la prossima verifica esisteva soltanto nella testa di chi se la ricordava.
 * Questo e' il pezzo che la crea.
 *
 * Il COSA vuol dire una regola sta tutto in `_lib/ricorrenza.ts`, dove e'
 * verificabile senza un database: qui c'e' solo QUALI serie rinnovare e la
 * difesa contro i doppioni.
 *
 * IL DOPPIONE E' IL GUASTO PRINCIPALE di questa funzione. Un promemoria
 * spedito due volte e' una seccatura; un controllo di sicurezza duplicato
 * sporca il registro degli adempimenti, che e' il documento che qualcuno
 * guardera'. Le difese sono tre, in ordine di solidita':
 *
 *   1. Un indice unico parziale su `(recurrence_parent, due_date)`. E' l'unica
 *      difesa che regge anche se due esecuzioni si sovrappongono, perche' vive
 *      nel database e non nella memoria di un processo. L'SQL sta nel rapporto
 *      di consegna: finche' non e' applicato, restano attive solo le altre due.
 *   2. Il filtro in SQL qui sotto: nessuna nuova occorrenza se la serie ne ha
 *      gia' una aperta. E' cio' che impedisce la seconda copia quando qualcuno
 *      riapre e richiude un task.
 *   3. Il fatto che la data si calcoli dalla SCADENZA dell'occorrenza chiusa e
 *      non da "adesso": ricalcolare due volte da' sempre la stessa data, che e'
 *      cio' che rende efficace il punto 1.
 */

/** Uno stato terminale solo: tutto il resto e' "ancora aperto". */
const STATO_COMPLETATO = 'completed';

export const fetch = withErrors(async (request: Request) => {
  /**
   * Autenticazione dello scheduler, identica a quella degli altri due lavori
   * pianificati. Qui la rotta CREA righe: lasciata aperta sarebbe un pulsante
   * "riempi l'elenco di task" esposto su internet, per giunta senza limite di
   * chiamate. Senza CRON_SECRET configurata si rifiuta di funzionare.
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

  const admin = createSupabaseAdminClient();
  const adesso = new Date();

  const conteggi = {
    esaminati: 0,
    serie: 0,
    create: 0,
    saltati: {
      serieAperta: 0,
      serieFinita: 0,
      regolaNonValida: 0,
      doppione: 0,
      inserimentoFallito: 0,
    },
    tettoRaggiunto: false,
    tetto: TETTO_OCCORRENZE_PER_ESECUZIONE,
  };

  /**
   * I candidati: task COMPLETATI che portano una regola.
   *
   * Tutti e tre i filtri sono in SQL e non in memoria — `status`, la presenza
   * della regola e l'archiviazione — perche' altrimenti questa lettura
   * scaricherebbe l'intero archivio dei task di ogni organizzazione a ogni
   * esecuzione. L'indice parziale `tasks_ricorrenti_idx` (migrazione 0020)
   * copre gia' la condizione sulla ricorrenza.
   *
   * Un task archiviato non si rinnova: archiviare una serie e' il modo con cui
   * si smette di riceverla senza cancellarne la storia.
   */
  const { data: completati, error: erroreCompletati } = await admin
    .from('tasks')
    .select(
      'id, organization_id, title, description, assignee_id, priority, department, labels, estimate_minutes, due_date, updated_at, created_by, recurrence, recurrence_parent, subtasks, watchers, blocked_by, requires_approval, approved_by, approved_at'
    )
    .eq('status', STATO_COMPLETATO)
    .not('recurrence', 'is', null)
    .is('archived_at', null)
    // Le chiusure piu' recenti per prime: se si tocca il tetto, e' meglio aver
    // rinnovato le serie appena completate che quelle ferme da mesi.
    .order('updated_at', { ascending: false })
    .limit(MAX_SERIE_LETTE);

  if (erroreCompletati) {
    return jsonResponse({ error: erroreCompletati.message }, { status: 500 });
  }

  const righe = completati ?? [];
  conteggi.esaminati = righe.length;
  if (righe.length === 0) {
    return jsonResponse(conteggi);
  }

  /**
   * Una serie sola per gruppo, e sempre la piu' avanzata.
   *
   * La stessa serie puo' avere piu' occorrenze completate: se si calcolasse la
   * prossima data a partire da ciascuna, la prima esecuzione creerebbe l'intera
   * storia passata della serie tutta in una volta. Conta solo l'ultima chiusa,
   * cioe' quella con la scadenza piu' avanti.
   *
   * `recurrence_parent ?? id` e' l'identita' della serie: la prima occorrenza
   * non ha genitore ed e' genitore di se stessa.
   */
  type Riga = (typeof righe)[number];
  const ultimaPerSerie = new Map<string, { riga: Riga; base: Date }>();

  for (const riga of righe) {
    /*
      Una serie che aspetta un visto non si rinnova.

      `status = 'completed'` non vuol dire chiuso: se l'occorrenza richiede
      un'approvazione e non ce l'ha, il lavoro e' consegnato ma non concluso.
      Rinnovando si creava la successiva mentre la precedente aspettava ancora,
      e se poi il visto veniva negato — il rifiuto riporta a "in corso" — la
      serie si ritrovava con due occorrenze aperte insieme.
    */
    if (riga.requires_approval === true && !(riga.approved_by && riga.approved_at)) {
      continue;
    }

    // Senza scadenza non c'e' un ancoraggio della cadenza: si ripiega
    // sull'ultima modifica (in pratica il momento della chiusura) e solo in
    // ultimo su adesso. Cosi' una serie senza date non resta ferma per sempre.
    const grezza = riga.due_date ?? riga.updated_at ?? null;
    const base = grezza ? new Date(grezza) : adesso;
    if (Number.isNaN(base.getTime())) continue;

    const serie = (riga.recurrence_parent as string | null) ?? (riga.id as string);
    const precedente = ultimaPerSerie.get(serie);
    if (!precedente || base.getTime() > precedente.base.getTime()) {
      ultimaPerSerie.set(serie, { riga, base });
    }
  }

  const idSerie = Array.from(ultimaPerSerie.keys());
  conteggi.serie = idSerie.length;

  /**
   * Le serie che hanno gia' qualcosa di aperto.
   *
   * Due letture e non un giro in memoria su tutti i task: la condizione "esiste
   * un'occorrenza non completata" si valuta nel database, sulle sole serie
   * candidate. La prima cerca fra le occorrenze figlie, la seconda fra le
   * capostipite — che non hanno `recurrence_parent` e quindi la prima query non
   * le vedrebbe. Il caso esiste: la prima occorrenza puo' essere ancora aperta
   * mentre una successiva e' gia' stata chiusa.
   */
  const [figlieAperte, capostipiteAperte] = await Promise.all([
    admin
      .from('tasks')
      .select('recurrence_parent')
      .in('recurrence_parent', idSerie)
      .neq('status', STATO_COMPLETATO)
      .is('archived_at', null),
    admin
      .from('tasks')
      .select('id')
      .in('id', idSerie)
      .neq('status', STATO_COMPLETATO)
      .is('archived_at', null),
  ]);

  if (figlieAperte.error) {
    return jsonResponse({ error: figlieAperte.error.message }, { status: 500 });
  }
  if (capostipiteAperte.error) {
    return jsonResponse({ error: capostipiteAperte.error.message }, { status: 500 });
  }

  const conAperta = new Set<string>();
  for (const r of figlieAperte.data ?? []) {
    if (r.recurrence_parent) conAperta.add(r.recurrence_parent as string);
  }
  for (const r of capostipiteAperte.data ?? []) {
    conAperta.add(r.id as string);
  }

  for (const [serie, { riga, base }] of ultimaPerSerie) {
    if (conteggi.create >= TETTO_OCCORRENZE_PER_ESECUZIONE) {
      conteggi.tettoRaggiunto = true;
      break;
    }

    if (conAperta.has(serie)) {
      conteggi.saltati.serieAperta += 1;
      continue;
    }

    // La regola arriva da un jsonb: `regolaValida` non lancia e restituisce
    // null su qualunque cosa non sia una regola riconoscibile. Una riga
    // corrotta va saltata, non deve fermare le altre organizzazioni.
    const regola = regolaValida(riga.recurrence);
    if (!regola) {
      conteggi.saltati.regolaNonValida += 1;
      continue;
    }

    const prossima = prossimaOccorrenza(regola, base, adesso);
    if (!prossima) {
      // La serie ha superato la sua data di fine: e' il modo normale in cui
      // una ricorrenza si esaurisce, non un errore.
      conteggi.saltati.serieFinita += 1;
      continue;
    }

    /**
     * `spent_minutes` non si copia: il tempo impiegato appartiene
     * all'occorrenza chiusa. `status` riparte da zero e la nuova riga eredita
     * la regola, cosi' la serie continua anche se la capostipite viene
     * archiviata.
     */
    const { error: erroreInserimento } = await admin.from('tasks').insert({
      organization_id: riga.organization_id,
      title: riga.title,
      description: riga.description ?? '',
      assignee_id: riga.assignee_id,
      priority: riga.priority,
      department: riga.department,
      labels: riga.labels ?? [],
      estimate_minutes: riga.estimate_minutes,
      /*
        Cio' che descrive il LAVORO si copia; cio' che appartiene
        all'esecuzione appena chiusa no.
        - `subtasks`: i passi del controllo sono la sostanza della checklist.
          Senza, la nuova occorrenza era un titolo vuoto e chi la eseguiva non
          sapeva cosa verificare — e non poteva nemmeno riaggiungerli.
          Le spunte si azzerano: sono dell'esecuzione precedente.
        - `requires_approval`: un controllo periodico che richiede un visto lo
          richiede ogni volta. Perderlo dalla seconda occorrenza in poi e' un
          adempimento che si spegne da solo, in silenzio.
        - `watchers`: chi segue la serie continua a seguirla.
        - `blocked_by`: se quel lavoro dipendeva da un altro, ci dipende ancora.
        Non si copiano: `spent_minutes` (tempo speso li'), il visto gia' dato,
        e ovviamente lo stato.
      */
      subtasks: (Array.isArray(riga.subtasks) ? riga.subtasks : []).map((p) => ({
        ...(p as Record<string, unknown>),
        done: false,
        doneAt: null,
        doneBy: null,
      })),
      watchers: riga.watchers ?? [],
      blocked_by: riga.blocked_by ?? [],
      requires_approval: riga.requires_approval ?? false,
      status: 'not-started',
      due_date: prossima.toISOString(),
      created_by: riga.created_by,
      recurrence: regola,
      recurrence_parent: serie,
    });

    if (erroreInserimento) {
      // 23505 e' l'indice unico su (recurrence_parent, due_date): qui non e' un
      // guasto ma la difesa che ha fatto il suo lavoro — l'occorrenza esisteva
      // gia', creata da un'esecuzione sovrapposta.
      if (erroreInserimento.code === '23505') {
        conteggi.saltati.doppione += 1;
      } else {
        conteggi.saltati.inserimentoFallito += 1;
        console.error(
          `[ricorrenze] occorrenza non creata per la serie ${serie}:`,
          erroreInserimento.message
        );
      }
      continue;
    }

    // La serie ha di nuovo qualcosa di aperto: registrarlo subito evita che un
    // secondo candidato della stessa serie, arrivato per altra via, ne crei
    // un'altra nello stesso giro.
    conAperta.add(serie);
    conteggi.create += 1;
  }

  return jsonResponse(conteggi);
});
