export const runtime = 'edge';

import { createSupabaseAdminClient, getAuthenticatedUser, jsonResponse, withErrors } from '../_lib/supabase.js';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export const fetch = withErrors(async (request: Request) => {
  const user = await getAuthenticatedUser(request);
  const admin = createSupabaseAdminClient();

  if (request.method === 'GET') {
    const { data, error } = await admin
      .from('organization_members')
      .select('role, organizations(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse({ tenants: data ?? [] });
  }

  if (request.method === 'POST') {
    /**
     * Chi puo' creare un'organizzazione.
     *
     * La rotta era aperta a qualunque utente autenticato e non veniva
     * chiamata da nessuna parte. Wirarla cosi' com'era avrebbe permesso a un
     * 'member' di crearsi un'organizzazione di cui e' owner: non un furto di
     * dati (la nuova sarebbe vuota), ma un modo per ottenere privilegi
     * amministrativi e comparire come proprietario di uno spazio dentro lo
     * stesso progetto.
     *
     * Restano ammessi: chi e' gia' owner o admin da qualche parte (sta
     * aprendo un secondo spazio di lavoro) e chi non appartiene ad alcuna
     * organizzazione (primo avvio del progetto, quando non esiste ancora
     * nessuno che possa invitare).
     */
    const { data: appartenenze, error: appartenenzeError } = await admin
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id);

    if (appartenenzeError) {
      return jsonResponse({ error: appartenenzeError.message }, { status: 500 });
    }

    const membri = appartenenze ?? [];

    // "Non appartengo a nulla" non basta come permesso: e' la condizione in
    // cui si trova anche chi e' stato RIMOSSO da un amministratore, che
    // potrebbe cosi' rientrare creandosi un'organizzazione propria e
    // continuare a usare questa installazione. Il primo avvio si riconosce
    // invece dal fatto che l'istanza e' ancora vuota.
    const { count: organizzazioniEsistenti, error: conteggioError } = await admin
      .from('organizations')
      .select('id', { count: 'exact', head: true });

    if (conteggioError) {
      return jsonResponse({ error: conteggioError.message }, { status: 500 });
    }

    const primoAvvio = (organizzazioniEsistenti ?? 0) === 0;
    const puoCreare =
      primoAvvio || membri.some((m) => m.role === 'owner' || m.role === 'admin');

    if (!puoCreare) {
      return jsonResponse(
        { error: 'Solo un amministratore puo creare una nuova organizzazione' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return jsonResponse({ error: 'Tenant name is required' }, { status: 400 });
    }

    // Lo slug ha un vincolo di unicita' su tutto il progetto: due aziende con
    // lo stesso nome facevano fallire la seconda creazione con un errore di
    // chiave duplicata, incomprensibile per chi lo legge. Il suffisso lo rende
    // unico senza chiederlo all'utente.
    const base = typeof body.slug === 'string' && body.slug.trim()
      ? slugify(body.slug)
      : slugify(name);
    const slug = `${base || 'org'}-${crypto.randomUUID().slice(0, 8)}`;

    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .insert({
        name,
        slug,
        owner_id: user.id,
      })
      .select('*')
      .single();

    if (organizationError) {
      return jsonResponse({ error: organizationError.message }, { status: 500 });
    }

    const { error: membershipError } = await admin.from('organization_members').insert({
      organization_id: organization.id,
      user_id: user.id,
      role: 'owner',
    });

    if (membershipError) {
      return jsonResponse({ error: membershipError.message }, { status: 500 });
    }

    return jsonResponse({ tenant: organization }, { status: 201 });
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
});
