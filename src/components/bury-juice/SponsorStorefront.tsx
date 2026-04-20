import { useMemo, useRef, useState } from 'react';
import {
  BJ_PRICING,
  BJ_STATS,
  formatGBP,
  packSavingsPct,
  priceForTierAndSize,
  type BjPackSize,
  type BjTier,
} from '../../lib/bury-juice/pricing.js';
import { uploadCreativeFile } from '../../lib/bury-juice/upload.js';
import { BookingFlow } from './storefront/BookingFlow';
import { CreativeForm, validateCreative, normaliseUrl, type CreativeFormValue } from './storefront/CreativeForm';
import { ReviewPay } from './storefront/ReviewPay';
import { Footer } from './storefront/Footer';

// One-screen landing for the sponsor storefront. Inspired by the
// beehiiv direct-sponsorship page: wordmark → short description →
// tags → stats → a row per placement with price + book button.
// Clicking a row inline-expands into the booking flow for that tier.

const EMPTY_CREATIVE: CreativeFormValue = {
  businessName: '',
  contactEmail: '',
  contactPhone: '',
  headline: '',
  bodyCopy: '',
  ctaUrl: '',
  imageFile: null,
  logoFile: null,
};

const TIERS: BjTier[] = ['primary', 'feature', 'classified'];
const TAGS = ['Bury St Edmunds', 'Weekly', 'Local'];

export default function SponsorStorefront() {
  const [tier, setTier] = useState<BjTier | null>(null);
  const [size, setSize] = useState<BjPackSize>(1);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [creative, setCreative] = useState<CreativeFormValue>(EMPTY_CREATIVE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const bookingRef = useRef<HTMLDivElement | null>(null);

  const total = useMemo(
    () => (tier ? priceForTierAndSize(tier, size) : 0),
    [tier, size],
  );

  const errors = tier ? validateCreative(creative, tier) : {};
  const creativeValid = tier ? Object.keys(errors).length === 0 : false;
  const datesValid = selectedDates.length === size;

  function handleTierSelect(t: BjTier) {
    setTier(t);
    setSize(1);
    setSelectedDates([]);
    setSubmitError(null);
    setTimeout(() => {
      bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function handleCheckout() {
    if (!tier) return;
    setSubmitError(null);
    if (!creativeValid) {
      setSubmitError('Please complete the form above.');
      return;
    }
    if (!datesValid) {
      setSubmitError(`Please pick ${size} date${size === 1 ? '' : 's'}.`);
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      let logoUrl: string | null = null;
      const tasks: Promise<void>[] = [];
      if (creative.imageFile) {
        setUploadStatus('Uploading photo…');
        tasks.push(
          uploadCreativeFile(creative.imageFile, 'photo').then((u) => {
            imageUrl = u;
          }),
        );
      }
      if (creative.logoFile) {
        setUploadStatus((prev) => prev ?? 'Uploading logo…');
        tasks.push(
          uploadCreativeFile(creative.logoFile, 'logo').then((u) => {
            logoUrl = u;
          }),
        );
      }
      if (tasks.length > 0) await Promise.all(tasks);
      setUploadStatus('Sending you to Stripe…');

      const res = await fetch('/api/bury-juice/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          size,
          dates: selectedDates,
          creative: {
            business_name: creative.businessName,
            contact_email: creative.contactEmail,
            contact_phone: creative.contactPhone,
            headline: creative.headline,
            body_copy: creative.bodyCopy,
            cta_url: normaliseUrl(creative.ctaUrl),
            image_url: imageUrl,
            logo_url: logoUrl,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!body.checkoutUrl) throw new Error(body.error ?? 'No checkout URL');
      window.location.href = body.checkoutUrl;
    } catch (err) {
      setUploadStatus(null);
      setSubmitError(`Couldn't start checkout — ${err instanceof Error ? err.message : String(err)}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="bj-surface">
      {/* ── Header ─────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: '64px 24px 0',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: 'var(--terra)',
            color: '#fff',
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.03em',
          }}
          aria-hidden
        >
          BJ
        </div>
        <h1
          style={{
            fontSize: 'clamp(28px, 5vw, 40px)',
            lineHeight: 1.15,
            margin: 0,
            marginBottom: 12,
          }}
        >
          Bury Juice
        </h1>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.55,
            color: 'var(--ink-60)',
            margin: '0 auto',
            maxWidth: 520,
          }}
        >
          The weekly newsletter for Bury St Edmunds. Pick a placement, pick your Thursdays, and be in the next issue.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 18 }}>
          {TAGS.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'var(--ink-08)',
                color: 'var(--ink-60)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          <StatCard
            label="Subscribers"
            value={BJ_STATS.subscribers.toLocaleString('en-GB')}
          />
          <StatCard
            label="Open rate"
            value={`${Math.round(BJ_STATS.open_rate * 100)}%`}
          />
          <StatCard
            label="Click-through"
            value={`${(BJ_STATS.ctr * 100).toFixed(1)}%`}
          />
        </div>
      </section>

      {/* ── Placement options ──────────────────────────────────── */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 0' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          {TIERS.map((t) => (
            <PlacementRow
              key={t}
              tier={t}
              selected={tier === t}
              onBook={() => handleTierSelect(t)}
            />
          ))}
        </div>
      </section>

      {/* ── Get-in-touch ───────────────────────────────────────── */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '16px 24px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--r-card)',
            background: 'var(--shell)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ color: 'var(--ink)', fontSize: 14 }}>
            Looking for something custom?
          </div>
          <a
            href="mailto:hello@theburyjuice.com"
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--r-button)',
              border: '1px solid var(--border-color-hover)',
              background: 'var(--card)',
              color: 'var(--ink)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Get in touch
          </a>
        </div>
      </section>

      {/* ── Booking flow (expands when a placement is selected) ─ */}
      {tier && (
        <div ref={bookingRef} style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 0' }}>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 32 }}>
            <BookingFlow
              tier={tier}
              size={size}
              onSizeChange={setSize}
              selectedDates={selectedDates}
              onSelectedDatesChange={setSelectedDates}
            />
            <CreativeForm tier={tier} value={creative} onChange={setCreative} errors={errors} />
            <ReviewPay
              tier={tier}
              size={size}
              selectedDates={selectedDates}
              total={total}
              onCheckout={handleCheckout}
              submitting={submitting}
              submitError={submitError}
              uploadStatus={uploadStatus}
            />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--r-card)',
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--ink-60)' }}>{label}</div>
      <div
        style={{
          fontWeight: 700,
          fontSize: 'clamp(22px, 4vw, 28px)',
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PlacementRow({
  tier,
  selected,
  onBook,
}: {
  tier: BjTier;
  selected: boolean;
  onBook: () => void;
}) {
  const t = BJ_PRICING[tier];
  const packSave = packSavingsPct(tier, 12);
  return (
    <div
      style={{
        background: 'var(--card)',
        border: `1px solid ${selected ? 'var(--terra)' : 'var(--border-color)'}`,
        boxShadow: selected ? '0 0 0 3px var(--terra-10)' : 'none',
        borderRadius: 'var(--r-card)',
        padding: 18,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{t.name}</h3>
          <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>· {t.position.toLowerCase()}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-60)', margin: 0, lineHeight: 1.5 }}>
          {t.description}
          <span style={{ color: 'var(--ink-35)' }}> · Packs from {formatGBP(t.pack_12 / 12)}/issue (save {packSave}%)</span>
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          {formatGBP(t.single)}
        </div>
        <button
          type="button"
          onClick={onBook}
          style={{
            padding: '9px 16px',
            borderRadius: 'var(--r-button)',
            border: `1px solid ${selected ? 'var(--terra)' : 'var(--ink)'}`,
            background: selected ? 'var(--terra)' : 'var(--ink)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {selected ? 'Selected' : 'Book now'}
        </button>
      </div>
    </div>
  );
}
