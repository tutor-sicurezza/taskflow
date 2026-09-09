create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  assignee_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'not-started' check (status in ('not-started', 'in-progress', 'completed')),
  due_date timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  task_title text,
  type text not null,
  message text not null,
  action_by uuid references public.profiles(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('sent', 'failed', 'pending', 'bounced')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_organization_id on public.tasks (organization_id);
create index if not exists idx_tasks_assignee_id on public.tasks (assignee_id);
create index if not exists idx_notifications_user_id on public.notifications (user_id);
create index if not exists idx_notifications_organization_id on public.notifications (organization_id);
create index if not exists idx_email_logs_organization_id on public.email_delivery_logs (organization_id);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.email_delivery_logs enable row level security;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
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
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  );
$$;

create policy "organization members can read their organizations"
  on public.organizations
  for select
  using (public.is_org_member(id));

create policy "organization owners can insert organizations"
  on public.organizations
  for insert
  with check (owner_id = auth.uid());

create policy "profiles are readable by organization members"
  on public.profiles
  for select
  using (exists (
    select 1
    from public.organization_members om
    where om.user_id = profiles.id
      and public.is_org_member(om.organization_id)
  ));

create policy "members can read org members"
  on public.organization_members
  for select
  using (public.is_org_member(organization_id));

create policy "admins can manage org members"
  on public.organization_members
  for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "members can read tasks"
  on public.tasks
  for select
  using (public.is_org_member(organization_id));

create policy "members can create tasks"
  on public.tasks
  for insert
  with check (public.is_org_member(organization_id));

create policy "members can update tasks"
  on public.tasks
  for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "members can delete tasks"
  on public.tasks
  for delete
  using (public.is_org_member(organization_id));

create policy "users can read their notifications"
  on public.notifications
  for select
  using (user_id = auth.uid() and public.is_org_member(organization_id));

create policy "users can update their notifications"
  on public.notifications
  for update
  using (user_id = auth.uid() and public.is_org_member(organization_id))
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

create policy "admins can read email logs"
  on public.email_delivery_logs
  for select
  using (public.is_org_admin(organization_id));
