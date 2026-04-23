-- ═══════════════════════════════════════════════════════════════
-- NAYBA — applications.previously_selected_at
--
-- Once a pending selection is cleared (by the auto-decline cron, by
-- the admin manually declining, or by "Return to reserves"), nothing
-- on the row tells us the creator was ever selected. Result: the
-- admin can accidentally re-pick a creator who already ghosted a
-- selection on the same campaign.
--
-- Add a nullable timestamp that records the last time this row held
-- status='selected'. UI uses it to flag reserves/declines as
-- "previously didn't confirm"; cron + decline flows populate it on
-- every selected→X transition going forward.
--
-- Backfill covers the two historical states:
--   1. Already auto-declined rows — copy selected_at across.
--   2. Manually returned-to-reserves rows — trace through the
--      selection_expired notification row created at expiry time.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS previously_selected_at TIMESTAMPTZ;

COMMENT ON COLUMN applications.previously_selected_at IS
  'Last time this application held status=selected. Non-null on rows '
  'where the creator was picked but did not confirm (either the 48h '
  'window expired or the admin/brand manually retired the selection). '
  'UI uses this to warn the admin when a reserve has ghosted before.';

-- 1. Auto-declined rows: selected_at is still populated on these.
UPDATE applications
   SET previously_selected_at = selected_at
 WHERE status = 'declined'
   AND selected_at IS NOT NULL
   AND previously_selected_at IS NULL;

-- 2. Manually returned-to-reserves: selected_at was cleared, but a
-- selection_expired notification will have been written when we
-- retrofitted those rows. Use the notification's created_at as a
-- reasonable proxy for "the moment the selection was retired".
UPDATE applications ap
   SET previously_selected_at = n.created_at
  FROM notifications n
 WHERE n.email_type = 'selection_expired'
   AND n.user_id = ap.creator_id
   AND n.campaign_id = ap.campaign_id
   AND ap.previously_selected_at IS NULL;
