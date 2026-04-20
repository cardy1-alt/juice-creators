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
  // Stylised representation of where the ad sits in the newsletter.
  const block = {
    classified: { top: false, middle: false, bottom: true },
    feature:    { top: false, middle: true,  bottom: false },
    primary:    { top: true,  middle: false, bottom: false },
  }[tier];
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--r-input)',
        background: 'var(--shell)',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginBottom: 16,
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
              background: isSponsor ? 'var(--terra)' : 'var(--ink-08)',
              color: isSponsor ? '#fff' : 'var(--ink-35)',
              padding: '8px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              height: row.key === 'top' ? 40 : row.key === 'middle' ? 32 : 24,
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
    <section className="bj-section" style={{ paddingTop: 32 }}>
      <h2 style={{ fontSize: 22, marginBottom: 6 }}>Pick your placement</h2>
      <p style={{ color: 'var(--ink-60)', margin: 0, marginBottom: 20, fontSize: 15 }}>
        Three formats — one of each goes out in every Thursday issue.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {TIERS.map((tier) => {
          const t = BJ_PRICING[tier];
          const isSelected = selected === tier;
          return (
            <div
              key={tier}
              style={{
                background: 'var(--card)',
                color: 'var(--ink)',
                border: `1px solid ${isSelected ? 'var(--terra)' : 'var(--border-color)'}`,
                borderRadius: 'var(--r-card)',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: isSelected ? '0 0 0 3px var(--terra-10)' : 'none',
                transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--terra)',
                  marginBottom: 4,
                }}
              >
                {t.position}
              </div>
              <h3 style={{ fontSize: 22, marginBottom: 8 }}>{t.name}</h3>
              <p style={{ color: 'var(--ink-60)', lineHeight: 1.5, fontSize: 14, margin: 0, marginBottom: 16 }}>
                {t.description}
              </p>

              <TierPreview tier={tier} />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {t.format.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'var(--ink-08)',
                      color: 'var(--ink-60)',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
                <PriceRow label="Single issue" price={formatGBP(t.single)} badge={null} />
                <PriceRow
                  label="4-pack"
                  price={formatGBP(t.pack_4)}
                  badge={`Save ${packSavingsPct(tier, 4)}%`}
                />
                <PriceRow
                  label="12-pack"
                  price={formatGBP(t.pack_12)}
                  badge={`Save ${packSavingsPct(tier, 12)}%`}
                />
              </div>

              <button
                type="button"
                onClick={() => onSelect(tier)}
                className={`bj-btn${isSelected ? '' : ' bj-btn--ghost'}`}
                style={{ marginTop: 'auto' }}
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
}: {
  label: string;
  price: string;
  badge: string | null;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 14,
      }}
    >
      <span style={{ color: 'var(--ink-60)' }}>{label}</span>
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        {badge && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--terra-light)',
              color: 'var(--terra)',
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            {badge}
          </span>
        )}
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{price}</span>
      </span>
    </div>
  );
}
