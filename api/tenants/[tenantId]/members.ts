export const runtime = 'edge';

import { createSupabaseAdminClient, ensureTenantAdmin, ensureTenantMembership, getAuthenticatedUser, jsonResponse, withErrors } from '../../_lib/supabase.js';

export const fetch = withErrors(async (request: Request) => {
  const user = await getAuthenticatedUser(request);

  // Il routing generato da Vercel riscrive questa rotta come
  //   /api/tenants/[tenantId]/members?tenantId=$1
  // quindi l'id arriva in query string. Il fallback legge il segmento di path
  // nel caso la rotta venga invocata direttamente.
  const url = new URL(request.url);
  // Indicizzazione esplicita invece di .at(-2): Vercel compila le funzioni di
  // api/ con il tsconfig.json di root, che ha target ES2020, dove
  // Array.prototype.at non esiste. Il nostro tsconfig.api.json usa ES2022 e
  // quindi non intercettava l'errore — il build passava in locale e falliva
  // sulla piattaforma.
  const segments = url.pathname.split('/').filter(Boolean);
  const tenantId =
    url.searchParams.get('tenantId') ??
    (segments.length >= 2 ? segments[segments.length - 2] : '') ??
    '';

  if (!tenantId) {
    return jsonResponse({ error: 'tenantId mancante' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  await ensureTenantMembership(user.id, tenantId);

  if (request.method === 'GET') {
    const { data, error } = await admin
      .from('organization_members')
      .select('id, role, created_at, users:profiles(id, full_name, avatar_url, email)')
      .eq('organization_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    return jsonResponse({ members: data ?? [] });
  }

  if (request.method === 'POST') {
    // Aggiungere membri o assegnare ruoli e' un'operazione amministrativa.
    // Senza questo controllo un 'member' poteva promuoversi da solo: gli
    // handler usano il client service role, che ignora le policy RLS.
    const callerMembership = await ensureTenantAdmin(user.id, tenantId);

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    /**
     * Reimpostazione della password da parte dell'amministratore.
     *
     * Senza questo percorso, chi dimenticava la password restava fuori per
     * sempre: non esiste un "password dimenticata" recapitabile con certezza
     * (il mailer di Supabase e' fortemente limitato) e non c'era alcun modo,
     * dall'applicazione, di assegnare una nuova password. L'unica via era il
     * dashboard Supabase, cioe' un accesso che l'amministratore
     * dell'organizzazione normalmente non ha.
     *
     * La nuova password e' provvisoria e viene restituita a chi la richiede,
     * perche' la consegni di persona: non essendoci un canale di recapito
     * garantito, inviarla per email sarebbe una garanzia solo apparente.
     */
    if (body.action === 'reset-password') {
      await ensureTenantAdmin(user.id, tenantId);

      if (!email) {
        return jsonResponse({ error: 'Email is required' }, { status: 400 });
      }

      const { data: target, error: targetError } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (targetError) {
        return jsonResponse({ error: targetError.message }, { status: 500 });
      }

      if (!target) {
        return jsonResponse({ error: 'Utente non trovato' }, { status: 404 });
      }

      // Deve appartenere a QUESTA organizzazione: senza il controllo, un
      // amministratore potrebbe reimpostare la password di un utente di
      // un'altra organizzazione conoscendone solo l'indirizzo email.
      const { data: membership } = await admin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', tenantId)
        .eq('user_id', target.id)
        .maybeSingle();

      if (!membership) {
        return jsonResponse(
          { error: 'Questo utente non appartiene alla tua organizzazione' },
          { status: 403 }
        );
      }

      const nuovaPassword = `Tf-${crypto.randomUUID().slice(0, 12)}!`;

      const { error: updateError } = await admin.auth.admin.updateUserById(target.id, {
        password: nuovaPassword,
      });

      if (updateError) {
        return jsonResponse({ error: updateError.message }, { status: 500 });
      }

      return jsonResponse({ temporaryPassword: nuovaPassword });
    }

    // La lista deve coprire TUTTI i ruoli del vincolo CHECK di
    // organization_members (0004), non solo tre: con 'manager' e 'viewer'
    // fuori dalla lista, l'interfaccia poteva chiedere quei ruoli e l'utente
    // finiva silenziosamente 'member', cioe' con piu' permessi di quelli
    // scelti nel caso di 'viewer'.
    const ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'] as const;

    // Il ruolo e' FACOLTATIVO: questa rotta serve anche a modificare
    // l'anagrafica di un membro esistente. Prima l'assenza di body.role
    // significava 'member', quindi salvare il numero di telefono di un
    // amministratore lo declassava in silenzio.
    const roleRichiesto: (typeof ROLES)[number] | null = ROLES.includes(body.role)
      ? body.role
      : null;

    // Solo il proprietario puo' conferire la proprieta'. Senza questo controllo
    // un 'admin' poteva assegnare 'owner' a se stesso e poi declassare il vero
    // proprietario a 'member': l'upsert su (organization_id, user_id) aggiorna
    // una membership esistente, non crea solo inviti. Presa di controllo
    // completa dell'organizzazione partendo da admin.
    if (roleRichiesto === 'owner' && callerMembership.role !== 'owner') {
      return jsonResponse(
        { error: 'Solo il proprietario puo assegnare il ruolo owner' },
        { status: 403 }
      );
    }

    if (!email) {
      return jsonResponse({ error: 'Email is required' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      return jsonResponse({ error: profileError.message }, { status: 500 });
    }

    let memberId = profile?.id;
    let createdPassword: string | null = null;

    // Campi di profilo che l'interfaccia raccoglie nello stesso form della
    // creazione. Vivono su profiles perche' e' da li' che useSyncEmployees li
    // rilegge a ogni avvio: se restassero solo nello stato applicativo,
    // sarebbero invisibili a chi non ha ancora quella copia in cache.
    const jobTitle =
      typeof body.jobTitle === 'string' && body.jobTitle.trim()
        ? body.jobTitle.trim()
        : null;
    const departments = Array.isArray(body.departments)
      ? body.departments.filter((d: unknown): d is string => typeof d === 'string')
      : null;

    // Gli altri campi dell'anagrafica. Vivono su profiles perche' e' da li'
    // che useSyncEmployees li rilegge: tenuti solo nello stato applicativo,
    // ogni ricarica li riportava al valore del database. E' il motivo per cui
    // "disattiva utente" non durava: profiles.status restava 'active'.
    const fullNameAggiornato =
      typeof body.fullName === 'string' && body.fullName.trim()
        ? body.fullName.trim()
        : null;
    const status =
      body.status === 'active' || body.status === 'inactive' ? body.status : null;
    const teamLead = typeof body.teamLead === 'boolean' ? body.teamLead : null;
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    const location = typeof body.location === 'string' ? body.location.trim() : null;

    const campiProfilo = {
      ...(jobTitle ? { job_title: jobTitle } : {}),
      ...(departments ? { departments } : {}),
      ...(fullNameAggiornato ? { full_name: fullNameAggiornato } : {}),
      ...(status ? { status } : {}),
      ...(teamLead !== null ? { team_lead: teamLead } : {}),
      ...(phone !== null ? { phone } : {}),
      ...(location !== null ? { location } : {}),
    };

    if (!profile) {
      // L'utente non esiste ancora: lo crea l'amministratore.
      // Questo e' l'UNICO percorso di creazione account previsto — la
      // registrazione autonoma va disattivata in Supabase (Authentication ->
      // Sign In / Providers -> "Allow new users to sign up").
      const fullName =
        typeof body.fullName === 'string' && body.fullName.trim()
          ? body.fullName.trim()
          : email.split('@')[0];

      // Password temporanea: finche' non e' configurato un provider email,
      // non esiste modo di recapitarla, quindi viene restituita all'admin
      // nella risposta perche' la consegni lui.
      // Costante tipizzata a parte: `body` e' `any`, quindi assegnare
      // direttamente a createdPassword (string | null) non restringe il tipo e
      // password: string | null non e' accettato da createUser.
      const password: string =
        typeof body.password === 'string' && body.password.length >= 8
          ? body.password
          : `Tf-${crypto.randomUUID().slice(0, 12)}!`;

      createdPassword = password;

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

      if (createError || !created?.user) {
        return jsonResponse(
          { error: createError?.message ?? 'Creazione utente fallita' },
          { status: 500 }
        );
      }

      memberId = created.user.id;

      const { error: insertProfileError } = await admin.from('profiles').insert({
        id: memberId,
        email,
        full_name: fullName,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(memberId)}`,
        ...campiProfilo,
      });

      if (insertProfileError) {
        return jsonResponse({ error: insertProfileError.message }, { status: 500 });
      }
    } else if (Object.keys(campiProfilo).length > 0) {
      // Profilo gia' esistente: si aggiorna solo cio' che e' stato passato,
      // per non azzerare campi che il chiamante non ha nemmeno inviato.
      const { error: updateProfileError } = await admin
        .from('profiles')
        .update(campiProfilo)
        .eq('id', memberId);

      if (updateProfileError) {
        return jsonResponse({ error: updateProfileError.message }, { status: 500 });
      }
    }

    // L'upsert aggiorna una membership esistente: senza questo controllo un
    // 'admin' potrebbe declassare il proprietario, che perderebbe i privilegi
    // e non potrebbe piu' annullare la modifica.
    const { data: targetMembership } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', tenantId)
      .eq('user_id', memberId)
      .maybeSingle();

    if (
      targetMembership?.role === 'owner' &&
      callerMembership.role !== 'owner'
    ) {
      return jsonResponse(
        { error: 'Solo il proprietario puo modificare il proprio ruolo' },
        { status: 403 }
      );
    }

    // Ruolo effettivo: quello richiesto se c'e', altrimenti quello che il
    // membro ha gia'; 'member' solo per chi entra ora nell'organizzazione.
    const role = roleRichiesto ?? targetMembership?.role ?? 'member';

    const { data, error } = await admin
      .from('organization_members')
      .upsert(
        {
          organization_id: tenantId,
          user_id: memberId,
          role,
        },
        {
          onConflict: 'organization_id,user_id',
        }
      )
      .select('*')
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, { status: 500 });
    }

    // temporaryPassword compare solo quando l'account e' stato appena creato.
    return jsonResponse(
      createdPassword
        ? { member: data, temporaryPassword: createdPassword }
        : { member: data },
      { status: 201 }
    );
  }

  if (request.method === 'DELETE') {
    /**
     * Rimozione di un membro dall'organizzazione.
     *
     * Prima non esisteva affatto: "Team member removed" nell'interfaccia si
     * limitava a togliere la persona dall'array `employees` dello stato
     * applicativo. La riga in organization_members restava, quindi
     * l'interessato continuava ad accedere e a vedere tutto; e alla ricarica
     * successiva useSyncEmployees lo rimetteva in elenco, perche' la fonte di
     * verita' e' il database. La rimozione non revocava nulla e non durava
     * nemmeno.
     *
     * Qui si revoca la membership, che e' cio' su cui si reggono le policy
     * RLS: senza, l'utente non vede piu' i dati dell'organizzazione. L'account
     * resta (puo' appartenere ad altre organizzazioni, e cancellarlo sarebbe
     * una decisione diversa e irreversibile).
     */
    const callerMembership = await ensureTenantAdmin(user.id, tenantId);

    const memberId = url.searchParams.get('userId') ?? '';

    if (!memberId) {
      return jsonResponse({ error: 'userId mancante' }, { status: 400 });
    }

    const { data: target, error: targetError } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', tenantId)
      .eq('user_id', memberId)
      .maybeSingle();

    if (targetError) {
      return jsonResponse({ error: targetError.message }, { status: 500 });
    }

    if (!target) {
      return jsonResponse({ error: 'Questo utente non e un membro' }, { status: 404 });
    }

    // Il proprietario non e' rimovibile: l'organizzazione resterebbe senza
    // nessuno che possa conferire di nuovo i ruoli, e organizations.owner_id
    // punterebbe a un non-membro.
    if (target.role === 'owner') {
      return jsonResponse(
        { error: 'Il proprietario non puo essere rimosso dall organizzazione' },
        { status: 403 }
      );
    }

    // Un admin non puo' rimuovere un altro admin: solo il proprietario puo'
    // farlo. Senza questo, due amministratori potrebbero espellersi a vicenda
    // e vincerebbe chi clicca per primo.
    if (target.role === 'admin' && callerMembership.role !== 'owner') {
      return jsonResponse(
        { error: 'Solo il proprietario puo rimuovere un amministratore' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await admin
      .from('organization_members')
      .delete()
      .eq('organization_id', tenantId)
      .eq('user_id', memberId);

    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, { status: 500 });
    }

    // Le notifiche gia' recapitate riguardano un'organizzazione a cui non
    // appartiene piu': non deve continuare a vederle.
    await admin
      .from('notifications')
      .delete()
      .eq('organization_id', tenantId)
      .eq('user_id', memberId);

    return jsonResponse({ removed: memberId });
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
});
