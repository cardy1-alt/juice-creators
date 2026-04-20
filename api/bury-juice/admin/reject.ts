import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminPasswordOk, jsonError, supabaseFetch } from '../_lib';
import { rejectionEmailHTML } from '../../../src/lib/bury-juice/email-templates';

// POST /api/bury-juice/admin/reject
// Flip a booking back to pending_creative and email the sponsor.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');
  if (!adminPasswordOk(req)) return jsonError(res, 401, 'Unauthorized');

  let body: { booking_id?: string; notes?: string };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as { booking_id?: string; notes?: string });
  } catch {
    return jsonError(res, 400, 'Invalid JSON');
  }
  const { booking_id, notes } = body;
  if (!booking_id || !notes) return jsonError(res, 400, 'booking_id and notes required');

  try {
    await supabaseFetch(`bj_bookings?id=eq.${booking_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pending_creative' }),
    });

    const rows = await supabaseFetch<
      {
        id: string;
        business_id: string;
        pack_id: string | null;
      }[]
    >(`bj_bookings?select=id,business_id,pack_id&id=eq.${booking_id}&limit=1`);
    if (rows.length === 0) return res.status(200).json({ ok: true });
    const booking = rows[0];

    const businesses = await supabaseFetch<
      { id: string; name: string; contact_email: string }[]
    >(`businesses?select=id,name,contact_email&id=eq.${booking.business_id}&limit=1`);
    const business = businesses[0];

    let dashboardUrl = `https://${req.headers.host}/sponsor`;
    if (booking.pack_id) {
      const packs = await supabaseFetch<{ dashboard_token: string }[]>(
        `bj_packs?select=dashboard_token&id=eq.${booking.pack_id}&limit=1`,
      );
      if (packs.length > 0) {
        dashboardUrl = `https://${req.headers.host}/sponsor/dashboard/${packs[0].dashboard_token}`;
      }
    }

    const key = process.env.RESEND_API_KEY;
    if (key) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Bury Juice <hello@buryjuice.com>',
          to: business.contact_email,
          subject: 'Quick tweak needed on your Bury Juice placement',
          html: rejectionEmailHTML({
            businessName: business.name,
            notes,
            dashboardUrl,
          }),
        }),
      }).catch((e) => console.error('[bj/admin/reject] resend failed', e));
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[bj/admin/reject]', err);
    jsonError(res, 500, err instanceof Error ? err.message : 'Internal error');
  }
}
