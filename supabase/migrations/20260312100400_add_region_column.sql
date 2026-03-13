/*
  # Add region column to businesses and creators

  Non-breaking migration to support future multi-region expansion.
  All existing rows default to 'bury-st-edmunds'.
*/

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'bury-st-edmunds';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'bury-st-edmunds';
