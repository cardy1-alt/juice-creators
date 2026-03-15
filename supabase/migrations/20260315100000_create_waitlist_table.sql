-- Waitlist table for full offers
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  UNIQUE(offer_id, creator_id)
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can join waitlist"
  ON waitlist FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can view own waitlist entries"
  ON waitlist FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "Creators can leave waitlist"
  ON waitlist FOR DELETE TO authenticated
  USING (creator_id = auth.uid());
