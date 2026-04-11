import { supabase } from './supabase';

const BUCKET = 'brand-assets';

/**
 * Upload an image to Supabase Storage and return the public URL.
 * Files are stored under folder/timestamp-filename to avoid collisions.
 */
export async function uploadImage(
  file: File,
  folder: 'logos' | 'campaigns'
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
