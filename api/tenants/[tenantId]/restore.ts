export const runtime = 'edge';

import { perBlocchi } from '../../_lib/aBlocchi.js';
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
 * Cio' che NON viene concesso: `organization_id` lo decide questa rotta, non
 * il file, E un id che esiste gia' altrove viene rifiutato (vedi il controllo
 * piu' sotto). Servono ENTRAMBE le cose: la prima da sola impediva di
 * dichiarare l'organizzazione e proprio per questo rendeva l'upsert un modo
 * per spostare un task altrui dentro la propria.
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

  /*
    Un id che esiste GIA' in un'altra organizzazione non si tocca.

    Questo controllo mancava, e la sua assenza era una falla fra
    organizzazioni: `upsert ... on conflict (id) do update` non guarda a chi
    appartiene la riga che sta aggiornando. Con `organization_id` forzato al
    tenant di chi chiama — riga 103, fatto apposta per impedire il contrario —
    l'effetto era che bastava conoscere un uuid per **spostare** quel task
    nella propria organizzazione, portandosi dietro commenti, cronologia e
    allegati. Dall'organizzazione di origine spariva.

    E il trigger `task_campi_immutabili` della 0018, che vieta il cambio di
    `organization_id`, qui non aiuta: esce subito quando `auth.uid()` e' nullo,
    cioe' esattamente nel caso del service role che questa rotta usa. La
    difesa che avrebbe dovuto fare da rete e' cieca proprio qui.

    Verificato sul database il 17 settembre: il task cambiava organizzazione e
    i commenti lo seguivano.

    Il rimedio: si leggono gli id gia' esistenti e si rifiuta l'INTERO blocco
    se anche uno solo appartiene altrove. Tutto o niente, perche' un
    ripristino applicato a meta' e' peggio di uno rifiutato.
  */
  const { data: esistenti, error: erroreLettura } = await perBlocchi<{
    id: string;
    organization_id: string;
  }>(
    righe.map((r: Record<string, unknown>) => r.id as string),
    (blocco) => admin.from('tasks').select('id, organization_id').in('id', blocco)
  );

  if (erroreLettura) {
    return jsonResponse({ error: erroreLettura }, { status: 500 });
  }

  const altrui = (esistenti ?? []).filter((r) => r.organization_id !== tenantId);
  if (altrui.length > 0) {
    return jsonResponse(
      {
        error:
          `${altrui.length} task del backup esistono gia' in un'altra ` +
          'organizzazione. Un ripristino non puo\' spostare lavoro fra ' +
          'organizzazioni: niente e\' stato scritto.',
      },
      { status: 409 }
    );
  }

  /*
    E ogni assegnatario del backup deve essere un membro di QUESTA
    organizzazione.

    Il trigger `task_assegnazione_protetta` (0027) fa questo controllo, ma esce
    presto quando `auth.uid()` e' nullo — cioe' qui. Senza, un ripristino
    poteva assegnare un task a un estraneo: la riga resta dentro il confine
    (l'organizzazione la decide questa rotta), ma `api/cron/promemoria.ts`
    filtra per `assignee_id` senza chiedersi se quella persona e' dei nostri, e
    le manda le email di scadenza. Un modo per far arrivare posta a qualcuno di
    un'altra azienda, e per incastonarne l'identificativo nei nostri dati.
  */
  const assegnatari: string[] = Array.from(
    new Set(
      righe
        .map((r: Record<string, unknown>) => r.assignee_id)
        .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
    )
  );

  if (assegnatari.length > 0) {
    const { data: membri, error: erroreMembri } = await perBlocchi<{ user_id: string }>(
      assegnatari,
      (blocco) =>
        admin
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', tenantId)
          .in('user_id', blocco)
    );

    if (erroreMembri) {
      return jsonResponse({ error: erroreMembri }, { status: 500 });
    }

    const sonoMembri = new Set((membri ?? []).map((m) => m.user_id));
    const estranei = assegnatari.filter((id) => !sonoMembri.has(id));
    if (estranei.length > 0) {
      return jsonResponse(
        {
          error:
            `${estranei.length} assegnatari del backup non appartengono a ` +
            'questa organizzazione: niente e\' stato scritto.',
        },
        { status: 409 }
      );
    }
  }

  const { error } = await admin.from('tasks').upsert(righe, { onConflict: 'id' });

  if (error) {
    // Il messaggio del database e' piu' utile di un 500 muto: e' quello che
    // dice "Prima vanno chiuse: X", cioe' quale riga del backup non sta in
    // piedi.
    return jsonResponse({ error: error.message }, { status: 400 });
  }

  return jsonResponse({ ripristinati: righe.length });
});
