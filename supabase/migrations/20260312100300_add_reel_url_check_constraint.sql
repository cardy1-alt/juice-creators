/*
  # Add CHECK constraint for reel_url on claims table

  Ensures reel URLs must be valid Instagram reel links.
  NULL values are allowed (reel not yet submitted).
*/

ALTER TABLE claims
ADD CONSTRAINT claims_reel_url_instagram_check
CHECK (reel_url IS NULL OR reel_url ~* '^https://(www\.)?instagram\.com/');
