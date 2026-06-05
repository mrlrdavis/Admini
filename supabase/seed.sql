insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Demo School')
on conflict (id) do nothing;

insert into public.integration_connections (organization_id, provider, status)
values
  ('00000000-0000-4000-8000-000000000001', 'schoology', 'mock'),
  ('00000000-0000-4000-8000-000000000001', 'infinite_campus', 'mock'),
  ('00000000-0000-4000-8000-000000000001', 'google_classroom', 'mock')
on conflict (organization_id, provider) do nothing;
