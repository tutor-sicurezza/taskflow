-- 0027_appartenenze_e_assegnazioni.sql
--
-- Le due ultime porte che il client puo' saltare. Stessa forma delle
-- precedenti: la difesa esiste, ma solo nella rotta serverless.
--
-- ===========================================================================
-- A) Un amministratore poteva prendersi l'organizzazione.
--
-- `organization_members` aveva UNA sola policy di scrittura, quella della
-- 0001: `for all` con `is_org_admin(organization_id)` sia in `using` sia in
-- `with check`. E nessun trigger. Significa che chiunque abbia ruolo `admin`
-- puo', con una PATCH diretta a PostgREST:
--
--   * mettersi `role = 'owner'` da solo;
--   * degradare il proprietario a `viewer`, o cancellarne la riga;
--   * inserire appartenenze che nessuno gli ha chiesto.
--
-- `api/tenants/[tenantId]/members.ts` questi tre gesti li rifiuta — ma "il
-- client passa dalla rotta" non e' una difesa, ed e' esattamente cio' che
-- hanno stabilito la 0023 e la 0024 per i task. Qui la stessa cosa per le
-- appartenenze, che sono la radice di tutti gli altri permessi: chi puo'
-- riscrivere questa tabella puo' riscrivere il significato di ogni altra
-- policy del progetto.
--
-- ===========================================================================
-- B) Un'attivita' si poteva assegnare a chiunque, anche fuori organizzazione.
--
-- La policy di update della 0008 chiede `is_org_manager or created_by =
-- auth.uid() or assignee_id = auth.uid()` e non guarda il contenuto della
-- riga; `task_campi_immutabili` (0018) blocca solo `organization_id` e
-- `created_by`. Restavano due cose:
--
--   1. `assignee_id` scrivibile a qualunque uuid, senza controllo di
--      appartenenza. Il task esce dal confine multi-tenant, compare
--      nell'elenco di uno sconosciuto, e `api/cron/promemoria.ts` gli manda
--      anche l'email. E' lo stesso confine che la 0024 mette in creazione;
--      mancava in modifica, dove si arriva con una PATCH sola.
--   2. La policy non consulta mai `is_org_writer`: un `viewer` che risulti
--      assegnatario di qualcosa puo' modificarlo come un membro. Nella
--      matrice dei permessi il viewer non scrive nulla (`DEFAULT_ROLES` in
--      src/lib/permissions.ts), ed e' l'unico ruolo di sola lettura che il
--      prodotto promette.
--
-- Chi puo' assegnare ad altri e' la stessa regola della creazione e la stessa
-- della matrice (`tasks.assign` e' true solo da manager in su): a se stessi
-- chiunque, ad altri solo un responsabile.

-- ===========================================================================
-- A) Appartenenze
-- ===========================================================================

-- Serviva un "sei il proprietario di questa organizzazione?" e non c'era.
-- `security definer` come le altre: dentro non si applica la RLS di
-- `organization_members`, che e' anche il motivo per cui una policy su quella
-- tabella puo' chiamarla senza ricorsione (e' la lezione della 0002).
create or replace function public.is_org_owner(target_org_id uuid)
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
      and om.role = 'owner'
  );
$$;

-- La `for all` della 0001 va in tre policy separate, perche' le tre
-- operazioni hanno regole diverse e una `for all` non sa distinguerle.
drop policy if exists "admins can manage org members" on public.organization_members;

create policy "admins can add org members"
  on public.organization_members for insert
  with check (
    public.is_org_admin(organization_id)
    -- La proprieta' la conferisce solo chi ce l'ha.
    and (role <> 'owner' or public.is_org_owner(organization_id))
  );

create policy "admins can update org members"
  on public.organization_members for update
  using (
    public.is_org_admin(organization_id)
    -- Sulla riga del proprietario mette le mani solo il proprietario.
    and (role <> 'owner' or public.is_org_owner(organization_id))
  )
  with check (
    public.is_org_admin(organization_id)
    and (role <> 'owner' or public.is_org_owner(organization_id))
  );

create policy "admins can remove org members"
  on public.organization_members for delete
  using (
    public.is_org_admin(organization_id)
    and (role <> 'owner' or public.is_org_owner(organization_id))
  );

-- Quello che le policy non sanno dire, perche' serve confrontare la riga
-- vecchia con la nuova.
create or replace function public.membro_ruolo_protetto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Scrittura dal server: le rotte in api/ hanno gia' verificato il ruolo.
  -- Stessa convenzione della 0018 e della 0023 — queste sono autorizzazioni,
  -- non invarianti sui dati, e per il service role `auth.uid()` e' nullo.
  if auth.uid() is null then
    return new;
  end if;

  -- Nessuno si promuove da solo. E' il gesto che rende inutile ogni altro
  -- controllo: senza questa riga un `admin` si scrive `owner` e da li' in poi
  -- e' il proprietario a tutti gli effetti.
  if new.role is distinct from old.role and new.user_id = auth.uid() then
    raise exception 'Non si cambia il proprio ruolo';
  end if;

  -- Togliere la proprieta' a qualcun altro e' un gesto da proprietario, e la
  -- policy lo copre. Qui si chiude il verso opposto, che la policy non vede:
  -- la riga PRIMA non era `owner`, quindi passa il `using`, e diventa `owner`
  -- adesso.
  if new.role = 'owner' and old.role <> 'owner'
     and not public.is_org_owner(new.organization_id) then
    raise exception 'Solo il proprietario puo'' conferire la proprieta''';
  end if;

  -- Una riga non cambia ne' persona ne' organizzazione: sarebbe un modo di
  -- spostare un'appartenenza altrove aggirando le `with check`, che guardano
  -- la riga nuova ma non sanno da dove viene.
  if new.user_id is distinct from old.user_id then
    raise exception 'Un''appartenenza non cambia persona';
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'Un''appartenenza non cambia organizzazione';
  end if;

  return new;
end;
$$;

drop trigger if exists membro_ruolo_protetto on public.organization_members;

create trigger membro_ruolo_protetto
  before update on public.organization_members
  for each row
  execute function public.membro_ruolo_protetto();

-- ===========================================================================
-- B) Assegnazioni
-- ===========================================================================

drop policy if exists "task owners managers and admins can update tasks" on public.tasks;

create policy "task owners managers and admins can update tasks"
  on public.tasks for update
  using (
    -- Nuovo rispetto alla 0008: il viewer non scrive, nemmeno cio' che gli e'
    -- stato assegnato. Il ruolo di sola lettura deve essere di sola lettura.
    public.is_org_writer(organization_id)
    and (
      public.is_org_manager(organization_id)
      or created_by = auth.uid()
      or assignee_id = auth.uid()
    )
  )
  with check (
    public.is_org_writer(organization_id)
    and (
      public.is_org_manager(organization_id)
      or created_by = auth.uid()
      or assignee_id = auth.uid()
    )
  );

-- Il confine sull'assegnatario sta in un trigger e non nella `with check`
-- perche' deve scattare SOLO quando l'assegnatario cambia davvero.
-- Nella `with check` varrebbe su ogni scrittura, e allora un'attivita' il cui
-- assegnatario ha lasciato l'azienda diventerebbe immodificabile per sempre:
-- non si potrebbe nemmeno correggerle il titolo o toglierle l'assegnazione.
create or replace function public.task_assegnazione_protetta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  -- Stessa regola della creazione (0024) e della matrice dei permessi:
  -- `tasks.assign` e' vero solo da manager in su.
  if new.assignee_id is not null
     and new.assignee_id <> auth.uid()
     and not public.is_org_manager(new.organization_id) then
    raise exception 'Solo un responsabile puo'' assegnare a un''altra persona';
  end if;

  -- E l'assegnatario, chiunque lo scelga, sta in QUESTA organizzazione.
  if new.assignee_id is not null
     and not public.is_org_member_of(new.organization_id, new.assignee_id) then
    raise exception 'L''assegnatario non appartiene a questa organizzazione';
  end if;

  return new;
end;
$$;

drop trigger if exists task_assegnazione_protetta on public.tasks;

create trigger task_assegnazione_protetta
  before update on public.tasks
  for each row
  execute function public.task_assegnazione_protetta();
