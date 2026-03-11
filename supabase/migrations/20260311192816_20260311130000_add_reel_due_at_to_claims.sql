/*
  # Add reel_due_at to claims

  1. Changes
    - Add `reel_due_at` column to claims table
    - Tracks when reel submission is due (48 hours after redemption)
*/

ALTER TABLE claims 
ADD COLUMN IF NOT EXISTS reel_due_at timestamptz;
