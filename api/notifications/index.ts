export const runtime = 'edge';

import { createSupabaseAdminClient, ensureIsOrgMember, ensureTenantMembership, ensureTenantRole, getAuthenticatedUser, jsonResponse, withErrors } from '../_lib/supabase.js';

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
    // Il destinatario e' SEMPRE il chiamante. Accettare ?userId= permetteva a
    // qualunque membro di leggere le notifiche di un collega (i loro UUID sono
    // esposti da GET /api/tenants/<id>/members), vanificando la policy RLS
    // "users can read their notifications" — inattiva qui, perche' gli handler
    // usano il client service role.
    const recipientId = user.id;

    const { data, error } = await admin
      .from('notifications')
      .select('*')
      .eq('organization_id', tenantId)
      .eq('user_id', recipientId)
      .order('created_at', { ascending: false });

    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse({ notifications: data ?? [] });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const recipientId = typeof body.userId === 'string' ? body.userId : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const type = typeof body.type === 'string' ? body.type : 'task_updated';

    if (!recipientId || !message) {
      return jsonResponse({ error: 'userId and message are required' }, { status: 400 });
    }

    // Chiunque poteva inserire una notifica arbitraria nella casella di un
    // collega: testo libero, tipo a scelta, taskId a scelta. Con `action_by`
    // mostrato nell'interfaccia questo e' impersonificazione — un messaggio
    // che sembra provenire dal sistema o da un responsabile.
    //
    // Regola: notifiche a se stessi sempre concesse; per scrivere ad altri
    // serve 'manager' o superiore, e il destinatario deve appartenere
    // all'organizzazione (altrimenti si scrive nella casella di un utente di
    // un altro tenant).
    if (recipientId !== user.id) {
      await ensureTenantRole(user.id, tenantId, 'manager');
      await ensureIsOrgMember(recipientId, tenantId);
    }

    const { data, error } = await admin
      .from('notifications')
      .insert({
        organization_id: tenantId,
        user_id: recipientId,
        task_id: body.taskId || null,
        task_title: typeof body.taskTitle === 'string' ? body.taskTitle : null,
        type,
        message,
        action_by: user.id,
        read: false,
      })
      .select('*')
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse({ notification: data }, { status: 201 });
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
});
