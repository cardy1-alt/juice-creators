-- Add reel_due_at column to claims (set to redeemed_at + 48 hours at point of redemption)
ALTER TABLE claims ADD COLUMN IF NOT EXISTS reel_due_at timestamptz;

-- Add overdue status support and index
CREATE INDEX IF NOT EXISTS idx_claims_reel_due_at ON claims(reel_due_at) WHERE status = 'redeemed' AND reel_url IS NULL;
