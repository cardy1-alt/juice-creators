-- Update admin email from admin@juicecreators.com to hello@nayba.app
-- across all RLS policies

-- Drop and recreate admin policies on creators
DROP POLICY IF EXISTS "Admin full access to creators" ON creators;
CREATE POLICY "Admin full access to creators" ON creators
  FOR ALL TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app');

-- Drop and recreate admin policies on businesses
DROP POLICY IF EXISTS "Admin full access to businesses" ON businesses;
CREATE POLICY "Admin full access to businesses" ON businesses
  FOR ALL TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app');

-- Drop and recreate admin policies on offers
DROP POLICY IF EXISTS "Admin full access to offers" ON offers;
CREATE POLICY "Admin full access to offers" ON offers
  FOR ALL TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app');

-- Drop and recreate admin policies on claims
DROP POLICY IF EXISTS "Admin full access to claims" ON claims;
CREATE POLICY "Admin full access to claims" ON claims
  FOR ALL TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app');

-- Drop and recreate admin policies on notifications
DROP POLICY IF EXISTS "Admin full access to notifications" ON notifications;
CREATE POLICY "Admin full access to notifications" ON notifications
  FOR ALL TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app');

-- Drop and recreate admin policies on feedback
DROP POLICY IF EXISTS "Admin full access to feedback" ON feedback;
CREATE POLICY "Admin full access to feedback" ON feedback
  FOR ALL TO authenticated
  USING (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app')
  WITH CHECK (lower((SELECT (auth.jwt() ->> 'email'))) = 'hello@nayba.app');

-- Drop and recreate admin policies on disputes (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disputes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access to disputes" ON disputes';
    EXECUTE 'CREATE POLICY "Admin full access to disputes" ON disputes
      FOR ALL TO authenticated
      USING (lower((SELECT (auth.jwt() ->> ''email''))) = ''hello@nayba.app'')
      WITH CHECK (lower((SELECT (auth.jwt() ->> ''email''))) = ''hello@nayba.app'')';
  END IF;
END $$;
