-- Add notification_preferences JSONB column to profiles table
-- Stores per-user notification settings (email, push, digest toggles)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences jsonb
DEFAULT '{"emailNotifications": true, "pushNotifications": true, "activityDigest": false}'::jsonb;