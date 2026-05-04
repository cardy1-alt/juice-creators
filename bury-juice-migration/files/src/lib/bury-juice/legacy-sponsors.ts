// Reference list of legacy sponsors. The canonical source of truth
// lives in the DB (bj_legacy_rates), seeded by the migration
// 20260420120000_bury_juice_legacy_sponsor_seed.sql. This module is
// only useful for admin-side UI that needs a readable description of
// who each legacy row represents.

import type { BjTier } from './pricing.js';

export interface LegacySponsor {
  name: string;
  // Optional: only set for sponsors whose primary relationship is with
  // Bury Juice. Sponsors that are also Nayba brands (e.g. David Lloyd)
  // are contacted through their Nayba identity — no BJ email on file.
  email?: string;
  tier: BjTier;
  monthlyRateGbp: number;
  cadence: 'monthly' | 'weekly';
  isComp: boolean;
  notes: string;
}

export const LEGACY_SPONSORS: LegacySponsor[] = [
  {
    name: 'David Lloyd Clubs',
    tier: 'primary',
    monthlyRateGbp: 0,
    cadence: 'weekly',
    isComp: true,
    notes: 'Comp placement — membership exchange. Rotates tier weekly. Contact handled via Nayba brand account; no email stored on the Bury Juice side.',
  },
  {
    name: 'Snappy Shopper',
    email: 'legacy+snappyshopper@buryjuice.com',
    tier: 'primary',
    monthlyRateGbp: 9500,
    cadence: 'monthly',
    isComp: false,
    notes: 'Rolling monthly commitment — 2nd Thursday of each month',
  },
  {
    name: 'Loyal Wolf Barbershop',
    email: 'legacy+loyalwolf@buryjuice.com',
    tier: 'classified',
    monthlyRateGbp: 2500,
    cadence: 'monthly',
    isComp: false,
    notes: 'Rolling monthly commitment — 1st Thursday of each month',
  },
  {
    name: 'Midgar',
    email: 'legacy+midgar@buryjuice.com',
    tier: 'feature',
    monthlyRateGbp: 6500,
    cadence: 'monthly',
    isComp: false,
    notes: 'Rolling monthly commitment — 3rd Thursday of each month',
  },
  {
    name: 'Yes You Can Fitness',
    email: 'legacy+yesyoucanfitness@buryjuice.com',
    tier: 'feature',
    monthlyRateGbp: 6500,
    cadence: 'monthly',
    isComp: false,
    notes: 'Rolling monthly commitment — 1st Thursday of each month',
  },
];
