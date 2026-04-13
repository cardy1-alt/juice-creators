-- Add denied_at timestamp to distinguish denied from pending accounts.
--
-- Before this migration, denying a creator or brand set approved = false,
-- which is the same state as a fresh (pending) signup. As a result, the
-- "N awaiting approval" banner counted denied users as still pending.
--
-- With denied_at set, the admin UI filters pending = (!approved AND denied_at IS NULL).
-- Existing approved rows are unaffected (denied_at stays NULL).

ALTER TABLE creators ADD COLUMN IF NOT EXISTS denied_at timestamptz;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS denied_at timestamptz;

-- Indexes keep the pending-filter query cheap even as denied rows accumulate.
CREATE INDEX IF NOT EXISTS idx_creators_pending
  ON creators (approved)
  WHERE approved = false AND denied_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_pending
  ON businesses (approved)
  WHERE approved = false AND denied_at IS NULL;
