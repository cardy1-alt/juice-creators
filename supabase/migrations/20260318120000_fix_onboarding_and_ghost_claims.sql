-- Fix Issue A: Midgar Coffee (and all seeded businesses) showing onboarding wizard
-- The onboarding_complete column was added after initial seed, defaulting to false.
-- Backfill all businesses that have a name and address populated.
UPDATE businesses
SET onboarding_complete = true
WHERE name IS NOT NULL
  AND address IS NOT NULL
  AND onboarding_complete = false;

-- Fix Issue B: Sophie Carter's ghost active claim blocking new claims
-- 1. Expire any 'active' claims whose QR token has already expired (stale from seeding/testing).
UPDATE claims
SET status = 'expired'
WHERE status = 'active'
  AND qr_expires_at < now();

-- 2. Also expire Sophie Carter's specific seed claim by ID regardless of QR expiry,
--    in case the seed was recently re-run (QR set to NOW()+24h on each seed run).
UPDATE claims
SET status = 'expired'
WHERE id = 'd1111111-1111-1111-1111-111111111111'
  AND status = 'active';

-- Note: No 'available_slots' column exists — the system uses monthly_cap with
-- a count-based query in claim_offer RPC, so no slot restoration is needed.
