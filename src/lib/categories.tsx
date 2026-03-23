import React from 'react';
import {
  DoodleCutlery, DoodleScissors, DoodleDumbbell, DoodleBag,
  DoodleCoffee, DoodlePaintBrush, DoodleFlower, DoodlePawPrint,
  DoodleGradCap, DoodleWrench, DoodleShop,
} from './doodle-icons';

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
  Cutlery: DoodleCutlery,
  Scissors: DoodleScissors,
  Dumbbell: DoodleDumbbell,
  Bag: DoodleBag,
  Coffee: DoodleCoffee,
  PaintBrush: DoodlePaintBrush,
  Flower: DoodleFlower,
  PawPrint: DoodlePawPrint,
  GradCap: DoodleGradCap,
  Wrench: DoodleWrench,
  Shop: DoodleShop,
};

export function CategoryIcon({ category, className = "w-4 h-4", style }: { category: string | undefined | null; className?: string; style?: React.CSSProperties }) {
  const iconName = getCategoryIconName(category);
  const IconComponent = ICON_COMPONENTS[iconName] || DoodleShop;
  return <IconComponent className={className} style={style} />;
}

// Category-specific dark gradients for placeholder images
const CATEGORY_GRADIENTS: Record<string, string> = {
  'Food & Drink': 'linear-gradient(135deg, #3D2314, #6B3A1F)',
  'Cafe & Coffee': 'linear-gradient(135deg, #3D2314, #6B3A1F)',
  'Hair & Beauty': 'linear-gradient(135deg, #2D1F2E, #5C3A5A)',
  'Wellness & Spa': 'linear-gradient(135deg, #2D1F2E, #5C3A5A)',
  'Health & Fitness': 'linear-gradient(135deg, #0F1F2E, #1A3A5C)',
  'Retail': 'linear-gradient(135deg, #1A1F3A, #2D3561)',
  'Arts & Entertainment': 'linear-gradient(135deg, #1F1A0F, #4A3A1A)',
  'Education': 'linear-gradient(135deg, #0F2318, #1A4A2E)',
  'Pets': 'linear-gradient(135deg, #2A1A0F, #5C3D1A)',
  'Services': 'linear-gradient(135deg, #2C2420, #3A3A3A)',
};

const CATEGORY_SOLID_COLORS: Record<string, string> = {
  'Food & Drink': '#3D2314',
  'Cafe & Coffee': '#3D2314',
  'Hair & Beauty': '#2D1F2E',
  'Wellness & Spa': '#2D1F2E',
  'Health & Fitness': '#0F1F2E',
  'Retail': '#1A1F3A',
  'Arts & Entertainment': '#1F1A0F',
  'Education': '#0F2318',
  'Pets': '#2A1A0F',
  'Services': '#2C2420',
};

export function getCategoryGradient(category: string | undefined | null): string {
  return CATEGORY_GRADIENTS[category || ''] || 'linear-gradient(135deg, #1A4A2E, #2C4A3E)';
}

export function getCategorySolidColor(category: string | undefined | null): string {
  return CATEGORY_SOLID_COLORS[category || ''] || '#1A4A2E';
}

// Muted pastel card backgrounds
const CATEGORY_PASTEL_BG: Record<string, string> = {
  'Food & Drink': '#F2E8E0',
  'Cafe & Coffee': '#F2E8E0',
  'Hair & Beauty': '#F2E2EA',
  'Wellness & Spa': '#E8EEE7',
  'Health & Fitness': '#E4EAED',
  'Retail': '#E4EAED',
  'Arts & Entertainment': '#F2E8E0',
  'Education': '#E8EEE7',
  'Pets': '#F2E8E0',
  'Services': '#EDE8DC',
};

const CATEGORY_PASTEL_ICON: Record<string, string> = {
  'Food & Drink': '#9E7A5A',
  'Cafe & Coffee': '#9E7A5A',
  'Hair & Beauty': '#A06A82',
  'Wellness & Spa': '#7A6A98',
  'Health & Fitness': '#5A8A72',
  'Retail': '#5A6A8E',
  'Arts & Entertainment': '#8E7A52',
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
