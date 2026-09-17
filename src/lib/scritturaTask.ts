/**
 * Come si costruisce l'UPDATE di un'attivita'.
 *
 * Sta qui e non dentro `useTasks` perche' e' logica pura — nessuna rete,
 * nessuno stato di React — ed e' la parte che decide se una modifica cancella
 * il lavoro di un collega. Roba che va provata, non guardata.
 */
import type { Task } from '@/lib/types';

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
export function colonneScrivibili(task: Task): Record<string, unknown> {
  const riga: Record<string, unknown> = {
    title: task.title,
    description: task.description ?? '',
    assignee_id: task.assigneeId || null,
    priority: task.priority,
    status: task.status,
    // `?? null` e non `|| null`: la scadenza e' facoltativa, e una stringa
    // vuota deve diventare NULL invece di finire nel database come data.
    due_date: task.dueDate || null,
    comments: task.comments ?? [],
    activities: task.activities ?? [],
    department: task.department ?? null,
    labels: task.labels ?? [],
    subtasks: task.subtasks ?? [],
    blocked_by: task.blockedBy ?? [],
    estimate_minutes: task.estimateMinutes ?? null,
    spent_minutes: task.spentMinutes ?? null,
    watchers: task.watchers ?? [],
    recurrence: task.recurrence ?? null,
    recurrence_parent: task.recurrenceParent ?? null,
    archived_at: task.archivedAt ?? null,
    requires_approval: task.requiresApproval ?? false,
    approved_by: task.approvedBy ?? null,
    approved_at: task.approvedAt ?? null,
    updated_at: new Date().toISOString(),
  };

  if (task.attachments !== undefined) riga.attachments = task.attachments;

  return riga;
}

/**
 * Le sole colonne che questa modifica ha davvero cambiato.
 *
 * Prima si scriveva la riga intera, e non era una svista: sembrava innocuo,
 * perche' i valori erano quelli "giusti" — quelli che il browser aveva in
 * memoria. Il punto e' proprio quello: erano quelli che aveva in memoria LUI.
 *
 * Due persone sulla stessa attivita', o una sola con una scheda rimasta aperta
 * mentre la rete cadeva, e la fotografia locale tornava indietro nel tempo. Il
 * commento scritto da un collega nel frattempo veniva riscritto via, senza
 * errori e senza che nessuno se ne accorgesse: la rilettura successiva
 * confermava che sul database non c'era piu'.
 *
 * Il caso peggiore non erano i commenti. Se la copia locale era antecedente a
 * un'approvazione, la scrittura mandava `approved_by: null` e `approved_at:
 * null`, e nessuno dei trigger la ferma — la 0023 non controlla un visto che
 * viene TOLTO (riaprire e' legittimo), la 0026 azzera solo se cambia lo stato.
 * Bastava correggere un titolo. Risultato: la cronologia dice "approvato" e la
 * riga non ha piu' un approvatore. Per un prodotto che tiene i controlli
 * periodici di sicurezza, una firma che sparisce e' il danno peggiore
 * possibile.
 *
 * Ora una colonna entra nell'UPDATE solo se il suo valore e' cambiato rispetto
 * a quello da cui questa modifica e' partita. E' la stessa garanzia che gia'
 * valeva per `attachments`, estesa a tutte le altre: non sta in un controllo,
 * sta nel fatto che la colonna non entra nella query.
 */
export function taskToRow(task: Task, precedente: Task | undefined): Record<string, unknown> {
  const dopo = colonneScrivibili(task);
  if (!precedente) return dopo;

  const prima = colonneScrivibili(precedente);
  const riga: Record<string, unknown> = {};

  for (const [chiave, valore] of Object.entries(dopo)) {
    // `updated_at` e' nuovo per costruzione: va sempre, o non si vedrebbe mai
    // che la riga e' stata toccata.
    if (chiave === 'updated_at') continue;
    if (JSON.stringify(valore) !== JSON.stringify(prima[chiave])) riga[chiave] = valore;
  }

  riga.updated_at = dopo.updated_at;
  return riga;
}

/**
 * Fonde un elenco per id prendendo come base cio' che c'e' SUL DATABASE.
 *
 * `comments` e `activities` sono colonne cumulative: crescono, e due persone
 * ci scrivono dentro nello stesso momento. Scrivere solo quando cambiano (vedi
 * `taskToRow`) protegge chi non le tocca, ma non basta a chi le tocca: chi
 * aggiunge un commento manda comunque l'array intero, costruito su una base
 * che nel frattempo puo' essere invecchiata.
 *
 * Qui si fa quello che fa `flushKey` in useKV: la base non e' mai la copia
 * locale, e' lo stato del server, e sopra ci si riapplica la DIFFERENZA — cosa
 * e' stato aggiunto, cosa cambiato, cosa tolto. Cosi' il commento di un
 * collega arrivato nel frattempo resta, e insieme resta possibile togliere
 * davvero una voce, che una fusione a sola aggiunta impedirebbe.
 */
export function fondiPerId<T extends { id: string }>(suDatabase: T[], prima: T[], dopo: T[]): T[] {
  const idPrima = new Set(prima.map((v) => v.id));
  const dopoPerId = new Map(dopo.map((v) => [v.id, v]));

  const risultato: T[] = [];
  for (const voce of suDatabase) {
    // Tolta di proposito da questa modifica: non la si rimette.
    if (idPrima.has(voce.id) && !dopoPerId.has(voce.id)) continue;
    // Modificata da questa modifica: vince la versione nuova.
    risultato.push(dopoPerId.get(voce.id) ?? voce);
  }

  const giaPresenti = new Set(risultato.map((v) => v.id));
  for (const voce of dopo) {
    if (!giaPresenti.has(voce.id)) risultato.push(voce);
  }

  return risultato;
}

