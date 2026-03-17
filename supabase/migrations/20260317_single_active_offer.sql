-- Business onboarding tracking columns
-- Note: offers table already has is_live and monthly_cap columns

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
