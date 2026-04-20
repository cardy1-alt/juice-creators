import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonError, supabaseFetch } from './_lib.js';

// GET /api/bury-juice/dashboard?token=xxx
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');
  const { token } = req.query as { token?: string };
  if (!token) return jsonError(res, 400, 'token is required');

  try {
    const packs = await supabaseFetch<
      {
        id: string;
        business_id: string;
        tier: 'classified' | 'feature' | 'primary';
        size: number;
        credits_remaining: number;
        amount_paid_gbp: number;
        stripe_payment_intent: string;
        dashboard_token: string;
        expires_at: string;
        created_at: string;
      }[]
    >(`bj_packs?dashboard_token=eq.${encodeURIComponent(token)}&limit=1`);
    if (packs.length === 0) return jsonError(res, 404, 'Not found');
    const pack = packs[0];

    const businesses = await supabaseFetch<
      { id: string; name: string; contact_email: string }[]
    >(`businesses?select=id,name,contact_email&id=eq.${pack.business_id}&limit=1`);
    const business = businesses[0];

    const bookings = await supabaseFetch(
      `bj_bookings?pack_id=eq.${pack.id}&order=issue_date.asc`,
    );

    res.status(200).json({ pack, business, bookings });
  } catch (err) {
    console.error('[bj/dashboard]', err);
    jsonError(res, 500, err instanceof Error ? err.message : 'Internal error');
  }
}
