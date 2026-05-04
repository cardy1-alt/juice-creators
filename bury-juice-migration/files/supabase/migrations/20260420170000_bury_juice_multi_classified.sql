-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — multi-classified inventory
--
-- Original schema enforced exactly one booking per (tier,
-- issue_date) via UNIQUE(tier, issue_date). Reality is less rigid:
-- each issue can carry up to four classified placements. Primary
-- and Feature remain one-per-issue.
--
-- We drop the hard UNIQUE constraint and enforce capacity at the
-- application layer (availability helper + booking-create path).
-- A composite index keeps per-issue lookups fast.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE bj_bookings DROP CONSTRAINT IF EXISTS bj_bookings_tier_issue_date_key;

-- The schema's generated unique key name. Some Supabase instances
-- emit the name without the _key suffix; drop both to be safe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.bj_bookings'::regclass
        AND contype = 'u'
        AND array_to_string(conkey, ',') = (
          SELECT array_to_string(array_agg(attnum ORDER BY attnum), ',')
            FROM pg_attribute
            WHERE attrelid = 'public.bj_bookings'::regclass
              AND attname IN ('tier', 'issue_date')
        )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE bj_bookings DROP CONSTRAINT ' || quote_ident(conname)
        FROM pg_constraint
        WHERE conrelid = 'public.bj_bookings'::regclass
          AND contype = 'u'
          AND array_to_string(conkey, ',') = (
            SELECT array_to_string(array_agg(attnum ORDER BY attnum), ',')
              FROM pg_attribute
              WHERE attrelid = 'public.bj_bookings'::regclass
                AND attname IN ('tier', 'issue_date')
          )
        LIMIT 1
    );
  END IF;
END $$;

-- Supporting index so capacity lookups stay cheap at scale.
CREATE INDEX IF NOT EXISTS bj_bookings_tier_date_idx
  ON bj_bookings(tier, issue_date)
  WHERE status != 'cancelled';
