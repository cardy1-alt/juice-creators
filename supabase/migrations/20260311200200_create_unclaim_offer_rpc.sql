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
