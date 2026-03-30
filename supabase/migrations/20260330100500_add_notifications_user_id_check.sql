/*
  # Add validation constraint on notifications.user_id

  A direct FK to auth.users(id) is not possible because notifications.user_id
  stores creator/business profile UUIDs (from gen_random_uuid()), not auth UIDs.
  Admin notifications also use a placeholder UUID (00000000-...).

  Instead, add a CHECK constraint that ensures user_id references either:
  - An existing creator, OR
  - An existing business, OR
  - The admin placeholder UUID

  This provides referential integrity without requiring a single FK target.
  Orphaned rows are cleaned up by delete_user_account RPC and CASCADE deletes.
*/

-- Add a trigger-based validation instead of a CHECK (CHECK can't do subqueries)
CREATE OR REPLACE FUNCTION validate_notification_user_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Allow admin placeholder UUID
  IF NEW.user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RETURN NEW;
  END IF;

  -- Check if user_id references a creator or business
  IF NOT EXISTS (SELECT 1 FROM creators WHERE id = NEW.user_id)
     AND NOT EXISTS (SELECT 1 FROM businesses WHERE id = NEW.user_id) THEN
    RAISE EXCEPTION 'notifications.user_id must reference an existing creator or business (got %)', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_notification_user_id ON notifications;
CREATE TRIGGER trg_validate_notification_user_id
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION validate_notification_user_id();
