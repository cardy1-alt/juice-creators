// Pricing and constants for the Bury Juice sponsor storefront.
// Prices are in pence (integer) so they match the Stripe amount format
// and avoid floating-point rounding anywhere.

// Tier names describe the *kind* of placement rather than ranking it,
// so no one placement is implicitly a consolation prize.
export type BjTier = 'classified' | 'feature' | 'primary';
export type BjPackSize = 1 | 4 | 12;

export interface BjTierConfig {
  name: string;
  position: string; // Where in the newsletter: Top / Middle / Bottom
  description: string;
  format: string[];
  single: number;
  pack_4: number;
  pack_12: number;
  bodyCharLimit: number;
}

export const BJ_PRICING: Record<BjTier, BjTierConfig> = {
  classified: {
    name: 'Classified',
    position: 'Bottom of newsletter',
    description: 'Content block at the bottom of the newsletter.',
    format: ['Headline', 'Copy', 'Link'],
    single: 4000,
    pack_4: 14400,
    pack_12: 38400,
    bodyCharLimit: 400,
  },
  feature: {
    name: 'Feature',
    position: 'Middle of newsletter',
    description: 'Photo + copy placement in the middle of the newsletter.',
    format: ['Headline', 'Photo', 'Copy', 'Link'],
    single: 9500,
    pack_4: 34200,
    pack_12: 91200,
    bodyCharLimit: 600,
  },
  primary: {
    name: 'Primary',
    position: 'Top of newsletter',
    description: 'Logo + photo + copy at the top of the newsletter — full-attention slot.',
    format: ['Logo', 'Headline', 'Photo', 'Copy', 'Link'],
    single: 15000,
    pack_4: 54000,
    pack_12: 144000,
    bodyCharLimit: 600,
  },
};

export const BJ_STATS = {
  subscribers: 7404,
  open_rate: 0.5304,
  ctr: 0.148,
  effective_reach: 3927, // subscribers × open_rate, rounded
} as const;

// Thursday = 4 when using JS getDay() (Sun=0).
export const ISSUE_DAY_OF_WEEK = 4;
export const BOOKING_CUTOFF_HOURS = 48;
export const PACK_EXPIRY_MONTHS = 6;

// Inventory capacity per issue. Primary and Feature are scarce
// (one each); Classified is a four-up block at the bottom.
export const TIER_CAPACITY: Record<BjTier, number> = {
  primary: 1,
  feature: 1,
  classified: 4,
};

// Helpers ----------------------------------------------------------

export function priceForTierAndSize(tier: BjTier, size: BjPackSize): number {
  const t = BJ_PRICING[tier];
  if (size === 1) return t.single;
  if (size === 4) return t.pack_4;
  return t.pack_12;
}

export function formatGBP(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', {
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function packSavingsPct(tier: BjTier, size: BjPackSize): number {
  if (size === 1) return 0;
  const singlePrice = BJ_PRICING[tier].single;
  const packPrice = priceForTierAndSize(tier, size);
  return Math.round((1 - packPrice / (singlePrice * size)) * 100);
}
