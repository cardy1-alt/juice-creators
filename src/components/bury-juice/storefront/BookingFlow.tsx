import { useEffect, useMemo, useState } from 'react';
import {
  BJ_PRICING,
  formatGBP,
  priceForTierAndSize,
  type BjPackSize,
  type BjTier,
} from '../../../lib/bury-juice/pricing';
import type { BjAvailabilityEntry } from '../../../lib/bury-juice/types';
import { nextNThursdays, parseISODate } from '../../../lib/bury-juice/availability';

interface Props {
  tier: BjTier;
  size: BjPackSize;
  onSizeChange: (size: BjPackSize) => void;
  selectedDates: string[];
  onSelectedDatesChange: (dates: string[]) => void;
}

const SIZES: BjPackSize[] = [1, 4, 12];
const WEEKS_TO_SHOW = 26;

async function fetchAvailability(tier: BjTier): Promise<Map<string, BjAvailabilityEntry>> {
  const dates = nextNThursdays(WEEKS_TO_SHOW);
  const from = dates[0];
  const to = dates[dates.length - 1];
  try {
    const res = await fetch(
      `/api/bury-juice/availability?tier=${tier}&from=${from}&to=${to}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { entries: BjAvailabilityEntry[] };
    return new Map(body.entries.map((e) => [e.date, e]));
  } catch {
    // Dev fallback: assume everything is available.
    return new Map(
      dates.map((d) => [d, { date: d, status: 'available' as const, filled: 0, capacity: 1 }]),
    );
  }
}

function formatDateLong(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function BookingFlow(props: Props) {
  const { tier, size, onSizeChange, selectedDates, onSelectedDatesChange } = props;
  const [availability, setAvailability] = useState<Map<string, BjAvailabilityEntry> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAvailability(tier).then((map) => {
      if (!cancelled) {
        setAvailability(map);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tier]);

  useEffect(() => {
    if (!availability) return;
    const pruned = selectedDates.filter((d) => availability.get(d)?.status === 'available');
    if (pruned.length !== selectedDates.length) {
      onSelectedDatesChange(pruned);
    }
    if (pruned.length > size) {
      onSelectedDatesChange(pruned.slice(0, size));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, size, tier]);

  const total = useMemo(() => priceForTierAndSize(tier, size), [tier, size]);

  const allDates = availability ? Array.from(availability.keys()) : nextNThursdays(WEEKS_TO_SHOW);

  function toggleDate(iso: string) {
    if (!availability) return;
    if (availability.get(iso)?.status !== 'available') return;
    const has = selectedDates.includes(iso);
    if (has) {
      onSelectedDatesChange(selectedDates.filter((d) => d !== iso));
      return;
    }
    if (selectedDates.length >= size) return;
    onSelectedDatesChange([...selectedDates, iso].sort());
  }

  const remainingSlots = size - selectedDates.length;
  const t = BJ_PRICING[tier];

  return (
    <section className="bj-section" id="booking-flow" style={{ paddingTop: 32 }}>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Book your Thursdays</h2>
      <p style={{ color: 'var(--ink-60)', margin: 0, marginBottom: 20, fontSize: 15 }}>
        {t.name} placement · {t.position.toLowerCase()}
      </p>

      <div style={{ marginBottom: 24 }}>
        <div className="bj-label">How many?</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SIZES.map((s) => {
            const isSelected = size === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSizeChange(s)}
                className={`bj-btn${isSelected ? '' : ' bj-btn--ghost'}`}
                style={{
                  borderColor: isSelected ? 'var(--terra)' : 'var(--border-color)',
                  color: isSelected ? '#fff' : 'var(--ink)',
                  fontWeight: 500,
                }}
              >
                {s === 1 ? 'Single' : `${s}-pack`} · {formatGBP(priceForTierAndSize(tier, s))}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="bj-label" style={{ marginBottom: 10 }}>
          Pick {size} Thursday{size === 1 ? '' : 's'}
          {remainingSlots > 0 && ` — ${remainingSlots} to go`}
        </div>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--ink-60)' }}>Loading availability…</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 8,
              }}
            >
              {allDates.map((iso) => {
                const entry = availability?.get(iso);
                const status = entry?.status ?? 'available';
                const selected = selectedDates.includes(iso);
                const disabled = status !== 'available';
                const capacity = entry?.capacity ?? 1;
                const filled = entry?.filled ?? 0;
                const remaining = capacity - filled;
                const hint =
                  status === 'taken'
                    ? capacity > 1 ? 'Full' : 'Booked'
                    : status === 'too_soon'
                    ? '<48h notice'
                    : selected
                    ? 'Selected'
                    : capacity > 1
                    ? `${remaining} of ${capacity} left`
                    : 'Available';
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleDate(iso)}
                    title={hint}
                    style={{
                      padding: 12,
                      textAlign: 'left',
                      border: '1px solid',
                      borderRadius: 'var(--r-input)',
                      borderColor: selected ? 'var(--terra)' : 'var(--border-color)',
                      background: selected ? 'var(--terra)' : 'var(--card)',
                      color: selected
                        ? '#fff'
                        : disabled
                        ? 'var(--ink-35)'
                        : 'var(--ink)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.12s ease, background-color 0.12s ease',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{formatDateLong(iso)}</div>
                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 2,
                        opacity: selected ? 0.9 : 0.6,
                      }}
                    >
                      {hint}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
      </div>

      <div
        style={{
          marginTop: 28,
          padding: 16,
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--r-card)',
          background: 'var(--card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: 'var(--ink-60)' }}>Running total</div>
          <div style={{ fontSize: 13, color: 'var(--ink-60)', marginTop: 2 }}>
            {t.name} · {size === 1 ? 'single issue' : `${size}-pack`} ·{' '}
            {selectedDates.length}/{size} picked
          </div>
        </div>
        <div style={{ fontWeight: 600, fontSize: 26, letterSpacing: '-0.02em' }}>
          {formatGBP(total)}
        </div>
      </div>
    </section>
  );
}
