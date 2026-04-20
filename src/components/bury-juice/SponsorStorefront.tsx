import { useMemo, useRef, useState } from 'react';
import {
  priceForTierAndSize,
  type BjPackSize,
  type BjTier,
} from '../../lib/bury-juice/pricing';
import { Hero } from './storefront/Hero';
import { StatsBand } from './storefront/StatsBand';
import { HowItWorks } from './storefront/HowItWorks';
import { TierCards } from './storefront/TierCards';
import { BookingFlow } from './storefront/BookingFlow';
import { CreativeForm, validateCreative, type CreativeFormValue } from './storefront/CreativeForm';
import { ReviewPay } from './storefront/ReviewPay';
import { FAQ } from './storefront/FAQ';
import { Footer } from './storefront/Footer';

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

export default function SponsorStorefront() {
  const [tier, setTier] = useState<BjTier | null>(null);
  const [size, setSize] = useState<BjPackSize>(1);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [pickLater, setPickLater] = useState(false);
  const [creative, setCreative] = useState<CreativeFormValue>(EMPTY_CREATIVE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const bookingRef = useRef<HTMLDivElement | null>(null);

  const total = useMemo(
    () => (tier ? priceForTierAndSize(tier, size) : 0),
    [tier, size],
  );

  const errors = tier ? validateCreative(creative, tier) : {};
  const creativeValid = tier ? Object.keys(errors).length === 0 : false;
  const datesValid = pickLater || selectedDates.length === size;

  function handleTierSelect(t: BjTier) {
    setTier(t);
    setSelectedDates([]);
    // Scroll on next tick so the booking flow is mounted.
    setTimeout(() => {
      bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function handleCheckout() {
    if (!tier) return;
    setSubmitError(null);
    if (!creativeValid) {
      setSubmitError('Please complete the creative form above.');
      return;
    }
    if (!datesValid) {
      setSubmitError(`Please pick ${size} date${size === 1 ? '' : 's'} — or opt to pick them later.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/bury-juice/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          size,
          dates: pickLater ? [] : selectedDates,
          pickLater,
          creative: {
            business_name: creative.businessName,
            contact_email: creative.contactEmail,
            contact_phone: creative.contactPhone,
            headline: creative.headline,
            body_copy: creative.bodyCopy,
            cta_url: creative.ctaUrl,
            // Image/logo: for v1 client hands over filename only; a real
            // implementation would pre-upload to Supabase Storage first.
            image_filename: creative.imageFile?.name ?? null,
            logo_filename: creative.logoFile?.name ?? null,
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (body.error || !body.checkoutUrl) {
        throw new Error(body.error ?? 'No checkout URL returned');
      }
      window.location.href = body.checkoutUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(`Couldn't start checkout — ${msg}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="bj-surface">
      <Hero />
      <StatsBand />
      <HowItWorks />
      <TierCards onSelect={handleTierSelect} selected={tier} />
      {tier && (
        <div ref={bookingRef}>
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
          <ReviewPay
            tier={tier}
            size={size}
            selectedDates={selectedDates}
            pickLater={pickLater}
            total={total}
            onCheckout={handleCheckout}
            submitting={submitting}
            submitError={submitError}
          />
        </div>
      )}
      <FAQ />
      <Footer />
    </div>
  );
}
