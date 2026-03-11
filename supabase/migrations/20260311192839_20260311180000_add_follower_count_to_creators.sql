/*
  # Add follower_count to creators

  1. Changes
    - Add `follower_count` column to creators table
    - Defaults to 0
*/

ALTER TABLE creators 
ADD COLUMN IF NOT EXISTS follower_count integer DEFAULT 0;
