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

export const CATEGORY_LIST = Object.keys(BUSINESS_CATEGORIES);

export function getCategoryEmoji(category: string | undefined | null): string {
  return BUSINESS_CATEGORIES[category || ''] || '🏪';
}
