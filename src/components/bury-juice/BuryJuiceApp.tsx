import React, { useEffect, useState } from 'react';

const SponsorStorefront = React.lazy(() => import('./SponsorStorefront'));
const SponsorSuccess = React.lazy(() => import('./SponsorSuccess'));
const SponsorDashboard = React.lazy(() => import('./SponsorDashboard'));
const AdminSponsors = React.lazy(() => import('./AdminSponsors'));

// The Bury Juice surface is a second app rendered on the same SPA.
// Route resolution is path-based (not ?page= query), mirroring the
// spec's /sponsor, /sponsor/success, /sponsor/dashboard/[token],
// /admin/sponsors[/[date]] URLs.

type Route =
  | { kind: 'storefront' }
  | { kind: 'success' }
  | { kind: 'dashboard'; token: string }
  | { kind: 'admin'; issueDate: string | null };

function parseRoute(pathname: string): Route {
  // Accept both /sponsor and /sponsor/ — same for every other path.
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/sponsor' || path === '/') return { kind: 'storefront' };
  if (path === '/sponsor/success') return { kind: 'success' };
  const dashMatch = path.match(/^\/sponsor\/dashboard\/([^/]+)$/);
  if (dashMatch) return { kind: 'dashboard', token: decodeURIComponent(dashMatch[1]) };
  if (path === '/admin/sponsors') return { kind: 'admin', issueDate: null };
  const issueMatch = path.match(/^\/admin\/sponsors\/(\d{4}-\d{2}-\d{2})$/);
  if (issueMatch) return { kind: 'admin', issueDate: issueMatch[1] };
  return { kind: 'storefront' };
}

const ADMIN_PW_KEY = 'bj_admin_pw';

export default function BuryJuiceApp() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  const [adminPassword, setAdminPassword] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ADMIN_PW_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(pathname: string) {
    window.history.pushState({}, '', pathname);
    setRoute(parseRoute(pathname));
  }

  function onAdminSignIn(pw: string) {
    try {
      sessionStorage.setItem(ADMIN_PW_KEY, pw);
    } catch {
      /* noop */
    }
    setAdminPassword(pw);
  }

  return (
    <React.Suspense
      fallback={
        <div className="bj-surface">
          <section className="bj-section">
            <p style={{ color: 'var(--bj-mid)' }}>Loading…</p>
          </section>
        </div>
      }
    >
      {route.kind === 'storefront' && <SponsorStorefront />}
      {route.kind === 'success' && <SponsorSuccess />}
      {route.kind === 'dashboard' && <SponsorDashboard token={route.token} />}
      {route.kind === 'admin' && (
        <AdminSponsors
          adminPassword={adminPassword}
          onSignIn={onAdminSignIn}
          selectedIssueDate={route.issueDate}
          onSelectIssueDate={(iso) =>
            navigate(iso ? `/admin/sponsors/${iso}` : '/admin/sponsors')
          }
        />
      )}
    </React.Suspense>
  );
}

export { isBuryJuiceSurface } from '../../lib/bury-juice/surface';
