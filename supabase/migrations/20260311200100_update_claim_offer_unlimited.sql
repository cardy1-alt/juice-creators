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
