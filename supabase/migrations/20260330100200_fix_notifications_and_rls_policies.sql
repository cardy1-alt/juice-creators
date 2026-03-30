/*
  # Fix notifications INSERT, saved_businesses admin, and waitlist admin RLS

  1. Notifications INSERT: The original WITH CHECK (true) was dropped, and only
     service_role INSERT was added. But client-side code inserts notifications
     for transactional emails (creator→business, business→creator). This adds
     a policy allowing authenticated users to insert notifications only where
     the target user_id references an existing creator or business profile.

  2. saved_businesses admin policy: Update from hardcoded admin@juicecreators.com
     to dynamic current_setting('app.admin_email').

  3. waitlist admin policy: Add missing admin access to waitlist table.
*/

-- ═══ 1. Notifications INSERT policy for authenticated users ═══

-- Allow authenticated users to insert notifications targeting valid profiles
-- (prevents arbitrary user_id targeting while allowing cross-user notifications)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Target must be an existing creator or business
    EXISTS (SELECT 1 FROM creators WHERE creators.id = user_id)
    OR
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = user_id)
  );

-- ═══ 2. Fix saved_businesses admin policy ═══

DROP POLICY IF EXISTS "Admin full access to saved_businesses" ON saved_businesses;
CREATE POLICY "Admin full access to saved_businesses"
  ON saved_businesses FOR ALL
  TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)));

-- ═══ 3. Add waitlist admin policy ═══

DROP POLICY IF EXISTS "Admin full access to waitlist" ON waitlist;
CREATE POLICY "Admin full access to waitlist"
  ON waitlist FOR ALL
  TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)))
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(current_setting('app.admin_email', true)));
