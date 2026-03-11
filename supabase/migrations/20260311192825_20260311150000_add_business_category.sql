/*
  # Add category to businesses

  1. Changes
    - Add `category` column to businesses table
    - Defaults to 'Food & Drink' for existing businesses
*/

ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Food & Drink';
