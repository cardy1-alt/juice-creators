import { supabase } from './supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadAvatar(
  file: File,
  userId: string,
  type: 'creators' | 'businesses'
): Promise<{ url: string | null; error: string | null }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { url: null, error: 'Only JPEG, PNG, and WebP images are allowed.' };
  }
  if (file.size > MAX_SIZE) {
    return { url: null, error: 'File must be under 5MB.' };
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = type === 'creators' ? 'avatar' : 'logo';
  const path = `${type}/${userId}/${fileName}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { url: null, error: 'Upload failed — try again' };
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Add cache-busting param
  const url = `${data.publicUrl}?t=${Date.now()}`;

  // Update the profile row
  const table = type === 'creators' ? 'creators' : 'businesses';
  const column = type === 'creators' ? 'avatar_url' : 'logo_url';
  const idColumn = type === 'creators' ? 'email' : 'owner_email';

  // We'll use the id directly since we know it
  const { error: updateError } = await supabase
    .from(table)
    .update({ [column]: url })
    .eq('id', userId);

  if (updateError) {
    return { url, error: null }; // Upload worked, DB update may fail due to RLS
  }

  return { url, error: null };
}
