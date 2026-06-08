create extension if not exists pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.admini_role AS ENUM ('admin', 'principal', 'teacher', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.capture_status AS ENUM ('queued', 'synced', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_provider AS ENUM ('schoology', 'infinite_campus', 'google_classroom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_status AS ENUM ('not_configured', 'mock', 'connected', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.admini_role not null,
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.admini_role not null default 'staff',
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index invitations_pending_email_org_idx
on public.invitations (organization_id, lower(email))
where status = 'pending' and revoked_at is null and accepted_at is null;

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
  updated_at timestamptz not null default now(),
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
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capture_id uuid not null references public.captures(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, capture_id, task_id)
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
  entity_type text not null check (entity_type in ('capture', 'task', 'integration', 'invitation', 'membership')),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete', 'retry', 'accept', 'revoke')),
  created_at timestamptz not null default now()
);

create index profiles_email_lower_idx on public.profiles (lower(email));
create index organizations_created_by_idx on public.organizations (created_by);
create index organization_memberships_profile_idx on public.organization_memberships (profile_id);
create index organization_memberships_org_role_idx on public.organization_memberships (organization_id, role);
create index invitations_org_status_idx on public.invitations (organization_id, status, created_at desc);
create index invitations_email_lower_idx on public.invitations (lower(email));
create index captures_organization_created_at_idx on public.captures (organization_id, created_at desc);
create index tasks_organization_status_idx on public.tasks (organization_id, status, created_at desc);
create index capture_task_links_org_capture_idx on public.capture_task_links (organization_id, capture_id);
create index capture_task_links_org_task_idx on public.capture_task_links (organization_id, task_id);
create index integration_connections_org_provider_idx on public.integration_connections (organization_id, provider);
create index sync_events_organization_created_at_idx on public.sync_events (organization_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();

create trigger invitations_set_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

create trigger captures_set_updated_at
before update on public.captures
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt()->>'email', '');
$$;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships
    where organization_memberships.organization_id = target_organization_id
      and organization_memberships.profile_id = (select auth.uid())
  );
$$;

create or replace function public.org_role(target_organization_id uuid)
returns public.admini_role
language sql
stable
security definer
set search_path = public
as $$
  select organization_memberships.role
  from public.organization_memberships
  where organization_memberships.organization_id = target_organization_id
    and organization_memberships.profile_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.can_manage_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.org_role(target_organization_id) in ('admin', 'principal');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'AdminI user'),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.ensure_profile_row()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_email text;
begin
  current_user_id := (select auth.uid());
  current_email := public.current_user_email();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    current_user_id,
    current_email,
    coalesce(nullif(auth.jwt()->'user_metadata'->>'display_name', ''), split_part(current_email, '@', 1), 'AdminI user')
  )
  on conflict (id) do update
  set email = excluded.email;

  return current_user_id;
end;
$$;

create or replace function public.ensure_user_profile()
returns table (
  id uuid,
  organization_id uuid,
  email text,
  display_name text,
  role public.admini_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  default_organization_id uuid;
begin
  current_user_id := public.ensure_profile_row();

  select organization_memberships.organization_id
  into default_organization_id
  from public.organization_memberships
  where organization_memberships.profile_id = current_user_id
  order by organization_memberships.joined_at asc
  limit 1;

  if default_organization_id is null then
    insert into public.organizations (name, created_by)
    values (
      coalesce(nullif(auth.jwt()->'user_metadata'->>'school_name', ''), 'AdminI School'),
      current_user_id
    )
    returning organizations.id into default_organization_id;

    insert into public.organization_memberships (organization_id, profile_id, role)
    values (default_organization_id, current_user_id, 'admin');
  end if;

  return query
  select profiles.id, organization_memberships.organization_id, profiles.email, profiles.display_name, organization_memberships.role
  from public.profiles
  join public.organization_memberships on organization_memberships.profile_id = profiles.id
  where profiles.id = current_user_id
    and organization_memberships.organization_id = default_organization_id
  limit 1;
end;
$$;

create or replace function public.create_organization(organization_name text, organization_slug text default null)
returns table (
  organization_id uuid,
  membership_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_profile_row();

  insert into public.organizations (name, slug, created_by)
  values (organization_name, organization_slug, current_user_id)
  returning organizations.id into organization_id;

  insert into public.organization_memberships (organization_id, profile_id, role)
  values (organization_id, current_user_id, 'admin')
  returning organization_memberships.id into membership_id;

  return next;
end;
$$;

create or replace function public.create_invitation(
  target_organization_id uuid,
  invite_email text,
  invite_role public.admini_role default 'staff',
  invite_expires_at timestamptz default now() + interval '7 days'
)
returns table (
  invitation_id uuid,
  invitation_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  generated_token text;
begin
  current_user_id := (select auth.uid());

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_manage_org(target_organization_id) then
    raise exception 'Only admins and principals can invite users';
  end if;

  generated_token := encode(gen_random_bytes(32), 'hex');

  insert into public.invitations (organization_id, email, role, token_hash, invited_by, expires_at)
  values (
    target_organization_id,
    lower(trim(invite_email)),
    invite_role,
    encode(digest(generated_token, 'sha256'), 'hex'),
    current_user_id,
    invite_expires_at
  )
  returning invitations.id into invitation_id;

  invitation_token := generated_token;
  return next;
end;
$$;

create or replace function public.accept_invitation(invitation_token text)
returns table (
  organization_id uuid,
  membership_id uuid,
  role public.admini_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_email text;
  target_invitation public.invitations%rowtype;
begin
  current_user_id := (select auth.uid());
  current_email := lower(trim(public.current_user_email()));

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.ensure_profile_row();

  select *
  into target_invitation
  from public.invitations
  where token_hash = encode(digest(invitation_token, 'sha256'), 'hex')
    and status = 'pending'
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if target_invitation.id is null then
    raise exception 'Invitation is invalid or expired';
  end if;

  if lower(trim(target_invitation.email)) <> current_email then
    raise exception 'Invitation email does not match the signed-in user';
  end if;

  insert into public.organization_memberships (organization_id, profile_id, role, invited_by)
  values (target_invitation.organization_id, current_user_id, target_invitation.role, target_invitation.invited_by)
  on conflict (organization_id, profile_id) do update
  set role = excluded.role
  returning organization_memberships.organization_id, organization_memberships.id, organization_memberships.role
  into organization_id, membership_id, role;

  update public.invitations
  set status = 'accepted',
      accepted_by = current_user_id,
      accepted_at = now()
  where id = target_invitation.id;

  return next;
end;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.captures enable row level security;
alter table public.tasks enable row level security;
alter table public.capture_task_links enable row level security;
alter table public.integration_connections enable row level security;
alter table public.sync_events enable row level security;

create policy "profiles can read themselves and org peers"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.organization_memberships self_membership
    join public.organization_memberships peer_membership
      on peer_membership.organization_id = self_membership.organization_id
    where self_membership.profile_id = (select auth.uid())
      and peer_membership.profile_id = profiles.id
  )
);

create policy "profiles can update themselves"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "members can read their organizations"
on public.organizations for select
to authenticated
using (public.is_org_member(id));

create policy "admins and principals can update organizations"
on public.organizations for update
to authenticated
using (public.can_manage_org(id))
with check (public.can_manage_org(id));

create policy "admins can delete organizations"
on public.organizations for delete
to authenticated
using (public.org_role(id) = 'admin');

create policy "members can read organization memberships"
on public.organization_memberships for select
to authenticated
using (public.is_org_member(organization_id));

create policy "admins and principals can update organization memberships"
on public.organization_memberships for update
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

create policy "admins and principals can remove organization memberships"
on public.organization_memberships for delete
to authenticated
using (
  public.can_manage_org(organization_id)
  or profile_id = (select auth.uid())
);

create policy "managers can read organization invitations"
on public.invitations for select
to authenticated
using (
  public.can_manage_org(organization_id)
  or lower(email) = lower(public.current_user_email())
);

create policy "managers can revoke organization invitations"
on public.invitations for update
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

create policy "members can read org captures"
on public.captures for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can create org captures"
on public.captures for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_org_member(organization_id)
);

create policy "capture owners and managers can update captures"
on public.captures for update
to authenticated
using (
  public.can_manage_org(organization_id)
  or created_by = (select auth.uid())
)
with check (
  public.can_manage_org(organization_id)
  or created_by = (select auth.uid())
);

create policy "capture owners and managers can delete captures"
on public.captures for delete
to authenticated
using (
  public.can_manage_org(organization_id)
  or created_by = (select auth.uid())
);

create policy "members can read org tasks"
on public.tasks for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can create org tasks"
on public.tasks for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_org_member(organization_id)
);

create policy "task owners and managers can update tasks"
on public.tasks for update
to authenticated
using (
  public.can_manage_org(organization_id)
  or created_by = (select auth.uid())
)
with check (
  public.can_manage_org(organization_id)
  or created_by = (select auth.uid())
);

create policy "task owners and managers can delete tasks"
on public.tasks for delete
to authenticated
using (
  public.can_manage_org(organization_id)
  or created_by = (select auth.uid())
);

create policy "members can read org capture task links"
on public.capture_task_links for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can create org capture task links"
on public.capture_task_links for insert
to authenticated
with check (public.is_org_member(organization_id));

create policy "members can update org capture task links"
on public.capture_task_links for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "members can delete org capture task links"
on public.capture_task_links for delete
to authenticated
using (public.is_org_member(organization_id));

create policy "members can read org integrations"
on public.integration_connections for select
to authenticated
using (public.is_org_member(organization_id));

create policy "admins and principals can manage org integrations"
on public.integration_connections for all
to authenticated
using (public.can_manage_org(organization_id))
with check (public.can_manage_org(organization_id));

create policy "members can read org sync events"
on public.sync_events for select
to authenticated
using (public.is_org_member(organization_id));

create policy "members can create org sync events"
on public.sync_events for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and public.is_org_member(organization_id)
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.organizations,
  public.organization_memberships,
  public.invitations,
  public.captures,
  public.tasks,
  public.capture_task_links,
  public.integration_connections,
  public.sync_events
to authenticated;

grant execute on function public.ensure_user_profile() to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.admini_role, timestamptz) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
