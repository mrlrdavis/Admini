-- Fix delete_account function that was missing
-- This function allows authenticated users to delete their own account
CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Delete captures
  DELETE FROM public.captures WHERE created_by = uid;
  -- Delete tasks
  DELETE FROM public.tasks WHERE created_by = uid;
  -- Delete meeting notes
  DELETE FROM public.meeting_notes WHERE created_by = uid;
  -- Delete profile (cascades from auth.users)
  DELETE FROM public.profiles WHERE id = uid;
  -- Delete the auth user
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
