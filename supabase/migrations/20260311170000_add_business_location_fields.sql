-- Add location and profile fields to businesses (all nullable, non-breaking)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS bio text;
