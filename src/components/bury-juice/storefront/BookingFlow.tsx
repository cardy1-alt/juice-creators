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
  pickLater: boolean;
  onPickLaterChange: (v: boolean) => void;
}

const SIZES: BjPackSize[] = [1, 4, 12];
const WEEKS_TO_SHOW = 26;

async function fetchAvailability(
  tier: BjTier,
): Promise<Map<string, BjAvailabilityEntry['status']>> {
  const dates = nextNThursdays(WEEKS_TO_SHOW);
  const from = dates[0];
  const to = dates[dates.length - 1];
  try {
    const res = await fetch(
      `/api/bury-juice/availability?tier=${tier}&from=${from}&to=${to}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { entries: BjAvailabilityEntry[] };
    return new Map(body.entries.map((e) => [e.date, e.status]));
  } catch {
    // Dev fallback: assume everything is available.
    return new Map(dates.map((d) => [d, 'available']));
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
  const { tier, size, onSizeChange, selectedDates, onSelectedDatesChange, pickLater, onPickLaterChange } = props;
  const [availability, setAvailability] = useState<Map<string, BjAvailabilityEntry['status']> | null>(null);
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

  // When tier or size changes, drop selected dates no longer eligible.
  useEffect(() => {
    if (!availability) return;
    const pruned = selectedDates.filter((d) => availability.get(d) === 'available');
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
    if (availability.get(iso) !== 'available') return;
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
    <section className="bj-section" id="booking-flow">
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
        Pick your run
      </div>
      <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginBottom: 32 }}>
        {t.name} · {t.position.toLowerCase()}
      </h2>

      <div style={{ marginBottom: 32 }}>
        <div className="bj-label">Quantity</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSizeChange(s)}
              className="bj-btn"
              style={{
                background: size === s ? 'var(--bj-crimson)' : 'transparent',
                color: size === s ? 'var(--bj-white)' : 'var(--bj-crimson)',
              }}
            >
              {s === 1 ? 'Single' : `${s}-pack`} · {formatGBP(priceForTierAndSize(tier, s))}
            </button>
          ))}
        </div>
      </div>

      {size > 1 && (
        <label
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: 12,
            border: '1px solid var(--bj-faint)',
            background: 'var(--bj-white)',
            marginBottom: 24,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={pickLater}
            onChange={(e) => onPickLaterChange(e.target.checked)}
          />
          <span style={{ fontSize: 14 }}>I'll pick my dates later (credits stay on file for 6 months)</span>
        </label>
      )}

      {!pickLater && (
        <div>
          <div className="bj-label" style={{ marginBottom: 12 }}>
            Choose {size} Thursday{size === 1 ? '' : 's'}
            {remainingSlots > 0 && ` — ${remainingSlots} to go`}
          </div>
          {loading ? (
            <div style={{ padding: 24, color: 'var(--bj-mid)' }}>Loading availability…</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 8,
              }}
            >
              {allDates.map((iso) => {
                const status = availability?.get(iso) ?? 'available';
                const selected = selectedDates.includes(iso);
                const disabled = status !== 'available';
                const hint =
                  status === 'taken'
                    ? 'Booked'
                    : status === 'too_soon'
                    ? '<48h notice required'
                    : selected
                    ? 'Selected'
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
                      borderColor: selected ? 'var(--bj-crimson)' : 'var(--bj-faint)',
                      background: selected
                        ? 'var(--bj-crimson)'
                        : disabled
                        ? 'var(--bj-faint)'
                        : 'var(--bj-white)',
                      color: selected
                        ? 'var(--bj-white)'
                        : disabled
                        ? 'var(--bj-soft)'
                        : 'var(--bj-charcoal)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{formatDateLong(iso)}</div>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        marginTop: 4,
                        opacity: 0.75,
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
      )}

      <div
        style={{
          marginTop: 32,
          padding: 20,
          border: '2px solid var(--bj-charcoal)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--bj-mid)',
              fontWeight: 700,
            }}
          >
            Running total
          </div>
          <div style={{ fontSize: 14, color: 'var(--bj-mid)', marginTop: 4 }}>
            {t.name} · {size === 1 ? 'single' : `${size}-pack`} ·{' '}
            {pickLater ? 'dates TBC' : `${selectedDates.length} date${selectedDates.length === 1 ? '' : 's'} picked`}
          </div>
        </div>
        <div style={{ fontWeight: 900, fontSize: 40, letterSpacing: '-0.02em' }}>
          {formatGBP(total)}
        </div>
      </div>
    </section>
  );
}
