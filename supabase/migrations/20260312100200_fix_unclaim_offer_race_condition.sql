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
