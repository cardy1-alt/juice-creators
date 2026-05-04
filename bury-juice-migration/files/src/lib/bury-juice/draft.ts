import type { BjPackSize, BjTier } from './pricing.js';
import type { CreativeFormValue } from '../../components/bury-juice/storefront/CreativeForm';

// localStorage-backed draft of an in-progress booking. Photos can't
// round-trip through JSON so we persist text fields only — a sponsor
// returning after a tab kill keeps every typed character but has to
// re-attach their photo / logo (the file inputs can't be re-seeded
// for security reasons anyway).

const STORAGE_KEY = 'bj_booking_draft_v1';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface SerializableCreative {
  businessName: string;
  contactEmail: string;
  contactPhone: string;
  headline: string;
  bodyCopy: string;
  ctaUrl: string;
}

export interface BookingDraft {
  tier: BjTier | null;
  size: BjPackSize;
  selectedDates: string[];
  pickLater: boolean;
  creative: SerializableCreative;
  savedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadDraft(): BookingDraft | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingDraft;
    if (Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(
  tier: BjTier | null,
  size: BjPackSize,
  selectedDates: string[],
  pickLater: boolean,
  creative: CreativeFormValue,
): void {
  if (!isBrowser()) return;
  const hasContent =
    !!creative.businessName.trim() ||
    !!creative.contactEmail.trim() ||
    !!creative.contactPhone.trim() ||
    !!creative.headline.trim() ||
    !!creative.bodyCopy.trim() ||
    !!creative.ctaUrl.trim() ||
    selectedDates.length > 0 ||
    pickLater;
  if (!hasContent) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  try {
    const draft: BookingDraft = {
      tier,
      size,
      selectedDates,
      pickLater,
      creative: {
        businessName: creative.businessName,
        contactEmail: creative.contactEmail,
        contactPhone: creative.contactPhone,
        headline: creative.headline,
        bodyCopy: creative.bodyCopy,
        ctaUrl: creative.ctaUrl,
      },
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore — localStorage may be full or blocked */
  }
}

export function clearDraft(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
