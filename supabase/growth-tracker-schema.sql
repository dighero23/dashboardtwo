-- Baby profile (single shared row — one baby)
CREATE TABLE IF NOT EXISTS baby_profile (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text,
  date_of_birth date,
  sex           text        CHECK (sex IN ('male', 'female')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Growth measurements
CREATE TABLE IF NOT EXISTS baby_growth (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  measured_on date        NOT NULL,
  weight_oz   integer,
  height_cm   numeric(6,2),
  notes       text,
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weight_or_height CHECK (weight_oz IS NOT NULL OR height_cm IS NOT NULL)
);

-- RLS
ALTER TABLE baby_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE baby_growth  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baby_profile_access" ON baby_profile
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND (can_edit_baby = true OR is_admin = true)
    )
  );

CREATE POLICY "baby_growth_access" ON baby_growth
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_permissions
      WHERE user_id = auth.uid()
        AND (can_edit_baby = true OR is_admin = true)
    )
  );

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS baby_growth_measured_on_idx ON baby_growth (measured_on DESC);
