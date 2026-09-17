export const runtime = 'edge';

import {
  ROLE_RANK,
  createSupabaseAdminClient,
  ensureIsOrgMember,
  ensureTenantRole,
  getAuthenticatedUser,
  jsonResponse,
  roleRank,
  withErrors,
} from '../_lib/supabase.js';
import { normalizzaNuovoTask } from '../_lib/nuovoTask.js';

/**
 * POST /api/tasks?tenantId=<uuid> — l'unico percorso di creazione di un task
 * dall'interfaccia.
 *
 * Questa rotta esisteva gia', con i controlli giusti, e nessuna schermata la
 * chiamava: il client inseriva direttamente su public.tasks, e la policy di
 * insert chiedeva solo di poter scrivere nell'organizzazione. Conseguenze,
 * tutte provate con l'account di un dipendente: un membro creava un task
 * assegnato a un collega (prerogativa da responsabile in su), scriveva
 * `created_by` con l'id di un altro, e assegnava a un utente di un'ALTRA
 * organizzazione, che se lo vedeva comparire fra i propri.
 *
 * Ora il client passa di qui, e la migrazione 0024 chiude anche la porta
 * diretta: chi inserisce con il proprio token deve firmarsi, puo' assegnare
 * solo a se stesso se non e' un responsabile, e solo a membri
 * dell'organizzazione. Le due difese dicono la stessa cosa; questa in piu'
 * verifica cio' che una policy non sa leggere (osservatori e bloccanti) e
 * rifiuta cio' che un task non puo' essere alla nascita.
 *
 * La GET che stava qui e' stata tolta: nessuno la chiamava, e leggeva con il
 * service role cio' che la policy di lettura concede gia' a ogni membro.
 */
export const fetch = withErrors(async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');

  if (!tenantId) {
    return jsonResponse({ error: 'tenantId is required' }, { status: 400 });
  }

  const user = await getAuthenticatedUser(request);

  // Un 'viewer' non scrive. Prima il solo requisito era l'appartenenza
  // all'organizzazione, quindi il ruolo di sola lettura poteva creare task.
  const membership = await ensureTenantRole(user.id, tenantId, 'member');

  const corpo = await request.json().catch(() => null);
  const esito = normalizzaNuovoTask(corpo, user.id);

  if (!esito.ok) {
    return jsonResponse({ error: esito.errore }, { status: 400 });
  }

  const { riga, assigneeId, watchers, blockedBy } = esito.task;
  const admin = createSupabaseAdminClient();

  if (assigneeId) {
    // L'assegnatario deve stare in QUESTA organizzazione: senza il controllo
    // si poteva scrivere l'UUID di un utente di un altro tenant.
    await ensureIsOrgMember(assigneeId, tenantId);

    // Assegnare lavoro ad altri e' una prerogativa da 'manager' in su.
    // Un 'member' puo' creare task solo per se stesso.
    if (assigneeId !== user.id && roleRank(membership.role) < ROLE_RANK.manager) {
      return jsonResponse(
        { error: 'Solo manager, admin o owner possono assegnare task ad altri' },
        { status: 403 }
      );
    }
  }

  // Gli osservatori ricevono le notifiche del task: devono essere membri,
  // altrimenti si scrive nella campanella di un utente di un'altra
  // organizzazione. Una sola lettura per tutti, non una a testa.
  if (watchers.length > 0) {
    const { data, error } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', tenantId)
      .in('user_id', watchers);

    if (error) return jsonResponse({ error: error.message }, { status: 500 });

    if ((data ?? []).length !== watchers.length) {
      return jsonResponse(
        { error: "Un osservatore non appartiene a questa organizzazione" },
        { status: 403 }
      );
    }
  }

  // I bloccanti devono essere task della stessa organizzazione. Un id di
  // un'altra non sarebbe un'informazione rubata — l'interfaccia non lo
  // saprebbe mostrare — ma terrebbe il task fermo per sempre dietro qualcosa
  // che nessuno qui puo' chiudere.
  if (blockedBy.length > 0) {
    const { data, error } = await admin
      .from('tasks')
      .select('id')
      .eq('organization_id', tenantId)
      .in('id', blockedBy);

    if (error) return jsonResponse({ error: error.message }, { status: 500 });

    if ((data ?? []).length !== blockedBy.length) {
      return jsonResponse(
        { error: "Una dipendenza non e' un'attivita' di questa organizzazione" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await admin
    .from('tasks')
    .insert({
      ...riga,
      organization_id: tenantId,
      // L'autore e' chi chiama, sempre: e' il campo da cui dipendono i
      // permessi di modifica e cancellazione (0008) e che la 0018 rende
      // immutabile dopo.
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) {
    // Un id gia' presente e' il caso del doppio invio: 409, non 500, cosi'
    // il client puo' distinguerlo da un guasto.
    const status = error.code === '23505' ? 409 : 500;
    return jsonResponse({ error: error.message }, { status });
  }

  return jsonResponse({ task: data }, { status: 201 });
});
