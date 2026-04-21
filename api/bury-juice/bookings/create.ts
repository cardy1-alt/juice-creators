import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  addMonths,
  generateDashboardToken,
  jsonError,
  priceIdFor,
  stripeCall,
  supabaseFetch,
} from '../_lib.js';
import {
  BJ_PRICING,
  PACK_EXPIRY_MONTHS,
  TIER_CAPACITY,
  priceForTierAndSize,
  type BjPackSize,
  type BjTier,
} from '../../../src/lib/bury-juice/pricing.js';

interface CreativePayload {
  business_name: string;
  contact_email: string;
  contact_phone: string | null;
  headline: string;
  body_copy: string;
  cta_url: string;
  // Public URLs from the Supabase Storage upload step — null if the
  // tier doesn't need them (Classified has no image, Feature has no
  // logo).
  image_url: string | null;
  logo_url: string | null;
}

interface RequestBody {
  tier: BjTier;
  size: BjPackSize;
  dates: string[];
  creative: CreativePayload;
}

// POST /api/bury-juice/bookings/create
// Creates the businesses/packs/bookings rows (pending_creative until
// the webhook confirms payment) and returns a Stripe Checkout
// client_secret for mounting an embedded checkout on the storefront.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return jsonError(res, 405, 'Method not allowed');

  let body: RequestBody;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as RequestBody);
  } catch {
    return jsonError(res, 400, 'Invalid JSON');
  }

  const { tier, size, dates, creative } = body;
  if (!['classified', 'feature', 'primary'].includes(tier)) return jsonError(res, 400, 'invalid tier');
  if (![1, 4, 12].includes(size)) return jsonError(res, 400, 'invalid size');
  if (dates.length !== size) {
    return jsonError(res, 400, `expected ${size} dates, got ${dates.length}`);
  }
  if (!creative?.contact_email || !creative.business_name || !creative.headline) {
    return jsonError(res, 400, 'creative is incomplete');
  }
  if (creative.body_copy.length > BJ_PRICING[tier].bodyCharLimit) {
    return jsonError(res, 400, 'body copy exceeds char limit');
  }

  let step = 'pre-validation';
  try {
    // 0. Capacity check — refuse the booking if any requested date
    //    would exceed TIER_CAPACITY for this tier. Not a race-proof
    //    guard (the storefront's availability refresh catches 99%
    //    of clashes) but stops the double-booking edge case when
    //    two sponsors hit checkout simultaneously.
    step = 'capacity-check';
    const datesList = dates.map((d) => `"${d}"`).join(',');
    const existingCounts = await supabaseFetch<{ issue_date: string }[]>(
      `bj_bookings?select=issue_date&tier=eq.${tier}&status=neq.cancelled&issue_date=in.(${datesList})`,
    );
    const countByDate = new Map<string, number>();
    for (const b of existingCounts) {
      countByDate.set(b.issue_date, (countByDate.get(b.issue_date) ?? 0) + 1);
    }
    const cap = TIER_CAPACITY[tier];
    for (const d of dates) {
      if ((countByDate.get(d) ?? 0) >= cap) {
        return jsonError(res, 409, `${d} is already full for ${tier}`);
      }
    }

    // 1. Find or create the business row. The Nayba `businesses` table
    step = 'lookup-business';
    //    pre-dates Bury Juice and has `owner_email` (NOT NULL UNIQUE)
    //    as the primary identity; `contact_email` was added later and
    //    may still be NULL on Nayba rows. We match on either so a
    //    returning sponsor who already has a Nayba account keeps the
    //    same business_id and we don't collide on the UNIQUE key.
    //
    //    Two sequential lookups (by contact_email, then owner_email)
    //    avoid PostgREST's OR-filter quoting rules — dots and @ in
    //    email addresses need special escaping inside or=(...) groups,
    //    and getting that wrong silently 400s. Two cheap round-trips
    //    is the safer read.
    const email = creative.contact_email;
    const emailEq = `eq.${encodeURIComponent(email)}`;
    let existing = await supabaseFetch<{ id: string; contact_email: string | null }[]>(
      `businesses?select=id,contact_email&contact_email=${emailEq}&limit=1`,
    );
    if (existing.length === 0) {
      existing = await supabaseFetch<{ id: string; contact_email: string | null }[]>(
        `businesses?select=id,contact_email&owner_email=${emailEq}&limit=1`,
      );
    }
    let businessId: string;
    if (existing.length > 0) {
      businessId = existing[0].id;
      // Backfill contact_email if the matched row was a pure Nayba
      // business without one — keeps the Bury Juice admin view clean.
      if (!existing[0].contact_email) {
        await supabaseFetch(`businesses?id=eq.${businessId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            contact_email: email,
            contact_phone: creative.contact_phone,
          }),
        });
      }
    } else {
      const slugBase = creative.business_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'business';
      const slug = `bj-${slugBase}-${Date.now().toString(36)}`;
      const inserted = await supabaseFetch<{ id: string }[]>('businesses', {
        method: 'POST',
        body: JSON.stringify({
          name: creative.business_name,
          slug,
          owner_email: email,
          contact_email: email,
          contact_phone: creative.contact_phone,
        }),
      });
      businessId = inserted[0].id;
    }

    // 2. Create the pack row — one pack groups N (1, 4, or 12)
    //    bookings under a single Stripe payment. credits_remaining
    //    is always 0 post-checkout because every date is chosen
    //    upfront; the column lingers for backwards compat with older
    //    rows. dashboard_token is still generated (the column is
    //    NOT NULL UNIQUE from the original schema) but never
    //    surfaced — there's no sponsor-side dashboard anymore.
    step = 'create-pack';
    const token = generateDashboardToken();
    const expiresAt = addMonths(new Date(), PACK_EXPIRY_MONTHS).toISOString();
    const amountPaid = priceForTierAndSize(tier, size);

    const pack = await supabaseFetch<{ id: string }[]>('bj_packs', {
      method: 'POST',
      body: JSON.stringify({
        business_id: businessId,
        tier,
        size,
        credits_remaining: 0,
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
    step = 'create-bookings';
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
      image_url: creative.image_url,
      logo_url: creative.logo_url,
    }));
    await supabaseFetch('bj_bookings', {
      method: 'POST',
      body: JSON.stringify(rows),
    });

    // 4. Stripe Checkout session — hosted (redirect) mode. Keeps
    //    the client surface Stripe-free, which means no publishable
    //    key baked into the build, no Stripe.js load, no CSP fiddling.
    //    One brief redirect to checkout.stripe.com and back; Stripe's
    //    hosted page is fast enough that the UX cost is marginal.
    step = 'stripe-session';
    const host = req.headers.host ?? '';
    const origin = `https://${host}`;
    // On the sponsor.*.theburyjuice.com/buryjuice.com subdomains the
    // storefront lives at root, so the return URL drops the `/sponsor`
    // prefix. On app.nayba.app it stays under `/sponsor`.
    const onSponsorSubdomain = /^sponsor\.(the)?buryjuice\.com$/i.test(host);
    const successUrl = `${origin}${onSponsorSubdomain ? '/success' : '/sponsor/success'}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}${onSponsorSubdomain ? '/?cancelled=1' : '/sponsor?cancelled=1'}`;
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
    });

    res.status(200).json({ checkoutUrl: session.url, packId });
  } catch (err) {
    // Log with the step so Vercel Function Logs make it obvious
    // which phase failed — otherwise it's just "supabaseFetch threw".
    console.error(`[bj/bookings/create] failed at step=${step}`, err);
    const msg = err instanceof Error ? err.message : String(err);
    jsonError(res, 500, `${step}: ${msg}`);
  }
}
