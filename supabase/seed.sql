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
INSERT INTO creators (id, name, instagram_handle, code, email, follower_count, approved, onboarding_complete, region, avatar_url, level, level_name, total_reels, average_rating, current_streak, longest_streak, last_reel_month, profile_complete, display_name, bio)
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
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    3,
    'Regular',
    4,
    4.2,
    2,
    2,
    '2026-03',
    true,
    'Sophie Carter',
    'Coffee lover & content creator in Bury St Edmunds'
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
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    1,
    'Newcomer',
    0,
    0,
    0,
    0,
    NULL,
    false,
    NULL,
    NULL
  ),
  (
    'a3333333-3333-3333-3333-333333333333',
    'Mia Chen',
    '@miachen',
    'MIA303',
    'mia@example.com',
    '10k–25k',
    true,
    true,
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
    2,
    'Explorer',
    2,
    4.5,
    1,
    1,
    '2026-02',
    true,
    'Mia Chen',
    'Foodie & lifestyle creator'
  ),
  (
    'a4444444-4444-4444-4444-444444444444',
    'Tom Bradley',
    '@tombradley',
    'TOM404',
    'tom@example.com',
    '1k–5k',
    true,
    true,
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
    2,
    'Explorer',
    3,
    3.8,
    1,
    2,
    '2026-03',
    true,
    'Tom Bradley',
    'Fitness & wellness content'
  ),
  (
    'a5555555-5555-5555-5555-555555555555',
    'Isla Morgan',
    '@islamorgan',
    'ISLA505',
    'isla@example.com',
    '5k–10k',
    true,
    true,
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
    3,
    'Regular',
    5,
    4.6,
    3,
    3,
    '2026-03',
    true,
    'Isla Morgan',
    'Beauty & fashion in East Anglia'
  ),
  (
    'a6666666-6666-6666-6666-666666666666',
    'Dan Okafor',
    '@danokafor',
    'DAN606',
    'dan@example.com',
    '1k–5k',
    true,
    false,
    'bury-st-edmunds',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
    1,
    'Newcomer',
    0,
    0,
    0,
    0,
    NULL,
    false,
    NULL,
    NULL
  )
ON CONFLICT (id) DO UPDATE SET
  avatar_url = EXCLUDED.avatar_url,
  name = EXCLUDED.name,
  instagram_handle = EXCLUDED.instagram_handle,
  code = EXCLUDED.code,
  follower_count = EXCLUDED.follower_count,
  approved = EXCLUDED.approved,
  onboarding_complete = EXCLUDED.onboarding_complete,
  region = EXCLUDED.region,
  level = EXCLUDED.level,
  level_name = EXCLUDED.level_name,
  total_reels = EXCLUDED.total_reels,
  average_rating = EXCLUDED.average_rating,
  current_streak = EXCLUDED.current_streak,
  longest_streak = EXCLUDED.longest_streak,
  last_reel_month = EXCLUDED.last_reel_month,
  profile_complete = EXCLUDED.profile_complete,
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio;

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
INSERT INTO offers (id, business_id, description, monthly_cap, is_live, generated_title, offer_photo_url)
VALUES
  (
    'c1111111-1111-1111-1111-111111111111',
    'b1111111-1111-1111-1111-111111111111',
    'Free coffee + pastry in exchange for an Instagram reel featuring our shop',
    8,
    true,
    'Free coffee + pastry',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=500&fit=crop'
  ),
  (
    'c2222222-2222-2222-2222-222222222222',
    'b1111111-1111-1111-1111-111111111111',
    'Free brunch for two — post a story tagging @midgarcoffee',
    4,
    true,
    'Brunch for two',
    'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=400&h=500&fit=crop'
  ),
  (
    'c3333333-3333-3333-3333-333333333333',
    'b2222222-2222-2222-2222-222222222222',
    'Complimentary express facial for a reel showing the full experience',
    6,
    true,
    'Express facial',
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=500&fit=crop'
  ),
  (
    'c4444444-4444-4444-4444-444444444444',
    'b2222222-2222-2222-2222-222222222222',
    'Free gel manicure — share a before/after reel',
    null,
    true,
    'Free gel manicure',
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=500&fit=crop'
  ),
  (
    'c5555555-5555-5555-5555-555555555555',
    'b3333333-3333-3333-3333-333333333333',
    'Free smoothie bowl + juice — film a 30s reel of your visit',
    10,
    true,
    'Smoothie bowl + juice',
    'https://images.unsplash.com/photo-1546039907-7b3a4711ad8f?w=400&h=500&fit=crop'
  ),
  (
    'c6666666-6666-6666-6666-666666666666',
    'b4444444-4444-4444-4444-444444444444',
    'Free day pass + PT session — post a workout reel tagging @ironoakgym',
    4,
    true,
    'Free day pass + PT session',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=500&fit=crop'
  ),
  (
    'c7777777-7777-7777-7777-777777777777',
    'b5555555-5555-5555-5555-555555555555',
    'Free outfit styling session — share a try-on haul reel',
    6,
    true,
    'Outfit styling session',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=500&fit=crop'
  ),
  (
    'c8888888-8888-8888-8888-888888888888',
    'b6666666-6666-6666-6666-666666666666',
    'Free dog grooming session — post a cute before/after reel',
    null,
    true,
    'Free dog grooming',
    'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400&h=500&fit=crop'
  ),
  (
    'c9999999-9999-9999-9999-999999999999',
    'b7777777-7777-7777-7777-777777777777',
    'Free paint & sip evening for two — reel the experience',
    5,
    true,
    'Paint & sip for two',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=500&fit=crop'
  )
ON CONFLICT (id) DO UPDATE SET
  generated_title = EXCLUDED.generated_title,
  offer_photo_url = EXCLUDED.offer_photo_url;
