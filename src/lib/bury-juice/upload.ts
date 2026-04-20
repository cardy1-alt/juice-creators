// Upload a sponsor-creative file (Feature photo / Primary logo) to
// the `bj-creative` Supabase Storage bucket and return its public URL.
//
// The storefront is pre-auth (no Nayba login before checkout), so we
// push with the anon key; RLS on storage.objects limits the blast
// radius to this bucket, and Supabase's bucket-level MIME / size
// limits reject anything unexpected at the edge.

import { supabase } from '../supabase';

const BUCKET = 'bj-creative';

function safeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '') // strip extension; we re-add it below
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'file';
}

function fileExt(file: File): string {
  const fromName = file.name.match(/\.([A-Za-z0-9]+)$/)?.[1];
  if (fromName) return fromName.toLowerCase();
  // Fallback to mime type when the filename has no extension.
  const fromMime = file.type.split('/')[1];
  return (fromMime || 'bin').toLowerCase();
}

export async function uploadCreativeFile(
  file: File,
  kind: 'photo' | 'logo',
): Promise<string> {
  const ext = fileExt(file);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${kind}s/${stamp}-${rand}-${safeSlug(file.name)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || undefined,
      upsert: false,
    });
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
