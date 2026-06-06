-- Add school details columns to organizations table
-- These columns support the Admin tab's school details editing feature.
-- Requirements: 6.1, 8.1

alter table public.organizations
  add column if not exists address text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;
