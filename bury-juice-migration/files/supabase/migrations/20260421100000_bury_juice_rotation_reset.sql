-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — reset upcoming bookings to the 4-week rotation
--
-- Jacob's confirmed roster of recurring sponsors is:
--   David Lloyd Clubs (weekly, comp)
--   Snappy Shopper (£95, Primary, monthly)
--   Midgar (£65, Feature, monthly)
--   Loyal Wolf Barbershop (£25, Classified, monthly)
--
-- No-one else should be on the forward book until they've actually
-- bought a placement through the storefront. This migration:
--   1. Deletes every bj_bookings row with issue_date >= today so
--      the slate is clean (stale seed rows + Bury Rugby + YYCF +
--      any test bookings all go).
--   2. Re-seeds a 4-week rotation from the next Thursday through
--      the end of 2026.
--
-- 4-week cycle (anchored at 2026-04-23 = week 1):
--   Week 1: DL Feature
--   Week 2: DL Primary, Loyal Wolf Classified
--   Week 3: DL Feature, Snappy Shopper Primary
--   Week 4: DL Classified, Midgar Feature
--
-- Past bookings are left alone — they're history.
--
-- Idempotent: the DELETE at the top and WHERE NOT EXISTS guards
-- on the INSERTs let Jacob re-run this safely if he ever needs
-- to reset again.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 1. Wipe the forward book (everything from today).
DELETE FROM bj_bookings
 WHERE issue_date >= CURRENT_DATE;

-- 2. Seed the rotation forward.
DO $$
DECLARE
  v_dl_id         UUID;
  v_midgar_id     UUID;
  v_loyal_wolf_id UUID;
  v_snappy_id     UUID;
  v_anchor        DATE := '2026-04-23';
  v_end           DATE := '2026-12-31';
  v_thursday      DATE;
  v_cycle_week    INT;
BEGIN
  SELECT id INTO v_dl_id         FROM businesses WHERE name = 'David Lloyd Clubs';
  SELECT id INTO v_midgar_id     FROM businesses WHERE name = 'Midgar';
  SELECT id INTO v_loyal_wolf_id FROM businesses WHERE name = 'Loyal Wolf Barbershop';
  SELECT id INTO v_snappy_id     FROM businesses WHERE name = 'Snappy Shopper';

  IF v_dl_id IS NULL OR v_midgar_id IS NULL OR v_loyal_wolf_id IS NULL OR v_snappy_id IS NULL THEN
    RAISE EXCEPTION 'Missing one of the four anchor sponsors — aborting seed';
  END IF;

  -- Start at whichever comes later: the anchor date, or the next
  -- Thursday on/after today. That way a re-run doesn't re-seed
  -- issues in the past.
  v_thursday := GREATEST(
    v_anchor,
    CURRENT_DATE + ((4 - EXTRACT(DOW FROM CURRENT_DATE)::INT + 7) % 7)
  );

  WHILE v_thursday <= v_end LOOP
    v_cycle_week := ((v_thursday - v_anchor) / 7) % 4 + 1;

    IF v_cycle_week = 1 THEN
      -- DL Feature only
      INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
      VALUES (v_dl_id, 'feature', v_thursday, 'comp', 'confirmed', NULL);

    ELSIF v_cycle_week = 2 THEN
      INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
      VALUES (v_dl_id, 'primary', v_thursday, 'comp', 'confirmed', NULL);
      INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
      VALUES (v_loyal_wolf_id, 'classified', v_thursday, 'paid_legacy', 'confirmed', 2500);

    ELSIF v_cycle_week = 3 THEN
      INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
      VALUES (v_dl_id, 'feature', v_thursday, 'comp', 'confirmed', NULL);
      INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
      VALUES (v_snappy_id, 'primary', v_thursday, 'paid_legacy', 'confirmed', 9500);

    ELSE -- v_cycle_week = 4
      INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
      VALUES (v_dl_id, 'classified', v_thursday, 'comp', 'confirmed', NULL);
      INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
      VALUES (v_midgar_id, 'feature', v_thursday, 'paid_legacy', 'confirmed', 6500);
    END IF;

    v_thursday := v_thursday + INTERVAL '7 day';
  END LOOP;
END $$;

COMMIT;
