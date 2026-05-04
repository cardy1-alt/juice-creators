import { BJ_PRICING, type BjTier } from '../../../lib/bury-juice/pricing';
import { DropZone } from './DropZone';

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

  return (
    <section className="bj-section" style={{ paddingTop: 32 }}>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Your creative</h2>
      <p style={{ color: 'var(--ink-60)', margin: 0, marginBottom: 20, fontSize: 15 }}>
        This is what Bury Juice readers see on the day. You can change it up to 48h before send.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
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
              inputMode="email"
              autoComplete="email"
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
              inputMode="tel"
              autoComplete="tel"
              className="bj-input"
              value={value.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
              placeholder="01284 000000"
            />
          )}
        />
        <Field
          label="Link for the CTA"
          helper="We'll add https:// automatically."
          error={errors.ctaUrl}
          render={(id) => (
            <input
              id={id}
              type="text"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              className="bj-input"
              value={value.ctaUrl}
              onChange={(e) => set('ctaUrl', e.target.value)}
              placeholder="yourbusiness.co.uk/offer"
            />
          )}
        />
      </div>

      <div style={{ marginTop: 16 }}>
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

      <div style={{ marginTop: 16 }}>
        <Field
          label={`Body copy (${value.bodyCopy.length}/${bodyMax})`}
          error={errors.bodyCopy}
          render={(id) => (
            <textarea
              id={id}
              className="bj-textarea"
              rows={4}
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
            gridTemplateColumns: needsLogo ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr',
            gap: 16,
            marginTop: 16,
          }}
        >
          {needsImage && (
            <DropZone
              id="bj-photo"
              label="Photo"
              helper="JPEG or PNG · min 1200px wide · max 5 MB"
              accept="image/jpeg,image/png,image/webp"
              file={value.imageFile}
              error={errors.imageFile}
              onChange={(f) => set('imageFile', f)}
            />
          )}
          {needsLogo && (
            <DropZone
              id="bj-logo"
              label="Logo"
              helper="Transparent PNG preferred · max 5 MB"
              accept="image/png,image/svg+xml,image/webp"
              file={value.logoFile}
              error={errors.logoFile}
              onChange={(f) => set('logoFile', f)}
            />
          )}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  helper,
  error,
  render,
}: {
  label: string;
  helper?: string;
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
      {helper && !error && (
        <div style={{ color: 'var(--ink-35)', fontSize: 12, marginTop: 6 }}>{helper}</div>
      )}
      {error && (
        <div style={{ color: 'var(--destructive)', fontSize: 12, marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}

// Normalises a raw URL input — prepends https:// if the user skipped
// the scheme so `testbusiness.com` parses cleanly as a URL.
function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
    const normalised = normaliseUrl(value.ctaUrl);
    const parsed = new URL(normalised);
    // Reject obviously broken inputs (no host, missing dot in hostname).
    if (!parsed.hostname || !parsed.hostname.includes('.')) throw new Error('bad host');
  } catch {
    errors.ctaUrl = 'Enter a web address, e.g. yourbusiness.co.uk';
  }
  if ((tier === 'feature' || tier === 'primary') && !value.imageFile) errors.imageFile = 'Photo required';
  if (tier === 'primary' && !value.logoFile) errors.logoFile = 'Logo required';
  return errors;
}

// Exported so the SponsorStorefront can send a cleaned-up URL to the
// API (with https:// prepended when necessary).
export { normaliseUrl };
