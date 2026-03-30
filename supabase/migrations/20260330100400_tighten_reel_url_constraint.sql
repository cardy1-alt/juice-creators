/*
  # Tighten reel_url CHECK constraint

  The previous constraint accepted any Instagram URL. This tightens it to
  only accept reel URLs: https://instagram.com/reel/<id>
*/

ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_reel_url_instagram_check;

ALTER TABLE claims
ADD CONSTRAINT claims_reel_url_instagram_check
CHECK (reel_url IS NULL OR reel_url ~* '^https://(www\.)?instagram\.com/reel/[A-Za-z0-9_-]+/?');
