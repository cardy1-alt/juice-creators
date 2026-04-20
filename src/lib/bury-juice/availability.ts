import type { BjAvailabilityEntry, BjAvailabilityStatus, BjBooking } from './types';
import { BOOKING_CUTOFF_HOURS, ISSUE_DAY_OF_WEEK, type BjTier } from './pricing';

// Yield every Thursday-like ISSUE_DAY_OF_WEEK date between `from` and
// `to` inclusive, in YYYY-MM-DD form.
export function issueDatesInRange(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(from.getTime());
  cursor.setHours(0, 0, 0, 0);
  // Advance to the first ISSUE_DAY_OF_WEEK on or after `from`
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

// Determine availability for one issue date given the set of active
// bookings (which come from the DB already filtered to the same tier).
export function statusForDate(
  iso: string,
  takenDates: Set<string>,
  now: Date = new Date(),
): BjAvailabilityStatus {
  if (takenDates.has(iso)) return 'taken';

  // Issue sends at 08:00 on issue day; cutoff is BOOKING_CUTOFF_HOURS before.
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
  const taken = new Set(
    activeBookings.filter((b) => b.tier === tier).map((b) => b.issue_date),
  );
  return issueDatesInRange(from, to).map((date) => ({
    date,
    status: statusForDate(date, taken, now),
  }));
}

// Generate the next N upcoming Thursdays starting from `from`.
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
