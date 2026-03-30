import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Cron handler — invokes the Supabase Edge Function
 * `check-overdue-reels` every hour (see vercel.json crons config).
 *
 * Required env vars (set in Vercel dashboard):
 *   SUPABASE_URL           — e.g. https://xyz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service-role secret (never expose client-side)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow Vercel Cron (sends this header) or manual invocation with auth
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  // Vercel Cron jobs include the CRON_SECRET automatically when configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/check-overdue-reels`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Edge function error:', data);
      return res.status(response.status).json({ error: 'Edge function failed', details: data });
    }

    return res.status(200).json({ ok: true, ...data });
  } catch (err: any) {
    console.error('Failed to invoke check-overdue-reels:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
