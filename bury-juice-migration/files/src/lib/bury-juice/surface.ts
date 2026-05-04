// Cheap synchronous check used by App.tsx to decide whether to hand
// control to the Bury Juice surface before any other app state loads.
//
// Juice Local edition: storefront mounts at /bury on the
// sponsor.juicelocal.co.uk subdomain. Path-based detection picks up
// /bury (storefront root) and /bury/* sub-routes (e.g. /bury/success).

export function isBuryJuiceSurface(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  if (path === '/bury' || path.startsWith('/bury/')) return true;
  return false;
}
