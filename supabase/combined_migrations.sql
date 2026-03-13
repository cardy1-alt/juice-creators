/*
  # Juice Creators Platform Schema

  ## Overview
  Creates the complete database schema for Juice Creators - a hyperlocal creator redemption platform.

  ## Tables
  - businesses: Business accounts that create offers
  - offers: Offers created by businesses for creators
  - creators: Creator accounts that claim and redeem offers
  - claims: Creator claims on offers with QR redemption tracking
  - notifications: In-app notifications for all user types

  ## Security
  - All tables have Row Level Security (RLS) enabled
  - Admin identified by email gets full access via service-level policies
  - Creators can only access their own data
  - Businesses can only access their own data and related claims
  - INSERT policies allow sign-up profile creation
*/

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_email text UNIQUE NOT NULL,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  description text NOT NULL,
  monthly_cap integer NOT NULL DEFAULT 4,
  is_live boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create creators table
CREATE TABLE IF NOT EXISTS creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  instagram_handle text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  qr_token text UNIQUE NOT NULL,
  qr_expires_at timestamptz NOT NULL,
  claimed_at timestamptz DEFAULT now(),
  redeemed_at timestamptz,
  reel_url text,
  month text NOT NULL
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_type text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_offers_business_id ON offers(business_id);
CREATE INDEX IF NOT EXISTS idx_offers_is_live ON offers(is_live);
CREATE INDEX IF NOT EXISTS idx_claims_creator_id ON claims(creator_id);
CREATE INDEX IF NOT EXISTS idx_claims_offer_id ON claims(offer_id);
CREATE INDEX IF NOT EXISTS idx_claims_business_id ON claims(business_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_month ON claims(month);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- ADMIN POLICIES (full access for admin@juicecreators.com)
-- ============================================================

CREATE POLICY "Admin full access to businesses"
  ON businesses FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

CREATE POLICY "Admin full access to offers"
  ON offers FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

CREATE POLICY "Admin full access to creators"
  ON creators FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

CREATE POLICY "Admin full access to claims"
  ON claims FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

CREATE POLICY "Admin full access to notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

-- ============================================================
-- BUSINESSES TABLE POLICIES
-- ============================================================

CREATE POLICY "Public can view approved businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (approved = true);

CREATE POLICY "Businesses can view their own data"
  ON businesses FOR SELECT
  TO authenticated
  USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "Businesses can update their own data"
  ON businesses FOR UPDATE
  TO authenticated
  USING (owner_email = auth.jwt()->>'email')
  WITH CHECK (owner_email = auth.jwt()->>'email');

-- Allow new business sign-up (user can only insert their own email)
CREATE POLICY "Anyone can create a business profile on sign-up"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (owner_email = auth.jwt()->>'email');

-- ============================================================
-- OFFERS TABLE POLICIES
-- ============================================================

CREATE POLICY "Approved creators can view live offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    is_live = true AND
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.email = auth.jwt()->>'email'
      AND creators.approved = true
    )
  );

CREATE POLICY "Businesses can view their own offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Businesses can create offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_id
      AND businesses.owner_email = auth.jwt()->>'email'
      AND businesses.approved = true
    )
  );

CREATE POLICY "Businesses can update their own offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- ============================================================
-- CREATORS TABLE POLICIES
-- ============================================================

CREATE POLICY "Creators can view their own profile"
  ON creators FOR SELECT
  TO authenticated
  USING (email = auth.jwt()->>'email');

CREATE POLICY "Creators can update their own profile"
  ON creators FOR UPDATE
  TO authenticated
  USING (email = auth.jwt()->>'email')
  WITH CHECK (email = auth.jwt()->>'email');

CREATE POLICY "Businesses can view approved creators"
  ON creators FOR SELECT
  TO authenticated
  USING (
    approved = true AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- Allow new creator sign-up (user can only insert their own email)
CREATE POLICY "Anyone can create a creator profile on sign-up"
  ON creators FOR INSERT
  TO authenticated
  WITH CHECK (email = auth.jwt()->>'email');

-- ============================================================
-- CLAIMS TABLE POLICIES
-- ============================================================

CREATE POLICY "Creators can view their own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = claims.creator_id
      AND creators.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Creators can create claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = creator_id
      AND creators.email = auth.jwt()->>'email'
      AND creators.approved = true
    )
  );

CREATE POLICY "Creators can update their own claims"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = claims.creator_id
      AND creators.email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = claims.creator_id
      AND creators.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Businesses can view claims for their offers"
  ON claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = claims.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Businesses can update claims for their offers"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = claims.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = claims.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- ============================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id::text = auth.jwt()->>'sub' OR
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = notifications.user_id
      AND creators.email = auth.jwt()->>'email'
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = notifications.user_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_id::text = auth.jwt()->>'sub' OR
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = notifications.user_id
      AND creators.email = auth.jwt()->>'email'
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = notifications.user_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    user_id::text = auth.jwt()->>'sub' OR
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = notifications.user_id
      AND creators.email = auth.jwt()->>'email'
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = notifications.user_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- Allow inserting notifications (for system-generated notifications)
CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
-- Add email_sent flag to prevent duplicate email sends
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;
-- Add reel_due_at column to claims (set to redeemed_at + 48 hours at point of redemption)
ALTER TABLE claims ADD COLUMN IF NOT EXISTS reel_due_at timestamptz;

-- Add overdue status support and index
CREATE INDEX IF NOT EXISTS idx_claims_reel_due_at ON claims(reel_due_at) WHERE status = 'redeemed' AND reel_url IS NULL;
-- Atomic claim_offer RPC function
-- Checks monthly cap, duplicate claims, and active business claims before inserting
CREATE OR REPLACE FUNCTION claim_offer(
  p_offer_id uuid,
  p_creator_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offer offers%ROWTYPE;
  v_business_id uuid;
  v_current_month text;
  v_claim_count integer;
  v_existing_claim claims%ROWTYPE;
  v_active_business_claim claims%ROWTYPE;
  v_qr_token text;
  v_qr_expires_at timestamptz;
  v_new_claim claims%ROWTYPE;
BEGIN
  -- Get the current month
  v_current_month := to_char(now(), 'YYYY-MM');

  -- Lock the offer row to prevent race conditions
  SELECT * INTO v_offer FROM offers WHERE id = p_offer_id AND is_live = true FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Offer not found or not live.');
  END IF;

  v_business_id := v_offer.business_id;

  -- Check for existing non-expired claim on this offer
  SELECT * INTO v_existing_claim FROM claims
    WHERE offer_id = p_offer_id AND creator_id = p_creator_id AND status NOT IN ('expired', 'overdue')
    LIMIT 1;
  IF FOUND THEN
    RETURN json_build_object('error', 'You already have a claim on this offer.');
  END IF;

  -- Check for active claim with same business
  SELECT * INTO v_active_business_claim FROM claims
    WHERE business_id = v_business_id AND creator_id = p_creator_id AND status IN ('active', 'redeemed')
    LIMIT 1;
  IF FOUND THEN
    RETURN json_build_object('error', 'You already have an active claim with this business.');
  END IF;

  -- Check monthly cap
  SELECT count(*) INTO v_claim_count FROM claims
    WHERE offer_id = p_offer_id AND month = v_current_month;
  IF v_claim_count >= v_offer.monthly_cap THEN
    RETURN json_build_object('error', 'This offer has reached its monthly cap.');
  END IF;

  -- Generate QR token and expiry
  v_qr_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
  v_qr_expires_at := now() + interval '30 seconds';

  -- Insert the claim
  INSERT INTO claims (creator_id, offer_id, business_id, status, qr_token, qr_expires_at, month)
  VALUES (p_creator_id, p_offer_id, v_business_id, 'active', v_qr_token, v_qr_expires_at, v_current_month)
  RETURNING * INTO v_new_claim;

  RETURN json_build_object(
    'id', v_new_claim.id,
    'creator_id', v_new_claim.creator_id,
    'offer_id', v_new_claim.offer_id,
    'business_id', v_new_claim.business_id,
    'status', v_new_claim.status,
    'qr_token', v_new_claim.qr_token,
    'qr_expires_at', v_new_claim.qr_expires_at,
    'claimed_at', v_new_claim.claimed_at,
    'month', v_new_claim.month
  );
END;
$$;

-- Unique partial index to back up the cap enforcement:
-- prevents duplicate active/redeemed claims per creator per offer
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_claim_per_offer
  ON claims (creator_id, offer_id)
  WHERE status NOT IN ('expired', 'overdue');
-- Add category column to businesses table
-- Defaults to 'Food & Drink' for existing businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Food & Drink';
-- Create disputes table for claim-related disputes
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  reporter_role text NOT NULL CHECK (reporter_role IN ('creator', 'business')),
  message text NOT NULL,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disputes_claim_id ON disputes(claim_id);
CREATE INDEX IF NOT EXISTS idx_disputes_resolved ON disputes(resolved) WHERE resolved = false;

-- Admin full access
CREATE POLICY "Admin full access to disputes"
  ON disputes FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

-- Creators can insert disputes on claims they own
CREATE POLICY "Creators can create disputes on their claims"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_role = 'creator' AND
    EXISTS (
      SELECT 1 FROM claims
      JOIN creators ON creators.id = claims.creator_id
      WHERE claims.id = claim_id
      AND creators.email = auth.jwt()->>'email'
    )
  );

-- Businesses can insert disputes on claims for their business
CREATE POLICY "Businesses can create disputes on their claims"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_role = 'business' AND
    EXISTS (
      SELECT 1 FROM claims
      JOIN businesses ON businesses.id = claims.business_id
      WHERE claims.id = claim_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- Creators can view disputes on their claims
CREATE POLICY "Creators can view disputes on their claims"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims
      JOIN creators ON creators.id = claims.creator_id
      WHERE claims.id = disputes.claim_id
      AND creators.email = auth.jwt()->>'email'
    )
  );

-- Businesses can view disputes on their claims
CREATE POLICY "Businesses can view disputes on their claims"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims
      JOIN businesses ON businesses.id = claims.business_id
      WHERE claims.id = disputes.claim_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );
-- Add location and profile fields to businesses (all nullable, non-breaking)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bio text;
-- Add follower_count column to creators (nullable, non-breaking)
ALTER TABLE creators ADD COLUMN IF NOT EXISTS follower_count text;
/*
  # Add onboarding completion tracking to creators

  1. Changes
    - Add `onboarding_complete` boolean column to creators table
    - Defaults to false for new creators
    - Existing creators default to true (grandfather them in)

  2. Notes
    - Non-breaking change
    - Allows tracking whether a creator has completed first-time onboarding
*/

ALTER TABLE creators ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- Set existing approved creators to already onboarded
UPDATE creators SET onboarding_complete = true WHERE approved = true;
/*
  # Make monthly_cap nullable (unlimited offers)

  Allow offers to have no monthly cap (null = unlimited).
  Existing offers with a cap set are unaffected.
  New offers default to null (unlimited).
*/

-- Remove any NOT NULL constraint and set default to null
ALTER TABLE offers ALTER COLUMN monthly_cap DROP NOT NULL;
ALTER TABLE offers ALTER COLUMN monthly_cap SET DEFAULT null;
/*
  # Update claim_offer RPC for unlimited offers

  When monthly_cap is NULL, skip the cap check entirely and always allow the claim.
  When monthly_cap is set, enforce it as before.
*/

DROP FUNCTION IF EXISTS claim_offer(uuid, uuid);
CREATE OR REPLACE FUNCTION claim_offer(
  p_offer_id uuid,
  p_creator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id uuid;
  v_monthly_cap integer;
  v_current_claims integer;
  v_current_month text;
  v_qr_token text;
  v_claim_id uuid;
BEGIN
  v_current_month := to_char(now(), 'YYYY-MM');

  SELECT business_id, monthly_cap
  INTO v_business_id, v_monthly_cap
  FROM offers
  WHERE id = p_offer_id AND is_live = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Offer not found or not live');
  END IF;

  -- Only enforce cap when monthly_cap is set (not null)
  IF v_monthly_cap IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_current_claims
    FROM claims
    WHERE offer_id = p_offer_id
      AND month = v_current_month;

    IF v_current_claims >= v_monthly_cap THEN
      RETURN jsonb_build_object('error', 'This offer is fully claimed for the month');
    END IF;
  END IF;

  v_qr_token := encode(gen_random_bytes(16), 'hex');

  INSERT INTO claims (
    creator_id,
    offer_id,
    business_id,
    status,
    qr_token,
    qr_expires_at,
    month
  ) VALUES (
    p_creator_id,
    p_offer_id,
    v_business_id,
    'active',
    v_qr_token,
    now() + interval '72 hours',
    v_current_month
  )
  RETURNING id INTO v_claim_id;

  RETURN jsonb_build_object('success', true, 'claim_id', v_claim_id);
END;
$$;
/*
  # Create unclaim_offer RPC

  Allows a creator to unclaim an active claim (status = 'active').
  Works for both capped and unlimited offers — cap logic doesn't apply to unclaiming.
  Only the claim owner can unclaim.
*/

CREATE OR REPLACE FUNCTION unclaim_offer(
  p_claim_id uuid,
  p_creator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
  v_creator_id uuid;
BEGIN
  SELECT status, creator_id
  INTO v_status, v_creator_id
  FROM claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Claim not found');
  END IF;

  IF v_creator_id != p_creator_id THEN
    RETURN jsonb_build_object('error', 'Not authorized to unclaim this offer');
  END IF;

  IF v_status != 'active' THEN
    RETURN jsonb_build_object('error', 'Only active claims can be unclaimed. Current status: ' || v_status);
  END IF;

  DELETE FROM claims WHERE id = p_claim_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
/*
  # Change follower_count from integer to text

  1. Changes
    - Alter `follower_count` column in `creators` table from integer to text
    - Preserve existing data by converting to appropriate text ranges
  
  2. Security
    - No changes to RLS policies
*/

-- Create a temporary column to store the text values
ALTER TABLE creators ADD COLUMN follower_count_temp text;

-- Convert existing numeric values to text ranges
UPDATE creators
SET follower_count_temp = 
  CASE 
    WHEN follower_count < 1000 THEN 'Under 1k'
    WHEN follower_count >= 1000 AND follower_count < 5000 THEN '1k–5k'
    WHEN follower_count >= 5000 AND follower_count < 10000 THEN '5k–10k'
    WHEN follower_count >= 10000 THEN '10k+'
    ELSE 'Under 1k'
  END;

-- Drop the old integer column
ALTER TABLE creators DROP COLUMN follower_count;

-- Rename the temp column to follower_count
ALTER TABLE creators RENAME COLUMN follower_count_temp TO follower_count;
/*
  # Add bio and location fields to businesses table

  1. Changes
    - Add `bio` (text, nullable) for business description
    - Add `latitude` (double precision, nullable) for map display
    - Add `longitude` (double precision, nullable) for map display

  2. Notes
    - Uses IF NOT EXISTS pattern to safely add columns
    - Allows null values for these fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'bio'
  ) THEN
    ALTER TABLE businesses ADD COLUMN bio text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE businesses ADD COLUMN latitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE businesses ADD COLUMN longitude double precision;
  END IF;
END $$;
/*
  # Add INSERT policy for businesses table

  1. Changes
    - Add policy to allow authenticated users to insert their own business records during signup
  
  2. Security
    - Policy ensures users can only create businesses with their own email
*/

CREATE POLICY "Authenticated users can create their own business"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_email = (auth.jwt() ->> 'email'));
/*
  # Fix All RLS and Function Security Issues

  ## Overview
  Comprehensive security and performance fix:
  1. Optimizes RLS policies by wrapping auth function calls with SELECT
  2. Fixes function search_path for SECURITY DEFINER functions
  3. Removes unused index

  ## Changes
  - All auth.jwt() calls now use (SELECT auth.jwt()->>'...') pattern
  - claim_offer and unclaim_offer functions have explicit search_path
  - Drops idx_disputes_status (unused)

  ## Security Notes
  - Maintains all existing security guarantees
  - Improves performance without reducing security
*/

-- Drop unused index
DROP INDEX IF EXISTS idx_disputes_status;

-- Businesses table policies
DROP POLICY IF EXISTS "Businesses can view their own data" ON businesses;
CREATE POLICY "Businesses can view their own data"
  ON businesses FOR SELECT
  TO authenticated
  USING (owner_email = (SELECT (auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "Businesses can update their own data" ON businesses;
CREATE POLICY "Businesses can update their own data"
  ON businesses FOR UPDATE
  TO authenticated
  USING (owner_email = (SELECT (auth.jwt() ->> 'email')))
  WITH CHECK (owner_email = (SELECT (auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "Authenticated users can create their own business" ON businesses;
CREATE POLICY "Authenticated users can create their own business"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (owner_email = (SELECT (auth.jwt() ->> 'email')));

-- Offers table policies
DROP POLICY IF EXISTS "Approved creators can view live offers" ON offers;
CREATE POLICY "Approved creators can view live offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    is_live = true AND
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.email = (SELECT (auth.jwt() ->> 'email'))
      AND creators.approved = true
    )
  );

DROP POLICY IF EXISTS "Businesses can view their own offers" ON offers;
CREATE POLICY "Businesses can view their own offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "Businesses can create offers" ON offers;
CREATE POLICY "Businesses can create offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
      AND businesses.approved = true
    )
  );

DROP POLICY IF EXISTS "Businesses can update their own offers" ON offers;
CREATE POLICY "Businesses can update their own offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

-- Creators table policies
DROP POLICY IF EXISTS "Creators can view their own profile" ON creators;
CREATE POLICY "Creators can view their own profile"
  ON creators FOR SELECT
  TO authenticated
  USING (email = (SELECT (auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "Creators can update their own profile" ON creators;
CREATE POLICY "Creators can update their own profile"
  ON creators FOR UPDATE
  TO authenticated
  USING (email = (SELECT (auth.jwt() ->> 'email')))
  WITH CHECK (email = (SELECT (auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "Businesses can view approved creators" ON creators;
CREATE POLICY "Businesses can view approved creators"
  ON creators FOR SELECT
  TO authenticated
  USING (
    approved = true AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

-- Claims table policies
DROP POLICY IF EXISTS "Creators can view their own claims" ON claims;
CREATE POLICY "Creators can view their own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = claims.creator_id
      AND creators.email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "Creators can create claims" ON claims;
CREATE POLICY "Creators can create claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = creator_id
      AND creators.email = (SELECT (auth.jwt() ->> 'email'))
      AND creators.approved = true
    )
  );

DROP POLICY IF EXISTS "Creators can update their own claims" ON claims;
CREATE POLICY "Creators can update their own claims"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = claims.creator_id
      AND creators.email = (SELECT (auth.jwt() ->> 'email'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = claims.creator_id
      AND creators.email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "Businesses can view claims for their offers" ON claims;
CREATE POLICY "Businesses can view claims for their offers"
  ON claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = claims.business_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "Businesses can update claims for their offers" ON claims;
CREATE POLICY "Businesses can update claims for their offers"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = claims.business_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = claims.business_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

-- Notifications table policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id::text = (SELECT (auth.jwt() ->> 'sub')) OR
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = notifications.user_id
      AND creators.email = (SELECT (auth.jwt() ->> 'email'))
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = notifications.user_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_id::text = (SELECT (auth.jwt() ->> 'sub')) OR
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = notifications.user_id
      AND creators.email = (SELECT (auth.jwt() ->> 'email'))
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = notifications.user_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  )
  WITH CHECK (
    user_id::text = (SELECT (auth.jwt() ->> 'sub')) OR
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = notifications.user_id
      AND creators.email = (SELECT (auth.jwt() ->> 'email'))
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = notifications.user_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

-- Disputes table policies
DROP POLICY IF EXISTS "Admin full access to disputes" ON disputes;
CREATE POLICY "Admin full access to disputes"
  ON disputes FOR ALL
  TO authenticated
  USING ((SELECT (auth.jwt() ->> 'email')) = 'admin@juicecreators.com')
  WITH CHECK ((SELECT (auth.jwt() ->> 'email')) = 'admin@juicecreators.com');

DROP POLICY IF EXISTS "Users can create disputes for their claims" ON disputes;
CREATE POLICY "Users can create disputes for their claims"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    (reporter_role = 'creator' AND
      EXISTS (
        SELECT 1 FROM claims
        JOIN creators ON creators.id = claims.creator_id
        WHERE claims.id = claim_id
        AND creators.email = (SELECT (auth.jwt() ->> 'email'))
      )
    ) OR
    (reporter_role = 'business' AND
      EXISTS (
        SELECT 1 FROM claims
        JOIN businesses ON businesses.id = claims.business_id
        WHERE claims.id = claim_id
        AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
      )
    )
  );

DROP POLICY IF EXISTS "Users can view their own disputes" ON disputes;
CREATE POLICY "Users can view their own disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims
      JOIN creators ON creators.id = claims.creator_id
      WHERE claims.id = disputes.claim_id
      AND creators.email = (SELECT (auth.jwt() ->> 'email'))
    ) OR
    EXISTS (
      SELECT 1 FROM claims
      JOIN businesses ON businesses.id = claims.business_id
      WHERE claims.id = disputes.claim_id
      AND businesses.owner_email = (SELECT (auth.jwt() ->> 'email'))
    )
  );

-- Fix function search_path - drop and recreate with explicit search_path
DROP FUNCTION IF EXISTS claim_offer(uuid, uuid);
CREATE FUNCTION claim_offer(
  p_offer_id uuid,
  p_creator_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offer offers%ROWTYPE;
  v_business_id uuid;
  v_current_month text;
  v_claim_count integer;
  v_existing_claim claims%ROWTYPE;
  v_active_business_claim claims%ROWTYPE;
  v_qr_token text;
  v_qr_expires_at timestamptz;
  v_new_claim claims%ROWTYPE;
BEGIN
  v_current_month := to_char(now(), 'YYYY-MM');

  SELECT * INTO v_offer FROM offers WHERE id = p_offer_id AND is_live = true FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Offer not found or not live.');
  END IF;

  v_business_id := v_offer.business_id;

  SELECT * INTO v_existing_claim FROM claims
    WHERE offer_id = p_offer_id AND creator_id = p_creator_id AND status NOT IN ('expired', 'overdue')
    LIMIT 1;
  IF FOUND THEN
    RETURN json_build_object('error', 'You already have a claim on this offer.');
  END IF;

  SELECT * INTO v_active_business_claim FROM claims
    WHERE business_id = v_business_id AND creator_id = p_creator_id AND status IN ('active', 'redeemed')
    LIMIT 1;
  IF FOUND THEN
    RETURN json_build_object('error', 'You already have an active claim with this business.');
  END IF;

  IF v_offer.monthly_cap IS NOT NULL THEN
    SELECT count(*) INTO v_claim_count FROM claims
      WHERE offer_id = p_offer_id AND month = v_current_month;
    IF v_claim_count >= v_offer.monthly_cap THEN
      RETURN json_build_object('error', 'This offer has reached its monthly cap.');
    END IF;
  END IF;

  v_qr_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
  v_qr_expires_at := now() + interval '30 seconds';

  INSERT INTO claims (creator_id, offer_id, business_id, status, qr_token, qr_expires_at, month)
  VALUES (p_creator_id, p_offer_id, v_business_id, 'active', v_qr_token, v_qr_expires_at, v_current_month)
  RETURNING * INTO v_new_claim;

  RETURN json_build_object(
    'id', v_new_claim.id,
    'creator_id', v_new_claim.creator_id,
    'offer_id', v_new_claim.offer_id,
    'business_id', v_new_claim.business_id,
    'status', v_new_claim.status,
    'qr_token', v_new_claim.qr_token,
    'qr_expires_at', v_new_claim.qr_expires_at,
    'claimed_at', v_new_claim.claimed_at,
    'month', v_new_claim.month
  );
END;
$$;

DROP FUNCTION IF EXISTS unclaim_offer(uuid, uuid);
CREATE FUNCTION unclaim_offer(
  p_claim_id uuid,
  p_creator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_creator_id uuid;
BEGIN
  SELECT status, creator_id
  INTO v_status, v_creator_id
  FROM claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Claim not found');
  END IF;

  IF v_creator_id != p_creator_id THEN
    RETURN jsonb_build_object('error', 'Not authorized to unclaim this offer');
  END IF;

  IF v_status != 'active' THEN
    RETURN jsonb_build_object('error', 'Only active claims can be unclaimed. Current status: ' || v_status);
  END IF;

  DELETE FROM claims WHERE id = p_claim_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
/*
  # Fix claim_offer RPC — race condition and missing guards

  1. Add FOR UPDATE to the offers SELECT to lock the row during the transaction
  2. Re-add duplicate active claim check (same creator, same offer)
  3. Re-add active business claim check (same creator, same business)
*/

DROP FUNCTION IF EXISTS claim_offer(uuid, uuid);
CREATE OR REPLACE FUNCTION claim_offer(
  p_offer_id uuid,
  p_creator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id uuid;
  v_monthly_cap integer;
  v_current_claims integer;
  v_current_month text;
  v_qr_token text;
  v_claim_id uuid;
  v_existing_claim_id uuid;
BEGIN
  v_current_month := to_char(now(), 'YYYY-MM');

  -- Lock the offer row to prevent race conditions
  SELECT business_id, monthly_cap
  INTO v_business_id, v_monthly_cap
  FROM offers
  WHERE id = p_offer_id AND is_live = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Offer not found or not live');
  END IF;

  -- Prevent duplicate active claims on the same offer
  SELECT id INTO v_existing_claim_id
  FROM claims
  WHERE offer_id = p_offer_id
    AND creator_id = p_creator_id
    AND status NOT IN ('expired', 'overdue')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('error', 'You already have a claim on this offer.');
  END IF;

  -- Prevent simultaneous active claims at the same business
  SELECT id INTO v_existing_claim_id
  FROM claims
  WHERE business_id = v_business_id
    AND creator_id = p_creator_id
    AND status IN ('active', 'redeemed')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('error', 'You already have an active claim with this business.');
  END IF;

  -- Only enforce cap when monthly_cap is set (not null)
  IF v_monthly_cap IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_current_claims
    FROM claims
    WHERE offer_id = p_offer_id
      AND month = v_current_month;

    IF v_current_claims >= v_monthly_cap THEN
      RETURN jsonb_build_object('error', 'This offer is fully claimed for the month');
    END IF;
  END IF;

  v_qr_token := encode(gen_random_bytes(16), 'hex');

  INSERT INTO claims (
    creator_id,
    offer_id,
    business_id,
    status,
    qr_token,
    qr_expires_at,
    month
  ) VALUES (
    p_creator_id,
    p_offer_id,
    v_business_id,
    'active',
    v_qr_token,
    now() + interval '72 hours',
    v_current_month
  )
  RETURNING id INTO v_claim_id;

  RETURN jsonb_build_object('success', true, 'claim_id', v_claim_id);
END;
$$;
/*
  # Remove permissive notifications INSERT policy

  The existing WITH CHECK (true) policy allows any authenticated user to insert
  notifications targeting any other user. Remove it so only Edge Functions using
  the service role key can insert notifications.
*/

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
/*
  # Fix unclaim_offer RPC — race condition

  Replace separate SELECT + DELETE with a single atomic DELETE ... WHERE
  that checks both ownership and status, using RETURNING to confirm a row
  was actually deleted.
*/

CREATE OR REPLACE FUNCTION unclaim_offer(
  p_claim_id uuid,
  p_creator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_id uuid;
BEGIN
  DELETE FROM claims
  WHERE id = p_claim_id
    AND creator_id = p_creator_id
    AND status = 'active'
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    -- Determine why it failed for a useful error message
    IF NOT EXISTS (SELECT 1 FROM claims WHERE id = p_claim_id) THEN
      RETURN jsonb_build_object('error', 'Claim not found');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM claims WHERE id = p_claim_id AND creator_id = p_creator_id) THEN
      RETURN jsonb_build_object('error', 'Not authorized to unclaim this offer');
    END IF;

    RETURN jsonb_build_object('error', 'Only active claims can be unclaimed');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
/*
  # Add CHECK constraint for reel_url on claims table

  Ensures reel URLs must be valid Instagram reel links.
  NULL values are allowed (reel not yet submitted).
*/

ALTER TABLE claims
ADD CONSTRAINT claims_reel_url_instagram_check
CHECK (reel_url IS NULL OR reel_url ~* '^https://(www\.)?instagram\.com/');
/*
  # Add region column to businesses and creators

  Non-breaking migration to support future multi-region expansion.
  All existing rows default to 'bury-st-edmunds'.
*/

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'bury-st-edmunds';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'bury-st-edmunds';
/*
  # Fix Creator INSERT Policy & Admin Access Policies

  ## Problems Fixed
  1. Creator INSERT policy was using un-optimized auth.jwt() call which could fail
     in some session states. Drop and recreate with (SELECT ...) optimization.
  2. Admin FOR ALL policies were using un-optimized auth.jwt() calls, causing
     admin dashboard to return zero counts on some Supabase versions.
  3. Ensures all admin policies use case-insensitive email matching.

  ## Changes
  - Recreates creator INSERT policy with optimized format
  - Recreates all admin FOR ALL policies with (SELECT ...) optimization
  - Uses lower() for admin email comparison to prevent case mismatches
*/

-- ============================================================
-- FIX CREATOR INSERT POLICY
-- ============================================================

-- Drop both possible names for the creator INSERT policy
DROP POLICY IF EXISTS "Anyone can create a creator profile on sign-up" ON creators;
DROP POLICY IF EXISTS "Authenticated users can create their own creator" ON creators;

-- Recreate with optimized auth call
CREATE POLICY "Authenticated users can create their own creator profile"
  ON creators FOR INSERT
  TO authenticated
  WITH CHECK (email = (SELECT (auth.jwt() ->> 'email')));

-- ============================================================
-- FIX ADMIN FOR ALL POLICIES (optimized + case-insensitive)
-- ============================================================

-- Businesses
DROP POLICY IF EXISTS "Admin full access to businesses" ON businesses;
CREATE POLICY "Admin full access to businesses"
  ON businesses FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Offers
DROP POLICY IF EXISTS "Admin full access to offers" ON offers;
CREATE POLICY "Admin full access to offers"
  ON offers FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Creators
DROP POLICY IF EXISTS "Admin full access to creators" ON creators;
CREATE POLICY "Admin full access to creators"
  ON creators FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Claims
DROP POLICY IF EXISTS "Admin full access to claims" ON claims;
CREATE POLICY "Admin full access to claims"
  ON claims FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Notifications
DROP POLICY IF EXISTS "Admin full access to notifications" ON notifications;
CREATE POLICY "Admin full access to notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Disputes (already uses SELECT pattern from fix_all_security_issues, but update for case-insensitivity)
DROP POLICY IF EXISTS "Admin full access to disputes" ON disputes;
CREATE POLICY "Admin full access to disputes"
  ON disputes FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');
