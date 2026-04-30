-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — public stats table
--
-- Single-row table holding the newsletter metrics surfaced on the
-- storefront's stat cards (subscribers, open rate, click-through).
-- Editable via the Bury Juice admin tab so Jacob can refresh the
-- numbers without a code deploy.
--
-- - SMALLINT id with CHECK (id = 1) enforces singleton.
-- - Anyone (anon + authenticated) can SELECT — the storefront is
--   public.
-- - Only hello@nayba.app can INSERT/UPDATE/DELETE — same admin
--   pattern as the rest of the bj_* tables (hardcoded because
--   Supabase managed plans block ALTER DATABASE for current_setting).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bj_stats (
  id          SMALLINT PRIMARY KEY DEFAULT 1,
  subscribers INTEGER NOT NULL,
  open_rate   NUMERIC(5, 4) NOT NULL CHECK (open_rate BETWEEN 0 AND 1),
  ctr         NUMERIC(5, 4) NOT NULL CHECK (ctr BETWEEN 0 AND 1),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT bj_stats_singleton CHECK (id = 1)
);

INSERT INTO bj_stats (id, subscribers, open_rate, ctr)
VALUES (1, 7404, 0.5304, 0.148)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE bj_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bj_stats_public_read ON bj_stats;
CREATE POLICY bj_stats_public_read
  ON bj_stats FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS bj_stats_admin_write ON bj_stats;
CREATE POLICY bj_stats_admin_write
  ON bj_stats FOR ALL
  TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'hello@nayba.app')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'hello@nayba.app');

-- Touch updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION bj_stats_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bj_stats_set_updated_at ON bj_stats;
CREATE TRIGGER bj_stats_set_updated_at
  BEFORE UPDATE ON bj_stats
  FOR EACH ROW EXECUTE FUNCTION bj_stats_touch_updated_at();
