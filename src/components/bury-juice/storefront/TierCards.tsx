import {
  BJ_PRICING,
  type BjTier,
  formatGBP,
  packSavingsPct,
} from '../../../lib/bury-juice/pricing';

interface Props {
  onSelect: (tier: BjTier) => void;
  selected?: BjTier | null;
}

const TIERS: BjTier[] = ['classified', 'feature', 'primary'];

function TierPreview({ tier }: { tier: BjTier }) {
  // A stylised representation of where the ad sits in the newsletter.
  // Simple SVG-free blocks; crimson marks the sponsor slot.
  const block = {
    classified: { top: false, middle: false, bottom: true },
    feature:    { top: false, middle: true,  bottom: false },
    primary:    { top: true,  middle: false, bottom: false },
  }[tier];
  return (
    <div
      style={{
        border: '1px solid var(--bj-faint)',
        background: 'var(--bj-white)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 18,
      }}
      aria-hidden
    >
      {[
        { key: 'top', label: 'Primary' },
        { key: 'middle', label: 'Feature' },
        { key: 'bottom', label: 'Classified' },
      ].map((row) => {
        const isSponsor = (block as Record<string, boolean>)[row.key];
        return (
          <div
            key={row.key}
            style={{
              background: isSponsor ? 'var(--bj-crimson)' : 'var(--bj-faint)',
              color: isSponsor ? '#fff' : 'var(--bj-soft)',
              padding: '10px 8px',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700,
              height: row.key === 'top' ? 48 : row.key === 'middle' ? 38 : 28,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {row.label}
          </div>
        );
      })}
    </div>
  );
}

export function TierCards({ onSelect, selected }: Props) {
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
        Tiers
      </div>
      <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginBottom: 40 }}>Pick your placement.</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 24,
        }}
      >
        {TIERS.map((tier) => {
          const t = BJ_PRICING[tier];
          const isSelected = selected === tier;
          return (
            <div
              key={tier}
              style={{
                background: isSelected ? 'var(--bj-crimson)' : 'var(--bj-white)',
                color: isSelected ? 'var(--bj-white)' : 'var(--bj-charcoal)',
                border: '2px solid var(--bj-crimson)',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  opacity: 0.75,
                  marginBottom: 8,
                }}
              >
                {t.position}
              </div>
              <h3 style={{ fontSize: 36, color: 'inherit', marginBottom: 12 }}>{t.name}</h3>
              <p style={{ marginBottom: 18, lineHeight: 1.5, color: 'inherit', opacity: 0.85 }}>
                {t.description}
              </p>

              <TierPreview tier={tier} />

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px 0' }}>
                {t.format.map((f) => (
                  <li
                    key={f}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '6px 0',
                      borderBottom: '1px solid currentColor',
                      opacity: 0.9,
                    }}
                  >
                    {f}
                  </li>
                ))}
              </ul>

              <div style={{ display: 'grid', gap: 8, marginBottom: 22 }}>
                <PriceRow label="Single" price={formatGBP(t.single)} badge={null} inverted={isSelected} />
                <PriceRow
                  label="4-pack"
                  price={formatGBP(t.pack_4)}
                  badge={`Save ${packSavingsPct(tier, 4)}%`}
                  inverted={isSelected}
                />
                <PriceRow
                  label="12-pack"
                  price={formatGBP(t.pack_12)}
                  badge={`Save ${packSavingsPct(tier, 12)}%`}
                  inverted={isSelected}
                />
              </div>

              <button
                type="button"
                onClick={() => onSelect(tier)}
                className="bj-btn"
                style={{
                  marginTop: 'auto',
                  background: isSelected ? 'var(--bj-white)' : 'var(--bj-crimson)',
                  color: isSelected ? 'var(--bj-crimson)' : 'var(--bj-white)',
                  borderColor: isSelected ? 'var(--bj-white)' : 'var(--bj-crimson)',
                }}
              >
                {isSelected ? `${t.name} selected` : `Choose ${t.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PriceRow({
  label,
  price,
  badge,
  inverted,
}: {
  label: string;
  price: string;
  badge: string | null;
  inverted: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 14,
      }}
    >
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span style={{ display: 'inline-flex', gap: 10, alignItems: 'baseline' }}>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: inverted ? 'var(--bj-gold)' : 'var(--bj-gold)',
              color: 'var(--bj-charcoal)',
              padding: '3px 6px',
            }}
          >
            {badge}
          </span>
        )}
        <span style={{ fontWeight: 900, fontSize: 18 }}>{price}</span>
      </span>
    </div>
  );
}
