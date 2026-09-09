-- 0002_fix_rls_recursion.sql
--
-- Corregge tre difetti di 0001_multitenant_schema.sql che rendono lo schema
-- inutilizzabile dal client. Va eseguita SUBITO DOPO 0001.
--
-- 1) RICORSIONE INFINITA NELLE POLICY
--    is_org_member()/is_org_admin() sono dichiarate "stable" ma NON
--    "security definer", quindi girano con i privilegi del chiamante e la
--    query interna su organization_members attiva a sua volta la policy
--    "members can read org members" -> che richiama is_org_member() -> loop.
--    Postgres aborta con 42P17 al primo SELECT. La creazione delle policy in
--    0001 riesce (la ricorsione emerge solo a runtime), quindi il problema si
--    manifesta appena l'app legge qualcosa.
--    Fix: security definer + search_path fisso, così la query interna bypassa
--    RLS su organization_members e la ricorsione si spezza.
--
-- 2) BOOTSTRAP DEL PRIMO MEMBRO IMPOSSIBILE
--    L'unica policy di INSERT su organization_members e' "admins can manage
--    org members", che richiede is_org_admin() = true. Ma per essere admin
--    serve gia' una riga in organization_members: chicken-and-egg. Chi crea
--    un'organizzazione non puo' aggiungere se stesso.
--
-- 3) PROFILES SENZA INSERT/UPDATE
--    profiles ha solo una policy di SELECT: nessun utente puo' creare o
--    aggiornare il proprio profilo dal client.
--
-- 4) PROFILES SCOLLEGATA DA auth.users
--    profiles.id e' un uuid senza foreign key: si possono creare profili con
--    id arbitrari che non corrispondono ad alcun utente reale, e cancellando
--    un utente da auth.users il profilo resta orfano.

-- --------------------------------------------------------------------------
-- 1) Helper functions: security definer
-- --------------------------------------------------------------------------

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  );
$$;

-- --------------------------------------------------------------------------
-- 2) Bootstrap: il proprietario dell'organizzazione puo' inserire membri
-- --------------------------------------------------------------------------

drop policy if exists "org owner can bootstrap members" on public.organization_members;

create policy "org owner can bootstrap members"
  on public.organization_members
  for insert
  with check (
    exists (
      select 1
      from public.organizations o
      where o.id = organization_members.organization_id
        and o.owner_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- 3) Profiles: ogni utente gestisce la propria riga
-- --------------------------------------------------------------------------

drop policy if exists "users can insert their own profile" on public.profiles;

create policy "users can insert their own profile"
  on public.profiles
  for insert
  with check (id = auth.uid());

drop policy if exists "users can update their own profile" on public.profiles;

create policy "users can update their own profile"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "users can read their own profile" on public.profiles;

-- La policy di 0001 rende un profilo leggibile solo se condivide
-- un'organizzazione con chi legge: un utente appena registrato, ancora senza
-- organizzazione, non vedrebbe nemmeno se stesso.
create policy "users can read their own profile"
  on public.profiles
  for select
  using (id = auth.uid());

-- --------------------------------------------------------------------------
-- 4) Profiles agganciata a auth.users
-- --------------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;
