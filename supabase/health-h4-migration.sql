-- Phase H4: Align health schema with PRD spec
-- Run in Supabase SQL editor

-- 1. Add missing columns to health_events
ALTER TABLE health_events
  ADD COLUMN IF NOT EXISTS for_type      text    NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS completed_date date,
  ADD COLUMN IF NOT EXISTS alert_1_week  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_1_day   boolean NOT NULL DEFAULT true;

-- 2. Fix health_sent_notifications for per-user dedup
--    PRD requires unique on (user_id, event_id, notification_type)
ALTER TABLE health_sent_notifications
  ADD COLUMN IF NOT EXISTS user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS notification_type text;

-- Drop old alert_key-based unique index
DROP INDEX IF EXISTS health_sent_notifications_dedup;

-- New unique index (partial — ignores old rows with NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS health_sent_dedup
  ON health_sent_notifications (user_id, event_id, notification_type)
  WHERE user_id IS NOT NULL AND notification_type IS NOT NULL;

-- 3. Fix family_dependents: PRD says ALL health users share dependents
--    Add created_by for creator-only delete; loosen read policy to all health users.
ALTER TABLE family_dependents
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill created_by from existing user_id column
UPDATE family_dependents SET created_by = user_id WHERE created_by IS NULL;

-- Drop old per-owner-only RLS policies
DROP POLICY IF EXISTS "owner_select" ON family_dependents;
DROP POLICY IF EXISTS "owner_insert" ON family_dependents;
DROP POLICY IF EXISTS "owner_update" ON family_dependents;
DROP POLICY IF EXISTS "owner_delete" ON family_dependents;

-- All health users can read all dependents (shared between parents)
CREATE POLICY "health_users_select" ON family_dependents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid() AND (can_edit_health = true OR is_admin = true)
    )
  );

-- Any health user can create dependents
CREATE POLICY "health_users_insert" ON family_dependents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid() AND (can_edit_health = true OR is_admin = true)
    )
  );

-- Only creator (or admin) can delete a dependent
CREATE POLICY "creator_delete" ON family_dependents
  FOR DELETE USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_permissions WHERE user_id = auth.uid() AND is_admin = true)
  );
