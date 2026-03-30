/*
  # Fix SECURITY DEFINER search_path on redeem_offer

  The redeem_offer function was created with SECURITY DEFINER but without
  an explicit search_path, which is a search_path injection vector.

  delete_user_account was already fixed in 20260330100000.

  This migration recreates redeem_offer with SET search_path = public, pg_temp.
*/

CREATE OR REPLACE FUNCTION redeem_offer(
  p_qr_token text,
  p_business_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claim record;
  v_redeemed_at timestamptz;
  v_reel_due_at timestamptz;
  v_max_reel_due timestamptz;
BEGIN
  v_redeemed_at := now();

  -- Atomic lookup + lock: prevents concurrent scans from both proceeding
  SELECT id, status, qr_expires_at, creator_id, offer_id
  INTO v_claim
  FROM claims
  WHERE qr_token = p_qr_token
    AND business_id = p_business_id
  FOR UPDATE SKIP LOCKED;

  -- SKIP LOCKED means a concurrent transaction won't even see this row
  IF v_claim IS NULL THEN
    -- Could be not found OR locked by another transaction
    -- Check without lock to give a better error message
    IF EXISTS (
      SELECT 1 FROM claims
      WHERE qr_token = p_qr_token AND business_id = p_business_id
    ) THEN
      RETURN jsonb_build_object('error', 'This scan is already being processed. Please wait.');
    END IF;
    RETURN jsonb_build_object('error', 'Code not recognised. Check and try again.');
  END IF;

  -- Check status
  IF v_claim.status = 'redeemed' THEN
    RETURN jsonb_build_object('error', 'This pass has already been used.');
  END IF;

  IF v_claim.status <> 'active' THEN
    RETURN jsonb_build_object('error', format('This pass is %s. Cannot redeem.', v_claim.status));
  END IF;

  -- Check QR expiry
  IF v_claim.qr_expires_at < v_redeemed_at THEN
    RETURN jsonb_build_object('error', 'QR code expired. Ask the creator to refresh it.');
  END IF;

  -- Calculate reel_due_at: 48h from now, but capped at qr_expires_at + 24h
  v_reel_due_at := v_redeemed_at + interval '48 hours';
  v_max_reel_due := v_claim.qr_expires_at + interval '24 hours';
  IF v_reel_due_at > v_max_reel_due THEN
    v_reel_due_at := v_max_reel_due;
  END IF;

  -- Atomic update with status guard (belt-and-suspenders)
  UPDATE claims
  SET status = 'redeemed',
      redeemed_at = v_redeemed_at,
      reel_due_at = v_reel_due_at
  WHERE id = v_claim.id
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This pass has already been used.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'claim_id', v_claim.id
  );
END;
$$;
