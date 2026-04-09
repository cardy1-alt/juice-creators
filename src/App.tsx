import React, { Component, ReactNode, useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';

const CreatorApp = React.lazy(() => import('./components/CreatorApp'));
const BusinessPortal = React.lazy(() => import('./components/BusinessPortal'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const CampaignDetail = React.lazy(() => import('./components/CampaignDetail'));
import { AlertCircle, RefreshCw, LogOut, Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';

// ─── Error Boundary ──────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorMessage: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }
  static getDerivedStateFromError(error: unknown) {
    let msg: string;
    if (error instanceof Error) {
      msg = `${error.name}: ${error.message}`;
    } else {
      try { msg = JSON.stringify(error); } catch { msg = String(error); }
    }
    return { hasError: true, errorMessage: msg };
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--shell)]">
          <div className="bg-[var(--card)] rounded-[var(--r-card)] shadow-[var(--shadow-md)] border border-[var(--border)] p-8 max-w-sm text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-light)] mb-4">
              <AlertCircle size={28} strokeWidth={1.5} className="text-[var(--terra)]" />
            </div>
            <h2 className="text-xl font-sans font-semibold mb-2 text-[var(--ink)]">Something went wrong</h2>
            <p className="text-[var(--ink-60)] text-base mb-4">An unexpected error occurred. Please refresh the page.</p>
            {this.state.errorMessage && (
              <p className="text-[var(--ink-35)] text-sm mb-4 font-mono bg-[var(--shell)] rounded-lg p-3 text-left break-all">{this.state.errorMessage}</p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[6px] text-white font-semibold bg-[var(--terra)] hover:opacity-85 transition-colors"
            >
              <RefreshCw size={16} strokeWidth={1.5} />
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DemoBanner() {
  if (import.meta.env.VITE_ENABLE_DEMO !== 'true') return null;
  const params = new URLSearchParams(window.location.search);
  const current = params.get('demo');
  if (!current) return null;

  const roles = ['creator', 'business', 'admin'] as const;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[var(--ink)] text-white px-4 py-2 flex items-center justify-between text-sm">
      <span className="font-semibold">DEMO MODE</span>
      <div className="flex gap-2">
        {roles.map((r) => (
          <a
            key={r}
            href={`?demo=${r}`}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              current === r
                ? 'bg-[var(--terra)] text-white'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {r}
          </a>
        ))}
        <a
          href="/"
          className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 font-medium"
        >
          Exit
        </a>
      </div>
    </div>
  );
}

function isPasswordRecovery(): boolean {
  if (window.location.pathname === '/reset-password') return true;
  const hash = window.location.hash;
  if (hash.includes('type=recovery')) return true;
  return false;
}

function getCampaignIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('campaign');
}

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    const timeout = setTimeout(() => {
      setSessionError(true);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      setError(err.message === 'New password should be different from the old password.'
        ? 'New password must be different from your current password'
        : 'This reset link has expired or is invalid. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--shell)]">
        <div className="bg-[var(--card)] rounded-[var(--r-card)] shadow-[var(--shadow-md)] border border-[var(--border)] p-8 max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(45,122,79,0.1)] mb-4">
            <CheckCircle size={28} strokeWidth={1.5} className="text-[var(--success)]" />
          </div>
          <h2 className="text-xl font-sans font-semibold mb-2 text-[var(--ink)]">Password Updated</h2>
          <p className="text-[var(--ink-60)] text-base">Redirecting you to sign in...</p>
        </div>
      </div>
    );
  }

  if (!sessionReady && sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--shell)]">
        <div className="bg-[var(--card)] rounded-[var(--r-card)] shadow-[var(--shadow-md)] border border-[var(--border)] p-8 max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-light)] mb-4">
            <AlertCircle size={28} strokeWidth={1.5} className="text-[var(--terra)]" />
          </div>
          <h2 className="text-xl font-sans font-semibold mb-2 text-[var(--ink)]">Link Expired</h2>
          <p className="text-[var(--ink-60)] text-base mb-6">This password reset link has expired or is invalid. Please request a new one.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[6px] text-white font-semibold bg-[var(--terra)] hover:opacity-85 transition-colors"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)]">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--ink-60)] text-base font-medium">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--shell)]">
      <div className="bg-[var(--card)] rounded-[var(--r-card)] shadow-[var(--shadow-md)] border border-[var(--border)] p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-light)] mb-4">
            <Lock size={28} strokeWidth={1.5} className="text-[var(--terra)]" />
          </div>
          <h2 className="text-xl font-sans font-semibold mb-1 text-[var(--ink)]">Reset Password</h2>
          <p className="text-[var(--ink-60)] text-sm">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--ink-60)] mb-1.5">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className="w-full px-4 py-3 pr-11 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[var(--ink)] text-base focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-35)] hover:text-[var(--ink-60)]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ink-60)] mb-1.5">Confirm password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[var(--ink)] text-base focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)]"
            />
          </div>

          {error && (
            <p className="text-[var(--terra)] text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-[6px] text-white font-semibold bg-[var(--terra)] hover:opacity-85 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating...
              </>
            ) : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ViewAsBanner() {
  const { viewAsRole, viewAsProfile, exitViewAs } = useAuth();
  if (!viewAsRole) return null;
  const name = viewAsProfile?.display_name || viewAsProfile?.name || viewAsProfile?.email || '—';
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[var(--ink)] text-white px-4 py-2 flex items-center justify-between text-[13px]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <div className="flex items-center gap-2">
        <Eye size={14} className="opacity-60" />
        <span className="font-medium">Viewing as {viewAsRole === 'creator' ? 'creator' : 'brand'}:</span>
        <span className="font-semibold">{name}</span>
      </div>
      <button onClick={exitViewAs} className="px-3 py-1 rounded-[6px] bg-white/10 hover:bg-white/20 font-medium transition-colors">
        Back to Admin
      </button>
    </div>
  );
}

function App() {
  const { user, userRole, loading, signOut, viewAsRole, viewAsProfile } = useAuth();
  const isDemo = import.meta.env.VITE_ENABLE_DEMO === 'true' && new URLSearchParams(window.location.search).has('demo');
  const campaignId = getCampaignIdFromUrl();

  // Password recovery route — must be checked before auth gate
  if (isPasswordRecovery()) {
    return <ResetPassword />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)]">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--ink-60)] text-base font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Campaign deep link — unauthenticated: store campaign ID and show auth
  if (campaignId && !user) {
    try {
      sessionStorage.setItem('nayba_pending_campaign', campaignId);
    } catch {}
    return <Auth />;
  }

  if (!user) {
    return <Auth />;
  }

  // Campaign deep link — authenticated creator: render campaign detail directly
  if (campaignId && userRole === 'creator') {
    return (
      <React.Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--shell)]">
          <div className="w-10 h-10 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        {isDemo && <DemoBanner />}
        <div className={isDemo ? 'pt-10' : ''}>
          <CampaignDetail campaignId={campaignId} />
        </div>
      </React.Suspense>
    );
  }

  // Check for stored campaign ID after login (redirect from deep link)
  const pendingCampaign = (() => {
    try {
      return sessionStorage.getItem('nayba_pending_campaign');
    } catch {
      return null;
    }
  })();

  if (pendingCampaign && userRole === 'creator') {
    try {
      sessionStorage.removeItem('nayba_pending_campaign');
    } catch {}
    return (
      <React.Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--shell)]">
          <div className="w-10 h-10 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        {isDemo && <DemoBanner />}
        <div className={isDemo ? 'pt-10' : ''}>
          <CampaignDetail campaignId={pendingCampaign} />
        </div>
      </React.Suspense>
    );
  }

  const suspenseFallback = (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--shell)' }}>
      <span style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, color: 'var(--ink)', fontSize: 22 }}>nayba</span>
    </div>
  );

  // Admin "View as" mode — render creator or business view with exit banner
  if (userRole === 'admin' && viewAsRole) {
    return (
      <React.Suspense fallback={suspenseFallback}>
        <ViewAsBanner />
        <div className="pt-10">
          {viewAsRole === 'creator' && <CreatorApp />}
          {viewAsRole === 'business' && <BusinessPortal />}
        </div>
      </React.Suspense>
    );
  }

  if (userRole === 'admin') {
    return <React.Suspense fallback={suspenseFallback}>{isDemo && <DemoBanner />}<div className={isDemo ? 'pt-10' : ''}><AdminDashboard /></div></React.Suspense>;
  }

  if (userRole === 'creator') {
    return <React.Suspense fallback={suspenseFallback}>{isDemo && <DemoBanner />}<div className={isDemo ? 'pt-10' : ''}><CreatorApp /></div></React.Suspense>;
  }

  if (userRole === 'business') {
    return <React.Suspense fallback={suspenseFallback}>{isDemo && <DemoBanner />}<div className={isDemo ? 'pt-10' : ''}><BusinessPortal /></div></React.Suspense>;
  }

  // Fallback — user authenticated but no profile found
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--shell)]">
      <div className="bg-[var(--card)] rounded-[var(--r-card)] shadow-[var(--shadow-md)] border border-[var(--border)] p-8 max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-light)] mb-4">
          <AlertCircle size={28} strokeWidth={1.5} className="text-[var(--terra)]" />
        </div>
        <h2 className="text-xl font-sans font-semibold mb-2 text-[var(--ink)]">
          Account Not Found
        </h2>
        <p className="text-[var(--ink-60)] text-base mb-6">
          Your account profile could not be found. Please sign out and try again, or contact support.
        </p>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[6px] text-white font-semibold bg-[var(--terra)] hover:opacity-85 transition-colors"
        >
          <LogOut size={16} strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem('nayba_cookie_consent') !== 'true'; } catch { return true; }
  });

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999]" style={{ boxShadow: '0 -1px 3px rgba(42,32,24,0.06)' }}>
      <div className="bg-white px-[16px] py-[16px] flex items-center justify-between gap-[16px] max-w-[600px] mx-auto" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
        <p className="text-[13px] text-[var(--ink-60)] leading-[1.5] m-0" style={{ fontWeight: 400 }}>
          We use cookies to keep you signed in and improve your experience.
        </p>
        <button
          onClick={() => {
            try { localStorage.setItem('nayba_cookie_consent', 'true'); } catch {}
            setVisible(false);
          }}
          className="flex-shrink-0 px-[16px] py-[8px] text-[13px] text-white rounded-[6px] bg-[var(--terra)] hover:opacity-85 transition-opacity"
          style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
      <CookieConsent />
    </ErrorBoundary>
  );
}

export default AppWithBoundary;
