/*
  # Juice Creators Platform Schema

  ## Overview
  Creates the complete database schema for Juice Creators - a hyperlocal creator redemption platform.

  ## New Tables

  ### 1. businesses
  Stores business accounts that create offers for creators
  - `id` (uuid, primary key)
  - `name` (text) - Business display name
  - `slug` (text, unique) - URL-friendly identifier
  - `owner_email` (text, unique) - Business owner contact email
  - `approved` (boolean, default false) - Admin approval status
  - `created_at` (timestamptz) - Account creation timestamp

  ### 2. offers
  Stores offers created by businesses for creators to claim
  - `id` (uuid, primary key)
  - `business_id` (uuid, foreign key) - Links to businesses table
  - `description` (text) - Offer description shown to creators
  - `monthly_cap` (integer) - Maximum claims per calendar month
  - `is_live` (boolean, default false) - Whether offer is currently active
  - `created_at` (timestamptz) - Offer creation timestamp

  ### 3. creators
  Stores creator accounts that can claim and redeem offers
  - `id` (uuid, primary key)
  - `name` (text) - Creator display name
  - `instagram_handle` (text, unique) - Instagram username
  - `code` (text, unique) - Unique creator code (e.g., SOPHIE01)
  - `email` (text, unique) - Creator contact email
  - `approved` (boolean, default false) - Admin approval status
  - `created_at` (timestamptz) - Account creation timestamp

  ### 4. claims
  Stores creator claims on offers with redemption tracking
  - `id` (uuid, primary key)
  - `creator_id` (uuid, foreign key) - Links to creators table
  - `offer_id` (uuid, foreign key) - Links to offers table
  - `business_id` (uuid, foreign key) - Links to businesses table
  - `status` (text) - Claim status: pending/active/redeemed/expired
  - `qr_token` (text, unique) - Unique token for QR code generation
  - `qr_expires_at` (timestamptz) - When current QR code expires (30 second intervals)
  - `claimed_at` (timestamptz) - When creator claimed the offer
  - `redeemed_at` (timestamptz, nullable) - When business redeemed the claim
  - `reel_url` (text, nullable) - Link to creator's posted reel
  - `month` (text) - Calendar month for cap tracking (format: YYYY-MM)

  ### 5. notifications
  Stores notifications for all user types
  - `id` (uuid, primary key)
  - `user_id` (uuid) - ID of the user receiving notification
  - `user_type` (text) - Type: admin/creator/business
  - `message` (text) - Notification message content
  - `read` (boolean, default false) - Whether notification has been read
  - `created_at` (timestamptz) - Notification creation timestamp

  ## Security
  - All tables have Row Level Security (RLS) enabled
  - Separate policies for each user role (admin, creator, business)
  - Admins can access all data
  - Creators can only access their own data
  - Businesses can only access their own data and related claims
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

-- RLS Policies for businesses table
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

-- RLS Policies for offers table
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

-- RLS Policies for creators table
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

-- RLS Policies for claims table
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

-- RLS Policies for notifications table
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