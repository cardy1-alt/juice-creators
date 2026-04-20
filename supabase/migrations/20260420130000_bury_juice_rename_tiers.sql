-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — rename tier values
--   bronze → classified
--   silver → feature
--   gold   → primary
--
-- Olympic metals quietly frame the cheapest slot as a consolation
-- prize; placement-neutral names let the copy and price do the
-- selling. Affects three tables (bj_bookings, bj_packs,
-- bj_legacy_rates) — all three have the same CHECK constraint.
--
-- Idempotent: DROP ... IF EXISTS guards re-runs; the UPDATE only
-- touches rows still holding old values.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Drop the auto-named CHECK constraints so we can rewrite the data.
-- Postgres names inline CHECK constraints `<table>_<column>_check`
-- by default. The IF EXISTS guard keeps the migration re-runnable.
ALTER TABLE bj_bookings     DROP CONSTRAINT IF EXISTS bj_bookings_tier_check;
ALTER TABLE bj_packs        DROP CONSTRAINT IF EXISTS bj_packs_tier_check;
ALTER TABLE bj_legacy_rates DROP CONSTRAINT IF EXISTS bj_legacy_rates_tier_check;

-- Rewrite values. The WHERE guard keeps re-runs cheap (no-op once
-- all rows already carry the new names).
UPDATE bj_bookings SET tier = CASE tier
  WHEN 'gold'   THEN 'primary'
  WHEN 'silver' THEN 'feature'
  WHEN 'bronze' THEN 'classified'
END
WHERE tier IN ('gold', 'silver', 'bronze');

UPDATE bj_packs SET tier = CASE tier
  WHEN 'gold'   THEN 'primary'
  WHEN 'silver' THEN 'feature'
  WHEN 'bronze' THEN 'classified'
END
WHERE tier IN ('gold', 'silver', 'bronze');

UPDATE bj_legacy_rates SET tier = CASE tier
  WHEN 'gold'   THEN 'primary'
  WHEN 'silver' THEN 'feature'
  WHEN 'bronze' THEN 'classified'
END
WHERE tier IN ('gold', 'silver', 'bronze');

-- Re-add the CHECK constraints with the new vocabulary.
ALTER TABLE bj_bookings
  ADD CONSTRAINT bj_bookings_tier_check
  CHECK (tier IN ('classified', 'feature', 'primary'));

ALTER TABLE bj_packs
  ADD CONSTRAINT bj_packs_tier_check
  CHECK (tier IN ('classified', 'feature', 'primary'));

ALTER TABLE bj_legacy_rates
  ADD CONSTRAINT bj_legacy_rates_tier_check
  CHECK (tier IN ('classified', 'feature', 'primary'));

COMMIT;
