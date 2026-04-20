// Email bodies for the Bury Juice storefront. Kept as plain HTML
// strings so the serverless routes can POST them to Resend (or any
// provider) without a templating dependency.

import type { BjTier, BjPackSize } from './pricing.js';
import { BJ_PRICING, formatGBP } from './pricing.js';

interface ConfirmationArgs {
  businessName: string;
  tier: BjTier;
  size: BjPackSize;
  amountPaidGbp: number;
  bookedDates: string[];
  dashboardUrl: string;
  hasCreative: boolean;
}

export function sponsorConfirmationHTML(a: ConfirmationArgs): string {
  const tierLabel = BJ_PRICING[a.tier].name;
  const datesBlock = a.bookedDates.length > 0
    ? `<ul>${a.bookedDates.map((d) => `<li>${d}</li>`).join('')}</ul>`
    : `<p>You haven't picked your dates yet — head to your dashboard when you're ready.</p>`;
  const creativeBlock = a.hasCreative
    ? `<p>Your creative is in — we'll drop it into the newsletter on each of your booked dates.</p>`
    : `<p><strong>What happens next:</strong> upload your creative via your dashboard at least 48 hours before the issue send.</p>`;
  return `<!doctype html><html><body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#181818;padding:24px;">
    <h1 style="color:#A3185A;font-weight:900;text-transform:uppercase;">You're in.</h1>
    <p>Hi ${escapeHtml(a.businessName)} — your Bury Juice <strong>${tierLabel}</strong> ${a.size === 1 ? 'placement' : `${a.size}-pack`} is confirmed.</p>
    <p><strong>Amount paid:</strong> ${formatGBP(a.amountPaidGbp)}</p>
    <p><strong>Booked dates:</strong></p>
    ${datesBlock}
    ${creativeBlock}
    <p><a href="${escapeHtml(a.dashboardUrl)}" style="color:#A3185A;font-weight:700;">Open your dashboard &rarr;</a></p>
    <p style="color:rgba(24,24,24,0.6);font-size:13px;margin-top:32px;">Questions? Reply to this email or write to jacob@buryjuice.com.</p>
  </body></html>`;
}

interface AdminNotificationArgs {
  businessName: string;
  tier: BjTier;
  size: BjPackSize;
  amountPaidGbp: number;
  adminUrl: string;
}

export function adminNotificationHTML(a: AdminNotificationArgs): string {
  const tierLabel = BJ_PRICING[a.tier].name;
  return `<!doctype html><html><body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#181818;padding:24px;">
    <h2>New Bury Juice booking</h2>
    <p><strong>${escapeHtml(a.businessName)}</strong> — ${tierLabel} ${a.size === 1 ? 'single' : `${a.size}-pack`} — ${formatGBP(a.amountPaidGbp)}</p>
    <p><a href="${escapeHtml(a.adminUrl)}">Open admin view &rarr;</a></p>
  </body></html>`;
}

interface RejectionArgs {
  businessName: string;
  notes: string;
  dashboardUrl: string;
}

export function rejectionEmailHTML(a: RejectionArgs): string {
  return `<!doctype html><html><body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#181818;padding:24px;">
    <h2 style="color:#A3185A;">Quick tweak needed</h2>
    <p>Hi ${escapeHtml(a.businessName)},</p>
    <p>Thanks for sending through your Bury Juice creative. A small tweak before it goes out:</p>
    <blockquote style="border-left:3px solid #A3185A;padding-left:12px;color:rgba(24,24,24,0.8);">${escapeHtml(a.notes)}</blockquote>
    <p>Head back to your dashboard to re-upload:</p>
    <p><a href="${escapeHtml(a.dashboardUrl)}" style="color:#A3185A;font-weight:700;">Open your dashboard &rarr;</a></p>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Generate a minimal .ics payload for a booked issue date. Beehiiv
// sends on Thursdays at 08:00 Europe/London; the all-day event is
// simpler and travels better across mail clients.
export function buildICS(isoDates: string[], businessName: string, tier: BjTier): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const events = isoDates.map((iso, idx) => {
    const compact = iso.replace(/-/g, '');
    return [
      'BEGIN:VEVENT',
      `UID:bj-${compact}-${tier}-${idx}@buryjuice.com`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${compact}`,
      `DTEND;VALUE=DATE:${compact}`,
      `SUMMARY:Bury Juice — ${BJ_PRICING[tier].name} placement (${businessName})`,
      'END:VEVENT',
    ].join('\r\n');
  }).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bury Juice//Sponsor Storefront//EN',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}
