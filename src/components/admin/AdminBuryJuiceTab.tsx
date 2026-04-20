import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BJ_PRICING, formatGBP, type BjTier } from '../../lib/bury-juice/pricing.js';
import { generateHTMLForBooking } from '../../lib/bury-juice/beehiiv-html.js';
import { nextNThursdays, parseISODate } from '../../lib/bury-juice/availability.js';
import type { BjBooking } from '../../lib/bury-juice/types.js';
import { Copy, Check, ChevronDown } from 'lucide-react';

interface BusinessRow {
  id: string;
  name: string;
  contact_email: string;
}

// Nayba-admin-side view of Bury Juice sponsor inventory. Accessed
// from the existing AdminDashboard, so no separate login required —
// the bj_* RLS policies in 20260420150000 grant access based on the
// admin's JWT email matching current_setting('app.admin_email').

const TIER_ORDER: BjTier[] = ['primary', 'feature', 'classified'];
const WEEKS_AHEAD = 12;

export default function AdminBuryJuiceTab() {
  const [bookings, setBookings] = useState<BjBooking[] | null>(null);
  const [businesses, setBusinesses] = useState<Record<string, BusinessRow>>({});
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('bj_bookings')
        .select('*')
        .neq('status', 'cancelled')
        .order('issue_date', { ascending: true });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      setBookings((data ?? []) as BjBooking[]);
      const ids = Array.from(new Set((data ?? []).map((b) => b.business_id)));
      if (ids.length === 0) {
        setBusinesses({});
        return;
      }
      const { data: brows } = await supabase
        .from('businesses')
        .select('id,name,contact_email')
        .in('id', ids);
      if (cancelled) return;
      const map: Record<string, BusinessRow> = {};
      for (const b of (brows ?? []) as BusinessRow[]) map[b.id] = b;
      setBusinesses(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(() => nextNThursdays(WEEKS_AHEAD), []);
  const byDate = useMemo(() => {
    const map = new Map<string, BjBooking[]>();
    for (const b of bookings ?? []) {
      const arr = map.get(b.issue_date) ?? [];
      arr.push(b);
      map.set(b.issue_date, arr);
    }
    return map;
  }, [bookings]);

  const revenue = useMemo(() => {
    if (!bookings) return { month: 0, quarter: 0, ytd: 0 };
    const now = new Date();
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
    const q0 = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const y0 = new Date(now.getFullYear(), 0, 1);
    let month = 0, quarter = 0, ytd = 0;
    for (const b of bookings) {
      if (b.source === 'comp' || !b.amount_paid_gbp) continue;
      const d = new Date(b.issue_date);
      if (d >= y0) ytd += b.amount_paid_gbp;
      if (d >= q0) quarter += b.amount_paid_gbp;
      if (d >= m0) month += b.amount_paid_gbp;
    }
    return { month, quarter, ytd };
  }, [bookings]);

  if (error) {
    return (
      <div style={{ padding: 24, color: 'var(--terra)' }}>
        Couldn't load bookings: {error}
      </div>
    );
  }
  if (!bookings) {
    return <div style={{ padding: 24, color: 'var(--ink-60)' }}>Loading bookings…</div>;
  }

  return (
    <div style={{ padding: '0 0 32px' }}>
      {/* Revenue strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <RevenueCard label="This month" amount={revenue.month} />
        <RevenueCard label="This quarter" amount={revenue.quarter} />
        <RevenueCard label="YTD" amount={revenue.ytd} />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>
        Next {WEEKS_AHEAD} issues
      </h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {upcoming.map((iso) => (
          <IssueRow
            key={iso}
            iso={iso}
            bookings={byDate.get(iso) ?? []}
            businesses={businesses}
            expanded={expanded === iso}
            onToggle={() => setExpanded((prev) => (prev === iso ? null : iso))}
          />
        ))}
      </div>
    </div>
  );
}

function RevenueCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--ink-60)' }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 24, color: 'var(--ink)', marginTop: 4, letterSpacing: '-0.02em' }}>
        {formatGBP(amount)}
      </div>
    </div>
  );
}

function IssueRow({
  iso,
  bookings,
  businesses,
  expanded,
  onToggle,
}: {
  iso: string;
  bookings: BjBooking[];
  businesses: Record<string, BusinessRow>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const slotFor = useCallback(
    (tier: BjTier) => bookings.find((b) => b.tier === tier),
    [bookings],
  );
  const pending = bookings.some((b) => b.status === 'pending_creative');
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: 14,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'inherit',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>
            {parseISODate(iso).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 2 }}>{iso}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIER_ORDER.map((tier) => {
            const slot = slotFor(tier);
            return (
              <span
                key={tier}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: slot ? 'var(--terra-light)' : 'var(--ink-08)',
                  color: slot ? 'var(--terra)' : 'var(--ink-35)',
                }}
              >
                {BJ_PRICING[tier].name}
                {slot && `: ${businesses[slot.business_id]?.name ?? '—'}`}
              </span>
            );
          })}
          {pending && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(196, 42, 74, 0.08)',
                color: 'var(--status-error)',
              }}
            >
              Creative pending
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          style={{
            color: 'var(--ink-35)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-color)', padding: 14, display: 'grid', gap: 14 }}>
          {TIER_ORDER.map((tier) => (
            <SlotPanel
              key={tier}
              tier={tier}
              booking={slotFor(tier) ?? null}
              businessName={slotFor(tier) ? businesses[slotFor(tier)!.business_id]?.name ?? null : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlotPanel({
  tier,
  booking,
  businessName,
}: {
  tier: BjTier;
  booking: BjBooking | null;
  businessName: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const html = booking ? generateHTMLForBooking(booking) : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard access denied — ignore */
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: 12,
        background: 'var(--shell)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--terra)' }}>
            {BJ_PRICING[tier].name} · {BJ_PRICING[tier].position.toLowerCase()}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500, marginTop: 2 }}>
            {businessName ?? <span style={{ color: 'var(--ink-35)' }}>Slot open</span>}
          </div>
        </div>
        {booking && (
          <button
            type="button"
            onClick={copy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--terra)',
              background: copied ? 'var(--terra)' : 'transparent',
              color: copied ? '#fff' : 'var(--terra)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy HTML'}
          </button>
        )}
      </div>
      {booking && (
        <>
          {booking.headline && (
            <div style={{ fontSize: 13, color: 'var(--ink-60)', marginBottom: 6 }}>
              <strong style={{ color: 'var(--ink)' }}>{booking.headline}</strong>
              {booking.status === 'pending_creative' && (
                <span style={{ marginLeft: 8, color: 'var(--status-error)' }}>· needs creative</span>
              )}
            </div>
          )}
          <pre
            style={{
              margin: 0,
              padding: 10,
              background: 'var(--card)',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              fontSize: 11,
              lineHeight: 1.4,
              overflow: 'auto',
              maxHeight: 180,
              color: 'var(--ink-60)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {html}
          </pre>
        </>
      )}
    </div>
  );
}
