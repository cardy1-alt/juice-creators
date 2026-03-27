-- Fix waitlist RLS policies: replace auth.uid() with email-based creator lookup
-- creator_id is a FK to creators(id), not the auth UID, so auth.uid() never matches

DROP POLICY IF EXISTS "Creators can join waitlist" ON waitlist;
DROP POLICY IF EXISTS "Creators can view own waitlist entries" ON waitlist;
DROP POLICY IF EXISTS "Creators can leave waitlist" ON waitlist;

CREATE POLICY "Creators can join waitlist"
  ON waitlist FOR INSERT TO authenticated
  WITH CHECK (creator_id = (SELECT id FROM creators WHERE email = lower((auth.jwt()->>'email'))));

CREATE POLICY "Creators can view own waitlist entries"
  ON waitlist FOR SELECT TO authenticated
  USING (creator_id = (SELECT id FROM creators WHERE email = lower((auth.jwt()->>'email'))));

CREATE POLICY "Creators can leave waitlist"
  ON waitlist FOR DELETE TO authenticated
  USING (creator_id = (SELECT id FROM creators WHERE email = lower((auth.jwt()->>'email'))));
