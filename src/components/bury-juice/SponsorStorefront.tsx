import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  priceForTierAndSize,
  type BjPackSize,
  type BjTier,
} from '../../lib/bury-juice/pricing';
import { uploadCreativeFile } from '../../lib/bury-juice/upload';
import { Hero } from './storefront/Hero';
import { StatsBand } from './storefront/StatsBand';
import { HowItWorks } from './storefront/HowItWorks';
import { TierCards } from './storefront/TierCards';
import { BookingFlow } from './storefront/BookingFlow';
import { CreativeForm, validateCreative, type CreativeFormValue } from './storefront/CreativeForm';
import { ReviewPay } from './storefront/ReviewPay';
import { FAQ } from './storefront/FAQ';
import { Footer } from './storefront/Footer';
import { EmbeddedCheckout } from './EmbeddedCheckout';

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
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const bookingRef = useRef<HTMLDivElement | null>(null);
  const checkoutRef = useRef<HTMLDivElement | null>(null);

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
    setClientSecret(null);
    setSubmitError(null);
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
      // Stage 1 — upload the creative assets in parallel so the API
      // call receives public URLs rather than filename hints.
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
      if (tasks.length > 0) {
        await Promise.all(tasks);
      }
      setUploadStatus(null);

      // Stage 2 — create booking rows + Stripe embedded session.
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
            image_url: imageUrl,
            logo_url: logoUrl,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { clientSecret?: string; error?: string };
      if (!body.clientSecret) {
        throw new Error(body.error ?? 'No client secret returned');
      }
      setClientSecret(body.clientSecret);
    } catch (err) {
      setUploadStatus(null);
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(`Couldn't start checkout — ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  // Scroll the embedded checkout into view once Stripe hands us a
  // client secret and the iframe has had a paint.
  useEffect(() => {
    if (!clientSecret) return;
    const id = setTimeout(() => {
      checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(id);
  }, [clientSecret]);

  const onCheckoutError = useCallback((msg: string) => {
    setSubmitError(msg);
    setClientSecret(null);
  }, []);

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
          {!clientSecret && (
            <ReviewPay
              tier={tier}
              size={size}
              selectedDates={selectedDates}
              pickLater={pickLater}
              total={total}
              onCheckout={handleCheckout}
              submitting={submitting}
              submitError={submitError}
              uploadStatus={uploadStatus}
            />
          )}
          {clientSecret && (
            <section className="bj-section" ref={checkoutRef}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--bj-crimson)',
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Secure payment
              </div>
              <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginBottom: 24 }}>Pay &amp; finish.</h2>
              <EmbeddedCheckout clientSecret={clientSecret} onError={onCheckoutError} />
            </section>
          )}
        </div>
      )}
      <FAQ />
      <Footer />
    </div>
  );
}
