-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — Legacy sponsor seed (v2, idempotent)
--
-- Replaces the earlier legacy-seed migration that was never applied
-- because it relied on an ON CONFLICT (contact_email) clause against
-- a column with no UNIQUE constraint.
--
-- Constraints this migration respects (verified against the schema):
--   businesses: slug UNIQUE NOT NULL, owner_email UNIQUE NOT NULL,
--               name NOT NULL, category DEFAULT 'Food & Drink',
--               region DEFAULT 'bury-st-edmunds'. contact_email is
--               nullable and NOT unique — we don't use ON CONFLICT
--               against it anywhere.
--   bj_bookings: UNIQUE(tier, issue_date) — data is constructed so
--               no two rows collide on this pair.
--   bj_legacy_rates: business_id UNIQUE — one rate row per business.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── Step 1 — Rename existing Nayba brands to Bury Juice conventions
-- Both rows are still live Nayba brands referenced by campaigns, so
-- we only rename + backfill contact_email. owner_email / slug / any
-- other existing columns are untouched.
UPDATE businesses
   SET name = 'David Lloyd Clubs',
       contact_email = COALESCE(contact_email, 'legacy+davidlloyd@buryjuice.com')
 WHERE id = 'c1a6cafa-dd51-433b-86ce-defe8c678ea6';

UPDATE businesses
   SET name = 'Midgar',
       contact_email = COALESCE(contact_email, 'legacy+midgar@buryjuice.com')
 WHERE id = 'cf637e24-57e6-4625-b588-e5a833d87334';

-- ── Step 2 — Insert the three new sponsor rows (by name, not email)
-- slug + owner_email are NOT NULL UNIQUE in the existing Nayba
-- schema, so we must supply them. We namespace slugs with a
-- `bj-legacy-` prefix so they can't collide with Nayba business
-- slugs, and use the same address for owner_email and contact_email.
INSERT INTO businesses (name, slug, owner_email, contact_email)
SELECT 'Snappy Shopper', 'bj-legacy-snappy-shopper',
       'legacy+snappyshopper@buryjuice.com',
       'legacy+snappyshopper@buryjuice.com'
 WHERE NOT EXISTS (SELECT 1 FROM businesses WHERE name = 'Snappy Shopper');

INSERT INTO businesses (name, slug, owner_email, contact_email)
SELECT 'Loyal Wolf Barbershop', 'bj-legacy-loyal-wolf-barbershop',
       'legacy+loyalwolf@buryjuice.com',
       'legacy+loyalwolf@buryjuice.com'
 WHERE NOT EXISTS (SELECT 1 FROM businesses WHERE name = 'Loyal Wolf Barbershop');

INSERT INTO businesses (name, slug, owner_email, contact_email)
SELECT 'Yes You Can Fitness', 'bj-legacy-yes-you-can-fitness',
       'legacy+yesyoucanfitness@buryjuice.com',
       'legacy+yesyoucanfitness@buryjuice.com'
 WHERE NOT EXISTS (SELECT 1 FROM businesses WHERE name = 'Yes You Can Fitness');

-- ── Step 3 — Idempotent cleanup of any partial bj_* data for these
-- five businesses. bj_packs isn't touched because no packs were ever
-- created for these legacy sponsors.
DELETE FROM bj_bookings
 WHERE business_id IN (
   SELECT id FROM businesses
    WHERE name IN ('Snappy Shopper', 'Loyal Wolf Barbershop', 'Midgar',
                   'Yes You Can Fitness', 'David Lloyd Clubs')
 );

DELETE FROM bj_legacy_rates
 WHERE business_id IN (
   SELECT id FROM businesses
    WHERE name IN ('Snappy Shopper', 'Loyal Wolf Barbershop', 'Midgar',
                   'Yes You Can Fitness', 'David Lloyd Clubs')
 );

-- ── Step 4 — Legacy rate rows (one per business) ──────────────────
INSERT INTO bj_legacy_rates (business_id, tier, monthly_rate_gbp, cadence, is_comp, notes, active)
SELECT id, 'gold', 9500, 'monthly', FALSE,
       'Rolling monthly commitment', TRUE
  FROM businesses WHERE name = 'Snappy Shopper';

INSERT INTO bj_legacy_rates (business_id, tier, monthly_rate_gbp, cadence, is_comp, notes, active)
SELECT id, 'bronze', 2500, 'monthly', FALSE,
       'Rolling monthly commitment', TRUE
  FROM businesses WHERE name = 'Loyal Wolf Barbershop';

INSERT INTO bj_legacy_rates (business_id, tier, monthly_rate_gbp, cadence, is_comp, notes, active)
SELECT id, 'silver', 6500, 'monthly', FALSE,
       'Rolling monthly commitment', TRUE
  FROM businesses WHERE name = 'Midgar';

INSERT INTO bj_legacy_rates (business_id, tier, monthly_rate_gbp, cadence, is_comp, notes, active)
SELECT id, 'silver', 6500, 'monthly', FALSE,
       'Rolling monthly commitment', TRUE
  FROM businesses WHERE name = 'Yes You Can Fitness';

INSERT INTO bj_legacy_rates (business_id, tier, monthly_rate_gbp, cadence, is_comp, notes, active)
VALUES ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold', 0, 'weekly', TRUE,
        'Comp placement — membership exchange. Rotates tier weekly.', TRUE);

-- ── Step 5 — Bookings through end of 2026 ─────────────────────────
-- Paid legacy sponsors (32 rows). Insert via SELECTs so we can key
-- business_id off the name rather than hard-coded UUIDs.

-- Snappy Shopper — Gold, 2nd Thursday of each month, 9500 pence.
INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
SELECT b.id, 'gold', d::date, 'paid_legacy', 'confirmed', 9500
  FROM businesses b
  CROSS JOIN (VALUES
    ('2026-05-14'), ('2026-06-11'), ('2026-07-09'), ('2026-08-13'),
    ('2026-09-10'), ('2026-10-08'), ('2026-11-12'), ('2026-12-10')
  ) AS t(d)
 WHERE b.name = 'Snappy Shopper';

-- Loyal Wolf Barbershop — Bronze, 1st Thursday, 2500 pence.
INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
SELECT b.id, 'bronze', d::date, 'paid_legacy', 'confirmed', 2500
  FROM businesses b
  CROSS JOIN (VALUES
    ('2026-05-07'), ('2026-06-04'), ('2026-07-02'), ('2026-08-06'),
    ('2026-09-03'), ('2026-10-01'), ('2026-11-05'), ('2026-12-03')
  ) AS t(d)
 WHERE b.name = 'Loyal Wolf Barbershop';

-- Midgar — Silver, 3rd Thursday, 6500 pence.
INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
SELECT b.id, 'silver', d::date, 'paid_legacy', 'confirmed', 6500
  FROM businesses b
  CROSS JOIN (VALUES
    ('2026-05-21'), ('2026-06-18'), ('2026-07-16'), ('2026-08-20'),
    ('2026-09-17'), ('2026-10-15'), ('2026-11-19'), ('2026-12-17')
  ) AS t(d)
 WHERE b.name = 'Midgar';

-- Yes You Can Fitness — Silver, 1st Thursday, 6500 pence.
INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
SELECT b.id, 'silver', d::date, 'paid_legacy', 'confirmed', 6500
  FROM businesses b
  CROSS JOIN (VALUES
    ('2026-05-07'), ('2026-06-04'), ('2026-07-02'), ('2026-08-06'),
    ('2026-09-03'), ('2026-10-01'), ('2026-11-05'), ('2026-12-03')
  ) AS t(d)
 WHERE b.name = 'Yes You Can Fitness';

-- David Lloyd comp rotation (35 rows). Tier chosen weekly to avoid
-- collision with the paid legacy sponsors above.
INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
VALUES
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-05-07', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'silver', '2026-05-14', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-05-21', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-05-28', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-06-04', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'silver', '2026-06-11', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-06-18', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-06-25', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-07-02', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'silver', '2026-07-09', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-07-16', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-07-23', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'bronze', '2026-07-30', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-08-06', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'silver', '2026-08-13', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-08-20', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-08-27', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-09-03', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'silver', '2026-09-10', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-09-17', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-09-24', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-10-01', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'silver', '2026-10-08', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-10-15', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-10-22', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'bronze', '2026-10-29', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-11-05', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'silver', '2026-11-12', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-11-19', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-11-26', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-12-03', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'silver', '2026-12-10', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-12-17', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'gold',   '2026-12-24', 'comp', 'confirmed', NULL),
  ('c1a6cafa-dd51-433b-86ce-defe8c678ea6', 'bronze', '2026-12-31', 'comp', 'confirmed', NULL);

COMMIT;
