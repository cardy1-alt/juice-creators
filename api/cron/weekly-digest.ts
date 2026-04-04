import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Cron handler — weekly digest email (Tuesdays 8am).
 * Sends each approved creator a summary of active campaigns in their city.
 *
 * TODO(jacob): This is a stub. The full implementation requires:
 *   1. A Supabase Edge Function `weekly-digest` that:
 *      - Fetches all active/live campaigns
 *      - Groups by target_city
 *      - For each approved creator, inserts a notification with
 *        email_type='weekly_digest' and email_meta containing
 *        the campaigns matching their city
 *   2. An email template in send-email/index.ts for 'weekly_digest'
 *
 * For now this handler returns 200 to prevent cron 404 errors.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Stub: log and return success
  console.log('[weekly-digest] Cron triggered — stub handler, no emails sent yet');
  return res.status(200).json({ ok: true, message: 'Weekly digest not yet implemented — stub handler' });
}
