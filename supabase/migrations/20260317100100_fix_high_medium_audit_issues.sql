/*
  # Fix high/medium audit issues

  - #3:  Add composite index on (creator_id, status) for claims table
  - #18: Add notifications INSERT policy for service role (server-side only)
*/

-- #3: Composite index for common query pattern (creator's claims by status)
CREATE INDEX IF NOT EXISTS idx_claims_creator_status
  ON claims (creator_id, status);

-- #18: Allow service_role to insert notifications (Edge Functions / server-side)
-- This replaces the removed permissive policy with a restrictive one
CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  TO service_role
  WITH CHECK (true);
