-- Add instagram_handle column to businesses table
-- Referenced by BusinessOnboarding and BusinessPortal but was never created
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS instagram_handle text;
