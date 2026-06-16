-- Seed poop timer (run once; safe to re-run)
INSERT INTO baby_timers (type, name, interval_minutes)
SELECT 'poop', 'Poop', 2880
WHERE NOT EXISTS (SELECT 1 FROM baby_timers WHERE type = 'poop');

-- Daily tasks (shared between all parents)
CREATE TABLE IF NOT EXISTS baby_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- One completion record per task per CST calendar day
CREATE TABLE IF NOT EXISTS baby_task_completions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES baby_tasks(id) ON DELETE CASCADE,
  date_cst     date NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(task_id, date_cst)
);

-- Row-level security
ALTER TABLE baby_tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE baby_task_completions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baby_tasks_access" ON baby_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND (can_edit_baby = true OR is_admin = true)
    )
  );

CREATE POLICY "baby_task_completions_access" ON baby_task_completions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND (can_edit_baby = true OR is_admin = true)
    )
  );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE baby_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE baby_task_completions;
