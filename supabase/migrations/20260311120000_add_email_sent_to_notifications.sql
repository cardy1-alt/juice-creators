-- Add email_sent flag to prevent duplicate email sends
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;
