-- Audit logs table for recording admin actions (accountability)
-- Requirements: 8.1

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Index for efficient lookups by organization in reverse chronological order
create index audit_logs_org_created_at_idx
  on public.audit_logs (organization_id, created_at desc);

-- Enable Row Level Security
alter table public.audit_logs enable row level security;

-- Org members can read their organization's audit logs
create policy "members can read org audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_org_member(organization_id));

-- Authenticated admins can insert audit log entries
create policy "admins can insert audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (
    actor_id = (select auth.uid())
    and public.org_role(organization_id) = 'admin'
  );

-- Grant permissions to authenticated role
grant select, insert on public.audit_logs to authenticated;
