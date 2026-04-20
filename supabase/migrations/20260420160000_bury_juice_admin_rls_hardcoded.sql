-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — swap admin RLS to hardcoded email
--
-- The first admin-RLS migration (20260420150000) used
-- current_setting('app.admin_email', true) like Nayba's later
-- policies, but `app.admin_email` is unset on this project's
-- Supabase instance and managed Supabase plans block ALTER DATABASE
-- from application users. Fall back to hardcoding the admin email,
-- matching the original pre-dynamic Nayba pattern.
--
-- If Jacob ever rotates the admin email, one new migration swaps
-- the literal.
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
      USING (lower(auth.jwt() ->> 'email') = 'hello@nayba.app')
      WITH CHECK (lower(auth.jwt() ->> 'email') = 'hello@nayba.app')
  $policy$;

  -- bj_packs
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bj_packs' AND policyname='bj_packs_admin_all') THEN
    EXECUTE 'DROP POLICY bj_packs_admin_all ON bj_packs';
  END IF;
  EXECUTE $policy$
    CREATE POLICY bj_packs_admin_all
      ON bj_packs FOR ALL
      TO authenticated
      USING (lower(auth.jwt() ->> 'email') = 'hello@nayba.app')
      WITH CHECK (lower(auth.jwt() ->> 'email') = 'hello@nayba.app')
  $policy$;

  -- bj_legacy_rates
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bj_legacy_rates' AND policyname='bj_legacy_rates_admin_all') THEN
    EXECUTE 'DROP POLICY bj_legacy_rates_admin_all ON bj_legacy_rates';
  END IF;
  EXECUTE $policy$
    CREATE POLICY bj_legacy_rates_admin_all
      ON bj_legacy_rates FOR ALL
      TO authenticated
      USING (lower(auth.jwt() ->> 'email') = 'hello@nayba.app')
      WITH CHECK (lower(auth.jwt() ->> 'email') = 'hello@nayba.app')
  $policy$;
END $$;

-- The admin tab also reads from the businesses table to render the
-- sponsor name on each slot. Nayba's businesses policies already
-- grant admin access, so no change needed there.
