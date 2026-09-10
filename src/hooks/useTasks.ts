import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Task, TaskAttachment, TaskPriority, TaskStatus } from '@/lib/types';

/**
 * I task, letti e scritti sulla tabella public.tasks, una riga per task.
 *
 * Perche' non stanno piu' in app_state: li' erano un unico blob JSON, e la
 * policy di quella tabella ragiona per riga — dove la riga e' l'intero elenco.
 * Chiunque potesse scrivere poteva quindi sostituirlo per intero: una sola
 * chiamata a PostgREST azzerava tutti i task dell'organizzazione, ed e' stato
 * verificato con un account 'member' reale. Nessuna policy sul blob puo'
 * impedirlo, perche' a quel livello "modifico il mio task" e "li cancello
 * tutti" sono la stessa operazione.
 *
 * Con una riga per task valgono finalmente le policy della 0008: crea chi puo'
 * scrivere, modifica l'autore o l'assegnatario o un manager, cancella l'autore
 * o un manager. Il database rifiuta il resto, senza dipendere dall'interfaccia.
 *
 * L'hook espone di proposito la STESSA firma di useKV — `[tasks, setTasks]`
 * con updater sull'array — cosi' i diciannove punti di App.tsx che modificano
 * i task restano invariati. La differenza sta qui dentro: l'array nuovo viene
 * confrontato con quello precedente e tradotto in insert/update/delete per
 * riga. Il terzo elemento restituito, `caricaAllegati`, e' l'unica aggiunta.
 */

interface TaskRow {
  id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  priority: string;
  status: string;
  due_date: string;
  created_at: string;
  comments: unknown;
  activities: unknown;
  /**
   * Assente nella lettura di lista: vedi COLONNE_LISTA. E' `unknown` e non
   * `TaskAttachment[]` perche' arriva anche dal payload realtime, dove nessuno
   * garantisce la forma.
   */
  attachments?: unknown;
  /**
   * Colonna calcolata da Postgres (migrazione 0017): permette alla lista di
   * mostrare la graffetta col numero senza scaricare i file.
   */
  attachments_count?: number;
}

/**
 * Le colonne della lettura di lista. `attachments` NON c'e', di proposito.
 *
 * Gli allegati sono il file intero in base64 dentro il jsonb della riga: una
 * cinquantina di allegati da 2 MB sono oltre 100 MB che viaggiano a OGNI
 * rilettura dell'elenco, per ogni scheda aperta, per mostrare una griglia di
 * schede che degli allegati usa al massimo il numero. Si leggono quindi solo
 * quando servono davvero, cioe' quando si apre il dettaglio di UN task, con
 * `caricaAllegati`.
 *
 * `comments` e `activities` restano: sono testo breve, e li usano il conteggio
 * sulle schede, la cronologia e le menzioni in piu' punti. Toglierli
 * risparmierebbe poco e romperebbe molto.
 */
const COLONNE_LISTA =
  'id, title, description, assignee_id, priority, status, due_date, created_at, comments, activities, attachments_count';

/**
 * Traduce una riga in un task.
 *
 * Nota sulla distinzione fra "nessun allegato" e "allegati non letti": nel
 * primo caso `attachments` e' `[]`, nel secondo resta `undefined`. E' questa
 * differenza a impedire che una scrittura qualunque azzeri gli allegati sul
 * database — vedi `taskToRow`.
 */
function rowToTask(row: TaskRow): Task {
  const task: Task = {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    assigneeId: row.assignee_id,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    dueDate: row.due_date,
    createdAt: row.created_at,
    comments: (row.comments as Task['comments']) ?? [],
    activities: (row.activities as Task['activities']) ?? [],
  };

  // La colonna c'e' solo se qualcuno l'ha chiesta (caricaAllegati) o se e'
  // arrivata dal payload realtime, che porta la riga intera.
  if (typeof row.attachments_count === 'number') {
    task.attachmentsCount = row.attachments_count;
  }

  if ('attachments' in row) {
    task.attachments = (row.attachments as Task['attachments']) ?? [];
  }

  return task;
}

/**
 * Campi scrivibili. `organization_id` e `created_by` li mette solo l'insert.
 *
 * `attachments` viene incluso SOLO se il task ne porta una versione
 * effettivamente letta dal database. Se e' `undefined` la chiave non compare
 * nell'oggetto, quindi PostgREST genera un UPDATE che quella colonna non la
 * nomina e Postgres la lascia esattamente com'e'. E' cosi' che cambiare il
 * titolo di un task di cui non si sono mai letti gli allegati non li cancella:
 * la garanzia non sta in un controllo, sta nel fatto che la colonna non entra
 * mai nella query.
 */
function taskToRow(task: Task): Record<string, unknown> {
  const riga: Record<string, unknown> = {
    title: task.title,
    description: task.description ?? '',
    assignee_id: task.assigneeId || null,
    priority: task.priority,
    status: task.status,
    due_date: task.dueDate,
    comments: task.comments ?? [],
    activities: task.activities ?? [],
    updated_at: new Date().toISOString(),
  };

  if (task.attachments !== undefined) riga.attachments = task.attachments;

  return riga;
}

/**
 * Fonde nello stato la versione appena arrivata dal database.
 *
 * Se l'evento non porta gli allegati ma quelli locali erano gia' stati letti,
 * si tengono: l'alternativa sarebbe farli sparire dal dettaglio aperto a ogni
 * modifica del titolo fatta da un collega.
 */
function fondi(precedente: Task | undefined, arrivato: Task): Task {
  if (arrivato.attachments === undefined && precedente?.attachments !== undefined) {
    return { ...arrivato, attachments: precedente.attachments };
  }
  return arrivato;
}

/** L'elenco e' ordinato per data di creazione crescente, come la query. */
function perDataDiCreazione(a: Task, b: Task): number {
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? -1 : 1;
}

export function useTasks() {
  const { user, organization } = useAuth();
  const [tasks, setTasksState] = useState<Task[]>([]);

  // L'elenco corrente serve dentro `setTasks` senza rientrare nelle dipendenze:
  // altrimenti ogni modifica ricreerebbe la funzione e con essa gli effetti dei
  // componenti che la ricevono.
  const correnti = useRef<Task[]>([]);
  correnti.current = tasks;

  const reload = useCallback(async () => {
    if (!organization?.id) return;

    const { data, error } = await supabase
      .from('tasks')
      .select(COLONNE_LISTA)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[useTasks] lettura fallita:', error.message);
      return;
    }

    const arrivati = (data ?? []).map((r) => rowToTask(r as unknown as TaskRow));

    // Gli allegati gia' letti per il dettaglio aperto sopravvivono alla
    // rilettura: la lista non li porta, e senza questa fusione una rilettura
    // qualunque svuoterebbe la scheda "Allegati" sotto le mani dell'utente.
    setTasksState((precedenti) => {
      const perId = new Map(precedenti.map((t) => [t.id, t]));
      return arrivati.map((t) => fondi(perId.get(t.id), t));
    });
  }, [organization?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Rete di sicurezza: una rilettura completa, al massimo una al secondo.
   *
   * Serve solo quando il payload dell'evento non basta (evento senza riga
   * utilizzabile) o quando un evento e' stato scartato perche' sovrapposto a
   * una nostra scrittura. Il debounce esiste perche' un'operazione in blocco
   * produce un centinaio di eventi in pochi istanti: senza, sarebbero cento
   * SELECT dell'intera tabella.
   */
  const timerReload = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadConDebounce = useCallback(() => {
    if (timerReload.current !== null) clearTimeout(timerReload.current);
    timerReload.current = setTimeout(() => {
      timerReload.current = null;
      void reload();
    }, 1000);
  }, [reload]);

  useEffect(
    () => () => {
      if (timerReload.current !== null) clearTimeout(timerReload.current);
    },
    []
  );

  /**
   * Id dei task con una nostra scrittura ancora in volo, e memoria del fatto
   * che per colpa loro qualche evento e' stato scartato.
   *
   * Gli eventi che tornano indietro mentre stiamo ancora scrivendo possono
   * portare valori gia' superati dallo stato ottimistico (due modifiche rapide
   * sullo stesso task: l'evento della prima arriva dopo la seconda). Applicarli
   * farebbe lampeggiare a schermo il valore vecchio. Si scartano, e alla fine
   * delle scritture si programma una rilettura di controllo: e' l'unico modo di
   * non perdere una modifica di un collega arrivata proprio in quella finestra.
   */
  const scritturePendenti = useRef<Set<string>>(new Set());
  const eventiScartati = useRef(false);

  /** Applica allo stato locale una riga arrivata dal database. */
  const applicaRiga = useCallback((riga: TaskRow) => {
    setTasksState((precedenti) => {
      const arrivato = rowToTask(riga);
      const indice = precedenti.findIndex((t) => t.id === arrivato.id);

      if (indice === -1) {
        return [...precedenti, arrivato].sort(perDataDiCreazione);
      }

      const successivi = precedenti.slice();
      successivi[indice] = fondi(precedenti[indice], arrivato);
      return successivi;
    });
  }, []);

  /**
   * Consegna in tempo reale: le modifiche dei colleghi arrivano senza
   * ricaricare.
   *
   * Prima qui c'era `reload()` secco, senza guardare il payload: una modifica a
   * un task diventava una SELECT dell'INTERA tabella su ogni scheda aperta —
   * con trenta schede, trenta letture complete per un titolo cambiato. Le
   * operazioni in blocco (un centinaio di UPDATE in fila) moltiplicavano tutto
   * per cento. L'evento pero' porta gia' la riga: si applica quella, e la
   * rilettura resta solo come rete di sicurezza, con il debounce.
   */
  useEffect(() => {
    if (!organization?.id) return;

    const channel = supabase
      .channel(`tasks-${organization.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `organization_id=eq.${organization.id}`,
        },
        (payload) => {
          const nuova = payload.new as Partial<TaskRow> | null;
          const vecchia = payload.old as { id?: string } | null;
          const id = nuova?.id ?? vecchia?.id;

          // Un evento su un task che stiamo scrivendo noi: lo stato ottimistico
          // e' piu' aggiornato del payload. Si scarta e si rilegge dopo.
          if (id && scritturePendenti.current.has(id)) {
            eventiScartati.current = true;
            return;
          }

          if (payload.eventType === 'DELETE') {
            // Con REPLICA IDENTITY di default `old` contiene la sola chiave
            // primaria: e' tutto cio' che serve per togliere la riga.
            if (vecchia?.id) {
              const idRimosso = vecchia.id;
              setTasksState((precedenti) => precedenti.filter((t) => t.id !== idRimosso));
            } else {
              reloadConDebounce();
            }
            return;
          }

          // INSERT e UPDATE portano la riga completa. Se per qualche ragione
          // non fosse utilizzabile (payload troncato dal server quando la riga
          // supera il limite di dimensione del canale), si ricade sulla
          // rilettura.
          if (nuova?.id && nuova.created_at) {
            applicaRiga(nuova as TaskRow);
          } else {
            reloadConDebounce();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organization?.id, applicaRiga, reloadConDebounce]);

  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  /**
   * Legge gli allegati di UN task e li mette nello stato locale.
   *
   * Non passa da `setTasks`: aggiorna lo stato e basta, senza generare alcuna
   * scrittura. Da chiamare quando si apre il dettaglio di un task; restituisce
   * anche l'elenco, per chi tiene una copia locale del task da mostrare.
   */
  const caricaAllegati = useCallback(async (taskId: string): Promise<TaskAttachment[]> => {
    const { data, error } = await supabase
      .from('tasks')
      .select('attachments')
      .eq('id', taskId)
      .maybeSingle();

    if (error) {
      console.error('[useTasks] lettura allegati fallita:', error.message);
      return [];
    }

    const allegati = ((data?.attachments as TaskAttachment[] | null) ?? []) as TaskAttachment[];

    setTasksState((precedenti) =>
      precedenti.map((t) => (t.id === taskId ? { ...t, attachments: allegati } : t))
    );

    return allegati;
  }, []);

  /**
   * Ultima difesa contro la cancellazione degli allegati.
   *
   * Ci si arriva solo se qualcuno modifica `attachments` di un task per cui non
   * erano stati letti: in quel caso l'elenco locale e' partito da `[]` e non
   * dagli allegati veri, quindi scriverlo cosi' com'e' li spazzerebbe via. Si
   * rilegge la colonna e si aggiunge soltanto cio' che sul database non c'e'
   * ancora, per id. Una rimozione fatta in questo stato viene ignorata di
   * proposito: fra perdere un allegato appena aggiunto e perderne cinquanta
   * gia' presenti, non e' una scelta difficile.
   *
   * Restituisce l'elenco da scrivere, oppure null se la colonna non va toccata.
   */
  const unisciAllegati = useCallback(async (task: Task): Promise<TaskAttachment[] | null> => {
    console.warn(
      `[useTasks] allegati modificati senza averli letti (task ${task.id}): ` +
        'chiamare caricaAllegati() prima di aprire il dettaglio.'
    );

    const { data, error } = await supabase
      .from('tasks')
      .select('attachments')
      .eq('id', task.id)
      .maybeSingle();

    // Se non si riesce a leggere lo stato reale, non si scrive: meglio
    // un'aggiunta persa che l'elenco azzerato.
    if (error) {
      console.error('[useTasks] lettura allegati fallita:', error.message);
      return null;
    }

    const suDatabase = ((data?.attachments as TaskAttachment[] | null) ?? []) as TaskAttachment[];
    const idSuDatabase = new Set(suDatabase.map((a) => a.id));
    const aggiunti = (task.attachments ?? []).filter((a) => !idSuDatabase.has(a.id));

    return aggiunti.length > 0 ? [...suDatabase, ...aggiunti] : null;
  }, []);

  /**
   * Traduce la differenza fra l'array precedente e quello nuovo in operazioni
   * per riga. Il confronto per id e' affidabile perche' gli id sono uuid
   * generati una volta sola (vedi newId in lib/utils).
   */
  const applica = useCallback(
    async (precedenti: Task[], successivi: Task[]) => {
      if (!organization?.id) return;

      const primaPerId = new Map(precedenti.map((t) => [t.id, t]));
      const dopoPerId = new Map(successivi.map((t) => [t.id, t]));

      const aggiunti = successivi.filter((t) => !primaPerId.has(t.id));
      const rimossi = precedenti.filter((t) => !dopoPerId.has(t.id));
      const modificati = successivi.filter((t) => {
        const prima = primaPerId.get(t.id);
        return prima && JSON.stringify(prima) !== JSON.stringify(t);
      });

      const errori: string[] = [];

      // Gli id toccati vengono segnati prima di iniziare: da qui alla fine, gli
      // eventi realtime che li riguardano sono nostri e vanno ignorati.
      const toccati = [...aggiunti, ...modificati, ...rimossi].map((t) => t.id);
      for (const id of toccati) scritturePendenti.current.add(id);

      try {
        for (const t of aggiunti) {
          const { error } = await supabase.from('tasks').insert({
            id: t.id,
            organization_id: organization.id,
            created_by: user?.id ?? null,
            created_at: t.createdAt,
            ...taskToRow(t),
          });
          if (error) errori.push(`creazione "${t.title}": ${error.message}`);
        }

        for (const t of modificati) {
          const riga = taskToRow(t);

          // Allegati cambiati partendo da un elenco mai letto: non si scrive
          // quell'array, si fonde con quello vero. Vedi `unisciAllegati`.
          if (t.attachments !== undefined && primaPerId.get(t.id)?.attachments === undefined) {
            const uniti = await unisciAllegati(t);
            if (uniti) riga.attachments = uniti;
            else delete riga.attachments;
          }

          // Nessun .select(): il RETURNING passa dalla policy di lettura e non
          // serve a nulla qui. Una modifica rifiutata dalle policy non e' un
          // errore del programma: e' un permesso mancante, e va detto.
          const { error } = await supabase.from('tasks').update(riga).eq('id', t.id);
          if (error) errori.push(`modifica "${t.title}": ${error.message}`);
        }

        for (const t of rimossi) {
          const { error } = await supabase.from('tasks').delete().eq('id', t.id);
          if (error) errori.push(`eliminazione "${t.title}": ${error.message}`);
        }
      } finally {
        for (const id of toccati) scritturePendenti.current.delete(id);

        // Qualche evento e' stato scartato durante le scritture: poteva essere
        // di un collega, quindi si rilegge una volta sola, con calma.
        if (eventiScartati.current) {
          eventiScartati.current = false;
          reloadConDebounce();
        }
      }

      if (errori.length > 0) {
        console.error('[useTasks]', errori.join(' | '));
        toast.error(
          errori.length === 1
            ? `Operazione non consentita: ${errori[0]}`
            : `${errori.length} operazioni non consentite sui task`
        );
        // Lo stato ottimistico non rispecchia piu' il database: si rilegge,
        // cosi' l'utente vede la realta' invece di una modifica che crede
        // salvata. Qui la rilettura e' immediata e non differita: e' la
        // correzione di un errore, non un aggiornamento di cortesia.
        await reload();
      }
    },
    [organization?.id, user?.id, reload, reloadConDebounce, unisciAllegati]
  );

  const setTasks = useCallback(
    (valore: Task[] | ((precedenti: Task[]) => Task[])) => {
      const precedenti = correnti.current;
      const successivi =
        typeof valore === 'function'
          ? (valore as (p: Task[]) => Task[])(precedenti)
          : valore;

      // Anteprima immediata, poi la sincronizzazione riga per riga.
      setTasksState(successivi);
      correnti.current = successivi;
      void applica(precedenti, successivi);
    },
    [applica]
  );

  return [tasks, setTasks, caricaAllegati] as const;
}
