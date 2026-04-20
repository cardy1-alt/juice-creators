import { useEffect, useState } from 'react';
import { BJ_PRICING, type BjTier } from '../../lib/bury-juice/pricing';
import { generateHTMLForBooking } from '../../lib/bury-juice/beehiiv-html';
import { parseISODate } from '../../lib/bury-juice/availability';
import type { BjBooking } from '../../lib/bury-juice/types';
import { Footer } from './storefront/Footer';

interface Payload {
  issue_date: string;
  slots: {
    tier: BjTier;
    booking: BjBooking | null;
    business: { id: string; name: string; contact_email: string } | null;
  }[];
}

interface Props {
  adminPassword: string;
  issueDate: string;
  onBack: () => void;
}

export default function AdminIssueView({ adminPassword, issueDate, onBack }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingTier, setRejectingTier] = useState<BjTier | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  useEffect(() => {
    fetch(`/api/bury-juice/admin/issue?date=${encodeURIComponent(issueDate)}`, {
      headers: { 'X-BJ-Admin-Password': adminPassword },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [adminPassword, issueDate]);

  async function submitRejection(bookingId: string) {
    await fetch('/api/bury-juice/admin/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-BJ-Admin-Password': adminPassword },
      body: JSON.stringify({ booking_id: bookingId, notes: rejectNotes }),
    });
    setRejectingTier(null);
    setRejectNotes('');
  }

  if (error) {
    return (
      <div className="bj-surface">
        <section className="bj-section">
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

  return (
    <div className="bj-surface">
      <section className="bj-section">
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--bj-crimson)',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 24,
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          ← Back to overview
        </button>
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', color: 'var(--bj-crimson)', marginBottom: 8 }}>
          {parseISODate(data.issue_date).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </h1>
        <p style={{ color: 'var(--bj-mid)', marginBottom: 32 }}>
          Paste-ready HTML blocks for this Thursday's beehiiv issue.
        </p>

        <div style={{ display: 'grid', gap: 32 }}>
          {(['gold', 'silver', 'bronze'] as const).map((tier) => {
            const slot = data.slots.find((s) => s.tier === tier);
            return (
              <SlotBlock
                key={tier}
                tier={tier}
                slot={slot}
                isRejecting={rejectingTier === tier}
                rejectNotes={rejectNotes}
                onRejectStart={() => setRejectingTier(tier)}
                onRejectCancel={() => setRejectingTier(null)}
                onRejectNotesChange={setRejectNotes}
                onRejectSubmit={(bid) => submitRejection(bid)}
              />
            );
          })}
        </div>
      </section>
      <Footer />
    </div>
  );
}

function SlotBlock({
  tier,
  slot,
  isRejecting,
  rejectNotes,
  onRejectStart,
  onRejectCancel,
  onRejectNotesChange,
  onRejectSubmit,
}: {
  tier: BjTier;
  slot: Payload['slots'][number] | undefined;
  isRejecting: boolean;
  rejectNotes: string;
  onRejectStart: () => void;
  onRejectCancel: () => void;
  onRejectNotesChange: (v: string) => void;
  onRejectSubmit: (bookingId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const booking = slot?.booking ?? null;
  const businessName = slot?.business?.name ?? null;
  const html = booking ? generateHTMLForBooking(booking) : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  return (
    <div style={{ border: '2px solid var(--bj-charcoal)', padding: 24, background: 'var(--bj-white)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 28 }}>{BJ_PRICING[tier].name}</h2>
        {booking && (
          <button type="button" className="bj-btn" onClick={copy}>
            {copied ? 'Copied!' : 'Copy HTML'}
          </button>
        )}
      </div>
      {!booking ? (
        <p style={{ color: 'var(--bj-mid)' }}>Slot open.</p>
      ) : (
        <>
          <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--bj-mid)' }}>
            {businessName} — status:{' '}
            <strong style={{ color: booking.status === 'pending_creative' ? 'var(--bj-crimson)' : 'inherit' }}>
              {booking.status}
            </strong>
          </div>
          <pre
            style={{
              background: 'var(--bj-cream)',
              padding: 16,
              fontSize: 12,
              overflow: 'auto',
              maxHeight: 240,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              margin: 0,
            }}
          >
            {html}
          </pre>
          {!isRejecting ? (
            <button
              type="button"
              onClick={onRejectStart}
              style={{
                marginTop: 12,
                background: 'transparent',
                border: 'none',
                color: 'var(--bj-crimson)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Request rework →
            </button>
          ) : (
            <div style={{ marginTop: 16 }}>
              <label className="bj-label">What needs changing?</label>
              <textarea
                className="bj-textarea"
                rows={3}
                value={rejectNotes}
                onChange={(e) => onRejectNotesChange(e.target.value)}
                placeholder="e.g. Photo is lower resolution than 1200px — please resend."
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="bj-btn"
                  disabled={rejectNotes.trim().length === 0}
                  onClick={() => onRejectSubmit(booking.id)}
                >
                  Send resubmit email
                </button>
                <button
                  type="button"
                  onClick={onRejectCancel}
                  className="bj-btn bj-btn--ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
