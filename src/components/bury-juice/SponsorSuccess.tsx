import { useEffect, useState } from 'react';
import { Footer } from './storefront/Footer';

export default function SponsorSuccess() {
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);

  useEffect(() => {
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
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', marginBottom: 12, fontWeight: 600 }}>
          Payment confirmed
        </h1>
        <p style={{ fontSize: 16, maxWidth: 560, color: 'var(--ink-60)', marginBottom: 20, lineHeight: 1.6 }}>
          Your Bury Juice sponsorship is locked in. Check your inbox for a confirmation, calendar invites for every booked
          Thursday, and a magic link to your dashboard where you can update creative any time.
        </p>
        {dashboardUrl && (
          <a className="bj-btn" href={dashboardUrl}>
            Open your dashboard
          </a>
        )}
        <p style={{ fontSize: 13, color: 'var(--ink-35)', marginTop: 24 }}>
          Anything off? Reply to the confirmation email or write to jacob@buryjuice.com.
        </p>
      </section>
      <Footer />
    </div>
  );
}
