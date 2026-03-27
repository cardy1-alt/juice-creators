-- Replace hardcoded admin email with current_setting('app.admin_email', true)
-- so the admin email can be configured per environment without new migrations.
--
-- To set the admin email, run:
--   ALTER DATABASE postgres SET app.admin_email = 'hello@nayba.app';
-- or set it per-session / in Supabase custom config.

-- creators
DROP POLICY IF EXISTS "Admin full access to creators" ON creators;
CREATE POLICY "Admin full access to creators" ON creators
  FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)));

-- businesses
DROP POLICY IF EXISTS "Admin full access to businesses" ON businesses;
CREATE POLICY "Admin full access to businesses" ON businesses
  FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)));

-- offers
DROP POLICY IF EXISTS "Admin full access to offers" ON offers;
CREATE POLICY "Admin full access to offers" ON offers
  FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)));

-- claims
DROP POLICY IF EXISTS "Admin full access to claims" ON claims;
CREATE POLICY "Admin full access to claims" ON claims
  FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)));

-- notifications
DROP POLICY IF EXISTS "Admin full access to notifications" ON notifications;
CREATE POLICY "Admin full access to notifications" ON notifications
  FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)));

-- feedback
DROP POLICY IF EXISTS "Admin full access to feedback" ON feedback;
CREATE POLICY "Admin full access to feedback" ON feedback
  FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)));

-- disputes (conditional — table may not exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disputes') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access to disputes" ON disputes';
    EXECUTE 'CREATE POLICY "Admin full access to disputes" ON disputes
      FOR ALL TO authenticated
      USING (lower(auth.jwt() ->> ''email'') = lower(current_setting(''app.admin_email'', true)))
      WITH CHECK (lower(auth.jwt() ->> ''email'') = lower(current_setting(''app.admin_email'', true)))';
  END IF;
END $$;

-- Set the default admin email for this database
ALTER DATABASE postgres SET app.admin_email = 'hello@nayba.app';
