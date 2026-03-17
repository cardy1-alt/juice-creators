-- Single active offer model: add onboarding fields to businesses and active offer tracking to offers

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

ALTER TABLE offers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS monthly_slot_cap INTEGER DEFAULT 4;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS slots_used_this_month INTEGER DEFAULT 0;
