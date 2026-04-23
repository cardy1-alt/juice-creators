-- ═══════════════════════════════════════════════════════════════
-- NAYBA — per-participation content deadline override
--
-- Campaigns carry a single `content_deadline` that applies to every
-- confirmed creator. In practice brands sometimes negotiate an
-- extended filming date with an individual creator (appointment-
-- based perks, holiday overlap, family scheduling). Storing that
-- agreement against the participation lets the creator and the
-- overdue-reels cron both see the extended date without moving the
-- campaign deadline for everyone else.
--
-- NULL means "no override — use the campaign deadline".
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE participations
  ADD COLUMN IF NOT EXISTS content_deadline_override TIMESTAMPTZ;

COMMENT ON COLUMN participations.content_deadline_override IS
  'Optional per-creator override of campaigns.content_deadline. When set, '
  'the creator sees this date in the UI and the overdue-reels cron uses it '
  'instead of the campaign-wide deadline.';
