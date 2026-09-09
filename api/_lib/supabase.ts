import { createClient } from '@supabase/supabase-js';
import { getRequiredEnv } from './env.js';

export function createSupabaseAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getRequiredEnv();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createSupabaseAuthClient(accessToken: string) {
  const { supabaseUrl, supabaseAnonKey } = getRequiredEnv();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    throw new Response(JSON.stringify({ error: 'Missing authorization token' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const client = createSupabaseAuthClient(token);
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  return data.user;
}

export async function ensureTenantMembership(userId: string, tenantId: string) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('organization_members')
    .select('organization_id, role')
    .eq('organization_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!data) {
    throw new Response(JSON.stringify({ error: 'You do not belong to this tenant' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  return data;
}

/**
 * Come ensureTenantMembership, ma richiede anche privilegi amministrativi.
 *
 * Necessaria perche' tutti gli handler in api/ operano con il client service
 * role, che scavalca le RLS: la policy "admins can manage org members" non
 * viene mai valutata, quindi il controllo di ruolo DEVE avvenire qui.
 * Senza questa funzione un semplice 'member' poteva promuoversi ad 'admin'
 * chiamando POST /api/tenants/<id>/members (verificato in produzione).
 */
export async function ensureTenantAdmin(userId: string, tenantId: string) {
  const membership = await ensureTenantMembership(userId, tenantId);

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new Response(
      JSON.stringify({ error: 'Richiede privilegi di amministratore' }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
  }

  return membership;
}

/**
 * Gerarchia dei ruoli di organizzazione.
 *
 * Fino a ora 'manager' e 'viewer' esistevano solo nel vincolo CHECK della
 * tabella e nell'interfaccia: nessun controllo lato server li distingueva da
 * 'member', quindi un 'viewer' — nominalmente in sola lettura — poteva creare
 * e assegnare task come chiunque altro. I gate nel frontend non contano: le
 * rotte in api/ sono chiamabili direttamente con un token valido.
 */
export const ROLE_RANK = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3,
  owner: 4,
} as const;

export type OrgRole = keyof typeof ROLE_RANK;

export function roleRank(role: string | null | undefined): number {
  return role && role in ROLE_RANK ? ROLE_RANK[role as OrgRole] : -1;
}

function forbidden(message: string): never {
  throw new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
}

/** Membership che soddisfa almeno `minRole` nella gerarchia sopra. */
export async function ensureTenantRole(
  userId: string,
  tenantId: string,
  minRole: OrgRole
) {
  const membership = await ensureTenantMembership(userId, tenantId);

  if (roleRank(membership.role) < ROLE_RANK[minRole]) {
    forbidden(`Richiede il ruolo '${minRole}' o superiore in questa organizzazione`);
  }

  return membership;
}

/**
 * Verifica che `memberId` appartenga davvero a `tenantId`.
 *
 * Serve perche' gli handler usano il client service role: assegnare un task a
 * un UUID qualunque riusciva anche quando quell'utente stava in un'ALTRA
 * organizzazione, creando una riga che perde il confine multi-tenant e che il
 * destinatario vede comparire fra i propri task.
 */
export async function ensureIsOrgMember(memberId: string, tenantId: string) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', tenantId)
    .eq('user_id', memberId)
    .maybeSingle();

  if (error) {
    throw new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!data) {
    forbidden("L'utente indicato non appartiene a questa organizzazione");
  }

  return data;
}

export function jsonResponse(payload: unknown, init?: ResponseInit) {
  return Response.json(payload, init);
}

// Il runtime delle Vercel Functions non intercetta un `throw` di una Response:
// l'eccezione risale non gestita e la piattaforma risponde
// 500 FUNCTION_INVOCATION_FAILED invece del 401/403 previsto.
// Questo wrapper cattura l'eccezione e restituisce la Response "lanciata",
// trasformando qualsiasi altro errore in un 500 con corpo JSON.
export function withErrors(
  fn: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await fn(request);
    } catch (e) {
      if (e instanceof Response) return e;   // errori "lanciati" come Response
      const message = e instanceof Error ? e.message : 'Errore interno';
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
