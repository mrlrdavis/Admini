create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
  display_name text;
  school_name text;
begin
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  display_name := coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1), 'AdminI user');
  school_name := coalesce(nullif(new.raw_user_meta_data->>'school_name', ''), 'AdminI School');

  insert into public.organizations (name)
  values (school_name)
  returning id into new_organization_id;

  insert into public.profiles (id, organization_id, email, display_name, role)
  values (new.id, new_organization_id, coalesce(new.email, ''), display_name, 'admin');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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
  current_email text;
  new_organization_id uuid;
  profile_display_name text;
  profile_school_name text;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select profiles.id, profiles.organization_id, profiles.email, profiles.display_name, profiles.role
  from public.profiles
  where profiles.id = current_user_id;

  if found then
    return;
  end if;

  current_email := coalesce(auth.jwt()->>'email', '');
  profile_display_name := coalesce(nullif(auth.jwt()->'user_metadata'->>'display_name', ''), split_part(current_email, '@', 1), 'AdminI user');
  profile_school_name := coalesce(nullif(auth.jwt()->'user_metadata'->>'school_name', ''), 'AdminI School');

  insert into public.organizations (name)
  values (profile_school_name)
  returning organizations.id into new_organization_id;

  insert into public.profiles (id, organization_id, email, display_name, role)
  values (current_user_id, new_organization_id, current_email, profile_display_name, 'admin');

  return query
  select profiles.id, profiles.organization_id, profiles.email, profiles.display_name, profiles.role
  from public.profiles
  where profiles.id = current_user_id;
end;
$$;

grant execute on function public.ensure_user_profile() to authenticated;
