-- Add follower_count column to creators (nullable, non-breaking)
ALTER TABLE creators ADD COLUMN IF NOT EXISTS follower_count text;
