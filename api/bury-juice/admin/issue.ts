import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminPasswordOk, jsonError, supabaseFetch } from '../_lib';
import type { BjBooking } from '../../../src/lib/bury-juice/types';

// GET /api/bury-juice/admin/issue?date=2026-05-07
// Returns all three tier slots for that Thursday, including the
// business behind each booking. The frontend uses this to render the
// copy-paste HTML view.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');
  if (!adminPasswordOk(req)) return jsonError(res, 401, 'Unauthorized');

  const { date } = req.query as { date?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError(res, 400, 'date required');

  try {
    const bookings = await supabaseFetch<BjBooking[]>(
      `bj_bookings?issue_date=eq.${date}&status=neq.cancelled`,
    );
    const businessIds = Array.from(new Set(bookings.map((b) => b.business_id)));
    const businesses =
      businessIds.length === 0
        ? []
        : await supabaseFetch<{ id: string; name: string; contact_email: string }[]>(
            `businesses?select=id,name,contact_email&id=in.(${businessIds.join(',')})`,
          );
    const byId: Record<string, { id: string; name: string; contact_email: string }> = {};
    for (const b of businesses) byId[b.id] = b;

    const slots = (['gold', 'silver', 'bronze'] as const).map((tier) => {
      const booking = bookings.find((b) => b.tier === tier) ?? null;
      const business = booking ? byId[booking.business_id] ?? null : null;
      return { tier, booking, business };
    });

    res.status(200).json({ issue_date: date, slots });
  } catch (err) {
    console.error('[bj/admin/issue]', err);
    jsonError(res, 500, err instanceof Error ? err.message : 'Internal error');
  }
}
