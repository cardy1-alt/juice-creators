-- Create disputes table for claim-related disputes
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  reporter_role text NOT NULL CHECK (reporter_role IN ('creator', 'business')),
  message text NOT NULL,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disputes_claim_id ON disputes(claim_id);
CREATE INDEX IF NOT EXISTS idx_disputes_resolved ON disputes(resolved) WHERE resolved = false;

-- Admin full access
CREATE POLICY "Admin full access to disputes"
  ON disputes FOR ALL
  TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');

-- Creators can insert disputes on claims they own
CREATE POLICY "Creators can create disputes on their claims"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_role = 'creator' AND
    EXISTS (
      SELECT 1 FROM claims
      JOIN creators ON creators.id = claims.creator_id
      WHERE claims.id = claim_id
      AND creators.email = auth.jwt()->>'email'
    )
  );

-- Businesses can insert disputes on claims for their business
CREATE POLICY "Businesses can create disputes on their claims"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_role = 'business' AND
    EXISTS (
      SELECT 1 FROM claims
      JOIN businesses ON businesses.id = claims.business_id
      WHERE claims.id = claim_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );

-- Creators can view disputes on their claims
CREATE POLICY "Creators can view disputes on their claims"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims
      JOIN creators ON creators.id = claims.creator_id
      WHERE claims.id = disputes.claim_id
      AND creators.email = auth.jwt()->>'email'
    )
  );

-- Businesses can view disputes on their claims
CREATE POLICY "Businesses can view disputes on their claims"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims
      JOIN businesses ON businesses.id = claims.business_id
      WHERE claims.id = disputes.claim_id
      AND businesses.owner_email = auth.jwt()->>'email'
    )
  );
