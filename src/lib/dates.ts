// Date helpers for campaign deadlines.
//
// The admin wizard captures dates with <input type="date"> (YYYY-MM-DD).
// Calling new Date('2026-04-19').toISOString() produces midnight UTC, which
// for a UK creator means the deadline expires at 01:00 BST on the morning
// of the due date — they lose the day. These helpers coerce to start-of-day
// (for open dates) or end-of-day (for deadlines) in Europe/London, matching
// Hummingbirds' 11:59 PM behaviour.

function londonOffsetMinutes(utcDate: Date): number {
  // Determine whether Europe/London is currently observing BST.
  // DST rule: BST starts last Sunday of March, ends last Sunday of October.
  const y = utcDate.getUTCFullYear();
  const lastSunday = (month: number) => {
    const d = new Date(Date.UTC(y, month + 1, 0));
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d;
  };
  const bstStart = lastSunday(2); // March (0-indexed)
  bstStart.setUTCHours(1, 0, 0, 0);
  const bstEnd = lastSunday(9); // October
  bstEnd.setUTCHours(1, 0, 0, 0);
  return utcDate >= bstStart && utcDate < bstEnd ? 60 : 0;
}

function atLondonTime(dateStr: string, hours: number, minutes: number, seconds: number): string {
  // dateStr: 'YYYY-MM-DD'. Build a UTC instant corresponding to the given
  // local London time on that date.
  const [y, m, d] = dateStr.split('-').map(Number);
  // Probe to determine BST/GMT for that date.
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offsetMin = londonOffsetMinutes(probe);
  const utc = new Date(Date.UTC(y, m - 1, d, hours, minutes, seconds));
  utc.setUTCMinutes(utc.getUTCMinutes() - offsetMin);
  return utc.toISOString();
}

/** Coerce a YYYY-MM-DD string to 00:00:00 Europe/London as ISO. */
export function toStartOfDayISO(dateStr: string): string {
  return atLondonTime(dateStr, 0, 0, 0);
}

/** Coerce a YYYY-MM-DD string to 23:59:59 Europe/London as ISO. */
export function toEndOfDayISO(dateStr: string): string {
  return atLondonTime(dateStr, 23, 59, 59);
}

/** Format a deadline timestamp for display — date only, no time. */
export function fmtDeadline(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
}

export type DeadlineUrgency = 'none' | 'soon' | 'urgent' | 'today' | 'overdue';

/** Classify how pressing a deadline is relative to now. */
export function deadlineUrgency(iso: string | null): DeadlineUrgency {
  if (!iso) return 'none';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'overdue';
  const days = ms / 86_400_000;
  if (days < 1) return 'today';
  if (days < 3) return 'urgent';
  if (days < 7) return 'soon';
  return 'none';
}

/** Whole days remaining until a deadline (negative if past). */
export function daysUntilDeadline(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Short human phrase for a deadline — "Closes today", "2 days left", "3 days overdue". */
export function fmtCountdown(iso: string | null): string {
  if (!iso) return '';
  const days = daysUntilDeadline(iso)!;
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Closes today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

/** Hours remaining until `selected_at` + 48h. Negative if already past.
 * Shared by the creator confirmation countdown and the admin/brand views
 * that surface how long a pending selection has left before auto-decline. */
export function hoursUntilConfirmDeadline(selectedAt: string | null): number | null {
  if (!selectedAt) return null;
  const deadline = new Date(selectedAt).getTime() + 48 * 60 * 60 * 1000;
  return (deadline - Date.now()) / (60 * 60 * 1000);
}
