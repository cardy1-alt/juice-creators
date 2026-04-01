-- Add disapproved column to creators and businesses tables
ALTER TABLE creators ADD COLUMN IF NOT EXISTS disapproved boolean DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS disapproved boolean DEFAULT false;
