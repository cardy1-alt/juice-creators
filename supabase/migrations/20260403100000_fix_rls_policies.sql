-- ============================================================
-- NAYBA V2 — Fix RLS policies (security hardening)
-- Replaces all permissive policies on campaigns, applications,
-- and participations with proper role-based access control.
--
-- Admin check uses: current_setting('app.admin_email', true)
-- This is the SINGULAR form, matching the existing DB setting:
--   ALTER DATABASE postgres SET app.admin_email = 'hello@nayba.app';
-- Set in migration 20260319110000_use_dynamic_admin_email.sql
-- ============================================================

-- ============================================================
-- 1. DROP ALL EXISTING V2 POLICIES
-- ============================================================

DROP POLICY IF EXISTS "campaigns_select_authenticated" ON campaigns;
DROP POLICY IF EXISTS "campaigns_insert_admin" ON campaigns;
DROP POLICY IF EXISTS "campaigns_update_admin" ON campaigns;
DROP POLICY IF EXISTS "campaigns_delete_admin" ON campaigns;

DROP POLICY IF EXISTS "applications_select_own" ON applications;
DROP POLICY IF EXISTS "applications_insert_own" ON applications;
DROP POLICY IF EXISTS "applications_update_all" ON applications;
DROP POLICY IF EXISTS "applications_delete_all" ON applications;

DROP POLICY IF EXISTS "participations_select" ON participations;
DROP POLICY IF EXISTS "participations_insert_all" ON participations;
DROP POLICY IF EXISTS "participations_update_all" ON participations;
DROP POLICY IF EXISTS "participations_delete_all" ON participations;

-- Also drop any that may exist with alternate names
DROP POLICY IF EXISTS "campaigns_select_all" ON campaigns;
DROP POLICY IF EXISTS "applications_select" ON applications;
DROP POLICY IF EXISTS "applications_insert_own" ON applications;
DROP POLICY IF EXISTS "applications_update" ON applications;
DROP POLICY IF EXISTS "participations_insert_admin" ON participations;
DROP POLICY IF EXISTS "participations_update_admin" ON participations;

-- ============================================================
-- 2. CAMPAIGNS — readable by all, writable by admin only
-- ============================================================

CREATE POLICY campaigns_select_all ON campaigns
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY campaigns_insert_admin ON campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  );

CREATE POLICY campaigns_update_admin ON campaigns
  FOR UPDATE TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  )
  WITH CHECK (
    lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  );

CREATE POLICY campaigns_delete_admin ON campaigns
  FOR DELETE TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  );

-- ============================================================
-- 3. APPLICATIONS
-- Creators can read/insert/update their own (matched by id = auth.uid())
-- Admin can read/update all
-- ============================================================

CREATE POLICY applications_select ON applications
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  );

-- Creators insert their own applications only
CREATE POLICY applications_insert_own ON applications
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    OR lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  );

-- Creator can update own (e.g. confirm), admin can update all
CREATE POLICY applications_update ON applications
  FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid()
    OR lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  )
  WITH CHECK (
    creator_id = auth.uid()
    OR lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  );

-- ============================================================
-- 4. PARTICIPATIONS
-- Creators read their own, business owners read for their campaigns,
-- admin reads/writes all. Only admin can insert/update.
-- ============================================================

CREATE POLICY participations_select ON participations
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
    OR EXISTS (
      SELECT 1 FROM campaigns c
      JOIN businesses b ON b.id = c.brand_id
      WHERE c.id = participations.campaign_id
      AND b.owner_email = lower(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY participations_insert_admin ON participations
  FOR INSERT TO authenticated
  WITH CHECK (
    lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  );

CREATE POLICY participations_update_admin ON participations
  FOR UPDATE TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  )
  WITH CHECK (
    lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true))
  );
