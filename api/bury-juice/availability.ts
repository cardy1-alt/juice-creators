import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonError, supabaseFetch } from './_lib';
import { buildAvailability } from '../../src/lib/bury-juice/availability';
import type { BjTier } from '../../src/lib/bury-juice/pricing';

// GET /api/bury-juice/availability?tier=gold&from=2026-04-23&to=2026-10-22
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return jsonError(res, 405, 'Method not allowed');

  const { tier, from, to } = req.query as { tier?: BjTier; from?: string; to?: string };
  if (!tier || !from || !to) return jsonError(res, 400, 'tier, from, and to are required');
  if (!['bronze', 'silver', 'gold'].includes(tier)) return jsonError(res, 400, 'invalid tier');

  try {
    const bookings = await supabaseFetch<{ tier: BjTier; issue_date: string; status: string }[]>(
      `bj_bookings?select=tier,issue_date,status&tier=eq.${tier}&issue_date=gte.${from}&issue_date=lte.${to}&status=neq.cancelled`,
    );
    const entries = buildAvailability(
      tier,
      new Date(from),
      new Date(to),
      bookings.map((b) => ({ tier: b.tier, issue_date: b.issue_date })),
    );
    res.status(200).json({ entries });
  } catch (err) {
    console.error('[bj/availability]', err);
    jsonError(res, 500, err instanceof Error ? err.message : 'Internal error');
  }
}
