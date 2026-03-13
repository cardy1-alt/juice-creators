/*
  # Add onboarding completion tracking to creators

  1. Changes
    - Add `onboarding_complete` boolean column to creators table
    - Defaults to false for new creators
    - Existing creators default to true (grandfather them in)

  2. Notes
    - Non-breaking change
    - Allows tracking whether a creator has completed first-time onboarding
*/

ALTER TABLE creators ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- Set existing approved creators to already onboarded
UPDATE creators SET onboarding_complete = true WHERE approved = true;
