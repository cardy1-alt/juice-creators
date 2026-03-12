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
