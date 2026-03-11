/*
  # Create disputes table

  1. New Tables
    - `disputes`
      - `id` (uuid, primary key)
      - `claim_id` (uuid, references claims)
      - `reporter_role` (text: 'creator' or 'business')
      - `reason` (text)
      - `status` (text: 'pending', 'resolved', 'rejected')
      - `admin_notes` (text)
      - `created_at` (timestamptz)
      - `resolved_at` (timestamptz)
  
  2. Security
    - Enable RLS on disputes table
    - Authenticated users can create disputes for their own claims
    - Users can view their own disputes
    - Admin has full access
*/

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  reporter_role text NOT NULL CHECK (reporter_role IN ('creator', 'business')),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'rejected')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_disputes_claim_id ON disputes(claim_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

CREATE POLICY "Admin full access to disputes"
  ON disputes FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt()->>'email') = 'admin@juicecreators.com')
  WITH CHECK ((SELECT auth.jwt()->>'email') = 'admin@juicecreators.com');

CREATE POLICY "Users can create disputes for their claims"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM claims c
      LEFT JOIN creators cr ON cr.id = c.creator_id
      LEFT JOIN businesses b ON b.id = c.business_id
      WHERE c.id = disputes.claim_id
        AND (
          (cr.email = (auth.jwt()->>'email') AND disputes.reporter_role = 'creator')
          OR
          (b.owner_email = (auth.jwt()->>'email') AND disputes.reporter_role = 'business')
        )
    )
  );

CREATE POLICY "Users can view their own disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM claims c
      LEFT JOIN creators cr ON cr.id = c.creator_id
      LEFT JOIN businesses b ON b.id = c.business_id
      WHERE c.id = disputes.claim_id
        AND (cr.email = (auth.jwt()->>'email') OR b.owner_email = (auth.jwt()->>'email'))
    )
  );
