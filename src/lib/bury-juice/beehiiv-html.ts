// Beehiiv-compatible HTML generators for each tier. Jacob pastes the
// output into the three-dot menu → "Edit HTML" on a beehiiv content
// block, so we emit inline styles only and keep the markup minimal.

import type { BjBooking } from './types';
import type { BjTier } from './pricing';

const CRIMSON = '#A3185A';
const CHARCOAL = '#181818';

function withUtm(tier: BjTier, isoDate: string, ctaUrl: string): string {
  try {
    const url = new URL(ctaUrl);
    const campaign = `${tier}_${isoDate.replace(/-/g, '')}`;
    url.searchParams.set('utm_source', 'buryjuice');
    url.searchParams.set('utm_medium', 'newsletter');
    url.searchParams.set('utm_campaign', campaign);
    return url.toString();
  } catch {
    return ctaUrl;
  }
}

function esc(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateClassifiedHTML(b: Pick<BjBooking,
  'tier' | 'issue_date' | 'headline' | 'body_copy' | 'cta_url'>): string {
  const href = withUtm('classified', b.issue_date, b.cta_url || '#');
  return [
    `<div style="border-top:1px solid ${CHARCOAL};padding-top:14px;margin-top:18px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${CHARCOAL};">`,
    `<div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${CRIMSON};font-weight:700;margin-bottom:6px;">Classified</div>`,
    `<div style="font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:-0.01em;margin-bottom:6px;">${esc(b.headline)}</div>`,
    `<div style="font-size:14px;line-height:1.5;margin-bottom:10px;">${esc(b.body_copy)}</div>`,
    `<a href="${esc(href)}" style="color:${CRIMSON};font-weight:700;text-decoration:underline;">Learn more &rarr;</a>`,
    `</div>`,
  ].join('');
}

export function generateFeatureHTML(b: Pick<BjBooking,
  'tier' | 'issue_date' | 'headline' | 'body_copy' | 'cta_url' | 'image_url'>): string {
  const href = withUtm('feature', b.issue_date, b.cta_url || '#');
  return [
    `<div style="border-top:2px solid ${CRIMSON};padding-top:18px;margin-top:22px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${CHARCOAL};">`,
    `<div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${CRIMSON};font-weight:700;margin-bottom:10px;">Feature</div>`,
    b.image_url
      ? `<img src="${esc(b.image_url)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;margin-bottom:14px;" />`
      : '',
    `<div style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.01em;margin-bottom:8px;">${esc(b.headline)}</div>`,
    `<div style="font-size:15px;line-height:1.55;margin-bottom:14px;">${esc(b.body_copy)}</div>`,
    `<a href="${esc(href)}" style="display:inline-block;background:${CRIMSON};color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-size:12px;padding:12px 18px;text-decoration:none;">Learn more</a>`,
    `</div>`,
  ].join('');
}

export function generatePrimaryHTML(b: Pick<BjBooking,
  'tier' | 'issue_date' | 'headline' | 'body_copy' | 'cta_url' | 'image_url' | 'logo_url'>): string {
  const href = withUtm('primary', b.issue_date, b.cta_url || '#');
  return [
    `<div style="background:#FAF7F2;padding:24px;margin-bottom:22px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${CHARCOAL};">`,
    `<div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${CRIMSON};font-weight:700;margin-bottom:12px;">This week's primary sponsor</div>`,
    b.logo_url
      ? `<img src="${esc(b.logo_url)}" width="200" alt="" style="display:block;width:200px;max-width:100%;height:auto;margin-bottom:16px;" />`
      : '',
    b.image_url
      ? `<img src="${esc(b.image_url)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;margin-bottom:16px;" />`
      : '',
    `<div style="font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:10px;">${esc(b.headline)}</div>`,
    `<div style="font-size:15px;line-height:1.6;margin-bottom:16px;">${esc(b.body_copy)}</div>`,
    `<a href="${esc(href)}" style="display:inline-block;background:${CRIMSON};color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-size:13px;padding:14px 22px;text-decoration:none;">Learn more</a>`,
    `</div>`,
  ].join('');
}

export function generateHTMLForBooking(b: Pick<BjBooking,
  'tier' | 'issue_date' | 'headline' | 'body_copy' | 'cta_url' | 'image_url' | 'logo_url'>): string {
  if (b.tier === 'primary') return generatePrimaryHTML(b);
  if (b.tier === 'feature') return generateFeatureHTML(b);
  return generateClassifiedHTML(b);
}
