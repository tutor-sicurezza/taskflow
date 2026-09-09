-- 0004_extend_schema_for_app_state.sql
--
-- La 0001 copriva ~4 delle 17 chiavi di stato usate dall'app. Questa migration
-- colma il divario, su tre fronti:
--
--   1. allinea i ruoli fra TypeScript e database;
--   2. aggiunge a profiles/tasks/notifications i campi che il codice si aspetta;
--   3. introduce app_state e user_state, due tabelle chiave/valore JSONB che
--      ospitano le chiavi di configurazione rimanenti (system-settings,
--      sendgrid-config, departments, announcements, feedback, audit-log,
--      email-templates, ...) senza inventare una tabella per ciascuna.
--
-- Le entita' che meritano tabelle relazionali vere (tasks, profiles,
-- notifications) le hanno gia' e restano il percorso per una normalizzazione
-- successiva.

-- 1) Allinea i ruoli: TS usa admin|manager|member|viewer, SQL aveva owner|admin|member
alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'manager', 'member', 'viewer'));

-- 2) Campi Employee mancanti su profiles
alter table public.profiles add column if not exists job_title    text;
alter table public.profiles add column if not exists departments  text[] not null default '{}';
alter table public.profiles add column if not exists phone        text;
alter table public.profiles add column if not exists status       text not null default 'active'
  check (status in ('active', 'inactive'));
alter table public.profiles add column if not exists location     text;
alter table public.profiles add column if not exists bio          text;
alter table public.profiles add column if not exists skills       text[] not null default '{}';
alter table public.profiles add column if not exists team_lead    boolean not null default false;
alter table public.profiles add column if not exists custom_permissions jsonb;
alter table public.profiles add column if not exists joined_date  timestamptz not null default now();

-- 3) Sotto-oggetti dei task che non avevano casa
alter table public.tasks add column if not exists comments    jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists activities  jsonb not null default '[]'::jsonb;
alter table public.tasks add column if not exists attachments jsonb not null default '[]'::jsonb;

-- 4) Campi notifications mancanti
alter table public.notifications add column if not exists action_by_name   text;
alter table public.notifications add column if not exists action_by_avatar text;
alter table public.notifications add column if not exists link             text;

-- 5) app_state: chiave/valore per organizzazione
create table if not exists public.app_state (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key             text not null,
  value           jsonb not null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null,
  primary key (organization_id, key)
);

alter table public.app_state enable row level security;

drop policy if exists "members can read app state"   on public.app_state;
drop policy if exists "members can write app state"  on public.app_state;
drop policy if exists "members can update app state" on public.app_state;

create policy "members can read app state"
  on public.app_state for select
  using (public.is_org_member(organization_id));

create policy "members can write app state"
  on public.app_state for insert
  with check (public.is_org_member(organization_id));

create policy "members can update app state"
  on public.app_state for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- 6) user_state: chiavi per-utente (notification-preferences-<id>,
--    has-completed-welcome, has-seen-launch-announcement)
create table if not exists public.user_state (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_state enable row level security;

drop policy if exists "users manage their own state" on public.user_state;

create policy "users manage their own state"
  on public.user_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
