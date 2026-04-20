import React, { useEffect, useState } from 'react';

const SponsorStorefront = React.lazy(() => import('./SponsorStorefront'));
const SponsorSuccess = React.lazy(() => import('./SponsorSuccess'));

// The Bury Juice surface is a public storefront rendered on the same
// SPA. Admin management lives inside the Nayba AdminDashboard
// ("Bury Juice" tab). Only two public routes: the storefront itself
// and the post-payment success screen.

type Route = { kind: 'storefront' } | { kind: 'success' };

function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/sponsor/success') return { kind: 'success' };
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
    </React.Suspense>
  );
}

export { isBuryJuiceSurface } from '../../lib/bury-juice/surface.js';
