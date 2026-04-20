// Email bodies for the Bury Juice storefront.
//
// Styled with table-based layout + bgcolor attributes so the design
// renders identically in Spark, Outlook, Apple Mail and the Gmail
// web/native apps. Mirrors the wrapEmail shell used by Nayba's
// send-email Edge Function but scoped to the Bury Juice voice —
// subhead, sponsor-specific details, and a single crimson CTA.

import type { BjTier, BjPackSize } from './pricing.js';
import { BJ_PRICING, formatGBP } from './pricing.js';

// ── Design tokens (match Nayba's transactional palette) ─────────
const TERRA = '#D95F3B';
const TERRA_LIGHT = '#F9E8E1';
const TERRA_BORDER = '#F2DDD5';
const CHALK = '#FAFAF9';
const INK = '#2A2018';
const INK_60 = '#7A7168';
const INK_35 = '#B0AAA4';
const INK_08 = '#F4F3F1';
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Shell + helpers ─────────────────────────────────────────────
function wrap(body: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Bury Juice</title>
</head>
<body style="margin:0;padding:0;background-color:${CHALK};-webkit-font-smoothing:antialiased;font-family:${FONT_STACK};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${CHALK}" style="background-color:${CHALK};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">
          <tr>
            <td align="left" style="padding:0 4px 28px 4px;">
              <span style="font-family:${FONT_STACK};font-size:22px;font-weight:700;color:${INK};letter-spacing:-0.02em;">Bury Juice</span>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:12px;padding:32px 28px;font-family:${FONT_STACK};color:${INK};">
              ${body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 4px 0 4px;">
              <p style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:12px;color:${INK_35};line-height:1.5;">
                Bury Juice &middot; The weekly newsletter for Bury St Edmunds
              </p>
              <p style="margin:0;font-family:${FONT_STACK};font-size:11px;color:${INK_35};line-height:1.5;">
                Powered by Nayba &middot; Questions? Reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="font-family:${FONT_STACK};font-size:22px;font-weight:600;color:${INK};margin:0 0 8px;letter-spacing:-0.3px;">${text}</h1>`;
}

function subtext(text: string): string {
  return `<p style="font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${INK_60};margin:0 0 20px;">${text}</p>`;
}

function p(text: string): string {
  return `<p style="font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${INK};margin:0 0 14px;">${text}</p>`;
}

function divider(): string {
  return `<div style="height:1px;background:${INK_08};margin:20px 0;"></div>`;
}

function infoBox(content: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border-collapse:separate;">
    <tr>
      <td bgcolor="${TERRA_LIGHT}" style="background-color:${TERRA_LIGHT};border:1px solid ${TERRA_BORDER};border-radius:10px;padding:16px 18px;">${content}</td>
    </tr>
  </table>`;
}

function btn(text: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0 0;">
    <tr>
      <td align="center" bgcolor="${TERRA}" style="background-color:${TERRA};border-radius:10px;">
        <a href="${esc(href)}" style="display:inline-block;background-color:${TERRA};color:#FFFFFF;padding:13px 28px;border-radius:10px;text-decoration:none;font-family:${FONT_STACK};font-weight:600;font-size:14px;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function rowPair(label: string, value: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 6px 0;">
    <tr>
      <td style="font-family:${FONT_STACK};font-size:13px;color:${INK_60};padding:0;width:120px;">${esc(label)}</td>
      <td style="font-family:${FONT_STACK};font-size:14px;color:${INK};font-weight:500;padding:0;">${value}</td>
    </tr>
  </table>`;
}

function formatDateLong(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
    });
  } catch {
    return iso;
  }
}

// ── Sponsor confirmation (on successful payment) ────────────────
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
  const posn = BJ_PRICING[a.tier].position.toLowerCase();
  const datesBlock = a.bookedDates.length > 0
    ? a.bookedDates.map((d) => `<li style="margin:0 0 4px 0;padding:0;">${esc(formatDateLong(d))}</li>`).join('')
    : '';
  const nextStep = a.hasCreative
    ? p("Your creative is locked in — we'll drop it into the newsletter on each of your booked Thursdays.")
    : p("<strong>Next step:</strong> upload your creative via your dashboard at least 48 hours before the issue sends.");

  const body = `
    ${heading("You're in.")}
    ${subtext(`Hi ${esc(a.businessName)} — your Bury Juice ${esc(tierLabel)} ${a.size === 1 ? 'placement' : `${a.size}-pack`} is confirmed.`)}
    ${infoBox(`
      ${rowPair('Placement', `${esc(tierLabel)} <span style="color:${INK_60};">· ${esc(posn)}</span>`)}
      ${rowPair('Quantity', a.size === 1 ? 'Single issue' : `${a.size}-pack`)}
      ${rowPair('Amount paid', formatGBP(a.amountPaidGbp))}
    `)}
    ${a.bookedDates.length > 0 ? `
      <p style="font-family:${FONT_STACK};font-size:13px;color:${INK_60};margin:0 0 6px;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">Booked Thursdays</p>
      <ul style="margin:0 0 16px;padding:0 0 0 18px;font-family:${FONT_STACK};font-size:14px;color:${INK};line-height:1.6;">${datesBlock}</ul>
    ` : p("No dates picked yet — head to your dashboard when you're ready.")}
    ${nextStep}
    ${btn('Open your dashboard', a.dashboardUrl)}
    ${divider()}
    <p style="font-family:${FONT_STACK};font-size:13px;color:${INK_60};margin:0;line-height:1.6;">
      Attached: calendar invites (.ics) for each booked Thursday so you know when you're live.
    </p>
  `;
  return wrap(body);
}

// ── Admin notification (to hello@nayba.app on each sale) ─────────
interface AdminNotificationArgs {
  businessName: string;
  tier: BjTier;
  size: BjPackSize;
  amountPaidGbp: number;
  adminUrl: string;
}

export function adminNotificationHTML(a: AdminNotificationArgs): string {
  const tierLabel = BJ_PRICING[a.tier].name;
  const body = `
    ${heading('New Bury Juice booking')}
    ${subtext(`${esc(a.businessName)} just bought a ${esc(tierLabel)} ${a.size === 1 ? 'single' : `${a.size}-pack`}.`)}
    ${infoBox(`
      ${rowPair('Sponsor', esc(a.businessName))}
      ${rowPair('Placement', `${esc(tierLabel)} <span style="color:${INK_60};">· ${a.size === 1 ? 'single' : `${a.size}-pack`}</span>`)}
      ${rowPair('Amount', formatGBP(a.amountPaidGbp))}
    `)}
    ${btn('Open admin view', a.adminUrl)}
  `;
  return wrap(body);
}

// ── Creative rework / rejection ──────────────────────────────────
interface RejectionArgs {
  businessName: string;
  notes: string;
  dashboardUrl: string;
}

export function rejectionEmailHTML(a: RejectionArgs): string {
  const body = `
    ${heading('Quick tweak needed')}
    ${subtext(`Hi ${esc(a.businessName)}, thanks for sending through your Bury Juice creative — a small change before it goes out:`)}
    ${infoBox(`
      <p style="font-family:${FONT_STACK};font-size:14px;color:${INK};margin:0;line-height:1.6;">${esc(a.notes)}</p>
    `)}
    ${p('Head back to your dashboard to re-upload. Easy to sort.')}
    ${btn('Open your dashboard', a.dashboardUrl)}
  `;
  return wrap(body);
}

// ── .ics calendar attachment ─────────────────────────────────────
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
