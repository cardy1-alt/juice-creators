-- Fix Issue A: Midgar Coffee (and all seeded businesses) showing onboarding wizard
-- The onboarding_complete column was added after initial seed, defaulting to false.
-- Backfill all businesses that have a name and address populated.
UPDATE businesses
SET onboarding_complete = true
WHERE name IS NOT NULL
  AND address IS NOT NULL
  AND onboarding_complete = false;

-- Fix Issue B: Sophie Carter's ghost claims blocking new claims
-- The claim_offer RPC blocks on status NOT IN ('expired', 'overdue') (line 36)
-- and the unique index blocks on status NOT IN ('expired', 'overdue', 'completed').
-- Clean up ALL of Sophie's non-terminal claims so she can claim fresh.

-- 1. Expire any 'active' claims whose QR token has already expired (all creators).
UPDATE claims
SET status = 'expired'
WHERE status = 'active'
  AND qr_expires_at < now();

-- 2. Expire ALL of Sophie Carter's blocking claims on Midgar Coffee offers,
--    regardless of their current status (active, redeemed, reel_due).
UPDATE claims
SET status = 'expired'
WHERE creator_id = 'a1111111-1111-1111-1111-111111111111'
  AND business_id = 'b1111111-1111-1111-1111-111111111111'
  AND status NOT IN ('expired', 'overdue', 'completed');
