// Beehiiv-compatible Markdown generators for each tier. Jacob
// pastes the output into beehiiv's Markdown content block when
// composing the weekly issue — cleaner than maintaining HTML
// snippets and matches how beehiiv wants the input.

import type { BjBooking } from './types.js';
import type { BjTier } from './pricing.js';

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

function escMd(s: string | null | undefined): string {
  // Escape markdown-special chars so sponsor copy can't accidentally
  // produce headings, lists, or links in the rendered output.
  if (!s) return '';
  return s.replace(/([\\_*#[\]`])/g, '\\$1');
}

type BookingLite = Pick<BjBooking,
  'tier' | 'issue_date' | 'headline' | 'body_copy' | 'cta_url' | 'image_url' | 'logo_url'
>;

export function generateClassifiedMarkdown(b: BookingLite): string {
  const href = withUtm('classified', b.issue_date, b.cta_url || '#');
  return [
    `### ${escMd(b.headline)}`,
    '',
    escMd(b.body_copy),
    '',
    `[Learn more →](${href})`,
  ].join('\n');
}

export function generateFeatureMarkdown(b: BookingLite): string {
  const href = withUtm('feature', b.issue_date, b.cta_url || '#');
  const lines: string[] = [];
  lines.push(`## ${escMd(b.headline)}`);
  lines.push('');
  if (b.image_url) {
    lines.push(`![](${b.image_url})`);
    lines.push('');
  }
  lines.push(escMd(b.body_copy));
  lines.push('');
  lines.push(`[Learn more →](${href})`);
  return lines.join('\n');
}

export function generatePrimaryMarkdown(b: BookingLite): string {
  const href = withUtm('primary', b.issue_date, b.cta_url || '#');
  const lines: string[] = [];
  lines.push("**This week's primary sponsor**");
  lines.push('');
  if (b.logo_url) {
    lines.push(`![](${b.logo_url})`);
    lines.push('');
  }
  lines.push(`## ${escMd(b.headline)}`);
  lines.push('');
  if (b.image_url) {
    lines.push(`![](${b.image_url})`);
    lines.push('');
  }
  lines.push(escMd(b.body_copy));
  lines.push('');
  lines.push(`[Learn more →](${href})`);
  return lines.join('\n');
}

export function generateMarkdownForBooking(b: BookingLite): string {
  if (b.tier === 'primary') return generatePrimaryMarkdown(b);
  if (b.tier === 'feature') return generateFeatureMarkdown(b);
  return generateClassifiedMarkdown(b);
}
