-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — admin RLS policies
--
-- Grants the Nayba admin user (auth.jwt()->>'email' =
-- current_setting('app.admin_email')) full read/write access to the
-- bj_* tables so the AdminDashboard can manage sponsor bookings in
-- the same tab structure as campaigns/creators/brands — without
-- going through a separate password-gated endpoint.
--
-- Mirrors the pattern in 20260330100200_fix_notifications_and_rls_
-- policies.sql — uses current_setting('app.admin_email') so changing
-- the admin email is a config change, not another migration.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- bj_bookings
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bj_bookings' AND policyname='bj_bookings_admin_all') THEN
    EXECUTE 'DROP POLICY bj_bookings_admin_all ON bj_bookings';
  END IF;
  EXECUTE $policy$
    CREATE POLICY bj_bookings_admin_all
      ON bj_bookings FOR ALL
      TO authenticated
      USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
      WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  $policy$;

  -- bj_packs
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bj_packs' AND policyname='bj_packs_admin_all') THEN
    EXECUTE 'DROP POLICY bj_packs_admin_all ON bj_packs';
  END IF;
  EXECUTE $policy$
    CREATE POLICY bj_packs_admin_all
      ON bj_packs FOR ALL
      TO authenticated
      USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
      WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  $policy$;

  -- bj_legacy_rates
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bj_legacy_rates' AND policyname='bj_legacy_rates_admin_all') THEN
    EXECUTE 'DROP POLICY bj_legacy_rates_admin_all ON bj_legacy_rates';
  END IF;
  EXECUTE $policy$
    CREATE POLICY bj_legacy_rates_admin_all
      ON bj_legacy_rates FOR ALL
      TO authenticated
      USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
      WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  $policy$;
END $$;
