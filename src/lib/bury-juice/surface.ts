// Cheap synchronous check used by App.tsx to decide whether to hand
// control to the Bury Juice surface before loading any Nayba state.

export function isBuryJuiceSurface(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  // Subdomain hosts — every path on these resolves to the storefront.
  if (host === 'sponsor.buryjuice.com' || host.endsWith('.buryjuice.com')) return true;
  if (host === 'sponsor.theburyjuice.com' || host.endsWith('.theburyjuice.com')) return true;

  // Path-based on the Nayba host.
  const path = window.location.pathname;
  if (path === '/sponsor' || path.startsWith('/sponsor/')) return true;

  return false;
}
