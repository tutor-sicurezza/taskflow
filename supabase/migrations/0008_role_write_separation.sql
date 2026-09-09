-- 0008_role_write_separation.sql
--
-- I ruoli 'manager' e 'viewer' erano puramente decorativi: esistevano nel
-- vincolo CHECK di organization_members e nell'interfaccia, ma NESSUNA policy
-- li distingueva da 'member'. Tutte le policy di scrittura passavano da
-- is_org_member(), vera per qualunque ruolo, viewer compreso.
--
-- La conseguenza pratica piu' grave era su app_state: e' li' che l'app tiene
-- davvero task, dipendenti e annunci (la tabella `tasks` non e' ancora in uso).
-- Un 'viewer' — nominalmente in sola lettura — poteva quindi riscrivere lo
-- stato intero dell'organizzazione, e non serviva nemmeno l'interfaccia:
-- bastava una PATCH diretta a PostgREST con il proprio token.
--
-- Qui si separa "chi puo' leggere" da "chi puo' scrivere".

-- 1) Nuovi predicati. SECURITY DEFINER + search_path fissato per gli stessi
--    motivi della 0002: senza, la valutazione della policy rientra nella
--    tabella e Postgres solleva ricorsione infinita (54001).
create or replace function public.is_org_writer(target_org_id uuid)
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
      and om.role in ('owner', 'admin', 'manager', 'member')
  );
$$;

create or replace function public.is_org_manager(target_org_id uuid)
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
      and om.role in ('owner', 'admin', 'manager')
  );
$$;

-- Come nella 0003: `authenticated` DEVE conservare EXECUTE, altrimenti la
-- valutazione delle policy fallisce per gli utenti normali. Si revoca solo a
-- public/anon per non esporre i predicati come RPC a chi non ha sessione.
revoke execute on function public.is_org_writer(uuid) from public, anon;
revoke execute on function public.is_org_manager(uuid) from public, anon;
grant execute on function public.is_org_writer(uuid) to authenticated, service_role;
grant execute on function public.is_org_manager(uuid) to authenticated, service_role;

-- 2) app_state: lettura a tutti i membri, scrittura negata ai viewer.
drop policy if exists "members can write app state"  on public.app_state;
drop policy if exists "members can update app state" on public.app_state;

create policy "writers can insert app state"
  on public.app_state for insert
  with check (public.is_org_writer(organization_id));

create policy "writers can update app state"
  on public.app_state for update
  using (public.is_org_writer(organization_id))
  with check (public.is_org_writer(organization_id));

-- 3) tasks: la 0006 aveva gia' ristretto update/delete all'autore,
--    all'assegnatario o a un admin. Restava aperta la creazione, che
--    is_org_member concedeva anche ai viewer.
drop policy if exists "members can create tasks" on public.tasks;

create policy "writers can create tasks"
  on public.tasks for insert
  with check (public.is_org_writer(organization_id));

-- Un 'manager' deve poter gestire il lavoro del team, non solo il proprio:
-- la 0006 lo lasciava al livello di un 'member'.
drop policy if exists "task owners and admins can update tasks" on public.tasks;

create policy "task owners managers and admins can update tasks"
  on public.tasks
  for update
  using (
    public.is_org_manager(organization_id)
    or created_by = auth.uid()
    or assignee_id = auth.uid()
  )
  with check (
    public.is_org_manager(organization_id)
    or created_by = auth.uid()
    or assignee_id = auth.uid()
  );

drop policy if exists "task authors and admins can delete tasks" on public.tasks;

create policy "task authors and managers can delete tasks"
  on public.tasks
  for delete
  using (
    public.is_org_manager(organization_id)
    or created_by = auth.uid()
  );
