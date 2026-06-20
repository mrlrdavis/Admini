-- Allow notification reactions to appear as task activity feed entries.
-- Existing sync_events rows remain valid; this only broadens the action check.

ALTER TABLE public.sync_events
DROP CONSTRAINT IF EXISTS sync_events_action_check;

ALTER TABLE public.sync_events
ADD CONSTRAINT sync_events_action_check
CHECK (action IN ('create', 'update', 'delete', 'retry', 'accept', 'revoke', 'react'));
