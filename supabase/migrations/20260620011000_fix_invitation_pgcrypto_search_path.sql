-- Supabase installs pgcrypto in the extensions schema on many projects.
-- These SECURITY DEFINER RPCs previously used SET search_path = public,
-- which made digest()/gen_random_bytes() invisible even when pgcrypto was enabled.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.create_invitation(
  target_organization_id uuid,
  invite_email text,
  invite_role public.admini_role DEFAULT 'staff',
  invite_expires_at timestamptz DEFAULT now() + interval '7 days'
)
RETURNS TABLE (
  invitation_id uuid,
  invitation_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_user_id uuid;
  generated_token text;
BEGIN
  current_user_id := (SELECT auth.uid());

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_manage_org(target_organization_id) THEN
    RAISE EXCEPTION 'Only admins and principals can invite users';
  END IF;

  generated_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.invitations (organization_id, email, role, token_hash, invited_by, expires_at)
  VALUES (
    target_organization_id,
    lower(trim(invite_email)),
    invite_role,
    encode(digest(generated_token, 'sha256'), 'hex'),
    current_user_id,
    invite_expires_at
  )
  RETURNING invitations.id INTO invitation_id;

  invitation_token := generated_token;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(invitation_token text)
RETURNS TABLE (
  organization_id uuid,
  membership_id uuid,
  role public.admini_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_user_id uuid;
  current_email text;
  target_invitation public.invitations%rowtype;
BEGIN
  current_user_id := (SELECT auth.uid());
  current_email := lower(trim(public.current_user_email()));

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.ensure_profile_row();

  SELECT *
  INTO target_invitation
  FROM public.invitations
  WHERE token_hash = encode(digest(invitation_token, 'sha256'), 'hex')
    AND status = 'pending'
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF target_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invitation is invalid or expired';
  END IF;

  IF lower(trim(target_invitation.email)) <> current_email THEN
    RAISE EXCEPTION 'Invitation email does not match the signed-in user';
  END IF;

  INSERT INTO public.organization_memberships (organization_id, profile_id, role, invited_by)
  VALUES (target_invitation.organization_id, current_user_id, target_invitation.role, target_invitation.invited_by)
  ON CONFLICT (organization_id, profile_id) DO UPDATE
  SET role = excluded.role
  RETURNING organization_memberships.organization_id, organization_memberships.id, organization_memberships.role
  INTO organization_id, membership_id, role;

  UPDATE public.invitations
  SET status = 'accepted',
      accepted_by = current_user_id,
      accepted_at = now()
  WHERE id = target_invitation.id;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.admini_role, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
