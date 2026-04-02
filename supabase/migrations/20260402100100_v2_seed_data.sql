-- ============================================================
-- NAYBA V2 — Seed realistic test data
-- 3 brands, 2 active campaigns, 5 creators, 3 applications
-- ============================================================

-- ============================================================
-- 1. SEED BRANDS (businesses table)
-- ============================================================

INSERT INTO businesses (id, name, slug, owner_email, category, region, address, bio, instagram_handle, approved, is_live, onboarding_complete)
VALUES
  (
    'b0000001-0000-0000-0000-000000000001',
    'The Buttermarket Brew Co.',
    'buttermarket-brew-co',
    'hello@buttermarketbrew.co.uk',
    'Food & Drink',
    'Suffolk',
    '12 Abbeygate Street, Bury St Edmunds, IP33 1LW',
    'Independent speciality coffee shop in the heart of Bury St Edmunds. We roast our own beans and serve seasonal pastries from local bakers.',
    '@buttermarketbrew',
    true,
    true,
    true
  ),
  (
    'b0000002-0000-0000-0000-000000000002',
    'Glow Wellness Studio',
    'glow-wellness-studio',
    'bookings@glowwellness.co.uk',
    'Wellness',
    'Suffolk',
    '8 Angel Hill, Bury St Edmunds, IP33 1UZ',
    'Boutique wellness studio offering facials, massage, and holistic treatments. Suffolk''s hidden gem for self-care.',
    '@glowwellnessbse',
    true,
    true,
    true
  ),
  (
    'b0000003-0000-0000-0000-000000000003',
    'East Coast Provisions',
    'east-coast-provisions',
    'info@eastcoastprovisions.co.uk',
    'Food & Drink',
    'Suffolk',
    'Unit 4, Rougham Industrial Estate, Bury St Edmunds, IP30 9ND',
    'Small-batch hot sauces and condiments made with locally grown Suffolk chillies. Available in Waitrose East Anglia.',
    '@eastcoastprovisions',
    true,
    true,
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. SEED CREATORS
-- ============================================================

INSERT INTO creators (id, name, display_name, email, instagram_handle, code, approved, onboarding_complete, profile_complete, level, level_name, address, completion_rate, total_campaigns, completed_campaigns)
VALUES
  (
    'c0000001-0000-0000-0000-000000000001',
    'Sophie Turner',
    'Sophie Turner',
    'sophie.turner.test@nayba.app',
    '@sophieturner_bse',
    'SOPHIE01',
    true, true, true,
    3, 'Regular',
    'Bury St Edmunds',
    100, 4, 4
  ),
  (
    'c0000002-0000-0000-0000-000000000002',
    'Marcus Ali',
    'Marcus Ali',
    'marcus.ali.test@nayba.app',
    '@marcusali_suffolk',
    'MARCUS01',
    true, true, true,
    2, 'Explorer',
    'Bury St Edmunds',
    100, 2, 2
  ),
  (
    'c0000003-0000-0000-0000-000000000003',
    'Jess Hartley',
    'Jess Hartley',
    'jess.hartley.test@nayba.app',
    '@jesshartley_',
    'JESS01',
    true, true, true,
    1, 'Newcomer',
    'Ipswich',
    0, 0, 0
  ),
  (
    'c0000004-0000-0000-0000-000000000004',
    'Tom Bridges',
    'Tom Bridges',
    'tom.bridges.test@nayba.app',
    '@tombridges_eat',
    'TOM01',
    true, true, true,
    4, 'Local',
    'Stowmarket',
    83, 6, 5
  ),
  (
    'c0000005-0000-0000-0000-000000000005',
    'Amara Okafor',
    'Amara Okafor',
    'amara.okafor.test@nayba.app',
    '@amaraokafor_',
    'AMARA01',
    true, true, true,
    1, 'Newcomer',
    'Bury St Edmunds',
    0, 0, 0
  )
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 3. SEED CAMPAIGNS
-- ============================================================

INSERT INTO campaigns (id, brand_id, title, headline, about_brand, perk_description, perk_value, perk_type, target_city, target_county, content_requirements, talking_points, inspiration, deliverables, creator_target, open_date, expression_deadline, content_deadline, status, min_level)
VALUES
  (
    'a0000001-0000-0000-0000-000000000001',
    'b0000001-0000-0000-0000-000000000001',
    'Summer Iced Coffee Launch',
    'Try our new iced coffee range and share your experience',
    'The Buttermarket Brew Co. is Bury St Edmunds'' favourite independent coffee shop. We roast our own single-origin beans on site and serve seasonal pastries from Suffolk bakers. Our new iced coffee range launches this summer — three flavours, all made with cold-brewed Suffolk water.',
    '£15 gift card to spend on anything in-store — plus a free iced coffee flight (all 3 flavours)',
    15,
    'gift_card',
    'Bury St Edmunds',
    'Suffolk',
    'Post one Instagram Reel (30-60 seconds) showing your visit to The Buttermarket Brew Co. and trying at least one iced coffee. Must tag @buttermarketbrew and use #NaybaBSE. Show the cafe atmosphere — we want people to feel like they''re there.',
    ARRAY['Bury St Edmunds'' best-kept coffee secret', 'New iced coffee range — perfect for summer', 'Real beans, roasted on site, by real people'],
    '[{"title": "The first-sip reaction", "description": "Film yourself trying the iced coffee for the first time. Genuine reaction, no script. Show the drink being made if the barista is happy to be filmed."}, {"title": "A morning in Bury", "description": "Weave the coffee shop into a wider ''morning in my town'' Reel. Walk through the Buttermarket, grab your coffee, sit in the Abbey Gardens. Make it feel like a local''s guide."}]'::jsonb,
    '{"reel": true, "story": false}'::jsonb,
    8,
    '2026-04-01T09:00:00Z',
    '2026-04-14T23:59:00Z',
    '2026-04-28T23:59:00Z',
    'active',
    1
  ),
  (
    'a0000002-0000-0000-0000-000000000002',
    'b0000002-0000-0000-0000-000000000002',
    'Glow-Up Facial Experience',
    'Get a free signature facial and share your glow-up',
    'Glow Wellness Studio is a boutique treatment room on Angel Hill, Bury St Edmunds. Founded by trained aesthetician Priya Sharma, Glow offers facials, deep-tissue massage, and holistic skin consultations. Every product used is vegan, cruelty-free, and sourced from UK suppliers.',
    'One complimentary Signature Glow Facial (60 minutes, usually £65) — book directly with the studio',
    65,
    'experience',
    'Bury St Edmunds',
    'Suffolk',
    'Post one Instagram Reel (30-90 seconds) showing your visit to Glow Wellness Studio. Film before/during/after your facial — the vibe of the studio, the products, your skin after. Tag @glowwellnessbse and use #NaybaBSE. Keep it authentic — no filters on the after shot.',
    ARRAY['Bury''s best-kept wellness secret', 'Vegan, cruelty-free products from UK suppliers', 'Book your own Glow-Up — link in bio'],
    '[{"title": "The before and after", "description": "Start with bare skin, show the treatment process (ask Priya''s permission to film), then reveal the after glow. Natural lighting preferred."}, {"title": "Self-care Sunday", "description": "Frame it as your self-care routine. Show arriving at the studio, the relaxing atmosphere, the treatment, then how you feel after. Voiceover optional."}, {"title": "Get ready with me (studio edition)", "description": "A GRWM but at a professional studio instead of at home. Show the difference between DIY skincare and a professional facial."}]'::jsonb,
    '{"reel": true, "story": true}'::jsonb,
    5,
    '2026-04-03T09:00:00Z',
    '2026-04-17T23:59:00Z',
    '2026-05-01T23:59:00Z',
    'active',
    1
  );

-- ============================================================
-- 4. SEED APPLICATIONS
-- ============================================================

-- Sophie applied to campaign 1 — already selected
INSERT INTO applications (id, campaign_id, creator_id, pitch, status, applied_at, selected_at)
VALUES (
  'd0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000001',
  'I live two minutes from the Buttermarket and go there every week! My followers love coffee content and I''ve done similar Reels for other local spots.',
  'selected',
  '2026-04-02T10:00:00Z',
  '2026-04-02T14:00:00Z'
);

-- Marcus applied to campaign 1 — still interested
INSERT INTO applications (id, campaign_id, creator_id, pitch, status, applied_at)
VALUES (
  'd0000002-0000-0000-0000-000000000002',
  'a0000001-0000-0000-0000-000000000001',
  'c0000002-0000-0000-0000-000000000002',
  'Big coffee fan and I''ve been meaning to try their new range. Happy to do a Reel — I usually get decent engagement on food content.',
  'interested',
  '2026-04-02T11:30:00Z'
);

-- Jess applied to campaign 2 — interested
INSERT INTO applications (id, campaign_id, creator_id, pitch, status, applied_at)
VALUES (
  'd0000003-0000-0000-0000-000000000003',
  'a0000002-0000-0000-0000-000000000002',
  'c0000003-0000-0000-0000-000000000003',
  NULL,
  'interested',
  '2026-04-03T09:15:00Z'
);
