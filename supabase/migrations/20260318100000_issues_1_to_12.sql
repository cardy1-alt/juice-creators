/*
  Migration for Issues 1, 4, 5, 6, 11
  - Issue 1: Ensure onboarding_complete exists on businesses table
  - Issue 4: Add onboarding_step column for resume-from-where-left-off
  - Issue 5: Add snapshot columns to claims for freezing offer terms at claim time
  - Issue 6: Add reel_due_at column if missing (for filter logic)
  - Issue 11: Add title/body columns to notifications, indexes, and trigger functions
*/

-- ═══ ISSUE 1 & 4: Business onboarding columns ═══
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1;

-- ═══ ISSUE 5: Snapshot columns on claims ═══
-- Store the offer terms at time of claim so edits don't affect active claims
ALTER TABLE claims ADD COLUMN IF NOT EXISTS snapshot_offer_item TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS snapshot_specific_ask TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS snapshot_generated_title TEXT;

-- ═══ ISSUE 6: Ensure reel_due_at exists on claims ═══
ALTER TABLE claims ADD COLUMN IF NOT EXISTS reel_due_at TIMESTAMPTZ;

-- ═══ ISSUE 11: Extend notifications table ═══
-- Add title and body columns (existing 'message' column kept for backwards compat)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;

-- Add index on read column for query performance
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
-- creator_id index (notifications use user_id, but add compound index)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- ═══ ISSUE 11: Add is_live and region to businesses if missing ═══
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS region TEXT;

-- ═══ ISSUE 11: Add saved_businesses table for "hearted" businesses ═══
CREATE TABLE IF NOT EXISTS saved_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(creator_id, business_id)
);

ALTER TABLE saved_businesses ENABLE ROW LEVEL SECURITY;

-- Creators can manage their own saves
CREATE POLICY "Creators can view their saved businesses"
  ON saved_businesses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM creators WHERE creators.id = saved_businesses.creator_id
    AND creators.email = auth.jwt()->>'email'
  ));

CREATE POLICY "Creators can save businesses"
  ON saved_businesses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM creators WHERE creators.id = creator_id
    AND creators.email = auth.jwt()->>'email'
  ));

CREATE POLICY "Creators can unsave businesses"
  ON saved_businesses FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM creators WHERE creators.id = saved_businesses.creator_id
    AND creators.email = auth.jwt()->>'email'
  ));

CREATE POLICY "Admin full access to saved_businesses"
  ON saved_businesses FOR ALL TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

-- ═══ ISSUE 5: Update claim_offer RPC to snapshot offer terms ═══
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
  v_offer_item text;
  v_specific_ask text;
  v_generated_title text;
BEGIN
  v_current_month := to_char(now(), 'YYYY-MM');

  -- Lock the offer row to prevent race conditions
  SELECT business_id, monthly_cap, offer_item, specific_ask, generated_title
  INTO v_business_id, v_monthly_cap, v_offer_item, v_specific_ask, v_generated_title
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
    AND status NOT IN ('expired', 'overdue', 'completed')
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('error', 'already_claimed');
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
      RETURN jsonb_build_object('error', 'monthly_cap_reached');
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
    month,
    snapshot_offer_item,
    snapshot_specific_ask,
    snapshot_generated_title
  ) VALUES (
    p_creator_id,
    p_offer_id,
    v_business_id,
    'active',
    v_qr_token,
    now() + interval '72 hours',
    v_current_month,
    v_offer_item,
    v_specific_ask,
    v_generated_title
  )
  RETURNING id INTO v_claim_id;

  RETURN jsonb_build_object('success', true, 'claim_id', v_claim_id);
END;
$$;

-- ═══ ISSUE 2: Fix unique index to allow re-claiming after completion ═══
DROP INDEX IF EXISTS idx_unique_active_claim_per_offer;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_claim_per_offer
  ON claims (creator_id, offer_id)
  WHERE status NOT IN ('expired', 'overdue', 'completed');

-- ═══ ISSUE 11 Trigger 1: Notify creators when a saved business posts a new offer ═══
CREATE OR REPLACE FUNCTION notify_saved_creators_on_new_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_name TEXT;
  v_offer_title TEXT;
  v_saved RECORD;
BEGIN
  -- Only fire when offer becomes live
  IF NEW.is_live = true AND (OLD IS NULL OR OLD.is_live = false) THEN
    SELECT name INTO v_business_name FROM businesses WHERE id = NEW.business_id;
    v_offer_title := COALESCE(NEW.generated_title, NEW.description, 'a new offer');

    FOR v_saved IN
      SELECT creator_id FROM saved_businesses WHERE business_id = NEW.business_id
    LOOP
      INSERT INTO notifications (user_id, user_type, message, title, body, read)
      VALUES (
        v_saved.creator_id,
        'creator',
        v_business_name || ' has a new offer: ' || v_offer_title,
        v_business_name || ' has a new offer',
        v_offer_title || ' — claim it before slots run out.',
        false
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_saved_on_new_offer ON offers;
CREATE TRIGGER trg_notify_saved_on_new_offer
  AFTER INSERT OR UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_saved_creators_on_new_offer();

-- ═══ ISSUE 11 Trigger 2: Notify creators when business edits active offer ═══
CREATE OR REPLACE FUNCTION notify_creators_on_offer_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_name TEXT;
  v_claim RECORD;
BEGIN
  -- Only fire on UPDATE when offer stays live and content changed
  IF OLD.is_live = true AND NEW.is_live = true AND (
    OLD.offer_item IS DISTINCT FROM NEW.offer_item OR
    OLD.specific_ask IS DISTINCT FROM NEW.specific_ask OR
    OLD.generated_title IS DISTINCT FROM NEW.generated_title OR
    OLD.description IS DISTINCT FROM NEW.description
  ) THEN
    SELECT name INTO v_business_name FROM businesses WHERE id = NEW.business_id;

    FOR v_claim IN
      SELECT DISTINCT creator_id FROM claims
      WHERE offer_id = NEW.id AND status IN ('active', 'redeemed')
    LOOP
      INSERT INTO notifications (user_id, user_type, message, title, body, read)
      VALUES (
        v_claim.creator_id,
        'creator',
        v_business_name || ' updated their offer. Check the latest before your visit.',
        v_business_name || ' updated their offer',
        'The details for your active claim have changed. Check the latest before your visit.',
        false
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_offer_edit ON offers;
CREATE TRIGGER trg_notify_on_offer_edit
  AFTER UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_creators_on_offer_edit();

-- ═══ ISSUE 11 Trigger 3: Notify creators when new business goes live in their area ═══
CREATE OR REPLACE FUNCTION notify_creators_on_business_live()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator RECORD;
BEGIN
  -- Only fire when is_live changes to true
  IF NEW.is_live = true AND (OLD IS NULL OR OLD.is_live = false) THEN
    FOR v_creator IN
      SELECT id FROM creators
      WHERE region IS NOT NULL AND region = NEW.region
    LOOP
      INSERT INTO notifications (user_id, user_type, message, title, body, read)
      VALUES (
        v_creator.id,
        'creator',
        'New business near you: ' || NEW.name || ' just joined Nayba in ' || COALESCE(NEW.region, 'your area') || '.',
        'New business near you',
        NEW.name || ' just joined Nayba in ' || COALESCE(NEW.region, 'your area') || '. See their offers.',
        false
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_business_live ON businesses;
CREATE TRIGGER trg_notify_on_business_live
  AFTER UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION notify_creators_on_business_live();
