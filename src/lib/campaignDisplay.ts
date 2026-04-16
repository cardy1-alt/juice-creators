/**
 * Single source of truth for how a campaign's "brand" surfaces in the UI.
 *
 * Brand campaigns pull from the joined `businesses` row. Community campaigns
 * have a NULL `brand_id` (and thus no businesses join), so we synthesise a
 * Nayba-branded display object instead. Anything that renders a campaign
 * card, hero, or list row should funnel through this helper rather than
 * dereferencing `campaign.businesses?.…` directly — that way, the moment
 * we add a community campaign, every surface picks up the correct fallback.
 */

export const NAYBA_COMMUNITY_NAME = 'Nayba';
export const NAYBA_COMMUNITY_CATEGORY = 'Community';

// Matches the blue used by the existing community badge (CreatorApp.tsx:319).
const COMMUNITY_PALETTE = {
  color: '#3B82F6',
  tint: 'rgba(59,130,246,0.08)',
  border: 'rgba(59,130,246,0.20)',
};

interface CampaignLike {
  campaign_type?: 'brand' | 'community' | null;
  brand_id?: string | null;
  brand_instructions?: string | null;
  businesses?: {
    name?: string | null;
    category?: string | null;
    bio?: string | null;
    instagram_handle?: string | null;
    logo_url?: string | null;
    address?: string | null;
  } | null;
}

export interface CampaignBrandDisplay {
  /** True if this is an admin-run community campaign (no brand). */
  isCommunity: boolean;
  /** Brand or "Nayba Community" — always a non-empty string. */
  name: string;
  /** Category label for chips. May be empty. */
  category: string;
  /** Bio text — empty for community. */
  bio: string;
  /** @-handle stripped of leading "@" — empty for community. */
  instagramHandle: string;
  /** Logo URL — null for community (callers should render Nayba mark). */
  logoUrl: string | null;
  /** Address — empty for community. */
  address: string;
  /** Brand requirements — only meaningful for brand campaigns. */
  instructions: string;
  /** Palette to use for this campaign's category accents. */
  palette: { color: string; tint: string; border: string };
}

/**
 * Resolve the display details for a campaign. Pass the joined businesses row
 * if you have it; the helper handles the null cases for you.
 *
 * For community campaigns we deliberately do NOT use the category palette —
 * community campaigns are visually owned by Nayba (terra/blue), not by an
 * inferred category.
 */
export function getCampaignBrandDisplay(
  campaign: CampaignLike,
  categoryPalette?: (cat: string | null | undefined) => { color: string; tint: string; border: string },
): CampaignBrandDisplay {
  const isCommunity =
    campaign.campaign_type === 'community' || (!campaign.brand_id && !campaign.businesses);

  if (isCommunity) {
    return {
      isCommunity: true,
      name: NAYBA_COMMUNITY_NAME,
      category: NAYBA_COMMUNITY_CATEGORY,
      bio: '',
      instagramHandle: '',
      logoUrl: null,
      address: '',
      instructions: '',
      palette: COMMUNITY_PALETTE,
    };
  }

  const b = campaign.businesses || {};
  const palette = categoryPalette
    ? categoryPalette(b.category)
    : { color: 'var(--ink-35)', tint: 'var(--stone)', border: 'var(--ink-35)' };

  return {
    isCommunity: false,
    name: b.name || '—',
    category: b.category || '',
    bio: b.bio || '',
    instagramHandle: (b.instagram_handle || '').replace(/^@/, ''),
    logoUrl: b.logo_url || null,
    address: b.address || '',
    instructions: campaign.brand_instructions?.trim() || '',
    palette,
  };
}
