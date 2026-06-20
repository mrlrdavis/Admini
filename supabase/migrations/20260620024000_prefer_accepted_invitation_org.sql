-- Prefer the organization from the user's latest accepted invitation.
-- A user can accidentally create a newer personal org while testing an invite;
-- invitation acceptance should still route them back to the invited school.

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
  current_email text;
  default_organization_id uuid;
BEGIN
  current_user_id := public.ensure_profile_row();
  current_email := lower(trim(public.current_user_email()));

  SELECT invitations.organization_id
  INTO default_organization_id
  FROM public.invitations
  WHERE invitations.status = 'accepted'
    AND invitations.accepted_at IS NOT NULL
    AND (
      invitations.accepted_by = current_user_id
      OR lower(trim(invitations.email)) = current_email
    )
  ORDER BY invitations.accepted_at DESC
  LIMIT 1;

  IF default_organization_id IS NULL THEN
    SELECT organization_memberships.organization_id
    INTO default_organization_id
    FROM public.organization_memberships
    WHERE organization_memberships.profile_id = current_user_id
    ORDER BY organization_memberships.joined_at DESC
    LIMIT 1;
  END IF;

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

UPDATE public.organization_memberships AS memberships
SET joined_at = invitations.accepted_at,
    updated_at = now()
FROM public.invitations
WHERE invitations.status = 'accepted'
  AND invitations.accepted_at IS NOT NULL
  AND invitations.accepted_by = memberships.profile_id
  AND invitations.organization_id = memberships.organization_id
  AND memberships.joined_at < invitations.accepted_at;
