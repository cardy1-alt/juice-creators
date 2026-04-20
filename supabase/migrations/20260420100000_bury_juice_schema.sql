-- ═══════════════════════════════════════════════════════════════
-- BURY JUICE — Sponsor storefront schema
-- Adds bj_* tables for the Bury Juice sponsor surface. Shares the
-- existing businesses table with Nayba so the two brands can merge
-- cleanly later.
-- ═══════════════════════════════════════════════════════════════

-- ── Shared businesses table ────────────────────────────────────
-- Nayba already has a businesses table, so we only create columns
-- this build needs if they're missing. Nayba's businesses rows have
-- required owner_id/owner_email/name/slug and a lot more.
-- Bury Juice will reuse the row keyed by contact_email.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'businesses') THEN
    CREATE TABLE businesses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      address TEXT,
      stripe_customer_id TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX businesses_contact_email_idx ON businesses(contact_email);
  ELSE
    -- Businesses table exists (Nayba). Add Bury Juice-specific columns
    -- only if missing; leave existing columns untouched.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'businesses'
                     AND column_name = 'contact_email') THEN
      ALTER TABLE businesses ADD COLUMN contact_email TEXT;
      CREATE INDEX IF NOT EXISTS businesses_contact_email_idx ON businesses(contact_email);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'businesses'
                     AND column_name = 'contact_phone') THEN
      ALTER TABLE businesses ADD COLUMN contact_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'businesses'
                     AND column_name = 'stripe_customer_id') THEN
      ALTER TABLE businesses ADD COLUMN stripe_customer_id TEXT UNIQUE;
    END IF;
  END IF;
END $$;

-- ── bj_packs ────────────────────────────────────────────────────
-- Credit tracking for multi-placement purchases. Created first so
-- bj_bookings can reference it.
CREATE TABLE IF NOT EXISTS bj_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  size INTEGER NOT NULL CHECK (size IN (1, 4, 12)),
  credits_remaining INTEGER NOT NULL,
  amount_paid_gbp INTEGER NOT NULL,
  stripe_payment_intent TEXT NOT NULL,
  dashboard_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bj_packs_dashboard_token_idx ON bj_packs(dashboard_token);
CREATE INDEX IF NOT EXISTS bj_packs_business_id_idx ON bj_packs(business_id);

-- ── bj_bookings ─────────────────────────────────────────────────
-- One row per placement. UNIQUE(tier, issue_date) is the hard guard
-- against double-booking a slot even if two checkouts race.
CREATE TABLE IF NOT EXISTS bj_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  issue_date DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('paid_storefront', 'paid_legacy', 'comp')),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending_creative', 'cancelled')),
  pack_id UUID REFERENCES bj_packs(id),
  amount_paid_gbp INTEGER,
  stripe_payment_intent TEXT,

  headline TEXT,
  body_copy TEXT,
  cta_url TEXT,
  image_url TEXT,
  logo_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tier, issue_date)
);
CREATE INDEX IF NOT EXISTS bj_bookings_issue_date_idx ON bj_bookings(issue_date);
CREATE INDEX IF NOT EXISTS bj_bookings_business_id_idx ON bj_bookings(business_id);
CREATE INDEX IF NOT EXISTS bj_bookings_status_idx ON bj_bookings(status);

-- ── bj_legacy_rates ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bj_legacy_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  monthly_rate_gbp INTEGER NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'monthly',
  is_comp BOOLEAN DEFAULT FALSE,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Updated-at trigger helpers (idempotent) ─────────────────────
CREATE OR REPLACE FUNCTION bj_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bj_bookings_set_updated_at ON bj_bookings;
CREATE TRIGGER bj_bookings_set_updated_at
  BEFORE UPDATE ON bj_bookings
  FOR EACH ROW EXECUTE FUNCTION bj_set_updated_at();

-- ── Row-level security ──────────────────────────────────────────
-- The storefront talks to these tables only via service-role keys
-- from serverless routes, so RLS is locked down to deny anon access.
ALTER TABLE bj_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bj_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bj_legacy_rates ENABLE ROW LEVEL SECURITY;

-- Anon can read availability only (specific columns) via a view
DROP POLICY IF EXISTS bj_bookings_availability_read ON bj_bookings;
CREATE POLICY bj_bookings_availability_read ON bj_bookings
  FOR SELECT TO anon
  USING (status != 'cancelled');
