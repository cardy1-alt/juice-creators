/*
  # Bury Juice — sponsor creative storage bucket

  Stores Feature photos and Primary logos uploaded by sponsors from
  the public storefront. The sponsor storefront has no login, so
  uploads happen with the anon key — RLS is scoped to this bucket
  only. File size / MIME limits are enforced by Storage itself.

  If this migration fails because your Supabase instance doesn't
  allow INSERT into storage.buckets via SQL (rare but documented),
  fall back to the dashboard:
    Dashboard → Storage → New Bucket
      Name: bj-creative
      Public: true
      File size limit: 5 MB
      Allowed MIME types: image/jpeg, image/png, image/webp, image/svg+xml
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bj-creative',
  'bj-creative',
  true,
  5242880, -- 5 MB, matches the client-side cap documented in the spec
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public              = EXCLUDED.public,
  file_size_limit     = EXCLUDED.file_size_limit,
  allowed_mime_types  = EXCLUDED.allowed_mime_types;

-- RLS: anon can write into the bucket (the storefront is public,
-- there's no login before checkout) and anyone can read. The policies
-- are scoped so they only ever apply to this specific bucket.

DROP POLICY IF EXISTS "bj_creative_anon_insert" ON storage.objects;
CREATE POLICY "bj_creative_anon_insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'bj-creative');

DROP POLICY IF EXISTS "bj_creative_public_read" ON storage.objects;
CREATE POLICY "bj_creative_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'bj-creative');
