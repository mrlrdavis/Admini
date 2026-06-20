-- Task assignment notifications are in-app notifications.
-- Honor the recipient's notification_preferences.pushNotifications setting
-- when creating assignment notification rows.

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
    JOIN public.profiles recipient_profile
      ON recipient_profile.id = recipient_membership.profile_id
    WHERE sender_membership.profile_id = (SELECT auth.uid())
      AND recipient_membership.profile_id = notifications.recipient_id
      AND COALESCE((recipient_profile.notification_preferences->>'pushNotifications')::boolean, true)
  )
);
