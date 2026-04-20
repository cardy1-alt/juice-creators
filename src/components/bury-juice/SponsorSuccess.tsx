import { useEffect, useState } from 'react';
import { Footer } from './storefront/Footer';

export default function SponsorSuccess() {
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);

  useEffect(() => {
    // The Stripe redirect includes ?session_id=... — the webhook has
    // already finalised the booking by the time the customer lands, but
    // we call a confirmation endpoint so they can land directly on
    // their dashboard if they want to.
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;
    fetch(`/api/bury-juice/bookings/confirm?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { dashboardUrl?: string } | null) => {
        if (body?.dashboardUrl) setDashboardUrl(body.dashboardUrl);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="bj-surface">
      <section className="bj-section" style={{ minHeight: '70vh' }}>
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
          You're in
        </div>
        <h1 style={{ fontSize: 'clamp(56px, 8vw, 96px)', color: 'var(--bj-crimson)', marginBottom: 24 }}>
          Payment<br />confirmed.
        </h1>
        <p style={{ fontSize: 18, maxWidth: 640, marginBottom: 24 }}>
          Your Bury Juice sponsorship is locked in. Check your inbox for a confirmation, calendar invites for
          every booked Thursday, and a magic link to your sponsor dashboard where you can update creative any time.
        </p>
        {dashboardUrl && (
          <a className="bj-btn" href={dashboardUrl}>
            Open your dashboard
          </a>
        )}
        <p style={{ fontSize: 14, color: 'var(--bj-mid)', marginTop: 32 }}>
          Anything feels off? Reply to the confirmation email or write to jacob@buryjuice.com.
        </p>
      </section>
      <Footer />
    </div>
  );
}
