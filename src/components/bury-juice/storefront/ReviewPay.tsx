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
        <button
          type="button"
          className="bj-btn bj-btn--block"
          onClick={onCheckout}
          disabled={submitting}
          style={{ marginTop: 4 }}
        >
          {submitting ? (uploadStatus ?? 'Preparing checkout…') : `Pay ${formatGBP(total)} with Stripe`}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
          <LockIcon />
          <span style={{ fontSize: 12, color: 'var(--ink-35)' }}>Secure payment by Stripe</span>
        </div>
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            marginTop: 10,
            paddingTop: 12,
            display: 'grid',
            gap: 8,
            fontSize: 13,
            color: 'var(--ink-60)',
            lineHeight: 1.5,
          }}
        >
          <Reassurance>You'll pop over to Stripe to pay, then come straight back.</Reassurance>
          <Reassurance>Change your creative any time up to Tuesday 8pm before the issue sends.</Reassurance>
          <Reassurance>Need to swap a date or ask something? Just reply to the Stripe receipt or email hello@theburyjuice.com.</Reassurance>
        </div>
      </div>
    </section>
  );
}

function Reassurance({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 14,
          height: 14,
          borderRadius: 999,
          background: 'var(--terra-light)',
          color: 'var(--terra)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 700,
          marginTop: 3,
        }}
      >
        ✓
      </span>
      <span>{children}</span>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-35)' }} aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
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
