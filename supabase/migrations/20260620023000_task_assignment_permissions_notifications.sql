-- Task assignment support:
-- 1. Persist in-app assignment notifications.
-- 2. Restrict task edits/deletes so staff cannot edit another user's tasks.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
ON public.notifications (recipient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read their notifications" ON public.notifications;
CREATE POLICY "users can read their notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (recipient_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users can update their notifications" ON public.notifications;
CREATE POLICY "users can update their notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (recipient_id = (SELECT auth.uid()))
WITH CHECK (recipient_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "org members can create assignment notifications" ON public.notifications;
CREATE POLICY "org members can create assignment notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships sender_membership
    JOIN public.organization_memberships recipient_membership
      ON recipient_membership.organization_id = sender_membership.organization_id
    WHERE sender_membership.profile_id = (SELECT auth.uid())
      AND recipient_membership.profile_id = notifications.recipient_id
  )
);

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "task owners and managers can update tasks" ON public.tasks;
CREATE POLICY "task owners and managers can update tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  public.can_manage_org(organization_id)
  OR created_by = (SELECT auth.uid())
)
WITH CHECK (
  public.can_manage_org(organization_id)
  OR created_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "task owners and managers can delete tasks" ON public.tasks;
CREATE POLICY "task owners and managers can delete tasks"
ON public.tasks FOR DELETE
TO authenticated
USING (
  public.can_manage_org(organization_id)
  OR created_by = (SELECT auth.uid())
);
