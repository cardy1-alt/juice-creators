import type { BjTier } from './pricing.js';

export type BjBookingStatus = 'confirmed' | 'pending_creative' | 'cancelled';
export type BjBookingSource = 'paid_storefront' | 'paid_legacy' | 'comp';
export type BjAvailabilityStatus = 'available' | 'taken' | 'too_soon';

export interface BjBooking {
  id: string;
  business_id: string;
  tier: BjTier;
  issue_date: string;
  source: BjBookingSource;
  status: BjBookingStatus;
  pack_id: string | null;
  amount_paid_gbp: number | null;
  stripe_payment_intent: string | null;
  headline: string | null;
  body_copy: string | null;
  cta_url: string | null;
  image_url: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BjPack {
  id: string;
  business_id: string;
  tier: BjTier;
  size: number;
  credits_remaining: number;
  amount_paid_gbp: number;
  stripe_payment_intent: string;
  dashboard_token: string;
  expires_at: string;
  created_at: string;
}

export interface BjBusiness {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
  address: string | null;
  stripe_customer_id: string | null;
}

export interface BjAvailabilityEntry {
  date: string;
  status: BjAvailabilityStatus;
  filled: number;
  capacity: number;
}

export interface BjCreative {
  headline: string;
  body_copy: string;
  cta_url: string;
  image_url?: string | null;
  logo_url?: string | null;
}
