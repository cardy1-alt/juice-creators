-- Add email_type and email_meta columns to notifications table
-- email_type: identifies the template to use (e.g. 'creator_welcome', 'new_claim_business')
-- email_meta: JSON metadata for template variables (e.g. offer_title, business_name)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_type text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_meta jsonb DEFAULT '{}';

-- Create feedback table for in-app feedback submissions
CREATE TABLE IF NOT EXISTS feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('creator', 'business')),
  display_name text,
  page text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert feedback" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Admin can read all feedback
CREATE POLICY "Admin full access to feedback" ON feedback
  FOR ALL TO authenticated
  USING (auth.jwt()->>'email' = 'admin@juicecreators.com')
  WITH CHECK (auth.jwt()->>'email' = 'admin@juicecreators.com');
