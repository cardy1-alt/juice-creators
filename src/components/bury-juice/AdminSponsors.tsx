import { useEffect, useMemo, useState } from 'react';
import { BJ_PRICING, formatGBP, type BjTier } from '../../lib/bury-juice/pricing';
import { nextNThursdays, parseISODate } from '../../lib/bury-juice/availability';
import type { BjBooking } from '../../lib/bury-juice/types';
import { Footer } from './storefront/Footer';
import AdminIssueView from './AdminIssueView';
import { LEGACY_SPONSORS } from '../../lib/bury-juice/legacy-sponsors';

interface AdminPayload {
  bookings: BjBooking[];
  businesses: Record<string, { id: string; name: string; contact_email: string }>;
  revenue: { month: number; quarter: number; ytd: number };
  activePacks: {
    id: string;
    tier: BjTier;
    size: number;
    credits_remaining: number;
    business_name: string;
  }[];
}

interface Props {
  adminPassword: string | null;
  onSignIn: (pw: string) => void;
  selectedIssueDate: string | null;
  onSelectIssueDate: (iso: string | null) => void;
}

export default function AdminSponsors({ adminPassword, onSignIn, selectedIssueDate, onSelectIssueDate }: Props) {
  const [pw, setPw] = useState('');
  const [data, setData] = useState<AdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminPassword) return;
    fetch('/api/bury-juice/admin/overview', {
      headers: { 'X-BJ-Admin-Password': adminPassword },
    })
      .then((r) => {
        if (r.status === 401) throw new Error('Password incorrect');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((b) => setData(b))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [adminPassword]);

  if (!adminPassword) {
    return (
      <div className="bj-surface">
        <section className="bj-section">
          <h1 style={{ color: 'var(--bj-crimson)', fontSize: 48, marginBottom: 24 }}>Admin</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSignIn(pw);
            }}
            style={{ maxWidth: 360 }}
          >
            <label className="bj-label">Password</label>
            <input
              className="bj-input"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <button type="submit" className="bj-btn" style={{ marginTop: 16 }}>
              Sign in
            </button>
          </form>
        </section>
        <Footer />
      </div>
    );
  }

  if (selectedIssueDate) {
    return (
      <AdminIssueView
        adminPassword={adminPassword}
        issueDate={selectedIssueDate}
        onBack={() => onSelectIssueDate(null)}
      />
    );
  }

  if (error) {
    return (
      <div className="bj-surface">
        <section className="bj-section">
          <h1 style={{ color: 'var(--bj-crimson)' }}>Something went wrong</h1>
          <p>{error}</p>
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bj-surface">
        <section className="bj-section">
          <p style={{ color: 'var(--bj-mid)' }}>Loading…</p>
        </section>
      </div>
    );
  }

  return <AdminOverviewView data={data} onSelectIssueDate={onSelectIssueDate} />;
}

function AdminOverviewView({
  data,
  onSelectIssueDate,
}: {
  data: AdminPayload;
  onSelectIssueDate: (iso: string) => void;
}) {
  const upcoming = useMemo(() => nextNThursdays(8), []);
  const byDate = useMemo(() => {
    const map = new Map<string, BjBooking[]>();
    for (const b of data.bookings) {
      const arr = map.get(b.issue_date) ?? [];
      arr.push(b);
      map.set(b.issue_date, arr);
    }
    return map;
  }, [data.bookings]);

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
          Admin
        </div>
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', color: 'var(--bj-crimson)', marginBottom: 24 }}>
          Bury Juice sponsor ops
        </h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 48,
          }}
        >
          <RevenueCard label="This month" amount={data.revenue.month} />
          <RevenueCard label="This quarter" amount={data.revenue.quarter} />
          <RevenueCard label="YTD" amount={data.revenue.ytd} />
        </div>

        <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', marginBottom: 16 }}>Next 8 issues</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {upcoming.map((iso) => (
            <IssueRow
              key={iso}
              iso={iso}
              bookings={byDate.get(iso) ?? []}
              businesses={data.businesses}
              onClick={() => onSelectIssueDate(iso)}
            />
          ))}
        </div>
      </section>

      <section className="bj-section" style={{ paddingTop: 0 }}>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', marginBottom: 16 }}>Active packs</h2>
        {data.activePacks.length === 0 ? (
          <p style={{ color: 'var(--bj-mid)' }}>No active packs with remaining credits.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {data.activePacks.map((p) => (
              <div key={p.id} style={{ border: '1px solid var(--bj-faint)', padding: 16, background: 'var(--bj-white)' }}>
                <strong>{p.business_name}</strong> — {BJ_PRICING[p.tier].name} · {p.credits_remaining}/
                {p.size} credits remaining
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bj-section" style={{ paddingTop: 0 }}>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 32px)', marginBottom: 16 }}>Legacy sponsors</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {LEGACY_SPONSORS.map((s) => (
            <div
              key={s.email}
              style={{ border: '1px solid var(--bj-faint)', padding: 16, background: 'var(--bj-white)' }}
            >
              <strong>{s.name}</strong> — {BJ_PRICING[s.tier].name} ·{' '}
              {s.isComp ? 'Comp' : `${formatGBP(s.monthlyRateGbp)}/mo`} · {s.cadence}
              <div style={{ fontSize: 13, color: 'var(--bj-mid)', marginTop: 4 }}>{s.notes}</div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function RevenueCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div style={{ border: '2px solid var(--bj-charcoal)', padding: 20, background: 'var(--bj-white)' }}>
      <div
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontWeight: 700,
          color: 'var(--bj-mid)',
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 32, marginTop: 6 }}>{formatGBP(amount)}</div>
    </div>
  );
}

function IssueRow({
  iso,
  bookings,
  businesses,
  onClick,
}: {
  iso: string;
  bookings: BjBooking[];
  businesses: AdminPayload['businesses'];
  onClick: () => void;
}) {
  const slotFor = (tier: BjTier) => bookings.find((b) => b.tier === tier && b.status !== 'cancelled');
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        border: '1px solid var(--bj-faint)',
        background: 'var(--bj-white)',
        padding: 16,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'inherit',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 1fr 1fr',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            {parseISODate(iso).toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--bj-crimson)',
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {iso}
          </div>
        </div>
        {(['gold', 'silver', 'bronze'] as const).map((tier) => {
          const slot = slotFor(tier);
          const businessName = slot ? businesses[slot.business_id]?.name ?? '(unknown)' : null;
          return (
            <div key={tier}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--bj-mid)',
                  fontWeight: 700,
                }}
              >
                {tier}
              </div>
              <div style={{ fontWeight: 700 }}>
                {businessName ?? <span style={{ color: 'var(--bj-soft)' }}>Slot open</span>}
              </div>
              {slot && (
                <div
                  style={{
                    fontSize: 11,
                    color: slot.status === 'pending_creative' ? 'var(--bj-crimson)' : 'var(--bj-mid)',
                  }}
                >
                  {slot.status === 'pending_creative' ? 'Needs creative' : 'Ready'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </button>
  );
}
