-- ============================================================
-- One-off: shorten pilot campaign titles to the new punchy format
-- ============================================================
--
-- Context: early AI-generated campaign titles followed a formulaic
-- "Experience [x] at [brand]..." pattern that read as generic filler
-- in the creator Discover feed. The wizard prompt has been updated
-- to produce short, perk-focused titles (3–5 words, no brand name
-- since brand is shown separately on the card). This script rewrites
-- the 5 existing pilot campaigns to match.
--
-- HOW TO RUN
-- 1. (Optional) Preview current state by running just the SELECT
--    block below.
-- 2. Run the whole file in the Supabase SQL editor.
-- 3. Re-verify with the SELECT block.
--
-- Safe + idempotent: each UPDATE is scoped by brand name. Re-running
-- is a no-op if the titles are already short. Adjust any title text
-- below if you want different wording — brand names match via ILIKE
-- so minor casing differences don't matter.

-- ─────────────────────────────────────────────────────────────
-- PREVIEW (read-only)
-- ─────────────────────────────────────────────────────────────
SELECT
  b.name        AS brand,
  c.title       AS current_title,
  c.perk_description,
  c.perk_value,
  c.status
FROM campaigns c
JOIN businesses b ON b.id = c.brand_id
ORDER BY b.name, c.created_at DESC;

-- ─────────────────────────────────────────────────────────────
-- UPDATES — wrapped in a transaction so all-or-nothing
-- ─────────────────────────────────────────────────────────────
BEGIN;

-- The Space (reformer pilates, opening-week class)
UPDATE campaigns SET title = 'Free reformer class'
WHERE brand_id IN (SELECT id FROM businesses WHERE name ILIKE 'The Space');

-- David Lloyd Bury St Edmunds
UPDATE campaigns SET title = 'Free day pass'
WHERE brand_id IN (SELECT id FROM businesses WHERE name ILIKE 'David Lloyd%');

-- Midgar Coffee (free drink / coffee)
UPDATE campaigns SET title = 'Free drink'
WHERE brand_id IN (SELECT id FROM businesses WHERE name ILIKE 'Midgar Coffee');

-- Sugartown Toys (£20 gift voucher)
UPDATE campaigns SET title = '£20 gift voucher'
WHERE brand_id IN (SELECT id FROM businesses WHERE name ILIKE 'Sugartown Toys');

-- Revamp Gym (Summer Fitness Challenge — already short, just lower-case for consistency)
UPDATE campaigns SET title = 'Summer fitness challenge'
WHERE brand_id IN (SELECT id FROM businesses WHERE name ILIKE 'Revamp Gym');

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- POST-UPDATE VERIFY
-- ─────────────────────────────────────────────────────────────
SELECT
  b.name  AS brand,
  c.title AS new_title,
  c.status
FROM campaigns c
JOIN businesses b ON b.id = c.brand_id
ORDER BY b.name, c.created_at DESC;
