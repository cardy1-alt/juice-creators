-- Tighten feedback RLS:
-- 1. Only authenticated users can insert, and only with their own user_id
-- 2. No one except the service role (which bypasses RLS) can read feedback

-- Drop the existing permissive insert policy
DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;

-- Recreate insert: authenticated users can only insert rows where user_id = their own id
CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Drop the admin read/write policy — reads should go through service role only
DROP POLICY IF EXISTS "Admin full access to feedback" ON feedback;
