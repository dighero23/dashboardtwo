-- Phase H1: Family Health module schema
-- Run in Supabase SQL editor

-- 1. Add can_edit_health to user_permissions
ALTER TABLE user_permissions
  ADD COLUMN IF NOT EXISTS can_edit_health boolean NOT NULL DEFAULT false;

-- Grant admin full access
UPDATE user_permissions
  SET can_edit_health = true
  WHERE user_id = '3ae2a968-1613-480f-a351-e6d78324aacb';

-- 2. family_dependents — one row per family member
CREATE TABLE IF NOT EXISTS family_dependents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  birth_date   date,
  notes        text,
  sort_order   int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE family_dependents ENABLE ROW LEVEL SECURITY;

-- Only the owner can see/modify their dependents
CREATE POLICY "owner_select" ON family_dependents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON family_dependents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON family_dependents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON family_dependents
  FOR DELETE USING (auth.uid() = user_id);

-- 3. health_events — appointments, medications, check-ups, etc.
CREATE TABLE IF NOT EXISTS health_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dependent_id    uuid REFERENCES family_dependents(id) ON DELETE SET NULL,
  title           text NOT NULL,
  event_type      text NOT NULL DEFAULT 'appointment',  -- appointment | medication | checkup | other
  event_date      date NOT NULL,
  event_time      time,
  notes           text,
  is_recurring    boolean NOT NULL DEFAULT false,
  recurrence_rule text,                                 -- RRULE string (optional)
  status          text NOT NULL DEFAULT 'scheduled',    -- scheduled | completed | cancelled
  completed_at    timestamptz,
  alert_days      int  NOT NULL DEFAULT 1,              -- days before to alert
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON health_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON health_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON health_events
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON health_events
  FOR DELETE USING (auth.uid() = user_id);

-- 4. health_sent_notifications — dedup table to avoid sending duplicates
CREATE TABLE IF NOT EXISTS health_sent_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES health_events(id) ON DELETE CASCADE,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  alert_key  text NOT NULL  -- e.g. "{event_id}:{days_before}"
);

ALTER TABLE health_sent_notifications ENABLE ROW LEVEL SECURITY;

-- Service role only (admin client reads/writes this table)
-- No user-facing RLS policies — access only via service role key

-- Unique index to prevent duplicate alerts for the same event+day combination
CREATE UNIQUE INDEX IF NOT EXISTS health_sent_notifications_dedup
  ON health_sent_notifications (alert_key);

-- Index for lookups on health_events by user and date
CREATE INDEX IF NOT EXISTS health_events_user_date
  ON health_events (user_id, event_date);
