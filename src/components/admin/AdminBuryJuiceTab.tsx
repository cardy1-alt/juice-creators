import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BJ_PRICING,
  TIER_CAPACITY,
  formatGBP,
  type BjTier,
} from '../../lib/bury-juice/pricing.js';
import { generateMarkdownForBooking } from '../../lib/bury-juice/beehiiv-markdown.js';
import { nextNThursdays, parseISODate } from '../../lib/bury-juice/availability.js';
import type { BjBooking } from '../../lib/bury-juice/types.js';
import { Copy, Check, Calendar, Table as TableIcon, Plus, Pencil, Trash2, X } from 'lucide-react';

interface BusinessRow {
  id: string;
  name: string;
  contact_email: string | null;
}

type ViewMode = 'calendar' | 'table';

const TIER_ORDER: BjTier[] = ['primary', 'feature', 'classified'];
const WEEKS_AHEAD = 12;

// ─────────────────────────────────────────────────────────────────
// AdminBuryJuiceTab — calendar + table views over bj_bookings, plus
// an inline editor for manually adding / editing / cancelling rows.
// Uses the logged-in admin's session; the bj_* admin RLS policies
// (20260420160000) grant hello@nayba.app read/write.
// ─────────────────────────────────────────────────────────────────

export default function AdminBuryJuiceTab() {
  const [bookings, setBookings] = useState<BjBooking[] | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('calendar');
  const [editing, setEditing] = useState<BjBooking | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [bookingsRes, businessesRes] = await Promise.all([
      supabase
        .from('bj_bookings')
        .select('*')
        .neq('status', 'cancelled')
        .order('issue_date', { ascending: true }),
      supabase
        .from('businesses')
        .select('id,name,contact_email')
        .order('name', { ascending: true }),
    ]);
    if (bookingsRes.error) {
      setError(bookingsRes.error.message);
      return;
    }
    setBookings((bookingsRes.data ?? []) as BjBooking[]);
    setBusinesses((businessesRes.data ?? []) as BusinessRow[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const businessMap = useMemo(() => {
    const m: Record<string, BusinessRow> = {};
    for (const b of businesses) m[b.id] = b;
    return m;
  }, [businesses]);

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

  if (error) return <div style={{ padding: 24, color: 'var(--terra)' }}>Error: {error}</div>;
  if (!bookings) return <div style={{ padding: 24, color: 'var(--ink-60)' }}>Loading…</div>;

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Revenue */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <RevenueCard label="This month" amount={revenue.month} />
        <RevenueCard label="This quarter" amount={revenue.quarter} />
        <RevenueCard label="YTD" amount={revenue.ytd} />
      </div>

      {/* View toggle + Add */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--ink-08)', borderRadius: 10 }}>
          <ViewToggleButton active={view === 'calendar'} onClick={() => setView('calendar')} icon={<Calendar size={14} />} label="Calendar" />
          <ViewToggleButton active={view === 'table'} onClick={() => setView('table')} icon={<TableIcon size={14} />} label="Table" />
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: 'var(--terra)', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <Plus size={15} /> Add booking
        </button>
      </div>

      {view === 'calendar' && (
        <CalendarView
          bookings={bookings}
          businessMap={businessMap}
          onEdit={setEditing}
        />
      )}
      {view === 'table' && (
        <TableView
          bookings={bookings}
          businessMap={businessMap}
          onEdit={setEditing}
        />
      )}

      {(editing || adding) && (
        <BookingEditor
          booking={editing}
          adding={adding}
          businesses={businesses}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSaved={() => {
            setEditing(null);
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function RevenueCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-60)' }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 24, color: 'var(--ink)', marginTop: 4, letterSpacing: '-0.02em' }}>
        {formatGBP(amount)}
      </div>
    </div>
  );
}

function ViewToggleButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8,
        background: active ? 'var(--card)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-60)',
        border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
      }}
    >
      {icon} {label}
    </button>
  );
}

// ─── Calendar view ────────────────────────────────────────────────
function CalendarView({
  bookings,
  businessMap,
  onEdit,
}: {
  bookings: BjBooking[];
  businessMap: Record<string, BusinessRow>;
  onEdit: (b: BjBooking) => void;
}) {
  const upcoming = useMemo(() => nextNThursdays(WEEKS_AHEAD), []);
  const byDate = useMemo(() => {
    const m = new Map<string, BjBooking[]>();
    for (const b of bookings) {
      const arr = m.get(b.issue_date) ?? [];
      arr.push(b);
      m.set(b.issue_date, arr);
    }
    return m;
  }, [bookings]);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {upcoming.map((iso) => (
        <IssueCard
          key={iso}
          iso={iso}
          bookings={byDate.get(iso) ?? []}
          businessMap={businessMap}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

function IssueCard({
  iso,
  bookings,
  businessMap,
  onEdit,
}: {
  iso: string;
  bookings: BjBooking[];
  businessMap: Record<string, BusinessRow>;
  onEdit: (b: BjBooking) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const byTier: Record<BjTier, BjBooking[]> = {
    primary: bookings.filter((b) => b.tier === 'primary'),
    feature: bookings.filter((b) => b.tier === 'feature'),
    classified: bookings.filter((b) => b.tier === 'classified'),
  };

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%', textAlign: 'left', padding: 14,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', color: 'inherit',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {parseISODate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-60)', marginTop: 2 }}>{iso}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {TIER_ORDER.map((tier) => {
            const filled = byTier[tier].length;
            const cap = TIER_CAPACITY[tier];
            const full = filled >= cap;
            return (
              <span
                key={tier}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                  background: filled > 0 ? 'var(--terra-light)' : 'var(--ink-08)',
                  color: filled > 0 ? 'var(--terra)' : 'var(--ink-35)',
                  opacity: full ? 1 : filled > 0 ? 0.95 : 0.75,
                }}
              >
                {BJ_PRICING[tier].name} {filled}/{cap}
              </span>
            );
          })}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-color)', padding: 14, display: 'grid', gap: 12 }}>
          {TIER_ORDER.map((tier) => {
            const tierBookings = byTier[tier];
            const cap = TIER_CAPACITY[tier];
            return (
              <TierGroup
                key={tier}
                tier={tier}
                bookings={tierBookings}
                capacity={cap}
                businessMap={businessMap}
                onEdit={onEdit}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function TierGroup({
  tier,
  bookings,
  capacity,
  businessMap,
  onEdit,
}: {
  tier: BjTier;
  bookings: BjBooking[];
  capacity: number;
  businessMap: Record<string, BusinessRow>;
  onEdit: (b: BjBooking) => void;
}) {
  const label = `${BJ_PRICING[tier].name} · ${BJ_PRICING[tier].position.toLowerCase()}`;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--terra)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label} · {bookings.length}/{capacity}
      </div>
      {bookings.length === 0 && (
        <div
          style={{
            border: '1px dashed var(--border-color)', borderRadius: 10, padding: 10,
            color: 'var(--ink-35)', fontSize: 13,
          }}
        >
          No bookings for this slot
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {bookings.map((b) => (
          <BookingRow
            key={b.id}
            booking={b}
            businessName={businessMap[b.business_id]?.name ?? '—'}
            onEdit={() => onEdit(b)}
          />
        ))}
      </div>
    </div>
  );
}

function BookingRow({ booking, businessName, onEdit }: { booking: BjBooking; businessName: string; onEdit: () => void }) {
  const [copied, setCopied] = useState(false);
  const md = generateMarkdownForBooking(booking);

  async function copy() {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied */
    }
  }

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12, background: 'var(--shell)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{businessName}</div>
          {booking.headline && (
            <div style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {booking.headline}
            </div>
          )}
          <div style={{ fontSize: 11, color: booking.status === 'pending_creative' ? 'var(--status-error)' : 'var(--ink-35)', marginTop: 4 }}>
            {booking.status.replace('_', ' ')} · {booking.source.replace('_', ' ')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={copy} title="Copy markdown"
            style={{ padding: 6, borderRadius: 8, border: '1px solid var(--border-color)', background: copied ? 'var(--terra)' : 'var(--card)', color: copied ? '#fff' : 'var(--ink-60)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit' }}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Markdown'}
          </button>
          <button type="button" onClick={onEdit} title="Edit booking"
            style={{ padding: 6, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--card)', color: 'var(--ink-60)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', fontSize: 12, fontFamily: 'inherit' }}>
            <Pencil size={13} />
          </button>
        </div>
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--ink-35)', outline: 'none' }}>Preview markdown</summary>
        <pre style={{ margin: '8px 0 0', padding: 10, background: 'var(--card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 11, lineHeight: 1.5, overflow: 'auto', maxHeight: 180, color: 'var(--ink-60)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap' }}>
          {md}
        </pre>
      </details>
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────
function TableView({
  bookings,
  businessMap,
  onEdit,
}: {
  bookings: BjBooking[];
  businessMap: Record<string, BusinessRow>;
  onEdit: (b: BjBooking) => void;
}) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    if (!filter.trim()) return bookings;
    const f = filter.toLowerCase();
    return bookings.filter((b) => {
      const name = (businessMap[b.business_id]?.name ?? '').toLowerCase();
      return name.includes(f) || b.headline?.toLowerCase().includes(f) || b.tier.includes(f) || b.issue_date.includes(f);
    });
  }, [bookings, businessMap, filter]);

  return (
    <div>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by business, headline, tier, or date"
        style={{
          width: '100%', padding: '10px 12px', marginBottom: 12,
          border: '1px solid var(--border-color-input)', borderRadius: 10,
          background: 'var(--card)', fontFamily: 'inherit', fontSize: 14,
        }}
      />
      <div style={{ background: 'var(--card)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--shell)', color: 'var(--ink-60)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Th>Date</Th><Th>Tier</Th><Th>Business</Th><Th>Headline</Th><Th>Status</Th><Th>Paid</Th><Th>{' '}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                <Td>{b.issue_date}</Td>
                <Td>{BJ_PRICING[b.tier].name}</Td>
                <Td>{businessMap[b.business_id]?.name ?? '—'}</Td>
                <Td style={{ color: 'var(--ink-60)' }}>{b.headline ?? <span style={{ color: 'var(--ink-35)' }}>—</span>}</Td>
                <Td style={{ color: b.status === 'pending_creative' ? 'var(--status-error)' : 'var(--ink-60)' }}>{b.status.replace('_', ' ')}</Td>
                <Td>{b.amount_paid_gbp == null ? <span style={{ color: 'var(--ink-35)' }}>comp</span> : formatGBP(b.amount_paid_gbp)}</Td>
                <Td style={{ textAlign: 'right' }}>
                  <button type="button" onClick={() => onEdit(b)} style={{ padding: 4, border: 'none', background: 'transparent', color: 'var(--ink-60)', cursor: 'pointer' }}>
                    <Pencil size={14} />
                  </button>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-35)', fontSize: 13 }}>
                  No bookings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>{children}</th>;
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '10px 12px', color: 'var(--ink)', ...style }}>{children}</td>;
}

// ─── Editor modal ─────────────────────────────────────────────────
function BookingEditor({
  booking,
  adding,
  businesses,
  onClose,
  onSaved,
}: {
  booking: BjBooking | null;
  adding: boolean;
  businesses: BusinessRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    business_id: booking?.business_id ?? (businesses[0]?.id ?? ''),
    tier: (booking?.tier ?? 'classified') as BjTier,
    issue_date: booking?.issue_date ?? nextNThursdays(1)[0],
    source: booking?.source ?? 'comp',
    status: booking?.status ?? 'confirmed',
    headline: booking?.headline ?? '',
    body_copy: booking?.body_copy ?? '',
    cta_url: booking?.cta_url ?? '',
    image_url: booking?.image_url ?? '',
    logo_url: booking?.logo_url ?? '',
    amount_paid_gbp: booking?.amount_paid_gbp ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    const payload = {
      business_id: form.business_id,
      tier: form.tier,
      issue_date: form.issue_date,
      source: form.source,
      status: form.status,
      headline: form.headline || null,
      body_copy: form.body_copy || null,
      cta_url: form.cta_url || null,
      image_url: form.image_url || null,
      logo_url: form.logo_url || null,
      amount_paid_gbp: form.amount_paid_gbp,
    };
    const res = booking
      ? await supabase.from('bj_bookings').update(payload).eq('id', booking.id)
      : await supabase.from('bj_bookings').insert(payload);
    setSaving(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    onSaved();
  }

  async function cancelBooking() {
    if (!booking) return;
    if (!confirm('Cancel this booking? The row stays in the DB as status=cancelled.')) return;
    setSaving(true);
    const { error } = await supabase.from('bj_bookings').update({ status: 'cancelled' }).eq('id', booking.id);
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(42,32,24,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 12, padding: 24,
          maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            {adding ? 'Add booking' : 'Edit booking'}
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-60)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Business">
            <select
              value={form.business_id}
              onChange={(e) => setForm({ ...form, business_id: e.target.value })}
              style={selectStyle}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tier">
              <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as BjTier })} style={selectStyle}>
                <option value="primary">Primary</option>
                <option value="feature">Feature</option>
                <option value="classified">Classified</option>
              </select>
            </Field>
            <Field label="Issue date (Thursday)">
              <input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Source">
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as BjBooking['source'] })} style={selectStyle}>
                <option value="paid_storefront">Paid storefront</option>
                <option value="paid_legacy">Paid legacy</option>
                <option value="comp">Comp</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BjBooking['status'] })} style={selectStyle}>
                <option value="confirmed">Confirmed</option>
                <option value="pending_creative">Pending creative</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Amount (pence)">
              <input
                type="number"
                value={form.amount_paid_gbp ?? ''}
                onChange={(e) => setForm({ ...form, amount_paid_gbp: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="4000"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Headline">
            <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Body copy">
            <textarea value={form.body_copy} onChange={(e) => setForm({ ...form, body_copy: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <Field label="CTA URL">
            <input value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Photo URL">
            <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="Paste a public URL" style={inputStyle} />
          </Field>
          <Field label="Logo URL (Primary only)">
            <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="Paste a public URL" style={inputStyle} />
          </Field>

          {err && <div style={{ color: 'var(--terra)', fontSize: 13 }}>{err}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
            {booking && (
              <button type="button" onClick={cancelBooking} disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--destructive-border)', background: 'transparent', color: 'var(--destructive)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                <Trash2 size={13} /> Cancel booking
              </button>
            )}
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button type="button" onClick={onClose} disabled={saving}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--ink-60)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Close
              </button>
              <button type="button" onClick={save} disabled={saving}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-60)', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 14,
  border: '1px solid var(--border-color-input)', borderRadius: 8,
  background: 'var(--card)', fontFamily: 'inherit', color: 'var(--ink)',
};
const selectStyle = inputStyle;
