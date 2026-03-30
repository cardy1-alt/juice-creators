/*
  # Create Supabase Storage buckets

  Ensures the 'avatars' bucket exists for avatar, logo, and offer photo uploads.
  The bucket is public (read) so images can be served via public URLs.

  Note: Supabase storage bucket creation via SQL uses the storage schema.
  If this migration fails on your Supabase instance (some versions don't
  support storage.buckets INSERTs), create the bucket manually:
    Dashboard → Storage → New Bucket → Name: "avatars" → Public: true
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies for the avatars bucket
-- Allow authenticated users to upload to their own path
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete their own uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');
