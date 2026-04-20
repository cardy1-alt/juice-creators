// Reference list of legacy sponsors. The canonical source of truth
// lives in the DB (bj_legacy_rates), seeded by the migration
// 20260420100100_bury_juice_legacy_seed.sql. This module is only
// useful for admin-side UI that needs a readable description of who
// each legacy row represents.

import type { BjTier } from './pricing';

export interface LegacySponsor {
  name: string;
  email: string;
  tier: BjTier;
  monthlyRateGbp: number;
  cadence: 'monthly' | 'weekly';
  isComp: boolean;
  notes: string;
}

export const LEGACY_SPONSORS: LegacySponsor[] = [
  {
    name: 'David Lloyd Bury St Edmunds',
    email: 'legacy+davidlloyd@buryjuice.com',
    tier: 'gold',
    monthlyRateGbp: 0,
    cadence: 'weekly',
    isComp: true,
    notes: 'Comp — rotates gold/silver/bronze across the month',
  },
  {
    name: 'Snappy Shopper',
    email: 'legacy+snappy@buryjuice.com',
    tier: 'silver',
    monthlyRateGbp: 8000,
    cadence: 'monthly',
    isComp: false,
    notes: 'Rolling monthly commitment',
  },
  {
    name: 'Loyal Wolf',
    email: 'legacy+loyalwolf@buryjuice.com',
    tier: 'bronze',
    monthlyRateGbp: 3500,
    cadence: 'monthly',
    isComp: false,
    notes: 'Rolling monthly commitment',
  },
  {
    name: 'Midgar',
    email: 'legacy+midgar@buryjuice.com',
    tier: 'silver',
    monthlyRateGbp: 8500,
    cadence: 'monthly',
    isComp: false,
    notes: 'Rolling monthly commitment',
  },
  {
    name: 'Yes You Can Fitness',
    email: 'legacy+yycfitness@buryjuice.com',
    tier: 'bronze',
    monthlyRateGbp: 3500,
    cadence: 'monthly',
    isComp: false,
    notes: 'Rolling monthly commitment',
  },
];
