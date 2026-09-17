import { supabase } from '@/lib/supabase';

/*
  Gli errori di questo modulo portano una CHIAVE di traduzione, non una frase.

  Prima portavano la frase gia' scritta, in italiano, e chi la mostrava faceva
  `toast.error(e.message)`: un utente tedesco leggeva "Sessione scaduta, accedi
  di nuovo" in mezzo alla sua interfaccia. Qui dentro la lingua di chi guarda
  non si puo' sapere — non c'e' React, non c'e' contesto — quindi si rimanda la
  decisione a chi mostra il messaggio, che la sa. Chi lo mostra passa il
  messaggio da `t()`: le chiavi note vengono tradotte, e tutto il resto (gli
  errori di Supabase, per esempio) attraversa immutato.
*/
import type { DeroghePermessi, UserRole } from '@/lib/types';
import { chiamataAutenticata } from '@/lib/apiClient';

/**
 * Unico percorso di scrittura per l'anagrafica reale dei membri.
 *
 * Perche' esiste: "Add User" e la gestione dei ruoli scrivevano solo
 * nell'array `employees` dello stato applicativo. Il risultato era che
 * l'utente "creato" non aveva alcun account (non poteva accedere, e i task
 * assegnati puntavano a un id che non apparteneva a nessuno) e che un cambio
 * di ruolo non toccava `organization_members` — cioe' non cambiava NULLA di
 * cio' che le policy RLS e le rotte api/ usano per autorizzare. Peggio:
 * useSyncEmployees rilegge il ruolo dal database a ogni avvio, quindi la
 * modifica spariva da sola al ricaricamento.
 *
 * Entrambe le operazioni passano ora da POST /api/tenants/<id>/members, che
 * gira lato server con il service role e impone i controlli di ruolo
 * (solo owner/admin; solo l'owner puo' conferire o togliere 'owner').
 *
 * Nota operativa: le rotte in api/ non rispondono con `npm run dev`, che serve
 * solo il frontend. Servono `vercel dev` o un deploy.
 */

export type OrgRole = UserRole | 'owner';

export interface OrgMemberResult {
  /** id dell'utente in auth.users / profiles: e' l'id reale del membro. */
  userId: string;
  role: OrgRole;
  /**
   * Presente solo quando l'account e' stato appena creato. Non esiste modo di
   * recapitarla automaticamente, quindi va mostrata all'amministratore perche'
   * la consegni lui.
   */
  temporaryPassword?: string;
  /**
   * Presente solo quando l'operazione e' riuscita ma NON per intero: oggi
   * l'unico caso e' l'anagrafica di chi appartiene anche ad altre
   * organizzazioni, che da qui non si tocca.
   *
   * Va mostrato. Il difetto che ha aggiunto questo campo era esattamente il
   * contrario — la rotta rispondeva 403 ad accesso gia' concesso — e la
   * lezione e' la stessa: una risposta deve dire cosa e' successo davvero,
   * non una delle due meta'.
   */
  avviso?: string;
  /**
   * Il profilo COME E' NEL DATABASE, non come lo si era chiesto. Presente
   * insieme ad `avviso`, ed e' la ragione per cui esiste: chi chiama deve
   * poter mostrare i valori veri invece di quelli che ha inviato e che il
   * server ha rifiutato.
   */
  profiloEsistente?: {
    full_name?: string | null;
    avatar_url?: string | null;
    joined_date?: string | null;
    job_title?: string | null;
    departments?: string[] | null;
    status?: string | null;
    team_lead?: boolean | null;
    phone?: string | null;
    location?: string | null;
  };
}

interface UpsertMemberArgs {
  tenantId: string;
  email: string;
  /** Facoltativo: se assente, il ruolo esistente non viene toccato. */
  role?: OrgRole;
  fullName?: string;
  jobTitle?: string;
  departments?: string[];
  status?: 'active' | 'inactive';
  teamLead?: boolean;
  phone?: string;
  location?: string;
  /**
   * Deroghe ai permessi del ruolo. `null` le toglie; assente le lascia
   * com'erano. Vivono su organization_members.custom_permissions (0028),
   * quindi valgono SOLO nell'organizzazione in cui sono state concesse: e' la
   * rotta, con il service role e dopo aver verificato che chi chiama e'
   * amministratore, l'unica a poterle scrivere.
   */
  customPermissions?: DeroghePermessi | null;
}

/** Nome storico, mantenuto: la funzione condivisa sta in apiClient.ts. */
const authorizedFetch = (path: string, body: unknown) => chiamataAutenticata(path, { body });

/**
 * Crea l'account se l'email non e' ancora nota, altrimenti si limita ad
 * aggiornare la membership. La stessa rotta copre i due casi perche' lato
 * server sono lo stesso upsert su (organization_id, user_id).
 */
export async function upsertOrgMember({
  tenantId,
  email,
  role,
  fullName,
  jobTitle,
  departments,
  status,
  teamLead,
  phone,
  location,
  customPermissions,
}: UpsertMemberArgs): Promise<OrgMemberResult> {
  if (!tenantId) throw new Error('comune.nessunaOrganizzazione');
  if (!email?.trim()) {
    throw new Error("L'email e' obbligatoria: senza account l'utente non puo' accedere");
  }

  const payload = await authorizedFetch(
    `/api/tenants/${encodeURIComponent(tenantId)}/members`,
    {
      email: email.trim().toLowerCase(),
      role,
      fullName,
      jobTitle,
      departments,
      status,
      teamLead,
      phone,
      location,
      // `undefined` sparisce dal JSON, quindi "non toccare" e "togli" restano
      // distinguibili lato server: assente contro null.
      customPermissions,
    }
  );

  const member = payload?.member as { user_id?: string; role?: string } | undefined;
  if (!member?.user_id) {
    throw new Error('comune.rispostaIncompleta');
  }

  return {
    userId: member.user_id,
    role: member.role as OrgRole,
    temporaryPassword:
      typeof payload?.temporaryPassword === 'string' ? payload.temporaryPassword : undefined,
    avviso: typeof payload?.avviso === 'string' ? payload.avviso : undefined,
    profiloEsistente:
      payload?.profiloEsistente && typeof payload.profiloEsistente === 'object'
        ? (payload.profiloEsistente as OrgMemberResult['profiloEsistente'])
        : undefined,
  };
}

/** Cambia il ruolo di un membro gia' esistente, identificato dalla sua email. */
export async function updateOrgMemberRole(
  tenantId: string,
  email: string,
  role: OrgRole
): Promise<OrgMemberResult> {
  return upsertOrgMember({ tenantId, email, role });
}

/**
 * Rimuove un membro dall'organizzazione, revocandone davvero l'accesso.
 *
 * "Team member removed" toglieva la persona solo dall'elenco nello stato
 * applicativo: la riga in organization_members restava, quindi continuava ad
 * accedere e a vedere tutto, e alla ricarica successiva useSyncEmployees la
 * rimetteva in elenco. L'account non viene cancellato — puo' appartenere ad
 * altre organizzazioni — ma perde ogni accesso a questa.
 */
export async function removeOrgMember(tenantId: string, userId: string): Promise<void> {
  if (!tenantId) throw new Error('comune.nessunaOrganizzazione');
  if (!userId) throw new Error('comune.utenteNonIndicato');

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('comune.sessioneScaduta');
  }

  const response = await fetch(
    `/api/tenants/${encodeURIComponent(tenantId)}/members?userId=${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${session.access_token}` },
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Rimozione fallita (${response.status})`);
  }
}

/**
 * Assegna una nuova password provvisoria a un membro.
 *
 * Serve perche' non esisteva alcun modo di rientrare dopo aver dimenticato la
 * password: nessun "password dimenticata" nell'interfaccia e nessuna azione
 * amministrativa. La password torna al chiamante perche' la consegni di
 * persona — non c'e' un canale di recapito su cui fare affidamento.
 */
export async function resetMemberPassword(
  tenantId: string,
  email: string
): Promise<string> {
  if (!tenantId) throw new Error('comune.nessunaOrganizzazione');
  if (!email) throw new Error("Questo membro non ha un'email collegata");

  const payload = await authorizedFetch(
    `/api/tenants/${encodeURIComponent(tenantId)}/members`,
    { action: 'reset-password', email: email.trim().toLowerCase() }
  );

  if (typeof payload?.temporaryPassword !== 'string' || !payload.temporaryPassword) {
    throw new Error('comune.passwordNonRestituita');
  }

  return payload.temporaryPassword;
}

/**
 * Crea una nuova organizzazione e ne rende proprietario chi la crea.
 *
 * La rotta esisteva gia' in api/tenants/index.ts ma non era chiamata da
 * nessuna parte: dopo la chiusura dell'auto-creazione al primo accesso non
 * restava alcun modo, dall'applicazione, di aprire un secondo spazio di
 * lavoro. Lato server e' riservata a chi e' gia' amministratore da qualche
 * parte, o a chi non appartiene ancora a nulla.
 */
export async function createOrganization(name: string): Promise<{ id: string; name: string }> {
  if (!name.trim()) throw new Error("Indica il nome dell'organizzazione");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error('comune.sessioneScaduta');

  const response = await fetch('/api/tenants', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ name: name.trim() }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Creazione fallita (${response.status})`);
  }

  return payload.tenant;
}
