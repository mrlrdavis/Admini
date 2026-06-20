-- Fix ensure_user_profile to return the most recently joined organization
-- Previously it returned the oldest (ASC), which meant auto-created orphan orgs
-- took priority over invitation-based orgs
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  email text,
  display_name text,
  role public.admini_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  default_organization_id uuid;
BEGIN
  current_user_id := public.ensure_profile_row();

  -- Return the most recently joined org (DESC) so invitation-based orgs take priority
  SELECT organization_memberships.organization_id
  INTO default_organization_id
  FROM public.organization_memberships
  WHERE organization_memberships.profile_id = current_user_id
  ORDER BY organization_memberships.joined_at DESC
  LIMIT 1;

  IF default_organization_id IS NULL THEN
    INSERT INTO public.organizations (name, created_by)
    VALUES (
      COALESCE(NULLIF(auth.jwt()->'user_metadata'->>'school_name', ''), 'My School'),
      current_user_id
    )
    RETURNING organizations.id INTO default_organization_id;

    INSERT INTO public.organization_memberships (organization_id, profile_id, role)
    VALUES (default_organization_id, current_user_id, 'admin');
  END IF;

  RETURN QUERY
  SELECT profiles.id, organization_memberships.organization_id, profiles.email, profiles.display_name, organization_memberships.role
  FROM public.profiles
  JOIN public.organization_memberships ON organization_memberships.profile_id = profiles.id
  WHERE profiles.id = current_user_id
    AND organization_memberships.organization_id = default_organization_id
  LIMIT 1;
END;
$$;