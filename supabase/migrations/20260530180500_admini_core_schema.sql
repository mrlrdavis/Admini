create extension if not exists pgcrypto;

create type public.admini_role as enum ('admin', 'staff', 'viewer');
create type public.capture_status as enum ('queued', 'synced', 'failed');
create type public.task_status as enum ('open', 'in_progress', 'completed', 'archived');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.integration_provider as enum ('schoology', 'infinite_campus');
create type public.integration_status as enum ('not_configured', 'mock', 'connected', 'error');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.admini_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  source text not null check (source in ('desktop', 'mobile')),
  mode text not null check (mode in ('voice', 'tap', 'typed')),
  redacted_text text not null,
  token_count integer not null default 0 check (token_count >= 0),
  status public.capture_status not null default 'queued',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  priority public.task_priority not null default 'normal',
  status public.task_status not null default 'open',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 year'
);

create table public.capture_task_links (
  capture_id uuid not null references public.captures(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  primary key (capture_id, task_id)
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_status not null default 'not_configured',
  credential_ref text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table public.sync_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  entity_type text not null check (entity_type in ('capture', 'task', 'integration')),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete', 'retry')),
  created_at timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);
create index captures_organization_created_at_idx on public.captures (organization_id, created_at desc);
create index tasks_organization_status_idx on public.tasks (organization_id, status, created_at desc);
create index integration_connections_org_provider_idx on public.integration_connections (organization_id, provider);
create index sync_events_organization_created_at_idx on public.sync_events (organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.captures enable row level security;
alter table public.tasks enable row level security;
alter table public.capture_task_links enable row level security;
alter table public.integration_connections enable row level security;
alter table public.sync_events enable row level security;

create policy "profiles can read themselves"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles can update themselves"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "members can read their organization"
on public.organizations for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = organizations.id
  )
);

create policy "members can read org captures"
on public.captures for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = captures.organization_id
  )
);

create policy "staff can insert org captures"
on public.captures for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = captures.organization_id
      and profiles.role in ('admin', 'staff')
  )
);

create policy "members can read org tasks"
on public.tasks for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = tasks.organization_id
  )
);

create policy "staff can write org tasks"
on public.tasks for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = tasks.organization_id
      and profiles.role in ('admin', 'staff')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = tasks.organization_id
      and profiles.role in ('admin', 'staff')
  )
);

create policy "members can read capture task links"
on public.capture_task_links for select
to authenticated
using (
  exists (
    select 1
    from public.captures
    join public.profiles on profiles.organization_id = captures.organization_id
    where captures.id = capture_task_links.capture_id
      and profiles.id = auth.uid()
  )
);

create policy "staff can write capture task links"
on public.capture_task_links for all
to authenticated
using (
  exists (
    select 1
    from public.captures
    join public.profiles on profiles.organization_id = captures.organization_id
    where captures.id = capture_task_links.capture_id
      and profiles.id = auth.uid()
      and profiles.role in ('admin', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.captures
    join public.profiles on profiles.organization_id = captures.organization_id
    where captures.id = capture_task_links.capture_id
      and profiles.id = auth.uid()
      and profiles.role in ('admin', 'staff')
  )
);

create policy "members can read org integrations"
on public.integration_connections for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = integration_connections.organization_id
  )
);

create policy "admins can manage org integrations"
on public.integration_connections for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = integration_connections.organization_id
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = integration_connections.organization_id
      and profiles.role = 'admin'
  )
);

create policy "members can read org sync events"
on public.sync_events for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = sync_events.organization_id
  )
);

create policy "staff can create org sync events"
on public.sync_events for insert
to authenticated
with check (
  actor_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.organization_id = sync_events.organization_id
      and profiles.role in ('admin', 'staff')
  )
);
