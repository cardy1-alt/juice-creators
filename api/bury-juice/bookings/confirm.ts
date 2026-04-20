import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonError, supabaseFetch } from '../_lib';

// GET /api/bury-juice/bookings/confirm?session_id=cs_xxx
// Cheap lookup from the post-Stripe redirect so the success page can
// show the dashboard link immediately. The webhook is the source of
// truth for row state — this is just a convenience.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');

  const { session_id } = req.query as { session_id?: string };
  if (!session_id) return jsonError(res, 400, 'session_id is required');

  try {
    // Ask Stripe for the session so we can read its metadata without
    // requiring the customer to wait for our webhook.
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return jsonError(res, 500, 'Stripe is not configured');
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!stripeRes.ok) return jsonError(res, 500, `Stripe lookup failed: ${stripeRes.status}`);
    const session = (await stripeRes.json()) as {
      metadata?: { dashboard_token?: string; pack_id?: string };
    };
    const token = session.metadata?.dashboard_token;
    if (!token) return jsonError(res, 404, 'Pack not found');

    // Sanity-check against our DB.
    const packs = await supabaseFetch<{ id: string }[]>(
      `bj_packs?select=id&dashboard_token=eq.${encodeURIComponent(token)}&limit=1`,
    );
    if (packs.length === 0) return jsonError(res, 404, 'Pack not found');

    const origin = `https://${req.headers.host}`;
    res.status(200).json({ dashboardUrl: `${origin}/sponsor/dashboard/${token}` });
  } catch (err) {
    console.error('[bj/bookings/confirm]', err);
    jsonError(res, 500, err instanceof Error ? err.message : 'Internal error');
  }
}
