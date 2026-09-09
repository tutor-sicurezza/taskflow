-- 0005_owner_can_read_own_org.sql
--
-- Terzo chicken-and-egg della 0001, scoperto provando una registrazione reale.
--
-- L'unica policy di SELECT su organizations era:
--     using (public.is_org_member(id))
--
-- Postgres applica le policy di SELECT anche alla clausola RETURNING. Quando un
-- nuovo utente crea la propria organizzazione, la riga di organization_members
-- non esiste ancora, quindi la riga appena inserita non e' visibile a chi l'ha
-- creata e l'INSERT ... RETURNING viene rifiutato con:
--     42501: new row violates row-level security policy for table "organizations"
--
-- L'INSERT nudo passa: fallisce solo con RETURNING. E supabase-js usa RETURNING
-- per ogni .insert().select(), quindi il difetto colpisce ogni registrazione.
--
-- Il proprietario deve poter leggere la propria organizzazione a prescindere
-- dalla membership — che e' anche corretto di suo.

drop policy if exists "owners can read their organizations" on public.organizations;

create policy "owners can read their organizations"
  on public.organizations
  for select
  using (owner_id = auth.uid());
