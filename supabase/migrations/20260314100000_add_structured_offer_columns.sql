-- Add structured offer columns for the new offer builder
-- Keeps existing columns for backward compatibility

ALTER TABLE offers ADD COLUMN IF NOT EXISTS offer_type TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS offer_item TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'reel';
ALTER TABLE offers ADD COLUMN IF NOT EXISTS specific_ask TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS generated_title TEXT;

-- Backfill existing offers
UPDATE offers SET content_type = 'reel' WHERE content_type IS NULL;
UPDATE offers SET generated_title = description WHERE generated_title IS NULL;
