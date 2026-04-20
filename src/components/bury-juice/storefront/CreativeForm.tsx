import type { ChangeEvent } from 'react';
import { BJ_PRICING, type BjTier } from '../../../lib/bury-juice/pricing';

export interface CreativeFormValue {
  businessName: string;
  contactEmail: string;
  contactPhone: string;
  headline: string;
  bodyCopy: string;
  ctaUrl: string;
  imageFile: File | null;
  logoFile: File | null;
}

interface Props {
  tier: BjTier;
  value: CreativeFormValue;
  onChange: (next: CreativeFormValue) => void;
  errors: Partial<Record<keyof CreativeFormValue, string>>;
}

const HEADLINE_MAX = 60;

export function CreativeForm({ tier, value, onChange, errors }: Props) {
  const bodyMax = BJ_PRICING[tier].bodyCharLimit;
  const needsImage = tier === 'feature' || tier === 'primary';
  const needsLogo = tier === 'primary';

  function set<K extends keyof CreativeFormValue>(key: K, v: CreativeFormValue[K]) {
    onChange({ ...value, [key]: v });
  }

  function handleFile(key: 'imageFile' | 'logoFile', e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    set(key, f);
  }

  return (
    <section className="bj-section">
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
        Your creative
      </div>
      <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginBottom: 32 }}>
        Tell us what to run.
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        <Field
          label="Business name"
          error={errors.businessName}
          render={(id) => (
            <input
              id={id}
              className="bj-input"
              value={value.businessName}
              onChange={(e) => set('businessName', e.target.value)}
              placeholder="e.g. The Nutshell"
            />
          )}
        />
        <Field
          label="Contact email"
          error={errors.contactEmail}
          render={(id) => (
            <input
              id={id}
              type="email"
              className="bj-input"
              value={value.contactEmail}
              onChange={(e) => set('contactEmail', e.target.value)}
              placeholder="you@business.co.uk"
            />
          )}
        />
        <Field
          label="Contact phone"
          error={errors.contactPhone}
          render={(id) => (
            <input
              id={id}
              type="tel"
              className="bj-input"
              value={value.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
              placeholder="01284 000000"
            />
          )}
        />
        <Field
          label="CTA link"
          error={errors.ctaUrl}
          render={(id) => (
            <input
              id={id}
              type="url"
              className="bj-input"
              value={value.ctaUrl}
              onChange={(e) => set('ctaUrl', e.target.value)}
              placeholder="https://yourbusiness.co.uk/offer"
            />
          )}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <Field
          label={`Headline (${value.headline.length}/${HEADLINE_MAX})`}
          error={errors.headline}
          render={(id) => (
            <input
              id={id}
              className="bj-input"
              maxLength={HEADLINE_MAX}
              value={value.headline}
              onChange={(e) => set('headline', e.target.value)}
              placeholder="Short, punchy, no clickbait"
            />
          )}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <Field
          label={`Body copy (${value.bodyCopy.length}/${bodyMax})`}
          error={errors.bodyCopy}
          render={(id) => (
            <textarea
              id={id}
              className="bj-textarea"
              rows={5}
              maxLength={bodyMax}
              value={value.bodyCopy}
              onChange={(e) => set('bodyCopy', e.target.value)}
              placeholder="Tell Bury in your own words — who you are, why they should care."
            />
          )}
        />
      </div>

      {(needsImage || needsLogo) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: needsLogo ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr',
            gap: 20,
            marginTop: 20,
          }}
        >
          {needsImage && (
            <Field
              label="Photo (min 1200px wide, max 5MB)"
              error={errors.imageFile}
              render={(id) => (
                <input
                  id={id}
                  type="file"
                  accept="image/*"
                  className="bj-input"
                  onChange={(e) => handleFile('imageFile', e)}
                />
              )}
            />
          )}
          {needsLogo && (
            <Field
              label="Logo (transparent PNG preferred)"
              error={errors.logoFile}
              render={(id) => (
                <input
                  id={id}
                  type="file"
                  accept="image/png,image/svg+xml"
                  className="bj-input"
                  onChange={(e) => handleFile('logoFile', e)}
                />
              )}
            />
          )}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  error,
  render,
}: {
  label: string;
  error?: string;
  render: (id: string) => React.ReactNode;
}) {
  const id = `bj-${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="bj-label">
        {label}
      </label>
      {render(id)}
      {error && (
        <div style={{ color: 'var(--bj-crimson)', fontSize: 12, marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}

export function validateCreative(
  value: CreativeFormValue,
  tier: BjTier,
): Partial<Record<keyof CreativeFormValue, string>> {
  const errors: Partial<Record<keyof CreativeFormValue, string>> = {};
  if (!value.businessName.trim()) errors.businessName = 'Required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail)) errors.contactEmail = 'Valid email required';
  if (!value.contactPhone.trim()) errors.contactPhone = 'Required';
  if (!value.headline.trim()) errors.headline = 'Required';
  else if (value.headline.length > HEADLINE_MAX) errors.headline = `Max ${HEADLINE_MAX} chars`;
  const bodyMax = BJ_PRICING[tier].bodyCharLimit;
  if (!value.bodyCopy.trim()) errors.bodyCopy = 'Required';
  else if (value.bodyCopy.length > bodyMax) errors.bodyCopy = `Max ${bodyMax} chars`;
  try {
    if (!value.ctaUrl.trim()) throw new Error('missing');
    new URL(value.ctaUrl);
  } catch {
    errors.ctaUrl = 'Valid URL required';
  }
  if ((tier === 'feature' || tier === 'primary') && !value.imageFile) errors.imageFile = 'Photo required';
  if (tier === 'primary' && !value.logoFile) errors.logoFile = 'Logo required';
  return errors;
}
