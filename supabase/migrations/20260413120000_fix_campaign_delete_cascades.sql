-- Fix campaign delete failures.
--
-- participations.campaign_id had no ON DELETE CASCADE, so deleting a campaign
-- with any participation row would fail with a foreign key violation. The
-- admin UI used to swallow the error and appear as if the delete succeeded
-- (it didn't).
--
-- notifications.campaign_id had no cascade behaviour either. We SET NULL
-- rather than cascade so the notification history is preserved for the
-- Activity audit feed even after the campaign is gone.
--
-- applications.campaign_id already had ON DELETE CASCADE — unchanged.

-- participations.campaign_id → ON DELETE CASCADE
ALTER TABLE participations
  DROP CONSTRAINT IF EXISTS participations_campaign_id_fkey;

ALTER TABLE participations
  ADD CONSTRAINT participations_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- notifications.campaign_id → ON DELETE SET NULL (keep the row for audit)
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_campaign_id_fkey;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
