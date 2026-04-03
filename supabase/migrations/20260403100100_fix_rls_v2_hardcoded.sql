-- ============================================================
-- NAYBA V2 — Fix RLS policies (v2 — hardcoded admin email)
-- Replaces current_setting('app.admin_email') with a direct
-- email check since Supabase doesn't allow setting custom
-- GUC parameters on all plans.
--
-- Admin email: hello@nayba.app
-- If this changes, update this migration and re-run.
-- ============================================================

-- ============================================================
-- 1. DROP ALL EXISTING POLICIES ON V2 TABLES
-- ============================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('campaigns', 'applications', 'participations')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================
-- Helper: check if the current user is admin
-- Using a function avoids repeating the email everywhere and
-- makes it easy to update if the admin email changes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT lower(auth.jwt() ->> 'email') = 'hello@nayba.app';
$$;

-- ============================================================
-- 2. CAMPAIGNS — readable by all, writable by admin only
-- ============================================================

CREATE POLICY campaigns_select_all ON campaigns
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY campaigns_insert_admin ON campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY campaigns_update_admin ON campaigns
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY campaigns_delete_admin ON campaigns
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 3. APPLICATIONS
-- Creators can read/insert/update their own
-- Admin can read/insert/update all
-- ============================================================

CREATE POLICY applications_select ON applications
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY applications_insert_own ON applications
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY applications_update ON applications
  FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    creator_id = auth.uid()
    OR public.is_admin()
  );

-- ============================================================
-- 4. PARTICIPATIONS
-- Creators read their own
-- Business owners read participations for their campaigns
-- Admin reads/writes all
-- ============================================================

CREATE POLICY participations_select ON participations
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM campaigns c
      JOIN businesses b ON b.id = c.brand_id
      WHERE c.id = participations.campaign_id
      AND b.owner_email = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY participations_insert_admin ON participations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY participations_update_admin ON participations
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
