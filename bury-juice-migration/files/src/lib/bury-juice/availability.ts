import type { BjAvailabilityEntry, BjAvailabilityStatus, BjBooking } from './types.js';
import { BOOKING_CUTOFF_HOURS, ISSUE_DAY_OF_WEEK, TIER_CAPACITY, type BjTier } from './pricing.js';

// Yield every ISSUE_DAY_OF_WEEK date between `from` and `to`
// inclusive, in YYYY-MM-DD form.
export function issueDatesInRange(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(from.getTime());
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getDay() !== ISSUE_DAY_OF_WEEK) {
    cursor.setDate(cursor.getDate() + 1);
  }
  while (cursor <= to) {
    dates.push(formatISODate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Capacity-aware status for one issue date. `filled` is the number
// of active bookings already sitting on this (tier, date) pair.
export function statusForDate(
  iso: string,
  tier: BjTier,
  filled: number,
  now: Date = new Date(),
): BjAvailabilityStatus {
  if (filled >= TIER_CAPACITY[tier]) return 'taken';

  // Issues send at 08:00 on issue day; cutoff is BOOKING_CUTOFF_HOURS
  // before that.
  const issue = parseISODate(iso);
  issue.setHours(8, 0, 0, 0);
  const cutoff = new Date(issue.getTime() - BOOKING_CUTOFF_HOURS * 60 * 60 * 1000);
  if (now >= cutoff) return 'too_soon';
  return 'available';
}

export function buildAvailability(
  tier: BjTier,
  from: Date,
  to: Date,
  activeBookings: Pick<BjBooking, 'tier' | 'issue_date'>[],
  now: Date = new Date(),
): BjAvailabilityEntry[] {
  // Count bookings per issue_date for the tier of interest.
  const counts = new Map<string, number>();
  for (const b of activeBookings) {
    if (b.tier !== tier) continue;
    counts.set(b.issue_date, (counts.get(b.issue_date) ?? 0) + 1);
  }
  const capacity = TIER_CAPACITY[tier];
  return issueDatesInRange(from, to).map((date) => {
    const filled = counts.get(date) ?? 0;
    return {
      date,
      status: statusForDate(date, tier, filled, now),
      filled,
      capacity,
    };
  });
}

export function nextNThursdays(n: number, from: Date = new Date()): string[] {
  const cursor = new Date(from.getTime());
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getDay() !== ISSUE_DAY_OF_WEEK) {
    cursor.setDate(cursor.getDate() + 1);
  }
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(formatISODate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}
