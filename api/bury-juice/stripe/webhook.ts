import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';
import { jsonError, supabaseFetch } from '../_lib.js';
import { adminNotificationHTML } from '../../../src/lib/bury-juice/email-templates.js';

// POST /api/bury-juice/stripe/webhook
// Handles checkout.session.completed — flips bookings to 'confirmed'
// and emails Jacob that a booking landed. Stripe's own receipt covers
// the sponsor-side confirmation, so we don't duplicate it.
// Notion sync runs best-effort if NOTION_* env vars are set.

// Vercel gives us the raw body via a config export; see below.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(payload: Buffer, header: string, secret: string): boolean {
  // Stripe signature: t=timestamp,v1=signature[,v1=...]
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.split('=').map((s) => s.trim()) as [string, string]),
  );
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;
  const signed = `${ts}.${payload.toString('utf8')}`;
  const expected = createHmac('sha256', secret).update(signed).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

async function sendResendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // nayba.app is the verified sending domain; Bury Juice is the
      // display name in the recipient's inbox.
      from: 'Bury Juice <hello@nayba.app>',
      to,
      subject,
      html,
    }),
  }).catch((e) => console.error('[bj/webhook] resend failed', e));
}

async function writeToNotion(args: {
  businessName: string;
  tier: string;
  issueDate: string;
  amountPaidGbp: number;
  source: string;
}) {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_BURY_JUICE_BOOKINGS_DB_ID;
  if (!token || !dbId) return;
  await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        Business: { title: [{ text: { content: args.businessName } }] },
        Tier: { select: { name: args.tier } },
        'Issue Date': { date: { start: args.issueDate } },
        'Amount Paid': { number: args.amountPaidGbp / 100 },
        Source: { select: { name: args.source } },
      },
    }),
  }).catch((e) => console.error('[bj/webhook] notion failed', e));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  const raw = await readRawBody(req);
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || typeof sig !== 'string' || !verifySignature(raw, sig, secret)) {
    return jsonError(res, 400, 'Invalid signature');
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return jsonError(res, 400, 'Invalid JSON');
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session = event.data.object as {
    id: string;
    payment_intent: string;
    amount_total: number;
    metadata?: {
      pack_id?: string;
      business_id?: string;
      tier?: 'classified' | 'feature' | 'primary';
      size?: string;
      dashboard_token?: string;
    };
  };
  const packId = session.metadata?.pack_id;
  const tier = session.metadata?.tier;
  const size = session.metadata?.size ? Number(session.metadata.size) : 1;
  if (!packId || !tier) {
    return jsonError(res, 400, 'Missing metadata on checkout session');
  }

  try {
    // 1. Mark pack paid with the real payment intent.
    await supabaseFetch(`bj_packs?id=eq.${packId}`, {
      method: 'PATCH',
      body: JSON.stringify({ stripe_payment_intent: session.payment_intent ?? session.id }),
    });
    // 2. Confirm bookings belonging to this pack.
    await supabaseFetch(`bj_bookings?pack_id=eq.${packId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'confirmed',
        stripe_payment_intent: session.payment_intent ?? session.id,
      }),
    });

    // 3. Fetch pack + business — admin notification only; Stripe's
    //    own receipt covers the sponsor-side confirmation.
    const packs = await supabaseFetch<
      {
        id: string;
        business_id: string;
        amount_paid_gbp: number;
        tier: 'classified' | 'feature' | 'primary';
        size: number;
      }[]
    >(`bj_packs?id=eq.${packId}&limit=1`);
    const pack = packs[0];
    const businesses = await supabaseFetch<
      { id: string; name: string }[]
    >(`businesses?select=id,name&id=eq.${pack.business_id}&limit=1`);
    const business = businesses[0];

    const adminEmail = process.env.ADMIN_EMAIL || 'hello@nayba.app';
    const adminUrl = `https://${req.headers.host}/`;
    await sendResendEmail(
      adminEmail,
      `New Bury Juice booking: ${business.name} — ${tier.toUpperCase()} — £${(pack.amount_paid_gbp / 100).toFixed(0)}`,
      adminNotificationHTML({
        businessName: business.name,
        tier: pack.tier,
        size: pack.size as 1 | 4 | 12,
        amountPaidGbp: pack.amount_paid_gbp,
        adminUrl,
      }),
    );

    // 4. Notion sync (best-effort, one row per booking).
    if (process.env.NOTION_TOKEN && process.env.NOTION_BURY_JUICE_BOOKINGS_DB_ID) {
      const bookings = await supabaseFetch<{ id: string; issue_date: string }[]>(
        `bj_bookings?select=id,issue_date&pack_id=eq.${packId}`,
      );
      for (const b of bookings) {
        await writeToNotion({
          businessName: business.name,
          tier: pack.tier,
          issueDate: b.issue_date,
          amountPaidGbp: Math.round(pack.amount_paid_gbp / Math.max(1, size)),
          source: 'paid_storefront',
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[bj/webhook]', err);
    jsonError(res, 500, err instanceof Error ? err.message : 'Internal error');
  }
}
