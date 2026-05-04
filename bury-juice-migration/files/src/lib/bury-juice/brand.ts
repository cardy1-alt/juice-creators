// Brand constants for the Bury Juice surface. Kept in code (not CSS)
// so components can reference them without going through a global
// cascade. The matching CSS variables live in bury-juice.css and are
// scoped to the `.bj-surface` class so they never leak into Nayba.

export const BJ_COLORS = {
  crimson: '#A3185A',
  gold: '#F5C96A',
  cream: '#FAF7F2',
  charcoal: '#181818',
  white: '#FFFFFF',
  mid: 'rgba(24, 24, 24, 0.6)',
  soft: 'rgba(24, 24, 24, 0.3)',
  faint: 'rgba(24, 24, 24, 0.1)',
} as const;

// Helvetica Neue is a system font on most platforms; we fall back
// cleanly. Crimson Pro / Plus Jakarta Sans are explicitly excluded.
export const BJ_FONT_STACK =
  '"Helvetica Neue", "HelveticaNeue", Helvetica, Arial, sans-serif';
