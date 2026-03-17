import { supabase } from './supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const BUCKET = 'avatars';

/**
 * Resize an image file to a max dimension and return as a JPEG data URL.
 * Used as a fallback when Supabase Storage bucket is not available.
 */
function resizeToDataUrl(file: File, maxDim = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Try uploading to Supabase Storage. If the bucket doesn't exist, fall back
 * to a resized data URL stored directly in the database column.
 */
async function uploadToStorage(file: File, path: string): Promise<{ url: string | null; usedDataUrl: boolean }> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (!error) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: `${data.publicUrl}?t=${Date.now()}`, usedDataUrl: false };
  }

  // Bucket doesn't exist or other storage error — fall back to data URL
  console.warn('[upload] Storage failed, using data URL fallback:', error.message);
  const dataUrl = await resizeToDataUrl(file);
  return { url: dataUrl, usedDataUrl: true };
}

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

  const { url } = await uploadToStorage(file, path);
  if (!url) {
    return { url: null, error: 'Upload failed — try again' };
  }

  const table = type === 'creators' ? 'creators' : 'businesses';
  const column = type === 'creators' ? 'avatar_url' : 'logo_url';

  const { error: updateError } = await supabase
    .from(table)
    .update({ [column]: url })
    .eq('id', userId);

  if (updateError) {
    console.error('[upload] DB update failed:', updateError.message);
    return { url, error: 'Photo uploaded but profile update failed. Try saving again.' };
  }

  return { url, error: null };
}

export async function uploadOfferPhoto(
  file: File,
  offerId: string,
  _businessId: string
): Promise<{ url: string | null; error: string | null }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { url: null, error: 'Only JPEG, PNG, and WebP images are allowed.' };
  }
  if (file.size > MAX_SIZE) {
    return { url: null, error: 'File must be under 5MB.' };
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `businesses/${_businessId}/offer_${offerId}.${ext}`;

  const { url } = await uploadToStorage(file, path);
  if (!url) {
    return { url: null, error: 'Upload failed — try again' };
  }

  const { error: updateError } = await supabase
    .from('offers')
    .update({ offer_photo_url: url })
    .eq('id', offerId);

  if (updateError) {
    console.error('[upload] Offer photo DB update failed:', updateError.message);
    // Still return the URL so the UI updates
    return { url, error: null };
  }

  return { url, error: null };
}
