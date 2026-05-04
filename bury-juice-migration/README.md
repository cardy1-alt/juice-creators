# Bury Juice → Juice Local migration pack

Everything needed to host the Bury Juice sponsor storefront + admin tab inside the Juice Local repo at **`https://sponsor.juicelocal.co.uk/bury`**.

Files are pre-configured for the new path. Storefront runs at `/bury`, post-payment redirect lands on `/bury/success`. The Juice Local admin gets a Bury Juice tab.

Database, Stripe, Resend, Supabase Storage are **shared** with the existing setup — Juice Local connects to the same Supabase project and the same Stripe account. No data migration, no key rotation.

---

## Prerequisites

You should already have:

- Juice Local repo cloned locally
- Vercel project for Juice Local with `sponsor.juicelocal.co.uk` already pointed at it
- Supabase access (same project — `uwegcqabvlcswviexuax.supabase.co`)
- Stripe Live mode access (same account — same products, same prices)
- The `hello@nayba.app` admin login (RLS policies grant access from this email; can be changed later)

---

## Step 1 — Drop the files into Juice Local

From the Juice Local repo root:

```bash
# Adjust the source path to wherever you have the Nayba repo cloned.
NAYBA_REPO=~/code/juice-creators
cp -R "$NAYBA_REPO/bury-juice-migration/files/." .
```

That's it for files — they all land at the right paths:

```
api/bury-juice/                                # 4 serverless routes
src/components/bury-juice/                     # storefront + sub-components
src/components/admin/AdminBuryJuiceTab.tsx     # admin tab
src/components/admin/BuryJuiceBusinessPill.tsx
src/lib/bury-juice/                            # 11 helper modules
src/styles/bury-juice.css                      # scoped styles
public/bury-juice-avatar.jpg
supabase/migrations/                           # 8 historical migrations (already applied)
```

If Juice Local already has lockstep dependencies you don't need to install anything — Bury Juice only uses `react`, `@supabase/supabase-js`, and `lucide-react`. If lucide-react is missing: `npm install lucide-react`.

---

## Step 2 — Wire into Juice Local's app shell

Three small additions:

### 2a. `src/App.tsx`

Near the top of your App component (before any auth gate), add:

```tsx
import { isBuryJuiceSurface } from './lib/bury-juice/surface.js';
const BuryJuiceApp = React.lazy(() => import('./components/bury-juice/BuryJuiceApp'));
```

Then early in the render:

```tsx
if (isBuryJuiceSurface()) {
  return (
    <React.Suspense fallback={<div className="min-h-screen" />}>
      <BuryJuiceApp />
    </React.Suspense>
  );
}
```

This short-circuits the rest of the app whenever someone hits `/bury` or `/bury/*`.

### 2b. Admin shell

Wherever Juice Local renders its admin tabs, add a tab labelled "Bury Juice" rendering `<AdminBuryJuiceTab />`. If your admin uses string keys for tabs, `'bury-juice'` is the natural choice. Use `Newspaper` from `lucide-react` for the icon.

```tsx
import AdminBuryJuiceTab from './admin/AdminBuryJuiceTab';
import { Newspaper } from 'lucide-react';

// in your tab list / sidebar:
{ key: 'bury-juice', label: 'Bury Juice', icon: Newspaper, render: () => <AdminBuryJuiceTab /> }
```

### 2c. Global stylesheet

Add to whichever CSS file runs on every page (likely `src/index.css`):

```css
@import './styles/bury-juice.css';
```

---

## Step 3 — Vercel env vars

Open Juice Local's Vercel project → **Settings → Environment Variables** → import the `.env.juice-local` file in this pack.

```
VITE_SUPABASE_URL=https://uwegcqabvlcswviexuax.supabase.co
VITE_SUPABASE_ANON_KEY=…                       # same as Nayba
SUPABASE_URL=https://uwegcqabvlcswviexuax.supabase.co
SUPABASE_SERVICE_ROLE_KEY=…                    # same as Nayba
STRIPE_SECRET_KEY=sk_live_…                    # same as Nayba
STRIPE_WEBHOOK_SECRET=whsec_…                  # NEW — see Step 5
STRIPE_PRICE_CLASSIFIED_SINGLE=price_…
STRIPE_PRICE_CLASSIFIED_PACK4=price_…
STRIPE_PRICE_CLASSIFIED_PACK12=price_…
STRIPE_PRICE_FEATURE_SINGLE=price_…
STRIPE_PRICE_FEATURE_PACK4=price_…
STRIPE_PRICE_FEATURE_PACK12=price_…
STRIPE_PRICE_PRIMARY_SINGLE=price_…
STRIPE_PRICE_PRIMARY_PACK4=price_…
STRIPE_PRICE_PRIMARY_PACK12=price_…
RESEND_API_KEY=re_…                            # same as Nayba
ADMIN_EMAIL=hello@nayba.app                    # admin RLS keys off this
```

Apply to **Production + Preview + Development**. Copy values from Nayba's Vercel project — they're identical.

---

## Step 4 — Database (no work needed)

All `bj_*` tables, RLS policies, the storage bucket, and the seed data are already live on the shared Supabase project. The migrations in `supabase/migrations/` are copied for repo history; **don't re-run them**. They're idempotent if you do, but it's pointless work.

---

## Step 5 — Stripe webhook

The existing webhook is registered for `https://sponsor.theburyjuice.com/api/bury-juice/stripe/webhook`. Add a **second** endpoint for the new URL:

1. Stripe Dashboard → **Developers → Webhooks → + Add endpoint**
2. URL: `https://sponsor.juicelocal.co.uk/api/bury-juice/stripe/webhook`
3. Events: `checkout.session.completed` (Snapshot)
4. Save → reveal the new signing secret (`whsec_…`)
5. Paste it into Juice Local's `STRIPE_WEBHOOK_SECRET` env var

You now have two webhooks firing for live payments — one to the old URL (Nayba), one to the new (Juice Local). Both are idempotent (the booking flips to `confirmed` once and stays). After you sunset the Nayba storefront (Step 7), delete the old webhook endpoint.

---

## Step 6 — Deploy + smoke test

```bash
# In Juice Local
git add -A && git commit -m "Add Bury Juice storefront + admin tab"
git push
```

Vercel auto-deploys. Then:

1. Visit `https://sponsor.juicelocal.co.uk/bury` — storefront should render with avatar, stats, three placement rows
2. Pick Classified single → fill form → pay with `4242 4242 4242 4242` (test mode) or a real card
3. Land on `https://sponsor.juicelocal.co.uk/bury/success`
4. Stripe → Webhooks → new endpoint → recent delivery = **200**
5. Log into Juice Local admin → **Bury Juice** tab → new booking shows up in the calendar
6. Stats Editor still loads `7,404 / 53.04 / 14.80` and lets you edit + save
7. SponsorsPanel lists the legacy sponsors

If 1–7 pass, the migration is functionally complete.

---

## Step 7 — Sunset the Bury Juice surface in Nayba (when ready)

Wait a few days to make sure Juice Local is solid. Then in the Nayba repo:

```bash
rm -rf \
  src/components/bury-juice \
  src/components/admin/AdminBuryJuiceTab.tsx \
  src/components/admin/BuryJuiceBusinessPill.tsx \
  src/lib/bury-juice \
  src/styles/bury-juice.css \
  public/bury-juice-avatar.jpg \
  api/bury-juice
```

Then edit:

- `src/App.tsx` — remove the `isBuryJuiceSurface()` block + `BuryJuiceApp` import
- `src/components/AdminDashboard.tsx` — remove the Bury Juice tab nav + render
- `src/index.css` — remove `@import './styles/bury-juice.css'`
- `.env.example` — remove Bury Juice env-var section

Commit + push. The old `sponsor.theburyjuice.com` keeps resolving until you actually move the DNS record (you don't have to — it can keep pointing at Nayba indefinitely with the storefront removed; it'll just 404). Or remove the domain from Vercel and update Namecheap to point at Juice Local later.

In Stripe, delete the old webhook endpoint so live payments only fire one webhook.

---

## What doesn't change

- **Supabase project** — same URL, same anon key, same service-role key
- **Stripe products + price IDs** — paste them across as-is
- **Resend domain** — emails still send from `Bury Juice <hello@nayba.app>`
- **Supabase Storage** — the `bj-creative` bucket already exists with the right RLS
- **Sponsor-facing email** — `hello@theburyjuice.com` mailto links stay
- **Admin email** — `hello@nayba.app` keeps RLS access; if you want to add a Juice Local-specific admin email, that's a follow-up migration

---

## Total time estimate

- File copy: 1 minute
- App shell wiring: 5 minutes
- Vercel env vars: 5 minutes
- Stripe webhook: 2 minutes
- Deploy + smoke test: 10 minutes

**~25 minutes.** Sunset cleanup in Nayba is another 10 minutes once you've verified Juice Local is stable.
