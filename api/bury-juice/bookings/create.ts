import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  addMonths,
  generateDashboardToken,
  jsonError,
  priceIdFor,
  stripeCall,
  supabaseFetch,
} from '../_lib';
import {
  BJ_PRICING,
  PACK_EXPIRY_MONTHS,
  priceForTierAndSize,
  type BjPackSize,
  type BjTier,
} from '../../../src/lib/bury-juice/pricing';

interface CreativePayload {
  business_name: string;
  contact_email: string;
  contact_phone: string | null;
  headline: string;
  body_copy: string;
  cta_url: string;
  image_filename: string | null;
  logo_filename: string | null;
}

interface RequestBody {
  tier: BjTier;
  size: BjPackSize;
  dates: string[];
  pickLater: boolean;
  creative: CreativePayload;
}

// POST /api/bury-juice/bookings/create
// Creates the businesses/packs/bookings rows (pending_creative until the
// webhook confirms payment) and returns a Stripe Checkout URL.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  let body: RequestBody;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as RequestBody);
  } catch {
    return jsonError(res, 400, 'Invalid JSON');
  }

  const { tier, size, dates, pickLater, creative } = body;
  if (!['bronze', 'silver', 'gold'].includes(tier)) return jsonError(res, 400, 'invalid tier');
  if (![1, 4, 12].includes(size)) return jsonError(res, 400, 'invalid size');
  if (!pickLater && dates.length !== size) {
    return jsonError(res, 400, `expected ${size} dates, got ${dates.length}`);
  }
  if (!creative?.contact_email || !creative.business_name || !creative.headline) {
    return jsonError(res, 400, 'creative is incomplete');
  }
  if (creative.body_copy.length > BJ_PRICING[tier].bodyCharLimit) {
    return jsonError(res, 400, 'body copy exceeds char limit');
  }

  try {
    // 1. Find or create the business row. We match by contact_email.
    const existing = await supabaseFetch<{ id: string }[]>(
      `businesses?select=id&contact_email=eq.${encodeURIComponent(creative.contact_email)}&limit=1`,
    );
    let businessId: string;
    if (existing.length > 0) {
      businessId = existing[0].id;
    } else {
      const inserted = await supabaseFetch<{ id: string }[]>('businesses', {
        method: 'POST',
        body: JSON.stringify({
          name: creative.business_name,
          contact_email: creative.contact_email,
          contact_phone: creative.contact_phone,
        }),
      });
      businessId = inserted[0].id;
    }

    // 2. Create the pack row — credits_remaining decremented below as
    //    we insert bookings. Dashboard token returned in the email.
    const token = generateDashboardToken();
    const expiresAt = addMonths(new Date(), PACK_EXPIRY_MONTHS).toISOString();
    const amountPaid = priceForTierAndSize(tier, size);

    const pack = await supabaseFetch<
      { id: string; dashboard_token: string }[]
    >('bj_packs', {
      method: 'POST',
      body: JSON.stringify({
        business_id: businessId,
        tier,
        size,
        credits_remaining: size - (pickLater ? 0 : dates.length),
        amount_paid_gbp: amountPaid,
        stripe_payment_intent: 'pending',
        dashboard_token: token,
        expires_at: expiresAt,
      }),
    });
    const packId = pack[0].id;

    // 3. Create bookings for each chosen date (status starts as
    //    'pending_creative' — webhook flips to 'confirmed'). Each
    //    row gets the creative fields attached.
    if (!pickLater && dates.length > 0) {
      const rows = dates.map((d) => ({
        business_id: businessId,
        tier,
        issue_date: d,
        source: 'paid_storefront',
        status: 'pending_creative',
        pack_id: packId,
        amount_paid_gbp: Math.round(amountPaid / size),
        headline: creative.headline,
        body_copy: creative.body_copy,
        cta_url: creative.cta_url,
        // image_url / logo_url are written by the upload step — for
        // v1 we store the filename hint so Jacob knows what to expect.
        image_url: creative.image_filename,
        logo_url: creative.logo_filename,
      }));
      await supabaseFetch('bj_bookings', {
        method: 'POST',
        body: JSON.stringify(rows),
      });
    }

    // 4. Stripe Checkout session.
    const origin = `https://${req.headers.host}`;
    const successUrl = `${origin}/sponsor/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/sponsor?cancelled=1`;
    const session = await stripeCall<{ id: string; url: string }>('checkout/sessions', {
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'line_items[0][price]': priceIdFor(tier, size),
      'line_items[0][quantity]': 1,
      'customer_email': creative.contact_email,
      'metadata[pack_id]': packId,
      'metadata[business_id]': businessId,
      'metadata[tier]': tier,
      'metadata[size]': String(size),
      'metadata[dashboard_token]': token,
    });

    res.status(200).json({ checkoutUrl: session.url, packId, dashboardToken: token });
  } catch (err) {
    console.error('[bj/bookings/create]', err);
    jsonError(res, 500, err instanceof Error ? err.message : 'Internal error');
  }
}
