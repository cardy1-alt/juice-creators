/*
  # Add email_sent tracking to notifications

  1. Changes
    - Add `email_sent` column to notifications table
    - Defaults to false
    - Tracks whether notification email has been sent
*/

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;
