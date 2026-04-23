import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BJ_PRICING,
  BJ_STATS,
  formatGBP,
  packSavingsPct,
  priceForTierAndSize,
  type BjPackSize,
  type BjTier,
} from '../../lib/bury-juice/pricing.js';
import {
  nextNThursdays,
  parseISODate,
} from '../../lib/bury-juice/availability.js';
import type { BjAvailabilityEntry } from '../../lib/bury-juice/types.js';
import { LEGACY_SPONSORS } from '../../lib/bury-juice/legacy-sponsors.js';
import { uploadCreativeFile } from '../../lib/bury-juice/upload.js';
import { loadDraft, saveDraft, clearDraft } from '../../lib/bury-juice/draft.js';
import { BookingFlow } from './storefront/BookingFlow';
import { CreativeForm, validateCreative, normaliseUrl, type CreativeFormValue } from './storefront/CreativeForm';
import { PlacementPreview } from './storefront/PlacementPreview';
import { ReviewPay } from './storefront/ReviewPay';
import { Testimonials } from './storefront/Testimonials';
import { Footer } from './storefront/Footer';

// One-screen landing for the sponsor storefront. Beehiiv-style:
// wordmark → tags → stats → social proof → a row per placement
// (with pack ladder, next-available hint, and mini preview) →
// booking flow expands below when a tier is chosen.

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
const WEEKS_AHEAD = 12;

type NextAvailability = Partial<Record<BjTier, string | null>>;

export default function SponsorStorefront() {
  // Lazy init from localStorage so a sponsor who gets interrupted
  // (tab kill, accidental navigation) returns to the same text they
  // typed. Files don't round-trip through JSON — photo/logo will
  // still need to be re-attached.
  const initialDraft = typeof window === 'undefined' ? null : loadDraft();
  const [tier, setTier] = useState<BjTier | null>(initialDraft?.tier ?? null);
  const [size, setSize] = useState<BjPackSize>(initialDraft?.size ?? 1);
  const [selectedDates, setSelectedDates] = useState<string[]>(initialDraft?.selectedDates ?? []);
  const [pickLater, setPickLater] = useState<boolean>(initialDraft?.pickLater ?? false);
  const [creative, setCreative] = useState<CreativeFormValue>(
    initialDraft
      ? { ...EMPTY_CREATIVE, ...initialDraft.creative, imageFile: null, logoFile: null }
      : EMPTY_CREATIVE,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [nextAvailable, setNextAvailable] = useState<NextAvailability>({});
  const [showSticky, setShowSticky] = useState(false);

  const bookingRef = useRef<HTMLDivElement | null>(null);
  const placementsRef = useRef<HTMLDivElement | null>(null);

  // Persist text state to localStorage whenever it changes. Debounced
  // lightly via requestIdleCallback so we're not writing on every
  // keystroke.
  useEffect(() => {
    const idle = (cb: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
      if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(cb);
      else setTimeout(cb, 200);
    };
    idle(() => saveDraft(tier, size, selectedDates, pickLater, creative));
  }, [tier, size, selectedDates, pickLater, creative]);

  // Fetch next-available Thursday per tier so the rows can surface a
  // "Next available: …" hint. Three parallel calls; errors silently
  // fall back to "Available" without a date.
  useEffect(() => {
    let cancelled = false;
    const range = nextNThursdays(WEEKS_AHEAD);
    const from = range[0];
    const to = range[range.length - 1];
    Promise.all(
      TIERS.map((t) =>
        fetch(`/api/bury-juice/availability?tier=${t}&from=${from}&to=${to}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((body: { entries: BjAvailabilityEntry[] } | null) => {
            const entries = body?.entries ?? [];
            const firstAvail = entries.find((e) => e.status === 'available');
            return [t, firstAvail?.date ?? null] as const;
          })
          .catch(() => [t, null] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      const next: NextAvailability = {};
      for (const [t, d] of pairs) next[t] = d;
      setNextAvailable(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Show the sticky mobile CTA once the user scrolls past the
  // placement rows. IntersectionObserver keeps the work on the GPU.
  useEffect(() => {
    if (!placementsRef.current) return;
    const el = placementsRef.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const total = useMemo(
    () => (tier ? priceForTierAndSize(tier, size) : 0),
    [tier, size],
  );

  const errors = tier ? validateCreative(creative, tier) : {};
  const creativeValid = tier ? Object.keys(errors).length === 0 : false;
  // pickLater only applies to 4/12-packs; singles always require a
  // date. Relax the check when the checkbox is on for a pack.
  const datesValid = pickLater && size > 1 ? true : selectedDates.length === size;

  function handleTierSelect(t: BjTier) {
    setTier(t);
    setSize(1);
    setSelectedDates([]);
    setPickLater(false);
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
      setSubmitError(`Please pick ${size} date${size === 1 ? '' : 's'} — or tick "I'll pick later".`);
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
          dates: pickLater && size > 1 ? [] : selectedDates,
          pickLater: pickLater && size > 1,
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
      // Checkout session created — the sponsor is leaving for Stripe.
      // Clear the local draft so they don't see the old form text if
      // they cancel the payment and return.
      clearDraft();
      window.location.href = body.checkoutUrl;
    } catch (err) {
      setUploadStatus(null);
      setSubmitError(`Couldn't start checkout — ${err instanceof Error ? err.message : String(err)}`);
      setSubmitting(false);
    }
  }

  function scrollToPlacements() {
    placementsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="bj-surface">
      {/* ── Header ─────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: 'clamp(28px, 6vw, 64px) clamp(18px, 4vw, 24px) 0',
          textAlign: 'center',
        }}
      >
        <Avatar />
        <h1
          style={{
            fontSize: 'clamp(28px, 7vw, 44px)',
            lineHeight: 1.1,
            margin: 0,
            marginBottom: 10,
          }}
        >
          Bury Juice
        </h1>
        <p
          style={{
            fontSize: 'clamp(15px, 3.6vw, 17px)',
            lineHeight: 1.5,
            color: 'var(--ink-60)',
            margin: '0 auto',
            maxWidth: 520,
          }}
        >
          The weekly newsletter for Bury St Edmunds. Pick a placement, pick your Thursdays, and be in the next issue.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {TAGS.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: 8,
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
          <StatCard label="Subscribers" value={BJ_STATS.subscribers.toLocaleString('en-GB')} />
          <StatCard
            label="Open rate"
            value={`${Math.round(BJ_STATS.open_rate * 100)}%`}
            sublabel="2.5× industry avg"
          />
          <StatCard label="Click-through" value={`${(BJ_STATS.ctr * 100).toFixed(1)}%`} />
        </div>
      </section>

      {/* ── Social proof strip ─────────────────────────────────── */}
      <SocialProof />

      {/* ── Testimonials ───────────────────────────────────────── */}
      <Testimonials />

      {/* ── Placement options ──────────────────────────────────── */}
      <section
        ref={placementsRef}
        style={{ maxWidth: 680, margin: '0 auto', padding: '28px 24px 0' }}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          {TIERS.map((t) => (
            <PlacementRow
              key={t}
              tier={t}
              selected={tier === t}
              nextAvailable={nextAvailable[t] ?? undefined}
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
              pickLater={pickLater}
              onPickLaterChange={setPickLater}
            />
            <CreativeForm tier={tier} value={creative} onChange={setCreative} errors={errors} />
            <PlacementPreview tier={tier} value={creative} />
            <ReviewPay
              tier={tier}
              size={size}
              selectedDates={selectedDates}
              pickLater={pickLater && size > 1}
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

      {/* ── Sticky mobile CTA ──────────────────────────────────── */}
      {showSticky && !tier && <StickyCta onClick={scrollToPlacements} />}
    </div>
  );
}

// Loads the Bury Juice profile picture from /public — drop a file at
// `public/bury-juice-avatar.jpg` (or .png) and it picks up on deploy.
// Falls back to a terra-on-cream "BJ" monogram if the image is
// missing so the page never looks broken before the asset lands.
function Avatar() {
  const [failed, setFailed] = useState(false);
  const base: React.CSSProperties = {
    // Scales from 64px on narrow phones to 88px on desktop —
    // keeps the hero short on mobile without losing the identity
    // on bigger screens.
    width: 'clamp(64px, 14vw, 88px)',
    height: 'clamp(64px, 14vw, 88px)',
    borderRadius: 'clamp(14px, 2.5vw, 20px)',
    margin: '0 auto clamp(14px, 3vw, 20px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(42,32,24,0.08)',
  };
  if (failed) {
    return (
      <div
        aria-hidden
        style={{
          ...base,
          background: 'var(--terra)',
          color: '#fff',
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: '-0.03em',
        }}
      >
        BJ
      </div>
    );
  }
  return (
    <div style={{ ...base, background: 'var(--card)' }}>
      <img
        src="/bury-juice-avatar.jpg"
        alt="Bury Juice"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
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
      {sublabel && (
        <div style={{ fontSize: 12, color: 'var(--terra)', fontWeight: 600, marginTop: 4 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

// ── Social proof ─────────────────────────────────────────────────
function SocialProof() {
  // Hardcoded from the legacy sponsors already in the DB. If this list
  // gets stale we can swap to a live query later.
  const names = LEGACY_SPONSORS.map((s) => s.name);
  return (
    <section style={{ maxWidth: 680, margin: '0 auto', padding: '20px 24px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flexWrap: 'wrap',
          fontSize: 12,
          color: 'var(--ink-35)',
          textAlign: 'center',
        }}
      >
        <span style={{ fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 11 }}>
          Trusted by
        </span>
        {names.map((n, i) => (
          <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--ink-60)', fontWeight: 500, fontSize: 12 }}>{n}</span>
            {i < names.length - 1 && <span style={{ color: 'var(--ink-35)' }}>·</span>}
          </span>
        ))}
      </div>
    </section>
  );
}

// ── Placement row ────────────────────────────────────────────────
function PlacementRow({
  tier,
  selected,
  nextAvailable,
  onBook,
}: {
  tier: BjTier;
  selected: boolean;
  nextAvailable?: string | null;
  onBook: () => void;
}) {
  const t = BJ_PRICING[tier];
  return (
    <div
      style={{
        background: 'var(--card)',
        border: `1px solid ${selected ? 'var(--terra)' : 'var(--border-color)'}`,
        boxShadow: selected ? '0 0 0 3px var(--terra-10)' : 'none',
        borderRadius: 'var(--r-card)',
        padding: 18,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 16,
        alignItems: 'start',
      }}
    >
      <PlacementPreviewMini tier={tier} />

      <div style={{ minWidth: 0, display: 'grid', gap: 12 }}>
        {/* Title + description + next-available */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{t.name}</h3>
            <span style={{ fontSize: 13, color: 'var(--ink-60)' }}>· {t.position.toLowerCase()}</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-60)', margin: '6px 0 0', lineHeight: 1.5 }}>
            {t.description}
          </p>
          {nextAvailable !== undefined && (
            <div
              style={{
                fontSize: 13,
                color: nextAvailable ? 'var(--terra)' : 'var(--ink-60)',
                marginTop: 8,
                fontWeight: 500,
              }}
            >
              {nextAvailable
                ? `Next available: ${formatShortDate(nextAvailable)}`
                : 'No slots in the next 12 weeks'}
            </div>
          )}
        </div>

        {/* Pack-price ladder */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
            gap: 8,
          }}
        >
          <PriceStep label="Single issue" sublabel="" price={formatGBP(t.single)} />
          <PriceStep
            label="4-pack"
            sublabel={`save ${packSavingsPct(tier, 4)}%`}
            price={formatGBP(t.pack_4)}
          />
          <PriceStep
            label="12-pack"
            sublabel={`save ${packSavingsPct(tier, 12)}%`}
            price={formatGBP(t.pack_12)}
          />
        </div>

        <button
          type="button"
          onClick={onBook}
          className="bj-btn bj-btn--block"
        >
          {selected ? `${t.name} selected — scroll down` : `Book ${t.name} · from ${formatGBP(t.single)}`}
        </button>
      </div>
    </div>
  );
}

// Miniature representation of the newsletter layout with the relevant
// slot tinted terra. Non-photorealistic — just communicates position.
function PlacementPreviewMini({ tier }: { tier: BjTier }) {
  const isPrimary = tier === 'primary';
  const isFeature = tier === 'feature';
  const isClassified = tier === 'classified';
  const block = (highlighted: boolean, height: number) => (
    <div
      style={{
        background: highlighted ? 'var(--terra)' : 'var(--ink-08)',
        height,
        borderRadius: 3,
      }}
    />
  );
  return (
    <div
      aria-hidden
      style={{
        width: 48,
        padding: 6,
        background: 'var(--shell)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        flexShrink: 0,
      }}
    >
      {block(isPrimary, 18)}
      {block(false, 4)}
      {block(isFeature, 14)}
      {block(false, 4)}
      {block(isClassified, 8)}
    </div>
  );
}

function PriceStep({ label, sublabel, price }: { label: string; sublabel: string; price: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--r-input)',
        padding: '10px 12px',
        background: 'var(--shell)',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--ink-60)', fontWeight: 500 }}>{label}</div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
          marginTop: 2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {price}
      </div>
      {sublabel && (
        <div style={{ fontSize: 12, color: 'var(--terra)', fontWeight: 600, marginTop: 3 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Sticky mobile CTA ────────────────────────────────────────────
function StickyCta({ onClick }: { onClick: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        background: 'rgba(255,255,255,0.96)',
        borderTop: '1px solid var(--border-color)',
        backdropFilter: 'saturate(140%) blur(8px)',
        WebkitBackdropFilter: 'saturate(140%) blur(8px)',
        zIndex: 50,
        animation: 'bjStickyUp 0.2s ease-out',
      }}
      className="bj-sticky-mobile"
    >
      <button
        type="button"
        onClick={onClick}
        className="bj-btn bj-btn--block"
        style={{ justifyContent: 'space-between' }}
      >
        <span>Book a placement</span>
        <span style={{ fontWeight: 500, opacity: 0.9, fontSize: 14 }}>
          from {formatGBP(BJ_PRICING.classified.single)}
        </span>
      </button>
    </div>
  );
}
