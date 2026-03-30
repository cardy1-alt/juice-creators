/*
  # Waitlist automatic promotion

  When a claim status changes to 'expired', 'overdue', 'completed', or 'disputed',
  or when a claim is deleted, check if the offer has waitlisted creators and
  promote the next one in line.

  Promotion means:
  - Set notified_at on the waitlist entry
  - Set promotion_expires_at to 24 hours from now
  - Insert a notification for the creator

  The check-overdue-reels cron handles expired promotion windows by
  promoting the next creator in line.
*/

-- Add promotion window column
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS promotion_expires_at TIMESTAMPTZ;

-- Function to promote the next waitlisted creator for an offer
CREATE OR REPLACE FUNCTION promote_next_waitlisted_creator(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry RECORD;
  v_offer RECORD;
  v_current_month text;
  v_active_claims int;
BEGIN
  -- Get the offer details
  SELECT id, monthly_cap, business_id INTO v_offer
  FROM offers WHERE id = p_offer_id;

  IF NOT FOUND OR v_offer.monthly_cap IS NULL THEN
    RETURN; -- unlimited or non-existent offer
  END IF;

  -- Count active claims for this offer this month
  v_current_month := to_char(now(), 'YYYY-MM');
  SELECT count(*) INTO v_active_claims
  FROM claims
  WHERE offer_id = p_offer_id
    AND month = v_current_month
    AND status NOT IN ('expired', 'overdue', 'disputed');

  -- Only promote if there's actually a free slot
  IF v_active_claims >= v_offer.monthly_cap THEN
    RETURN;
  END IF;

  -- Check no one is already promoted and waiting (unexpired window)
  IF EXISTS (
    SELECT 1 FROM waitlist
    WHERE offer_id = p_offer_id
      AND notified_at IS NOT NULL
      AND promotion_expires_at > now()
  ) THEN
    RETURN; -- someone already has an active promotion window
  END IF;

  -- Find the next un-notified creator on the waitlist (FIFO)
  SELECT id, creator_id INTO v_entry
  FROM waitlist
  WHERE offer_id = p_offer_id
    AND notified_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN; -- no one waiting
  END IF;

  -- Promote: set notified_at and 24-hour claim window
  UPDATE waitlist
  SET notified_at = now(),
      promotion_expires_at = now() + interval '24 hours'
  WHERE id = v_entry.id;

  -- Get offer and business details for the notification
  INSERT INTO notifications (user_id, user_type, message, email_type, email_meta, read)
  SELECT
    v_entry.creator_id,
    'creator',
    'A spot just opened for ' || COALESCE(o.generated_title, o.description) || ' at ' || b.name || '. Claim it before it goes to the next person!',
    'slot_ready',
    jsonb_build_object(
      'offer_title', COALESCE(o.generated_title, o.description),
      'business_name', b.name,
      'offer_id', o.id::text,
      'expires_at', (now() + interval '24 hours')::text
    ),
    false
  FROM offers o
  JOIN businesses b ON b.id = o.business_id
  WHERE o.id = p_offer_id;
END;
$$;

-- Trigger function: fires when a claim status changes
CREATE OR REPLACE FUNCTION on_claim_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only act on status changes that free up a slot
  IF TG_OP = 'DELETE' THEN
    PERFORM promote_next_waitlisted_creator(OLD.offer_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('expired', 'overdue', 'disputed') THEN
      PERFORM promote_next_waitlisted_creator(NEW.offer_id);
    END IF;
    -- Also promote on completion since it frees a "slot" for next month's cycle
    IF NEW.status IN ('completed') THEN
      PERFORM promote_next_waitlisted_creator(NEW.offer_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_claim_status_change ON claims;
CREATE TRIGGER trg_claim_status_change
  AFTER UPDATE OR DELETE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION on_claim_status_change();
