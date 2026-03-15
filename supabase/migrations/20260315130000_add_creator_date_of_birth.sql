-- Add date_of_birth column to creators table
ALTER TABLE creators ADD COLUMN IF NOT EXISTS date_of_birth date;
