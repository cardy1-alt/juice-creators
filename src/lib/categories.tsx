import React from 'react';
import {
  UtensilsCrossed, Scissors, Dumbbell, ShoppingBag,
  Coffee, Paintbrush, Flower2, PawPrint,
  GraduationCap, Wrench, Store,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, string> = {
  'Food & Drink': 'Cutlery',
  'Hair & Beauty': 'Scissors',
  'Health & Fitness': 'Dumbbell',
  'Retail': 'Bag',
  'Cafe & Coffee': 'Coffee',
  'Arts & Entertainment': 'PaintBrush',
  'Wellness & Spa': 'Flower',
  'Pets': 'PawPrint',
  'Education': 'GradCap',
  'Services': 'Wrench',
};

export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Drink': 'bg-orange-500',
  'Hair & Beauty': 'bg-pink-500',
  'Health & Fitness': 'bg-green-500',
  'Retail': 'bg-blue-500',
  'Cafe & Coffee': 'bg-amber-500',
  'Arts & Entertainment': 'bg-purple-500',
  'Wellness & Spa': 'bg-teal-500',
  'Pets': 'bg-yellow-500',
  'Education': 'bg-indigo-500',
  'Services': 'bg-gray-500',
};

export const CATEGORY_LIST = Object.keys(CATEGORY_ICONS);

export function getCategoryIconName(category: string | undefined | null): string {
  return CATEGORY_ICONS[category || ''] || 'Shop';
}

export function getCategoryColor(category: string | undefined | null): string {
  return CATEGORY_COLORS[category || ''] || 'bg-gray-500';
}

export function getCategoryIconBg(category: string | undefined | null): string {
  const bgMap: Record<string, string> = {
    'Food & Drink': 'bg-gradient-to-br from-orange-50 to-orange-100/50',
    'Hair & Beauty': 'bg-gradient-to-br from-pink-50 to-pink-100/50',
    'Health & Fitness': 'bg-gradient-to-br from-green-50 to-green-100/50',
    'Retail': 'bg-gradient-to-br from-blue-50 to-blue-100/50',
    'Cafe & Coffee': 'bg-gradient-to-br from-amber-50 to-amber-100/50',
    'Arts & Entertainment': 'bg-gradient-to-br from-purple-50 to-purple-100/50',
    'Wellness & Spa': 'bg-gradient-to-br from-teal-50 to-teal-100/50',
    'Pets': 'bg-gradient-to-br from-yellow-50 to-yellow-100/50',
    'Education': 'bg-gradient-to-br from-indigo-50 to-indigo-100/50',
    'Services': 'bg-gradient-to-br from-gray-50 to-gray-100/50',
  };
  return bgMap[category || ''] || 'bg-gradient-to-br from-gray-50 to-gray-100/50';
}

export function getCategoryBorderColor(category: string | undefined | null): string {
  const borderMap: Record<string, string> = {
    'Food & Drink': 'border-orange-100/50',
    'Hair & Beauty': 'border-pink-100/50',
    'Health & Fitness': 'border-green-100/50',
    'Retail': 'border-blue-100/50',
    'Cafe & Coffee': 'border-amber-100/50',
    'Arts & Entertainment': 'border-purple-100/50',
    'Wellness & Spa': 'border-teal-100/50',
    'Pets': 'border-yellow-100/50',
    'Education': 'border-indigo-100/50',
    'Services': 'border-gray-100/50',
  };
  return borderMap[category || ''] || 'border-gray-100/50';
}

const ICON_COMPONENTS: Record<string, React.FC<any>> = {
  Cutlery: UtensilsCrossed,
  Scissors: Scissors,
  Dumbbell: Dumbbell,
  Bag: ShoppingBag,
  Coffee: Coffee,
  PaintBrush: Paintbrush,
  Flower: Flower2,
  PawPrint: PawPrint,
  GradCap: GraduationCap,
  Wrench: Wrench,
  Shop: Store,
};

export function CategoryIcon({ category, className = "w-4 h-4", style }: { category: string | undefined | null; className?: string; style?: React.CSSProperties }) {
  const iconName = getCategoryIconName(category);
  const IconComponent = ICON_COMPONENTS[iconName] || Store;
  return <IconComponent className={className} style={style} strokeWidth={1.5} />;
}

const CATEGORY_SOLID_COLORS: Record<string, string> = {
  'Food & Drink': '#3D2314',
  'Cafe & Coffee': '#2E1A0A',
  'Hair & Beauty': '#2D1F2E',
  'Wellness & Spa': '#1A2E2A',
  'Health & Fitness': '#0F1F2E',
  'Retail': '#1A1F3A',
  'Arts & Entertainment': '#2A1F2E',
  'Education': '#0F2318',
  'Pets': '#2A1A0F',
  'Services': '#2C2420',
};

export function getCategorySolidColor(category: string | undefined | null): string {
  return CATEGORY_SOLID_COLORS[category || ''] || '#1A4A2E';
}

// Muted pastel card backgrounds — visually distinct per category
const CATEGORY_PASTEL_BG: Record<string, string> = {
  'Food & Drink': '#EDE8D0',
  'Cafe & Coffee': '#F0E4D0',
  'Hair & Beauty': '#EDD4D4',
  'Wellness & Spa': '#D0E8E4',
  'Health & Fitness': '#D4E0ED',
  'Retail': '#D4D8ED',
  'Arts & Entertainment': '#E8D8ED',
  'Education': '#D4E8D0',
  'Pets': '#F0E6D4',
  'Services': '#EDE8DC',
};

const CATEGORY_PASTEL_ICON: Record<string, string> = {
  'Food & Drink': '#9E7A5A',
  'Cafe & Coffee': '#8A6842',
  'Hair & Beauty': '#A06A82',
  'Wellness & Spa': '#5A8A82',
  'Health & Fitness': '#5A8A72',
  'Retail': '#5A6A8E',
  'Arts & Entertainment': '#8A6A9E',
  'Education': '#4A7A5E',
  'Pets': '#8E7244',
  'Services': '#6E6A62',
};

export function getCategoryPastelBg(category: string | undefined | null): string {
  return CATEGORY_PASTEL_BG[category || ''] || '#EDE8DC';
}

export function getCategoryPastelIcon(category: string | undefined | null): string {
  return CATEGORY_PASTEL_ICON[category || ''] || '#6E6A62';
}

/* ── Nayba palette mapping — maps business categories to design token colors ──
 *
 * Keys cover both the short canonical names used by AdminBrandsTab (Food &
 * Drink / Beauty / Wellness / Experience / Retail) and legacy long-form
 * variants, so admin-created brands pick up the right colour regardless of
 * which vocabulary produced the row.
 */
const CATEGORY_PALETTE: Record<string, { color: string; tint: string; border: string }> = {
  // Short canonical names (what AdminBrandsTab saves)
  'Food & Drink':         { color: 'var(--sage)',        tint: 'var(--sage-tint)',   border: 'var(--sage)' },
  'Beauty':               { color: 'var(--violet)',      tint: 'var(--violet-tint)', border: 'var(--violet)' },
  'Wellness':             { color: 'var(--violet)',      tint: 'var(--violet-tint)', border: 'var(--violet)' },
  'Experience':           { color: 'var(--golden-mist)', tint: 'var(--mist-tint)',   border: 'var(--golden-mist)' },
  'Retail':               { color: 'var(--baltic)',      tint: 'var(--baltic-tint)', border: 'var(--baltic)' },
  // Legacy long-form variants (kept for any older rows)
  'Cafe & Coffee':        { color: 'var(--sage)',        tint: 'var(--sage-tint)',   border: 'var(--sage)' },
  'Hair & Beauty':        { color: 'var(--violet)',      tint: 'var(--violet-tint)', border: 'var(--violet)' },
  'Wellness & Spa':       { color: 'var(--violet)',      tint: 'var(--violet-tint)', border: 'var(--violet)' },
  'Health & Fitness':     { color: 'var(--baltic)',      tint: 'var(--baltic-tint)', border: 'var(--baltic)' },
  'Arts & Entertainment': { color: 'var(--golden-mist)', tint: 'var(--mist-tint)',   border: 'var(--golden-mist)' },
  'Education':            { color: 'var(--golden-mist)', tint: 'var(--mist-tint)',   border: 'var(--golden-mist)' },
  'Services':             { color: 'var(--ink-35)',      tint: 'var(--stone)',       border: 'var(--ink-35)' },
  'Pets':                 { color: 'var(--golden-mist)', tint: 'var(--mist-tint)',   border: 'var(--golden-mist)' },
};

const DEFAULT_PALETTE = { color: 'var(--ink-35)', tint: 'var(--stone)', border: 'var(--ink-35)' };

export function getCategoryPalette(category: string | undefined | null): { color: string; tint: string; border: string } {
  return CATEGORY_PALETTE[category || ''] || DEFAULT_PALETTE;
}

/* Maps display filter categories to palette colors for filter chips */
const FILTER_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  'Food & Drink': { bg: 'var(--sage)',        text: '#FFFFFF' },
  'Beauty':       { bg: 'var(--violet)',      text: '#FFFFFF' },
  'Wellness':     { bg: 'var(--violet)',      text: '#FFFFFF' },
  'Experience':   { bg: 'var(--golden-mist)', text: '#FFFFFF' },
  'Retail':       { bg: 'var(--baltic)',      text: '#FFFFFF' },
  'Fitness':      { bg: 'var(--baltic)',      text: '#FFFFFF' },
};

export function getFilterChipColor(displayCategory: string): { bg: string; text: string } | null {
  return FILTER_CHIP_COLORS[displayCategory] || null;
}
