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
  const expiringSoon = daysToExpiry < 30 && pack.credits_remaining > 0;
  const upcoming = bookings
    .filter((b) => new Date(b.issue_date) >= new Date(Date.now() - 24 * 60 * 60 * 1000))
    .sort((a, b) => a.issue_date.localeCompare(b.issue_date));

  // Status sentence depends on whether the sponsor has credits left or
  // everything is already booked in. "0 remaining" on a fresh single
  // booking reads like the payment evaporated; lean positive instead.
  let status: React.ReactNode;
  if (pack.credits_remaining === 0 && upcoming.length > 0) {
    status = (
      <>You're all set — your {tierLabel.toLowerCase()} placement is locked in below.</>
    );
  } else if (pack.credits_remaining === 0) {
    status = (
      <>Pack used up. Head back to the storefront to book another run.</>
    );
  } else if (pack.size === 1) {
    status = (
      <>
        <strong>{pack.credits_remaining}</strong> {tierLabel} placement ready to book.
      </>
    );
  } else {
    status = (
      <>
        <strong>{pack.credits_remaining}</strong> of {pack.size} {tierLabel} placements remaining on your {pack.size}-pack.
      </>
    );
  }

  return (
    <div className="bj-surface">
      <section className="bj-section">
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--terra)',
            marginBottom: 12,
          }}
        >
          Sponsor dashboard
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 52px)', color: 'var(--ink)', marginBottom: 12 }}>
          Hi {business.name}.
        </h1>
        <p style={{ fontSize: 17, maxWidth: 640, color: 'var(--ink-60)', lineHeight: 1.55, margin: 0 }}>
          {status}
        </p>

        {expiringSoon && (
          <div
            style={{
              background: 'var(--terra-light)',
              color: 'var(--ink)',
              border: '1px solid var(--terra)',
              borderRadius: 'var(--r-card)',
              padding: 14,
              marginTop: 20,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Heads up — your pack expires in {daysToExpiry} day{daysToExpiry === 1 ? '' : 's'}.
          </div>
        )}
      </section>

      <section className="bj-section" style={{ paddingTop: 16 }}>
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Upcoming placements</h2>
        {upcoming.length === 0 ? (
          <p style={{ color: 'var(--ink-60)', margin: 0 }}>
            No dates booked yet. Head back to the storefront to pick your Thursdays.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {upcoming.map((b) => (
              <div
                key={b.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--r-card)',
                  padding: 16,
                  background: 'var(--card)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: b.status === 'pending_creative' ? 'var(--terra)' : 'var(--ink-60)',
                    marginBottom: 4,
                  }}
                >
                  {BJ_PRICING[b.tier].name} · {b.status === 'pending_creative' ? 'Creative needed' : 'Locked in'}
                </div>
                <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)', marginBottom: 4 }}>
                  {parseISODate(b.issue_date).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                {b.headline && <div style={{ fontSize: 14, color: 'var(--ink-60)' }}>{b.headline}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
