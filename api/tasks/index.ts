export const runtime = 'edge';

import { ROLE_RANK, createSupabaseAdminClient, ensureIsOrgMember, ensureTenantMembership, ensureTenantRole, getAuthenticatedUser, jsonResponse, roleRank, withErrors } from '../_lib/supabase.js';

export const fetch = withErrors(async (request: Request) => {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId');

  if (!tenantId) {
    return jsonResponse({ error: 'tenantId is required' }, { status: 400 });
  }

  const user = await getAuthenticatedUser(request);
  await ensureTenantMembership(user.id, tenantId);

  const admin = createSupabaseAdminClient();

  if (request.method === 'GET') {
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');

    let query = admin
      .from('tasks')
      .select('*')
      .eq('organization_id', tenantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data, error } = await query;

    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse({ tasks: data ?? [] });
  }

  if (request.method === 'POST') {
    // Un 'viewer' non scrive. Prima il solo requisito era l'appartenenza
    // all'organizzazione, quindi il ruolo di sola lettura poteva creare task.
    const membership = await ensureTenantRole(user.id, tenantId, 'member');

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (!title) {
      return jsonResponse({ error: 'Task title is required' }, { status: 400 });
    }

    const assigneeId =
      typeof body.assigneeId === 'string' && body.assigneeId ? body.assigneeId : null;

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

    const { data, error } = await admin
      .from('tasks')
      .insert({
        organization_id: tenantId,
        title,
        description: typeof body.description === 'string' ? body.description : '',
        assignee_id: assigneeId,
        priority: body.priority === 'high' || body.priority === 'medium' || body.priority === 'low' ? body.priority : 'medium',
        status: body.status === 'completed' || body.status === 'in-progress' ? body.status : 'not-started',
        due_date: typeof body.dueDate === 'string' ? body.dueDate : new Date().toISOString(),
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse({ task: data }, { status: 201 });
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
});
