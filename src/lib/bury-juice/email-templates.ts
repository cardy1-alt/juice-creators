// Admin-facing notification email. The sponsor-facing confirmation
// was removed — Stripe's automatic receipt covers that side, and
// adding a second email just adds inbox noise for the customer.

import type { BjTier, BjPackSize } from './pricing.js';
import { BJ_PRICING, formatGBP } from './pricing.js';

const TERRA = '#D95F3B';
const TERRA_LIGHT = '#F9E8E1';
const TERRA_BORDER = '#F2DDD5';
const CHALK = '#FAFAF9';
const INK = '#2A2018';
const INK_60 = '#7A7168';
const INK_35 = '#B0AAA4';
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
              <p style="margin:0;font-family:${FONT_STACK};font-size:11px;color:${INK_35};line-height:1.5;">
                Powered by Nayba
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
