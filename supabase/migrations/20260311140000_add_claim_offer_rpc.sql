-- Atomic claim_offer RPC function
-- Checks monthly cap, duplicate claims, and active business claims before inserting
DROP FUNCTION IF EXISTS claim_offer(uuid, uuid);
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
