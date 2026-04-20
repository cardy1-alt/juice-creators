import { useEffect, useState } from 'react';
import { BJ_PRICING } from '../../lib/bury-juice/pricing';
import { parseISODate } from '../../lib/bury-juice/availability';
import { Footer } from './storefront/Footer';
import type { BjBooking, BjPack } from '../../lib/bury-juice/types';

interface DashboardPayload {
  pack: BjPack;
  business: { name: string; contact_email: string };
  bookings: BjBooking[];
}

interface Props {
  token: string;
}

export default function SponsorDashboard({ token }: Props) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bury-juice/dashboard?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Link not found' : `HTTP ${r.status}`);
        return r.json();
      })
      .then((b) => setData(b))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [token]);

  if (error) {
    return (
      <div className="bj-surface">
        <section className="bj-section">
          <h1 style={{ color: 'var(--bj-crimson)', fontSize: 48 }}>Link expired</h1>
          <p>{error}</p>
          <p>Email jacob@buryjuice.com and we'll send a fresh one.</p>
        </section>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bj-surface">
        <section className="bj-section">
          <p style={{ color: 'var(--bj-mid)' }}>Loading your dashboard…</p>
        </section>
      </div>
    );
  }

  const { pack, business, bookings } = data;
  const tierLabel = BJ_PRICING[pack.tier].name;
  const expiresAt = new Date(pack.expires_at);
  const daysToExpiry = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const expiringSoon = daysToExpiry < 30;
  const upcoming = bookings
    .filter((b) => new Date(b.issue_date) >= new Date(Date.now() - 24 * 60 * 60 * 1000))
    .sort((a, b) => a.issue_date.localeCompare(b.issue_date));

  return (
    <div className="bj-surface">
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
          Sponsor dashboard
        </div>
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', color: 'var(--bj-crimson)', marginBottom: 16 }}>
          Hi {business.name}.
        </h1>
        <p style={{ fontSize: 18, maxWidth: 640 }}>
          You have <strong>{pack.credits_remaining}</strong> {tierLabel} placement
          {pack.credits_remaining === 1 ? '' : 's'} remaining on your {pack.size === 1 ? 'single booking' : `${pack.size}-pack`}.
        </p>

        {expiringSoon && (
          <div
            style={{
              background: 'var(--bj-gold)',
              color: 'var(--bj-charcoal)',
              padding: 16,
              marginTop: 24,
              fontWeight: 700,
            }}
          >
            Heads up — your pack expires in {daysToExpiry} day{daysToExpiry === 1 ? '' : 's'}.
          </div>
        )}
      </section>

      <section className="bj-section" style={{ paddingTop: 0 }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: 24 }}>Upcoming placements</h2>
        {upcoming.length === 0 ? (
          <p style={{ color: 'var(--bj-mid)' }}>
            No dates booked yet. Use the calendar on the storefront to reserve your Thursdays.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {upcoming.map((b) => (
              <div key={b.id} style={{ border: '1px solid var(--bj-faint)', padding: 20, background: 'var(--bj-white)' }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--bj-crimson)',
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  {BJ_PRICING[b.tier].name} · {b.status === 'pending_creative' ? 'Creative needed' : 'Locked in'}
                </div>
                <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 6 }}>
                  {parseISODate(b.issue_date).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                {b.headline && <div style={{ fontSize: 14, color: 'var(--bj-mid)' }}>{b.headline}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
