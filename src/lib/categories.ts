export const BUSINESS_CATEGORIES: Record<string, string> = {
  'Food & Drink': '🍕',
  'Hair & Beauty': '💇',
  'Health & Fitness': '🏋️',
  'Retail': '🛍️',
  'Cafe & Coffee': '☕',
  'Arts & Entertainment': '🎭',
  'Wellness & Spa': '💆',
  'Pets': '🐾',
  'Education': '📚',
  'Services': '🔧',
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

export const CATEGORY_LIST = Object.keys(BUSINESS_CATEGORIES);

export function getCategoryEmoji(category: string | undefined | null): string {
  return BUSINESS_CATEGORIES[category || ''] || '🏪';
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
