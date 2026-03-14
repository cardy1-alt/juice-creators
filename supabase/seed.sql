/*
  Nayba Seed Data
  ===============
  Populates the database with test users for local development and pilot testing.

  IMPORTANT: You must also create matching auth users in the Supabase dashboard
  (Authentication > Users > Add User) with these emails and a password of your choice:

    1. admin@juicecreators.com   (admin — detected by email match)
    2. sophie@example.com        (creator)
    3. jake@example.com          (creator)
    4. hello@midgarcoffee.com    (business)
    5. info@glowstudio.com       (business)

  The seed uses fixed UUIDs so you can re-run it safely (uses ON CONFLICT DO NOTHING).
*/

-- ============================================================
-- CREATORS
-- ============================================================
INSERT INTO creators (id, name, instagram_handle, code, email, follower_count, approved, onboarding_complete, region)
VALUES
  (
    'a1111111-1111-1111-1111-111111111111',
    'Sophie Carter',
    '@sophiecarter',
    'SOPHIE101',
    'sophie@example.com',
    '5k–10k',
    true,
    true,
    'bury-st-edmunds'
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'Jake Miller',
    '@jakemiller',
    'JAKE202',
    'jake@example.com',
    '1k–5k',
    true,
    false,
    'bury-st-edmunds'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BUSINESSES
-- ============================================================
INSERT INTO businesses (id, name, slug, owner_email, category, address, latitude, longitude, bio, approved, region)
VALUES
  (
    'b1111111-1111-1111-1111-111111111111',
    'Midgar Coffee',
    'midgar-coffee',
    'hello@midgarcoffee.com',
    'Cafe & Coffee',
    '12 Abbeygate Street, Bury St Edmunds, IP33 1LB',
    52.2434,
    0.7137,
    'Specialty coffee & brunch spot in the heart of town.',
    true,
    'bury-st-edmunds'
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'Glow Studio',
    'glow-studio',
    'info@glowstudio.com',
    'Beauty & Wellness',
    '8 Cornhill, Bury St Edmunds, IP33 1BQ',
    52.2440,
    0.7155,
    'Facials, lashes & nails — your local glow-up destination.',
    true,
    'bury-st-edmunds'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- OFFERS
-- ============================================================
INSERT INTO offers (id, business_id, description, monthly_cap, is_live)
VALUES
  (
    'c1111111-1111-1111-1111-111111111111',
    'b1111111-1111-1111-1111-111111111111',
    'Free coffee + pastry in exchange for an Instagram reel featuring our shop',
    8,
    true
  ),
  (
    'c2222222-2222-2222-2222-222222222222',
    'b1111111-1111-1111-1111-111111111111',
    'Free brunch for two — post a story tagging @midgarcoffee',
    4,
    true
  ),
  (
    'c3333333-3333-3333-3333-333333333333',
    'b2222222-2222-2222-2222-222222222222',
    'Complimentary express facial for a reel showing the full experience',
    6,
    true
  ),
  (
    'c4444444-4444-4444-4444-444444444444',
    'b2222222-2222-2222-2222-222222222222',
    'Free gel manicure — share a before/after reel',
    null,
    true
  )
ON CONFLICT (id) DO NOTHING;
