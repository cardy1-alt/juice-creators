/*
  # Juice Creators Platform Schema

  ## Overview
  Creates the complete database schema for Juice Creators - a hyperlocal creator redemption platform.

  ## Tables
  - businesses: Business accounts that create offers
  - offers: Offers created by businesses for creators
  - creators: Creator accounts that claim and redeem offers
  - claims: Creator claims on offers with QR redemption tracking
  - notifications: In-app notifications for all user types

  ## Security
  - All tables have Row Level Security (RLS) enabled
  - Admin identified by email gets full access via service-level policies
  - Creators can only access their own data
  - Businesses can only access their own data and related claims
  - INSERT policies allow sign-up profile creation
*/

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_email text UNIQUE NOT NULL,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  description text NOT NULL,
  monthly_cap integer NOT NULL DEFAULT 4,
  is_live boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create creators table
CREATE TABLE IF NOT EXISTS creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  instagram_handle text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  qr_token text UNIQUE NOT NULL,
  qr_expires_at timestamptz NOT NULL,
  claimed_at timestamptz DEFAULT now(),
  redeemed_at timestamptz,
  reel_url text,
  month text NOT NULL
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_type text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_offers_business_id ON offers(business_id);
CREATE INDEX IF NOT EXISTS idx_offers_is_live ON offers(is_live);
CREATE INDEX IF NOT EXISTS idx_claims_creator_id ON claims(creator_id);
CREATE INDEX IF NOT EXISTS idx_claims_offer_id ON claims(offer_id);
CREATE INDEX IF NOT EXISTS idx_claims_business_id ON claims(business_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_month ON claims(month);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- ADMIN POLICIES (full access for admin@juicecreators.com)
-- ============================================================

CREATE POLICY "Admin full access to businesses"
  ON businesses FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

CREATE POLICY "Admin full access to offers"
  ON offers FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

CREATE POLICY "Admin full access to creators"
  ON creators FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

CREATE POLICY "Admin full access to claims"
  ON claims FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

CREATE POLICY "Admin full access to notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

-- ============================================================
-- BUSINESSES TABLE POLICIES
-- ============================================================

CREATE POLICY "Public can view approved businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (approved = true);

CREATE POLICY "Businesses can view their own data"
  ON businesses FOR SELECT
  TO authenticated
  USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "Businesses can update their own data"
  ON businesses FOR UPDATE
  TO authenticated
  USING (owner_email = auth.jwt()->>'email')
  WITH CHECK (owner_email = auth.jwt()->>'email');

-- Allow new business sign-up (user can only insert their own email)
CREATE POLICY "Anyone can create a business profile on sign-up"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (owner_email = auth.jwt()->>'email');

-- ============================================================
-- OFFERS TABLE POLICIES
-- ============================================================

CREATE POLICY "Approved creators can view live offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    is_live = true AND
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.email = auth.jwt()->>'email'
      AND creators.approved = true
    )
  );

CREATE POLICY "Businesses can view their own offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Businesses can create offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_id
      AND businesses.owner_email = auth.jwt()->>'email'
      AND businesses.approved = true
    )
  );

CREATE POLICY "Businesses can update their own offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- ============================================================
-- CREATORS TABLE POLICIES
-- ============================================================

CREATE POLICY "Creators can view their own profile"
  ON creators FOR SELECT
  TO authenticated
  USING (email = auth.jwt()->>'email');

CREATE POLICY "Creators can update their own profile"
  ON creators FOR UPDATE
  TO authenticated
  USING (email = auth.jwt()->>'email')
  WITH CHECK (email = auth.jwt()->>'email');

CREATE POLICY "Businesses can view approved creators"
  ON creators FOR SELECT
  TO authenticated
  USING (
    approved = true AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- Allow new creator sign-up (user can only insert their own email)
CREATE POLICY "Anyone can create a creator profile on sign-up"
  ON creators FOR INSERT
  TO authenticated
  WITH CHECK (email = auth.jwt()->>'email');

-- ============================================================
-- CLAIMS TABLE POLICIES
-- ============================================================

CREATE POLICY "Creators can view their own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = claims.creator_id
      AND creators.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Creators can create claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = creator_id
      AND creators.email = auth.jwt()->>'email'
      AND creators.approved = true
    )
  );

CREATE POLICY "Creators can update their own claims"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = claims.creator_id
      AND creators.email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = claims.creator_id
      AND creators.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Businesses can view claims for their offers"
  ON claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = claims.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Businesses can update claims for their offers"
  ON claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = claims.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = claims.business_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- ============================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id::text = auth.jwt()->>'sub' OR
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = notifications.user_id
      AND creators.email = auth.jwt()->>'email'
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = notifications.user_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_id::text = auth.jwt()->>'sub' OR
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = notifications.user_id
      AND creators.email = auth.jwt()->>'email'
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = notifications.user_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    user_id::text = auth.jwt()->>'sub' OR
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = notifications.user_id
      AND creators.email = auth.jwt()->>'email'
    ) OR
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = notifications.user_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- Allow inserting notifications (for system-generated notifications)
CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
