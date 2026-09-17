import { regolaValida } from './ricorrenza.js';

/**
 * Il corpo di POST /api/tasks, letto con diffidenza.
 *
 * La rotta gira con il service role: le policy RLS e i trigger della tabella
 * (0018, 0022, 0023) NON vedono queste scritture, perche' `auth.uid()` e'
 * nullo. Tutto cio' che il database rifiuterebbe a un client va quindi
 * rifiutato qui, prima, e in piu' le regole che il database non sa esprimere:
 * chi puo' assegnare a chi, che i bloccanti siano task della stessa
 * organizzazione, che nessuno firmi commenti a nome di altri.
 *
 * Questa funzione e' pura — riceve un valore qualunque e l'id di chi chiama —
 * cosi' si prova senza database. Le verifiche che richiedono il database
 * (l'assegnatario e' un membro? i bloccanti esistono?) le fa la rotta, sugli
 * id che questa funzione le consegna gia' puliti.
 *
 * Alcune costanti sono la copia di quelle in `src/lib/sottoattivita.ts`: api/
 * ha un tsconfig separato e non puo' importare da src/. La duplicazione e'
 * segnalata da entrambi i lati.
 */

/** Copia di `MAX_SOTTOATTIVITA` in src/lib/sottoattivita.ts. */
export const MAX_SOTTOATTIVITA = 50;
/** Copia di `MAX_LUNGHEZZA_PASSO` in src/lib/sottoattivita.ts. */
export const MAX_LUNGHEZZA_PASSO = 200;

const PRIORITA = ['low', 'medium', 'high'] as const;

/**
 * Gli stati con cui un task puo' NASCERE. `completed` non c'e', di proposito:
 * un lavoro creato gia' chiuso salta il flusso di approvazione (che scatta
 * sull'UPDATE) e le dipendenze (che si controllano al completamento). E' il
 * gemello, in creazione, della regola "nessun task nasce gia' approvato".
 */
const STATI_INIZIALI = ['not-started', 'in-progress', 'blocked'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NuovoTaskNormalizzato {
  /**
   * Le colonne da inserire. Mancano `organization_id` e `created_by`, che
   * decide la rotta e mai il chiamante.
   */
  riga: Record<string, unknown>;
  /** Da verificare sul database: deve essere un membro dell'organizzazione. */
  assigneeId: string | null;
  /** Da verificare sul database: tutti membri dell'organizzazione. */
  watchers: string[];
  /** Da verificare sul database: tutti task della stessa organizzazione. */
  blockedBy: string[];
}

export type EsitoNuovoTask =
  | { ok: true; task: NuovoTaskNormalizzato }
  | { ok: false; errore: string };

function errore(messaggio: string): EsitoNuovoTask {
  return { ok: false, errore: messaggio };
}

function eUuid(valore: unknown): valore is string {
  return typeof valore === 'string' && UUID.test(valore);
}

/** Un elenco di uuid, senza doppioni. `null`/`undefined` valgono come vuoto. */
function elencoUuid(valore: unknown, nome: string): string[] | EsitoNuovoTask {
  if (valore == null) return [];
  if (!Array.isArray(valore)) return errore(`${nome} deve essere un elenco`);
  const unici = new Set<string>();
  for (const v of valore) {
    if (!eUuid(v)) return errore(`${nome} contiene un identificativo non valido`);
    unici.add(v);
  }
  return Array.from(unici);
}

function dataIso(valore: unknown, nome: string): string | null | EsitoNuovoTask {
  if (valore == null || valore === '') return null;
  if (typeof valore !== 'string') return errore(`${nome} deve essere una data`);
  const istante = new Date(valore);
  if (Number.isNaN(istante.getTime())) return errore(`${nome} non e' una data leggibile`);
  return istante.toISOString();
}

function minuti(valore: unknown, nome: string): number | null | EsitoNuovoTask {
  if (valore == null) return null;
  if (typeof valore !== 'number' || !Number.isInteger(valore) || valore < 0) {
    return errore(`${nome} deve essere un numero intero di minuti, non negativo`);
  }
  return valore;
}

/**
 * Commenti, cronologia e allegati portano ognuno la firma di chi li ha
 * scritti (`userId`, oppure `uploadedBy`). In creazione l'unica firma
 * possibile e' quella di chi sta creando: accettare altro significherebbe
 * far nascere un task con un commento "del capo" che il capo non ha scritto.
 */
function elencoFirmato(
  valore: unknown,
  nome: string,
  campoFirma: string,
  autoreId: string
): Record<string, unknown>[] | EsitoNuovoTask {
  if (valore == null) return [];
  if (!Array.isArray(valore)) return errore(`${nome} deve essere un elenco`);
  for (const voce of valore) {
    if (!voce || typeof voce !== 'object' || Array.isArray(voce)) {
      return errore(`${nome} contiene una voce non valida`);
    }
    if ((voce as Record<string, unknown>)[campoFirma] !== autoreId) {
      return errore(`${nome}: in creazione ogni voce deve essere firmata da chi crea il task`);
    }
  }
  return valore as Record<string, unknown>[];
}

function passi(valore: unknown): Record<string, unknown>[] | EsitoNuovoTask {
  if (valore == null) return [];
  if (!Array.isArray(valore)) return errore('subtasks deve essere un elenco');
  if (valore.length > MAX_SOTTOATTIVITA) {
    return errore(`Al massimo ${MAX_SOTTOATTIVITA} passi per attivita'`);
  }

  const visti = new Set<string>();
  const puliti: Record<string, unknown>[] = [];

  for (const grezzo of valore) {
    if (!grezzo || typeof grezzo !== 'object' || Array.isArray(grezzo)) {
      return errore('subtasks contiene un passo non valido');
    }
    const passo = grezzo as Record<string, unknown>;
    const titolo = typeof passo.title === 'string' ? passo.title.trim() : '';
    if (typeof passo.id !== 'string' || !passo.id) return errore('Un passo senza id');
    if (visti.has(passo.id)) return errore('Due passi con lo stesso id');
    if (!titolo) return errore('Un passo senza testo');
    if (titolo.length > MAX_LUNGHEZZA_PASSO) {
      return errore(`Un passo supera i ${MAX_LUNGHEZZA_PASSO} caratteri`);
    }
    visti.add(passo.id);
    puliti.push({
      id: passo.id,
      title: titolo,
      done: passo.done === true,
      createdAt: typeof passo.createdAt === 'string' ? passo.createdAt : new Date().toISOString(),
      doneAt: typeof passo.doneAt === 'string' ? passo.doneAt : null,
      doneBy: typeof passo.doneBy === 'string' ? passo.doneBy : null,
    });
  }

  return puliti;
}

function eEsito(valore: unknown): valore is EsitoNuovoTask {
  return (
    !!valore &&
    typeof valore === 'object' &&
    !Array.isArray(valore) &&
    'ok' in (valore as Record<string, unknown>) &&
    (valore as Record<string, unknown>).ok === false
  );
}

export function normalizzaNuovoTask(corpo: unknown, autoreId: string): EsitoNuovoTask {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return errore('Corpo della richiesta mancante o non valido');
  }
  const b = corpo as Record<string, unknown>;

  // L'id lo sceglie il client (uuid generato in locale, cosi' la sua anteprima
  // ottimistica e la riga vera coincidono), ma solo se e' un uuid: un id
  // qualunque finirebbe in una colonna uuid e fallirebbe piu' avanti con un
  // errore illeggibile.
  let id: string | undefined;
  if (b.id != null) {
    if (!eUuid(b.id)) return errore("L'id del task deve essere un uuid");
    id = b.id;
  }

  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title) return errore('Il titolo e\' obbligatorio');

  if (b.description != null && typeof b.description !== 'string') {
    return errore('La descrizione deve essere testo');
  }
  const description = typeof b.description === 'string' ? b.description : '';

  let assigneeId: string | null = null;
  if (b.assigneeId != null && b.assigneeId !== '') {
    if (!eUuid(b.assigneeId)) return errore("L'assegnatario non e' un identificativo valido");
    assigneeId = b.assigneeId;
  }

  const priority = b.priority ?? 'medium';
  if (!PRIORITA.includes(priority as (typeof PRIORITA)[number])) {
    return errore('Priorita\' non valida');
  }

  const status = b.status ?? 'not-started';
  if (status === 'completed') return errore("Un'attivita' non puo' nascere gia' completata");
  if (!STATI_INIZIALI.includes(status as (typeof STATI_INIZIALI)[number])) {
    return errore('Stato non valido');
  }

  const dueDate = dataIso(b.dueDate, 'La scadenza');
  if (eEsito(dueDate)) return dueDate;

  if (b.department != null && typeof b.department !== 'string') {
    return errore('Il reparto deve essere testo');
  }
  const department = typeof b.department === 'string' && b.department.trim() ? b.department.trim() : null;

  let labels: string[] = [];
  if (b.labels != null) {
    if (!Array.isArray(b.labels) || b.labels.some((l) => typeof l !== 'string')) {
      return errore('Le etichette devono essere un elenco di testi');
    }
    labels = Array.from(new Set((b.labels as string[]).map((l) => l.trim()).filter(Boolean)));
  }

  const estimateMinutes = minuti(b.estimateMinutes, 'La stima');
  if (eEsito(estimateMinutes)) return estimateMinutes;
  const spentMinutes = minuti(b.spentMinutes, 'Il tempo impiegato');
  if (eEsito(spentMinutes)) return spentMinutes;

  const watchers = elencoUuid(b.watchers, 'Gli osservatori');
  if (eEsito(watchers)) return watchers;

  const blockedByGrezzi = elencoUuid(b.blockedBy, 'Le dipendenze');
  if (eEsito(blockedByGrezzi)) return blockedByGrezzi;
  // Un task non blocca se stesso (vincolo della 0022): meglio toglierlo qui
  // che far fallire l'inserimento per un legame che non significa nulla.
  const blockedBy = blockedByGrezzi.filter((altro) => altro !== id);

  const sottoattivita = passi(b.subtasks);
  if (eEsito(sottoattivita)) return sottoattivita;

  let recurrence: ReturnType<typeof regolaValida> = null;
  if (b.recurrence != null) {
    recurrence = regolaValida(b.recurrence);
    if (!recurrence) return errore('Regola di ricorrenza non valida');
  }

  // Le occorrenze di una serie le crea il lavoro pianificato, con il service
  // role: un client che dichiara "sono l'occorrenza della serie X" sta
  // agganciando un task a una serie che non ha creato.
  if (b.recurrenceParent != null) {
    return errore("Un'attivita' creata a mano non puo' dichiararsi occorrenza di una serie");
  }

  if (b.archivedAt != null) return errore("Un'attivita' non puo' nascere gia' archiviata");

  if (b.requiresApproval != null && typeof b.requiresApproval !== 'boolean') {
    return errore('requiresApproval deve essere vero o falso');
  }
  const requiresApproval = b.requiresApproval === true;

  // Stesso messaggio del trigger `task_creazione_valida` (0023), che qui non
  // scatta perche' la scrittura arriva dal service role.
  if (b.approvedBy != null || b.approvedAt != null) {
    return errore("Un'attivita' non puo' nascere gia' approvata");
  }

  const comments = elencoFirmato(b.comments, 'I commenti', 'userId', autoreId);
  if (eEsito(comments)) return comments;
  const activities = elencoFirmato(b.activities, 'La cronologia', 'userId', autoreId);
  if (eEsito(activities)) return activities;

  const riga: Record<string, unknown> = {
    title,
    description,
    assignee_id: assigneeId,
    priority,
    status,
    due_date: dueDate,
    department,
    labels,
    subtasks: sottoattivita,
    blocked_by: blockedBy,
    estimate_minutes: estimateMinutes,
    spent_minutes: spentMinutes,
    watchers,
    recurrence,
    recurrence_parent: null,
    archived_at: null,
    requires_approval: requiresApproval,
    approved_by: null,
    approved_at: null,
    comments,
    activities,
  };

  if (id) riga.id = id;

  // Gli allegati si scrivono solo se ci sono: la colonna ha gia' `[]` come
  // valore predefinito, e non nominarla e' la stessa cautela di `taskToRow`
  // nel client.
  if (b.attachments != null) {
    const attachments = elencoFirmato(b.attachments, 'Gli allegati', 'uploadedBy', autoreId);
    if (eEsito(attachments)) return attachments;
    riga.attachments = attachments;
  }

  return { ok: true, task: { riga, assigneeId, watchers, blockedBy } };
}
