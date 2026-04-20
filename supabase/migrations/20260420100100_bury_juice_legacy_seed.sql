-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — Legacy sponsor seed
-- Populates bj_legacy_rates + bj_bookings for grandfathered sponsors
-- through the end of 2026. Re-runnable: uses ON CONFLICT DO NOTHING
-- and guards against duplicate rate rows.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_david_lloyd_id UUID;
  v_snappy_id UUID;
  v_loyal_wolf_id UUID;
  v_midgar_id UUID;
  v_yyc_fitness_id UUID;
  v_thursday DATE;
  v_week_index INT;
  v_month_counter INT;
  v_current_month DATE;
BEGIN
  -- ── Businesses ───────────────────────────────────────────────
  INSERT INTO businesses (name, contact_email)
    VALUES ('David Lloyd Bury St Edmunds', 'legacy+davidlloyd@buryjuice.com')
    ON CONFLICT (contact_email) DO NOTHING;
  SELECT id INTO v_david_lloyd_id FROM businesses WHERE contact_email = 'legacy+davidlloyd@buryjuice.com';

  INSERT INTO businesses (name, contact_email)
    VALUES ('Snappy Shopper', 'legacy+snappy@buryjuice.com')
    ON CONFLICT (contact_email) DO NOTHING;
  SELECT id INTO v_snappy_id FROM businesses WHERE contact_email = 'legacy+snappy@buryjuice.com';

  INSERT INTO businesses (name, contact_email)
    VALUES ('Loyal Wolf', 'legacy+loyalwolf@buryjuice.com')
    ON CONFLICT (contact_email) DO NOTHING;
  SELECT id INTO v_loyal_wolf_id FROM businesses WHERE contact_email = 'legacy+loyalwolf@buryjuice.com';

  INSERT INTO businesses (name, contact_email)
    VALUES ('Midgar', 'legacy+midgar@buryjuice.com')
    ON CONFLICT (contact_email) DO NOTHING;
  SELECT id INTO v_midgar_id FROM businesses WHERE contact_email = 'legacy+midgar@buryjuice.com';

  INSERT INTO businesses (name, contact_email)
    VALUES ('Yes You Can Fitness', 'legacy+yycfitness@buryjuice.com')
    ON CONFLICT (contact_email) DO NOTHING;
  SELECT id INTO v_yyc_fitness_id FROM businesses WHERE contact_email = 'legacy+yycfitness@buryjuice.com';

  -- ── Legacy rate rows ─────────────────────────────────────────
  INSERT INTO bj_legacy_rates (business_id, tier, monthly_rate_gbp, cadence, is_comp, notes, active) VALUES
    (v_david_lloyd_id,  'gold',   0,    'weekly',  TRUE,  'Comp — rotates gold/silver/bronze across the month', TRUE),
    (v_snappy_id,       'silver', 8000, 'monthly', FALSE, 'Rolling monthly commitment',                         TRUE),
    (v_loyal_wolf_id,   'bronze', 3500, 'monthly', FALSE, 'Rolling monthly commitment',                         TRUE),
    (v_midgar_id,       'silver', 8500, 'monthly', FALSE, 'Rolling monthly commitment',                         TRUE),
    (v_yyc_fitness_id,  'bronze', 3500, 'monthly', FALSE, 'Rolling monthly commitment',                         TRUE)
  ON CONFLICT (business_id) DO NOTHING;

  -- ── David Lloyd rotation ─────────────────────────────────────
  -- Week 1 gold, week 2 silver, week 3 bronze, week 4 gold, repeat.
  -- 52 Thursdays forward from today.
  v_thursday := (CURRENT_DATE + ((4 - EXTRACT(DOW FROM CURRENT_DATE)::INT + 7) % 7))::DATE;
  v_week_index := 0;
  WHILE v_week_index < 52 LOOP
    INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
    VALUES (
      v_david_lloyd_id,
      CASE (v_week_index % 4)
        WHEN 0 THEN 'gold'
        WHEN 1 THEN 'silver'
        WHEN 2 THEN 'bronze'
        ELSE 'gold'
      END,
      v_thursday + (v_week_index * INTERVAL '7 day'),
      'comp',
      'confirmed',
      0
    )
    ON CONFLICT (tier, issue_date) DO NOTHING;
    v_week_index := v_week_index + 1;
  END LOOP;

  -- ── Rolling-monthly sponsors: seed 6 months forward ──────────
  -- Each legacy sponsor gets the FIRST Thursday of the month at
  -- their tier. Jacob extends from the admin view thereafter.
  v_month_counter := 0;
  WHILE v_month_counter < 6 LOOP
    v_current_month := (date_trunc('month', CURRENT_DATE) + (v_month_counter * INTERVAL '1 month'))::DATE;
    -- First Thursday of that month
    v_thursday := v_current_month + ((4 - EXTRACT(DOW FROM v_current_month)::INT + 7) % 7);

    -- Snappy Shopper — silver, week 2
    INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
    VALUES (v_snappy_id, 'silver', v_thursday + INTERVAL '7 day', 'paid_legacy', 'confirmed', 8000)
    ON CONFLICT (tier, issue_date) DO NOTHING;

    -- Midgar — silver, week 4
    INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
    VALUES (v_midgar_id, 'silver', v_thursday + INTERVAL '21 day', 'paid_legacy', 'confirmed', 8500)
    ON CONFLICT (tier, issue_date) DO NOTHING;

    -- Loyal Wolf — bronze, week 1
    INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
    VALUES (v_loyal_wolf_id, 'bronze', v_thursday, 'paid_legacy', 'confirmed', 3500)
    ON CONFLICT (tier, issue_date) DO NOTHING;

    -- Yes You Can Fitness — bronze, week 3 (bronze slot is still open
    -- in week 3 because David Lloyd holds bronze only on David Lloyd
    -- week 3; when they collide the DL comp wins and YYC rolls forward
    -- — Jacob reconciles manually for v1)
    INSERT INTO bj_bookings (business_id, tier, issue_date, source, status, amount_paid_gbp)
    VALUES (v_yyc_fitness_id, 'bronze', v_thursday + INTERVAL '14 day', 'paid_legacy', 'confirmed', 3500)
    ON CONFLICT (tier, issue_date) DO NOTHING;

    v_month_counter := v_month_counter + 1;
  END LOOP;
END $$;
