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
