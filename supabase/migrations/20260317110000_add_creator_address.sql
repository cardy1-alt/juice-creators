-- Add address fields to creators for local offer matching
ALTER TABLE creators ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS longitude double precision;
