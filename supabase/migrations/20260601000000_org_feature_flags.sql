-- Organization feature flags table
-- Controls per-organization feature enablement

create table public.organization_feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flag_key text not null,
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, flag_key)
);

create index org_feature_flags_org_idx
  on public.organization_feature_flags (organization_id);

create trigger org_feature_flags_set_updated_at
  before update on public.organization_feature_flags
  for each row execute function public.set_updated_at();

alter table public.organization_feature_flags enable row level security;

create policy "members can read org feature flags"
  on public.organization_feature_flags for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "admins can manage org feature flags"
  on public.organization_feature_flags for all
  to authenticated
  using (public.org_role(organization_id) = 'admin')
  with check (public.org_role(organization_id) = 'admin');

grant select, insert, update, delete
  on public.organization_feature_flags to authenticated;
