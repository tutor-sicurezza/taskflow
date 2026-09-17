export const runtime = 'edge';

import {
  createSupabaseAdminClient,
  ensureTenantAdmin,
  getAuthenticatedUser,
  jsonResponse,
  withErrors,
} from '../../_lib/supabase.js';

/**
 * POST /api/tenants/<uuid>/restore — rimette i task di un backup.
 *
 * Perche' una rotta e non un upsert dal client, come si faceva prima.
 *
 * Il ripristino dal client NON POTEVA funzionare, e non per una svista: tre
 * cose diverse lo rifiutavano, e sono tutte cose giuste.
 *
 *   1. `attachments_count` e' una colonna GENERATA (0017). Il backup fa
 *      `select('*')`, quindi se la porta dentro, e Postgres rifiuta un valore
 *      esplicito su una colonna generata. Bastava questo a far fallire
 *      l'intero blocco.
 *   2. Il trigger della 0023 rifiuta qualunque riga NUOVA con `approved_by`
 *      valorizzato, quando chi scrive e' una persona. Un backup di
 *      un'organizzazione che usa le approvazioni ne contiene sempre.
 *   3. Le policy della 0024 e della 0026 non lasciano nascere una riga
 *      archiviata o figlia di una serie ricorrente.
 *
 * Nessuna delle tre va allentata: servono a impedire che una persona si
 * fabbrichi a mano una riga in quello stato. Un ripristino pero' non e' una
 * persona che si fabbrica una riga — e' l'amministratore che rimette cio' che
 * c'era. Per quello esiste il service role, e per quello i trigger della 0018,
 * della 0023 e della 0027 escono presto quando `auth.uid()` e' nullo.
 *
 * Cio' che NON viene concesso, e che vale la pena dire: `organization_id` lo
 * decide questa rotta, non il file. Un backup non puo' reintrodurre righe di
 * un'altra organizzazione, ne' spostarne una qui.
 *
 * Le invarianti sui DATI, invece, restano in piedi anche qui: il trigger della
 * 0026 vale anche per il service role, quindi un backup che contiene
 * un'attivita' completata mentre cio' che la bloccava risulta ancora aperto
 * viene rifiutato. E' voluto — quei due fatti insieme non possono essere veri
 * — e l'errore dice quale attivita'.
 */

/** Colonne che il chiamante non decide. Tutto il resto del file passa. */
const NON_RIPRISTINABILI = new Set([
  // Generata: Postgres rifiuta un valore esplicito.
  'attachments_count',
  // La decide questa rotta.
  'organization_id',
]);

/**
 * Quanti task per richiesta.
 *
 * Il tetto non e' sul numero di righe ma sul PESO: gli allegati sono base64
 * dentro la riga, fino a 10 MB l'uno. Il client manda a blocchi e questa e' la
 * cintura, non la misura.
 */
const MAX_TASK_PER_RICHIESTA = 200;

export const fetch = withErrors(async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const segmenti = url.pathname.split('/').filter(Boolean);
  // .../tenants/<id>/restore — l'id e' il penultimo.
  const tenantId =
    url.searchParams.get('tenantId') ??
    (segmenti.length >= 2 ? segmenti[segmenti.length - 2] : '');

  if (!tenantId) {
    return jsonResponse({ error: 'tenantId mancante' }, { status: 400 });
  }

  const user = await getAuthenticatedUser(request);
  await ensureTenantAdmin(user.id, tenantId);

  const body = await request.json().catch(() => null);
  const task = body && Array.isArray(body.tasks) ? body.tasks : null;

  if (!task) {
    return jsonResponse({ error: 'Serve un elenco di task' }, { status: 400 });
  }

  if (task.length > MAX_TASK_PER_RICHIESTA) {
    return jsonResponse(
      { error: `Troppi task in una volta: al massimo ${MAX_TASK_PER_RICHIESTA}` },
      { status: 413 }
    );
  }

  if (task.length === 0) {
    return jsonResponse({ ripristinati: 0 });
  }

  const righe = task.map((riga: Record<string, unknown>) => {
    const pulita: Record<string, unknown> = {};
    for (const [chiave, valore] of Object.entries(riga ?? {})) {
      if (!NON_RIPRISTINABILI.has(chiave)) pulita[chiave] = valore;
    }
    pulita.organization_id = tenantId;
    return pulita;
  });

  const mancanti = righe.filter((r: Record<string, unknown>) => typeof r.id !== 'string' || !r.id);
  if (mancanti.length > 0) {
    return jsonResponse(
      { error: 'Ogni task del backup deve avere un id' },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  const { error } = await admin.from('tasks').upsert(righe, { onConflict: 'id' });

  if (error) {
    // Il messaggio del database e' piu' utile di un 500 muto: e' quello che
    // dice "Prima vanno chiuse: X", cioe' quale riga del backup non sta in
    // piedi.
    return jsonResponse({ error: error.message }, { status: 400 });
  }

  return jsonResponse({ ripristinati: righe.length });
});
