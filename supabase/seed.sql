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
INSERT INTO creators (id, name, instagram_handle, code, email, follower_count, approved, onboarding_complete, region, avatar_url)
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
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face'
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
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BUSINESSES
-- ============================================================
INSERT INTO businesses (id, name, slug, owner_email, category, address, latitude, longitude, bio, approved, region, logo_url)
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
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop'
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
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=400&h=400&fit=crop'
  ),
  (
    'b3333333-3333-3333-3333-333333333333',
    'The Greenhaus',
    'the-greenhaus',
    'hello@greenhaus.test',
    'Food & Drink',
    '23 St Johns Street, Bury St Edmunds, IP33 1SJ',
    52.2450,
    0.7120,
    'Plant-forward kitchen serving seasonal bowls, juices & smoothies.',
    true,
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop'
  ),
  (
    'b4444444-4444-4444-4444-444444444444',
    'Iron & Oak Gym',
    'iron-and-oak-gym',
    'info@ironoak.test',
    'Health & Fitness',
    '5 Out Risbygate, Bury St Edmunds, IP33 3AA',
    52.2420,
    0.7100,
    'Boutique strength & conditioning gym with personal training.',
    true,
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop'
  ),
  (
    'b5555555-5555-5555-5555-555555555555',
    'Thread & Fold',
    'thread-and-fold',
    'hello@threadfold.test',
    'Retail',
    '15 The Traverse, Bury St Edmunds, IP33 1BJ',
    52.2445,
    0.7148,
    'Independent clothing & lifestyle store. Curated everyday essentials.',
    true,
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop'
  ),
  (
    'b6666666-6666-6666-6666-666666666666',
    'Paws & Claws',
    'paws-and-claws',
    'hello@pawsclaws.test',
    'Pets',
    '30 Whiting Street, Bury St Edmunds, IP33 1NX',
    52.2460,
    0.7165,
    'Pet grooming, daycare & boutique treats for your furry friends.',
    true,
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop'
  ),
  (
    'b7777777-7777-7777-7777-777777777777',
    'Frame & Canvas',
    'frame-and-canvas',
    'hello@framecanvas.test',
    'Arts & Entertainment',
    '9 Hatter Street, Bury St Edmunds, IP33 1NE',
    52.2438,
    0.7170,
    'Art studio offering workshops, exhibitions & creative events.',
    true,
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=400&fit=crop'
  )
ON CONFLICT (id) DO UPDATE SET logo_url = EXCLUDED.logo_url;

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
  ),
  (
    'c5555555-5555-5555-5555-555555555555',
    'b3333333-3333-3333-3333-333333333333',
    'Free smoothie bowl + juice — film a 30s reel of your visit',
    10,
    true
  ),
  (
    'c6666666-6666-6666-6666-666666666666',
    'b4444444-4444-4444-4444-444444444444',
    'Free day pass + PT session — post a workout reel tagging @ironoakgym',
    4,
    true
  ),
  (
    'c7777777-7777-7777-7777-777777777777',
    'b5555555-5555-5555-5555-555555555555',
    'Free outfit styling session — share a try-on haul reel',
    6,
    true
  ),
  (
    'c8888888-8888-8888-8888-888888888888',
    'b6666666-6666-6666-6666-666666666666',
    'Free dog grooming session — post a cute before/after reel',
    null,
    true
  ),
  (
    'c9999999-9999-9999-9999-999999999999',
    'b7777777-7777-7777-7777-777777777777',
    'Free paint & sip evening for two — reel the experience',
    5,
    true
  )
ON CONFLICT (id) DO NOTHING;
