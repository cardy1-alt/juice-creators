import { useEffect, useState } from 'react';
import { BJ_PRICING, type BjTier } from '../../../lib/bury-juice/pricing.js';
import type { CreativeFormValue } from './CreativeForm';

interface Props {
  tier: BjTier;
  value: CreativeFormValue;
}

// Rough visualisation of where the sponsor's ad sits in the
// newsletter. Not a pixel-perfect beehiiv render — just enough for
// someone filling in the form to picture what readers will see.
// Placeholder text shows when a field is empty so the preview never
// looks broken mid-typing.

export function PlacementPreview({ tier, value }: Props) {
  const t = BJ_PRICING[tier];
  const imageUrl = useObjectUrl(value.imageFile);
  const logoUrl = useObjectUrl(value.logoFile);

  const headline = value.headline.trim() || 'Your headline here';
  const body = value.bodyCopy.trim() || 'Your copy goes here — a sentence or two for Bury Juice readers.';
  const cta = value.ctaUrl.trim() ? 'Learn more →' : 'Learn more →';
  const hasPhoto = tier === 'feature' || tier === 'primary';
  const hasLogo = tier === 'primary';

  return (
    <section className="bj-section" style={{ paddingTop: 32 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: 22, margin: 0 }}>Preview</h2>
        <span style={{ fontSize: 12, color: 'var(--ink-35)' }}>
          Rough — not a pixel-perfect newsletter render
        </span>
      </div>

      {/* Newsletter frame — a faux beehiiv container */}
      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--r-card)',
          background: 'var(--shell)',
          padding: 20,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Tier badge top-right so the viewer knows which slot
            they're previewing */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--terra)',
            background: 'var(--terra-light)',
            padding: '3px 10px',
            borderRadius: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {t.name}
        </div>

        {/* Ghost newsletter lines above (only for Classified to show
            it sits under newsletter content) and below for Primary /
            Feature to show it sits within the issue flow. */}
        {tier !== 'primary' && <GhostLines count={2} />}

        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: 18,
            margin: '14px 0',
          }}
        >
          {tier === 'primary' && (
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--terra)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              This week's primary sponsor
            </div>
          )}

          {hasLogo && (
            <div style={{ marginBottom: 14 }}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  style={{
                    maxWidth: 120,
                    maxHeight: 48,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <PlaceholderBox label="Logo" width={120} height={40} />
              )}
            </div>
          )}

          <div
            style={{
              fontSize: tier === 'primary' ? 22 : tier === 'feature' ? 19 : 16,
              fontWeight: 700,
              lineHeight: 1.2,
              color: value.headline.trim() ? 'var(--ink)' : 'var(--ink-35)',
              letterSpacing: '-0.01em',
              marginBottom: 10,
            }}
          >
            {headline}
          </div>

          {hasPhoto && (
            <div style={{ marginBottom: 12 }}>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Placement preview"
                  style={{
                    width: '100%',
                    maxHeight: 220,
                    objectFit: 'cover',
                    borderRadius: 6,
                    display: 'block',
                  }}
                />
              ) : (
                <PlaceholderBox label="Photo" width="100%" height={tier === 'primary' ? 200 : 160} />
              )}
            </div>
          )}

          <div
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: value.bodyCopy.trim() ? 'var(--ink)' : 'var(--ink-35)',
              marginBottom: 14,
              whiteSpace: 'pre-wrap',
            }}
          >
            {body}
          </div>

          <div
            style={{
              display: 'inline-block',
              color: 'var(--terra)',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              opacity: value.ctaUrl.trim() ? 1 : 0.5,
            }}
          >
            {cta}
          </div>
        </div>

        <GhostLines count={tier === 'classified' ? 1 : 3} />
      </div>
    </section>
  );
}

function GhostLines({ count }: { count: number }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: '2px 4px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 8,
            background: 'var(--ink-08)',
            borderRadius: 4,
            width: `${80 - (i % 2) * 25}%`,
          }}
        />
      ))}
    </div>
  );
}

function PlaceholderBox({
  label,
  width,
  height,
}: {
  label: string;
  width: number | string;
  height: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: 'var(--ink-08)',
        border: '1px dashed var(--border-color-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-35)',
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {label}
    </div>
  );
}

// Creates a temporary object URL for a File and revokes it on
// unmount / file change. Same pattern DropZone uses for its
// thumbnail — kept here so the preview doesn't need to be told
// about the URL from above.
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}
