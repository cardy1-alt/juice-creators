import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminPasswordOk, jsonError, supabaseFetch } from '../_lib.js';

// GET /api/bury-juice/admin/overview
// Returns bookings, businesses map, revenue totals, active packs.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');
  if (!adminPasswordOk(req)) return jsonError(res, 401, 'Unauthorized');

  try {
    const bookings = await supabaseFetch<
      {
        id: string;
        business_id: string;
        tier: 'classified' | 'feature' | 'primary';
        issue_date: string;
        status: string;
        source: string;
        amount_paid_gbp: number | null;
        headline: string | null;
      }[]
    >('bj_bookings?select=*&order=issue_date.asc');

    const businessIds = Array.from(new Set(bookings.map((b) => b.business_id)));
    const businessRows =
      businessIds.length === 0
        ? []
        : await supabaseFetch<{ id: string; name: string; contact_email: string }[]>(
            `businesses?select=id,name,contact_email&id=in.(${businessIds.join(',')})`,
          );
    const businesses: Record<string, { id: string; name: string; contact_email: string }> = {};
    for (const b of businessRows) businesses[b.id] = b;

    // Revenue calcs — month/quarter/YTD (this year, UK-centric month
    // boundaries good enough for v1).
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let month = 0;
    let quarter = 0;
    let ytd = 0;
    for (const b of bookings) {
      if (b.source === 'comp' || !b.amount_paid_gbp) continue;
      const d = new Date(b.issue_date);
      if (d >= startOfYear) ytd += b.amount_paid_gbp;
      if (d >= startOfQuarter) quarter += b.amount_paid_gbp;
      if (d >= startOfMonth) month += b.amount_paid_gbp;
    }

    const packs = await supabaseFetch<
      {
        id: string;
        business_id: string;
        tier: 'classified' | 'feature' | 'primary';
        size: number;
        credits_remaining: number;
      }[]
    >('bj_packs?select=id,business_id,tier,size,credits_remaining&credits_remaining=gt.0');

    const activePacks = packs.map((p) => ({
      ...p,
      business_name: businesses[p.business_id]?.name ?? '(unknown)',
    }));

    res.status(200).json({
      bookings,
      businesses,
      revenue: { month, quarter, ytd },
      activePacks,
    });
  } catch (err) {
    console.error('[bj/admin/overview]', err);
    jsonError(res, 500, err instanceof Error ? err.message : 'Internal error');
  }
}
