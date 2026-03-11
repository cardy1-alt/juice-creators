/*
  # Add location fields to businesses

  1. Changes
    - Add `address` column to businesses table
    - Add `city` column to businesses table
    - Add `state` column to businesses table
    - Add `zipcode` column to businesses table
*/

ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zipcode text;
