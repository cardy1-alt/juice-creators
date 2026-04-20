// Cheap synchronous check used by App.tsx to decide whether to hand
// control to the Bury Juice surface before loading any Nayba state.

export function isBuryJuiceSurface(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host === 'sponsor.buryjuice.com' || host.endsWith('.buryjuice.com')) return true;

  const path = window.location.pathname;
  if (path === '/sponsor' || path.startsWith('/sponsor/')) return true;

  return false;
}
