/*
  # Add bio and location fields to businesses table

  1. Changes
    - Add `bio` (text, nullable) for business description
    - Add `latitude` (double precision, nullable) for map display
    - Add `longitude` (double precision, nullable) for map display

  2. Notes
    - Uses IF NOT EXISTS pattern to safely add columns
    - Allows null values for these fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'bio'
  ) THEN
    ALTER TABLE businesses ADD COLUMN bio text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE businesses ADD COLUMN latitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE businesses ADD COLUMN longitude double precision;
  END IF;
END $$;
