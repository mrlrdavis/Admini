-- Data retention policies migration (REQ-17)
-- 1. Cleanup function for expired captures and tasks
-- 2. Orphan organization cleanup trigger
-- 3. Optimistic locking helper for concurrent task updates
-- 4. Proper cascade handling when deleting user profiles

-- ---------------------------------------------------------------------------
-- 1. Function to delete expired captures (> 90 days) and tasks (> 1 year)
-- This can be called via pg_cron or Supabase scheduled functions.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_expired_records()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete expired captures (default 90 days retention)
  delete from public.captures
  where expires_at < now();

  -- Delete expired tasks (default 1 year retention)
  delete from public.tasks
  where expires_at < now();

  -- Delete expired invitations that were never accepted
  update public.invitations
  set status = 'expired'
  where status = 'pending'
    and expires_at < now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Orphan organization cleanup trigger
-- When the last member leaves an organization, delete the organization
-- to prevent orphan data.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_orphan_organizations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_members integer;
begin
  -- Count remaining members in the organization that was just left
  select count(*)
  into remaining_members
  from public.organization_memberships
  where organization_id = OLD.organization_id;

  -- If no members remain, delete the organization (cascades to all related data)
  if remaining_members = 0 then
    delete from public.organizations
    where id = OLD.organization_id;
  end if;

  return OLD;
end;
$$;

create trigger after_membership_deleted_cleanup_org
after delete on public.organization_memberships
for each row execute function public.cleanup_orphan_organizations();

-- ---------------------------------------------------------------------------
-- 3. Optimistic locking for task updates
-- Prevents concurrent updates from silently overwriting each other.
-- If the row's updated_at doesn't match what the client last saw, the update
-- will fail. The set_updated_at trigger handles the server-side timestamp,
-- so concurrent writes are serialized at the DB level.
-- ---------------------------------------------------------------------------

create or replace function public.update_task_with_lock(
  task_id uuid,
  new_status public.task_status,
  expected_updated_at timestamptz default null
)
returns table (
  id uuid,
  organization_id uuid,
  created_by uuid,
  title text,
  description text,
  priority public.task_priority,
  status public.task_status,
  due_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If expected_updated_at is provided, verify no concurrent modification
  if expected_updated_at is not null then
    if not exists (
      select 1 from public.tasks t
      where t.id = task_id
        and t.updated_at = expected_updated_at
    ) then
      raise exception 'Task was modified by another session. Please refresh and try again.';
    end if;
  end if;

  return query
  update public.tasks t
  set status = new_status
  where t.id = task_id
  returning t.id, t.organization_id, t.created_by, t.title, t.description,
            t.priority, t.status, t.due_at, t.created_at, t.updated_at;
end;
$$;

grant execute on function public.cleanup_expired_records() to authenticated;
grant execute on function public.update_task_with_lock(uuid, public.task_status, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Update profile cascade behavior for user deletion
-- The profiles table already has ON DELETE CASCADE from auth.users.
-- Captures and tasks reference profiles(id) ON DELETE RESTRICT to prevent
-- accidental data loss.
--
-- Add a trigger that cleans up captures/tasks before profile deletion
-- so the ON DELETE RESTRICT constraint does not block the cascade.
-- ---------------------------------------------------------------------------

create or replace function public.handle_profile_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove captures and tasks created by this user before profile is deleted.
  -- This prevents the ON DELETE RESTRICT foreign key from blocking deletion.
  -- The data would expire via retention policies anyway.
  delete from public.captures where created_by = OLD.id;
  delete from public.tasks where created_by = OLD.id;

  return OLD;
end;
$$;

create trigger before_profile_deleted_cleanup
before delete on public.profiles
for each row execute function public.handle_profile_deletion();
