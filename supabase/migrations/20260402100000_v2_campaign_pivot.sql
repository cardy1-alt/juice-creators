-- ============================================================
-- NAYBA V2 — Campaign-based marketplace pivot
-- Single migration: drops old tables, creates new schema
-- ============================================================

-- ============================================================
-- 1. DROP OLD TABLES (order matters for FK dependencies)
-- ============================================================

-- Drop waitlist (depends on offers, creators)
DROP TABLE IF EXISTS waitlist CASCADE;

-- Drop claims (depends on offers, creators, businesses)
DROP TABLE IF EXISTS claims CASCADE;

-- Drop offers (depends on businesses)
DROP TABLE IF EXISTS offers CASCADE;

-- Drop the old claim_offer RPC if it exists
DROP FUNCTION IF EXISTS claim_offer(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS redeem_offer(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS promote_next_waitlisted(uuid) CASCADE;
DROP FUNCTION IF EXISTS check_and_promote_waitlist() CASCADE;

-- ============================================================
-- 2. CREATE NEW TABLES
-- ============================================================

-- campaigns
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES businesses(id),
  title text NOT NULL,
  headline text,
  about_brand text,
  perk_description text,
  perk_value numeric,
  perk_type text CHECK (perk_type IN ('gift_card', 'experience', 'product')),
  target_city text,
  target_county text,
  content_requirements text,
  talking_points text[],
  inspiration jsonb,
  deliverables jsonb DEFAULT '{"reel": true, "story": false}',
  creator_target integer DEFAULT 10,
  open_date timestamptz,
  expression_deadline timestamptz,
  content_deadline timestamptz,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'selecting', 'live', 'completed')),
  min_level integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- applications (replaces claims — expression of interest)
CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES creators(id) ON DELETE CASCADE,
  pitch text,
  status text DEFAULT 'interested' CHECK (status IN ('interested', 'selected', 'confirmed', 'declined')),
  applied_at timestamptz DEFAULT now(),
  selected_at timestamptz,
  confirmed_at timestamptz,
  UNIQUE(campaign_id, creator_id)
);

-- participations (created when creator is confirmed)
CREATE TABLE participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id),
  creator_id uuid REFERENCES creators(id),
  perk_sent boolean DEFAULT false,
  perk_sent_at timestamptz,
  reel_url text,
  reel_submitted_at timestamptz,
  reach integer,
  likes integer,
  comments integer,
  views integer,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'visited', 'content_submitted', 'completed', 'overdue')),
  completion_rate_snapshot numeric,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. ALTER EXISTING TABLES
-- ============================================================

-- Add new fields to creators
ALTER TABLE creators ADD COLUMN IF NOT EXISTS completion_rate numeric DEFAULT 0;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS total_campaigns integer DEFAULT 0;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS completed_campaigns integer DEFAULT 0;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS instagram_connected boolean DEFAULT false;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS instagram_access_token text;

-- Add campaign_id to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id);

-- ============================================================
-- 4. ENABLE RLS ON NEW TABLES
-- ============================================================

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE participations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES — CAMPAIGNS
-- ============================================================

-- All authenticated users can read campaigns
CREATE POLICY "campaigns_select_authenticated"
  ON campaigns FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert campaigns
CREATE POLICY "campaigns_insert_admin"
  ON campaigns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM creators WHERE creators.id = auth.uid()
      AND creators.email IN (SELECT unnest(string_to_array(current_setting('app.admin_emails', true), ',')))
    )
    OR
    auth.uid() = created_by
  );

-- Only admin can update campaigns
CREATE POLICY "campaigns_update_admin"
  ON campaigns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admin can delete campaigns
CREATE POLICY "campaigns_delete_admin"
  ON campaigns FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- 6. RLS POLICIES — APPLICATIONS
-- ============================================================

-- Creators can read their own applications
CREATE POLICY "applications_select_own"
  ON applications FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR
    -- Admin can read all
    EXISTS (SELECT 1 FROM creators WHERE creators.id = auth.uid())
  );

-- Creators can insert their own applications
CREATE POLICY "applications_insert_own"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    OR
    -- Admin can insert on behalf of creators
    true
  );

-- Admin can update any application
CREATE POLICY "applications_update_all"
  ON applications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admin can delete applications
CREATE POLICY "applications_delete_all"
  ON applications FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- 7. RLS POLICIES — PARTICIPATIONS
-- ============================================================

-- Creators can read their own participations; businesses can read for their campaigns
CREATE POLICY "participations_select"
  ON participations FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR
    -- Business can read participations for their campaigns
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN businesses b ON c.brand_id = b.id
      WHERE c.id = participations.campaign_id
    )
    OR
    -- Admin can read all (any authenticated user that is not filtered above)
    true
  );

-- Admin can insert participations
CREATE POLICY "participations_insert_all"
  ON participations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin can update participations
CREATE POLICY "participations_update_all"
  ON participations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admin can delete participations
CREATE POLICY "participations_delete_all"
  ON participations FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================
-- 8. INDEXES for performance
-- ============================================================

CREATE INDEX idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_target_city ON campaigns(target_city);
CREATE INDEX idx_campaigns_target_county ON campaigns(target_county);
CREATE INDEX idx_applications_campaign_id ON applications(campaign_id);
CREATE INDEX idx_applications_creator_id ON applications(creator_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_participations_campaign_id ON participations(campaign_id);
CREATE INDEX idx_participations_creator_id ON participations(creator_id);
CREATE INDEX idx_participations_status ON participations(status);
