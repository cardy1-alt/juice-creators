import { Footer } from './storefront/Footer';

export default function SponsorSuccess() {
  return (
    <div className="bj-surface">
      <section className="bj-section" style={{ minHeight: '60vh', paddingTop: 72 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: 'var(--terra-light)',
            color: 'var(--terra)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 600,
            marginBottom: 20,
          }}
          aria-hidden
        >
          ✓
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', marginBottom: 12 }}>
          You're in.
        </h1>
        <p style={{ fontSize: 16, maxWidth: 560, color: 'var(--ink-60)', marginBottom: 20, lineHeight: 1.6 }}>
          Your Bury Juice sponsorship is locked in. Stripe will email you a receipt in a moment. On each Thursday you've booked, your placement goes live in the newsletter — no further action needed.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ink-35)', marginTop: 24 }}>
          Need to change your creative, swap a date, or ask anything else? Just write to hello@theburyjuice.com.
        </p>
      </section>
      <Footer />
    </div>
  );
}
