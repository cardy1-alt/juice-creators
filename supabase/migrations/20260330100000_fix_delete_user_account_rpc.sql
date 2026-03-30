/*
  # Fix delete_user_account RPC

  The original version used auth.uid() to match creators.id, but these are
  different UUIDs (creators.id is gen_random_uuid(), not the auth UID).

  This rewrite:
  1. Looks up the creator or business via auth.jwt()->>'email' instead
  2. Handles both creator AND business account deletion
  3. Adds SET search_path for SECURITY DEFINER safety
  4. Cascades through all dependent rows before deleting auth user
*/

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_creator_id uuid;
  v_business_id uuid;
BEGIN
  -- Only authenticated users can call this
  IF v_uid IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Look up creator by email
  SELECT id INTO v_creator_id FROM creators WHERE email = v_email;

  -- Look up business by email
  SELECT id INTO v_business_id FROM businesses WHERE owner_email = v_email;

  -- Guard: at least one profile must exist
  IF v_creator_id IS NULL AND v_business_id IS NULL THEN
    RAISE EXCEPTION 'No profile found for this account';
  END IF;

  -- ── Creator deletion path ──
  IF v_creator_id IS NOT NULL THEN
    -- 1. Delete disputes linked to this creator's claims
    DELETE FROM disputes
    WHERE claim_id IN (SELECT id FROM claims WHERE creator_id = v_creator_id);

    -- 2. Delete waitlist entries
    DELETE FROM waitlist WHERE creator_id = v_creator_id;

    -- 3. Delete saved businesses
    DELETE FROM saved_businesses WHERE creator_id = v_creator_id;

    -- 4. Delete all claims
    DELETE FROM claims WHERE creator_id = v_creator_id;

    -- 5. Delete all notifications
    DELETE FROM notifications WHERE user_id = v_creator_id;

    -- 6. Delete feedback
    DELETE FROM feedback WHERE user_id = v_uid;

    -- 7. Delete creator profile
    DELETE FROM creators WHERE id = v_creator_id;
  END IF;

  -- ── Business deletion path ──
  IF v_business_id IS NOT NULL THEN
    -- 1. Delete disputes linked to this business's claims
    DELETE FROM disputes
    WHERE claim_id IN (SELECT id FROM claims WHERE business_id = v_business_id);

    -- 2. Delete waitlist entries for this business's offers
    DELETE FROM waitlist
    WHERE offer_id IN (SELECT id FROM offers WHERE business_id = v_business_id);

    -- 3. Delete saved_businesses references
    DELETE FROM saved_businesses WHERE business_id = v_business_id;

    -- 4. Delete claims for this business
    DELETE FROM claims WHERE business_id = v_business_id;

    -- 5. Delete notifications
    DELETE FROM notifications WHERE user_id = v_business_id;

    -- 6. Delete feedback
    DELETE FROM feedback WHERE user_id = v_uid;

    -- 7. Delete offers (CASCADE would handle this, but be explicit)
    DELETE FROM offers WHERE business_id = v_business_id;

    -- 8. Delete business profile
    DELETE FROM businesses WHERE id = v_business_id;
  END IF;

  -- ── Delete auth user last ──
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
