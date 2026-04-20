import React, { useEffect, useState } from 'react';

const SponsorStorefront = React.lazy(() => import('./SponsorStorefront'));
const SponsorSuccess = React.lazy(() => import('./SponsorSuccess'));
const SponsorDashboard = React.lazy(() => import('./SponsorDashboard'));

// The Bury Juice surface is a public storefront rendered on the same
// SPA. Admin management lives inside the Nayba AdminDashboard (new
// "Bury Juice" tab) — no separate /admin/sponsors path anymore.

type Route =
  | { kind: 'storefront' }
  | { kind: 'success' }
  | { kind: 'dashboard'; token: string };

function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/sponsor' || path === '/') return { kind: 'storefront' };
  if (path === '/sponsor/success') return { kind: 'success' };
  const dashMatch = path.match(/^\/sponsor\/dashboard\/([^/]+)$/);
  if (dashMatch) return { kind: 'dashboard', token: decodeURIComponent(dashMatch[1]) };
  return { kind: 'storefront' };
}

export default function BuryJuiceApp() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <React.Suspense
      fallback={
        <div className="bj-surface">
          <section className="bj-section">
            <p style={{ color: 'var(--ink-60)' }}>Loading…</p>
          </section>
        </div>
      }
    >
      {route.kind === 'storefront' && <SponsorStorefront />}
      {route.kind === 'success' && <SponsorSuccess />}
      {route.kind === 'dashboard' && <SponsorDashboard token={route.token} />}
    </React.Suspense>
  );
}

export { isBuryJuiceSurface } from '../../lib/bury-juice/surface.js';
