/*
  # Create delete_user_account RPC

  Allows an authenticated creator to permanently delete their own account.
  Removes all associated data (disputes, claims, notifications, creator row)
  and then deletes the auth.users entry.

  SECURITY DEFINER so the function has permission to delete from auth.users.
*/

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Only authenticated users can call this
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Delete disputes linked to this creator's claims
  DELETE FROM disputes
  WHERE claim_id IN (SELECT id FROM claims WHERE creator_id = v_uid);

  -- 2. Delete all claims
  DELETE FROM claims WHERE creator_id = v_uid;

  -- 3. Delete all notifications
  DELETE FROM notifications WHERE user_id = v_uid;

  -- 4. Delete creator profile
  DELETE FROM creators WHERE id = v_uid;

  -- 5. Delete auth user
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
