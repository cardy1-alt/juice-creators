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
          Payment confirmed
        </h1>
        <p style={{ fontSize: 16, maxWidth: 560, color: 'var(--ink-60)', marginBottom: 20, lineHeight: 1.6 }}>
          Your Bury Juice sponsorship is locked in. A confirmation email — with calendar invites for every booked Thursday — is on its way.
        </p>
        <p style={{ fontSize: 13, color: 'var(--ink-35)', marginTop: 24 }}>
          Need to change anything? Just reply to the confirmation email or write to hello@theburyjuice.com.
        </p>
      </section>
      <Footer />
    </div>
  );
}
