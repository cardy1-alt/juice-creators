/*
  # Fix Creator INSERT Policy & Admin Access Policies

  ## Problems Fixed
  1. Creator INSERT policy was using un-optimized auth.jwt() call which could fail
     in some session states. Drop and recreate with (SELECT ...) optimization.
  2. Admin FOR ALL policies were using un-optimized auth.jwt() calls, causing
     admin dashboard to return zero counts on some Supabase versions.
  3. Ensures all admin policies use case-insensitive email matching.

  ## Changes
  - Recreates creator INSERT policy with optimized format
  - Recreates all admin FOR ALL policies with (SELECT ...) optimization
  - Uses lower() for admin email comparison to prevent case mismatches
*/

-- ============================================================
-- FIX CREATOR INSERT POLICY
-- ============================================================

-- Drop both possible names for the creator INSERT policy
DROP POLICY IF EXISTS "Anyone can create a creator profile on sign-up" ON creators;
DROP POLICY IF EXISTS "Authenticated users can create their own creator" ON creators;

-- Recreate with optimized auth call
CREATE POLICY "Authenticated users can create their own creator profile"
  ON creators FOR INSERT
  TO authenticated
  WITH CHECK (email = (SELECT (auth.jwt() ->> 'email')));

-- ============================================================
-- FIX ADMIN FOR ALL POLICIES (optimized + case-insensitive)
-- ============================================================

-- Businesses
DROP POLICY IF EXISTS "Admin full access to businesses" ON businesses;
CREATE POLICY "Admin full access to businesses"
  ON businesses FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Offers
DROP POLICY IF EXISTS "Admin full access to offers" ON offers;
CREATE POLICY "Admin full access to offers"
  ON offers FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Creators
DROP POLICY IF EXISTS "Admin full access to creators" ON creators;
CREATE POLICY "Admin full access to creators"
  ON creators FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Claims
DROP POLICY IF EXISTS "Admin full access to claims" ON claims;
CREATE POLICY "Admin full access to claims"
  ON claims FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Notifications
DROP POLICY IF EXISTS "Admin full access to notifications" ON notifications;
CREATE POLICY "Admin full access to notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');

-- Disputes (already uses SELECT pattern from fix_all_security_issues, but update for case-insensitivity)
DROP POLICY IF EXISTS "Admin full access to disputes" ON disputes;
CREATE POLICY "Admin full access to disputes"
  ON disputes FOR ALL
  TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'admin@juicecreators.com');
