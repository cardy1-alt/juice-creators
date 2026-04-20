import { BJ_PRICING, formatGBP, type BjPackSize, type BjTier } from '../../../lib/bury-juice/pricing';

interface Props {
  tier: BjTier;
  size: BjPackSize;
  selectedDates: string[];
  total: number;
  onCheckout: () => void;
  submitting: boolean;
  submitError: string | null;
  uploadStatus: string | null;
}

export function ReviewPay(props: Props) {
  const { tier, size, selectedDates, total, onCheckout, submitting, submitError, uploadStatus } = props;
  const t = BJ_PRICING[tier];
  return (
    <section className="bj-section" style={{ paddingTop: 32 }}>
      <h2 style={{ fontSize: 22, marginBottom: 16 }}>Review &amp; pay</h2>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--r-card)',
          padding: 20,
          maxWidth: 560,
          display: 'grid',
          gap: 10,
        }}
      >
        <Row label="Placement" value={`${t.name} — ${t.position.toLowerCase()}`} />
        <Row label="Quantity" value={size === 1 ? 'Single issue' : `${size}-pack`} />
        <Row
          label="Dates"
          value={selectedDates.length > 0 ? selectedDates.join(', ') : '—'}
        />
        <div className="bj-rule" style={{ marginTop: 4, marginBottom: 4 }} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ color: 'var(--ink-60)', fontSize: 14 }}>Total</span>
          <span style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.02em' }}>{formatGBP(total)}</span>
        </div>
        {submitError && (
          <div style={{ color: 'var(--destructive)', fontSize: 14, marginTop: 4 }}>{submitError}</div>
        )}
        {uploadStatus && (
          <div style={{ color: 'var(--ink-60)', fontSize: 14, marginTop: 4 }}>{uploadStatus}</div>
        )}
        <button type="button" className="bj-btn" onClick={onCheckout} disabled={submitting} style={{ marginTop: 4 }}>
          {submitting ? (uploadStatus ?? 'Preparing checkout…') : 'Pay securely with Stripe'}
        </button>
        <p style={{ fontSize: 13, color: 'var(--ink-60)', margin: 0, marginTop: 4 }}>
          You'll pop over to Stripe to pay, then come straight back. Confirmation and dashboard link email to you on success.
        </p>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', fontSize: 14 }}>
      <span style={{ color: 'var(--ink-60)', flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: 'right', color: 'var(--ink)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
