import { BJ_PRICING, formatGBP, type BjPackSize, type BjTier } from '../../../lib/bury-juice/pricing';

interface Props {
  tier: BjTier;
  size: BjPackSize;
  selectedDates: string[];
  pickLater: boolean;
  total: number;
  onCheckout: () => void;
  submitting: boolean;
  submitError: string | null;
}

export function ReviewPay(props: Props) {
  const { tier, size, selectedDates, pickLater, total, onCheckout, submitting, submitError } = props;
  const t = BJ_PRICING[tier];
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
        Review
      </div>
      <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginBottom: 32 }}>Check and pay.</h2>
      <div
        style={{
          border: '2px solid var(--bj-charcoal)',
          padding: 24,
          maxWidth: 640,
          display: 'grid',
          gap: 16,
        }}
      >
        <Row label="Tier" value={`${t.name} — ${t.placement}`} />
        <Row label="Quantity" value={size === 1 ? 'Single placement' : `${size}-pack`} />
        <Row
          label="Dates"
          value={
            pickLater || selectedDates.length === 0
              ? 'To be selected via dashboard'
              : selectedDates.join(', ')
          }
        />
        <div className="bj-rule" />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>
            Total
          </span>
          <span style={{ fontWeight: 900, fontSize: 32 }}>{formatGBP(total)}</span>
        </div>
        {submitError && (
          <div style={{ color: 'var(--bj-crimson)', fontSize: 14 }}>{submitError}</div>
        )}
        <button type="button" className="bj-btn" onClick={onCheckout} disabled={submitting}>
          {submitting ? 'Sending you to Stripe…' : 'Pay via Stripe'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--bj-mid)', margin: 0 }}>
          You'll be redirected to Stripe to complete payment. A confirmation email and dashboard link arrive on success.
        </p>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 24, justifyContent: 'space-between', fontSize: 14 }}>
      <span
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--bj-mid)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ textAlign: 'right', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
