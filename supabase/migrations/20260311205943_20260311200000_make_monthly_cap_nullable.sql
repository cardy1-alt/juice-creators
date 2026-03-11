/*
  # Make monthly_cap nullable (unlimited offers)

  Allow offers to have no monthly cap (null = unlimited).
  Existing offers with a cap set are unaffected.
  New offers default to null (unlimited).
*/

-- Remove any NOT NULL constraint and set default to null
ALTER TABLE offers ALTER COLUMN monthly_cap DROP NOT NULL;
ALTER TABLE offers ALTER COLUMN monthly_cap SET DEFAULT null;
