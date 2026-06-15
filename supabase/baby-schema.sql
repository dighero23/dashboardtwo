-- Baby Tracker module schema (Phase B1)
-- Run in Supabase SQL editor

-- 1. Add can_edit_baby to user_permissions
ALTER TABLE user_permissions
  ADD COLUMN IF NOT EXISTS can_edit_baby boolean NOT NULL DEFAULT false;

-- 2. baby_timers — shared state for bottle + medication count-up timers
CREATE TABLE IF NOT EXISTS baby_timers (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text        NOT NULL CHECK (type IN ('bottle', 'medication')),
  name             text,                          -- null for bottle; medication name otherwise
  interval_minutes integer     NOT NULL DEFAULT 180,
  last_reset_at    timestamptz NOT NULL DEFAULT now(),
  last_reset_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  alert_sent       boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE baby_timers ENABLE ROW LEVEL SECURITY;

-- All users with can_edit_baby can read/write all rows (shared state)
CREATE POLICY "baby_timers_select" ON baby_timers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid() AND (can_edit_baby = true OR is_admin = true)
    )
  );

CREATE POLICY "baby_timers_insert" ON baby_timers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid() AND (can_edit_baby = true OR is_admin = true)
    )
  );

CREATE POLICY "baby_timers_update" ON baby_timers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid() AND (can_edit_baby = true OR is_admin = true)
    )
  );

CREATE POLICY "baby_timers_delete" ON baby_timers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid() AND (can_edit_baby = true OR is_admin = true)
    )
  );

-- 3. baby_log — daily history of reset events
CREATE TABLE IF NOT EXISTS baby_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timer_id   uuid        NOT NULL REFERENCES baby_timers(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('bottle', 'medication')),
  name       text,
  logged_at  timestamptz NOT NULL DEFAULT now(),
  logged_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE baby_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baby_log_select" ON baby_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid() AND (can_edit_baby = true OR is_admin = true)
    )
  );

CREATE POLICY "baby_log_insert" ON baby_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid() AND (can_edit_baby = true OR is_admin = true)
    )
  );

CREATE POLICY "baby_log_delete" ON baby_log
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid() AND (can_edit_baby = true OR is_admin = true)
    )
  );

-- 4. baby_sent_notifications — push dedup per user per timer cycle
CREATE TABLE IF NOT EXISTS baby_sent_notifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timer_id       uuid        NOT NULL REFERENCES baby_timers(id) ON DELETE CASCADE,
  cycle_reset_at timestamptz NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE baby_sent_notifications ENABLE ROW LEVEL SECURITY;

-- Service role only — no user-facing RLS policies
CREATE UNIQUE INDEX IF NOT EXISTS baby_sent_notif_dedup
  ON baby_sent_notifications (user_id, timer_id, cycle_reset_at);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS baby_log_logged_at ON baby_log (logged_at);
CREATE INDEX IF NOT EXISTS baby_log_timer_id  ON baby_log (timer_id);

-- 6. Seed the default bottle timer (3h interval)
INSERT INTO baby_timers (type, interval_minutes, last_reset_at)
VALUES ('bottle', 180, now())
ON CONFLICT DO NOTHING;
