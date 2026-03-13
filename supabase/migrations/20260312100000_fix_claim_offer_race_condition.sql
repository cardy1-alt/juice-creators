/*
  # Fix claim_offer RPC — race condition and missing guards

  1. Add FOR UPDATE to the offers SELECT to lock the row during the transaction
  2. Re-add duplicate active claim check (same creator, same offer)
  3. Re-add active business claim check (same creator, same business)
*/

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
