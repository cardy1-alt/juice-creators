import React, { Component, ReactNode, useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';

const CreatorApp = React.lazy(() => import('./components/CreatorApp'));
const BusinessPortal = React.lazy(() => import('./components/BusinessPortal'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
import { AlertCircle, RefreshCw, QrCode, LogOut, Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';

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
          <div className="bg-[var(--card)] rounded-[16px] shadow-[var(--shadow-md)] border border-[var(--ink-08)] p-8 max-w-sm text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-10)] mb-4">
              <AlertCircle size={28} strokeWidth={1.5} className="text-[var(--terra)]" />
            </div>
            <h2 className="text-xl font-sans font-semibold mb-2 text-[var(--near-black)]">Something went wrong</h2>
            <p className="text-[var(--mid)] text-base mb-4">An unexpected error occurred. Please refresh the page.</p>
            {this.state.errorMessage && (
              <p className="text-[var(--soft)] text-sm mb-4 font-mono bg-[var(--bg)] rounded-lg p-3 text-left break-all">{this.state.errorMessage}</p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors"
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
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[var(--near-black)] text-white px-4 py-2 flex items-center justify-between text-sm">
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

function RedeemLanding() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--shell)]">
      <div className="bg-[var(--card)] rounded-[16px] shadow-[var(--shadow-md)] border border-[var(--ink-08)] p-8 max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-10)] mb-4">
          <QrCode size={28} strokeWidth={1.5} className="text-[var(--terra)]" />
        </div>
        <h2 className="text-xl font-sans font-semibold mb-2 text-[var(--near-black)]">
          Creator Pass
        </h2>
        <p className="text-[var(--mid)] text-base mb-6">
          This QR code is for the business to scan. Ask the business to open their app and use the Scan tab to verify your visit.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors"
        >
          Go to app
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
    // Supabase auto-exchanges the hash tokens for a session via onAuthStateChange.
    // Wait for a PASSWORD_RECOVERY or SIGNED_IN event before allowing submission.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });

    // If the session is already established (e.g. page didn't just load), check now.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    // If no session after 5 seconds, the link is likely expired/invalid.
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
      // Redirect to login after a short delay
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
        <div className="bg-[var(--card)] rounded-[16px] shadow-[var(--shadow-md)] border border-[var(--ink-08)] p-8 max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(76,175,80,0.1)] mb-4">
            <CheckCircle size={28} strokeWidth={1.5} className="text-[#4CAF50]" />
          </div>
          <h2 className="text-xl font-sans font-semibold mb-2 text-[var(--near-black)]">Password Updated</h2>
          <p className="text-[var(--mid)] text-base">Redirecting you to sign in...</p>
        </div>
      </div>
    );
  }

  if (!sessionReady && sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--shell)]">
        <div className="bg-[var(--card)] rounded-[16px] shadow-[var(--shadow-md)] border border-[var(--ink-08)] p-8 max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-10)] mb-4">
            <AlertCircle size={28} strokeWidth={1.5} className="text-[var(--terra)]" />
          </div>
          <h2 className="text-xl font-sans font-semibold mb-2 text-[var(--near-black)]">Link Expired</h2>
          <p className="text-[var(--mid)] text-base mb-6">This password reset link has expired or is invalid. Please request a new one.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors"
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
          <p className="text-[var(--mid)] text-base font-medium">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--shell)]">
      <div className="bg-[var(--card)] rounded-[16px] shadow-[var(--shadow-md)] border border-[var(--ink-08)] p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-10)] mb-4">
            <Lock size={28} strokeWidth={1.5} className="text-[var(--terra)]" />
          </div>
          <h2 className="text-xl font-sans font-semibold mb-1 text-[var(--near-black)]">Reset Password</h2>
          <p className="text-[var(--mid)] text-sm">Enter your new password below</p>
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
                className="w-full px-4 py-3 pr-11 rounded-2xl border border-[rgba(34,34,34,0.10)] bg-white text-[var(--near-black)] text-base focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)]"
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
              className="w-full px-4 py-3 rounded-2xl border border-[rgba(34,34,34,0.10)] bg-white text-[var(--near-black)] text-base focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)]"
            />
          </div>

          {error && (
            <p className="text-[var(--terra)] text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full text-white font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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

function App() {
  const { user, userRole, loading, signOut } = useAuth();
  const isDemo = import.meta.env.VITE_ENABLE_DEMO === 'true' && new URLSearchParams(window.location.search).has('demo');
  const hasRedeemParam = new URLSearchParams(window.location.search).has('redeem');

  // Password recovery route — must be checked before auth gate
  if (isPasswordRecovery()) {
    return <ResetPassword />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)]">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--mid)] text-base font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // If ?redeem= is present and user is not a business, show helpful landing
  if (hasRedeemParam && userRole !== 'business') {
    return <RedeemLanding />;
  }

  if (!user) {
    return <Auth />;
  }

  const suspenseFallback = (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F6F3EE' }}>
      <span style={{ fontFamily: "'Corben', cursive", color: '#1A3C34', fontSize: '2rem' }}>nayba</span>
    </div>
  );

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
      <div className="bg-[var(--card)] rounded-[16px] shadow-[var(--shadow-md)] border border-[var(--ink-08)] p-8 max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-10)] mb-4">
          <AlertCircle size={28} strokeWidth={1.5} className="text-[var(--terra)]" />
        </div>
        <h2 className="text-xl font-sans font-semibold mb-2 text-[var(--near-black)]">
          Account Not Found
        </h2>
        <p className="text-[var(--mid)] text-base mb-6">
          Your account profile could not be found. Please sign out and try again, or contact support.
        </p>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors"
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
    <div className="fixed bottom-0 left-0 right-0 z-[9999]" style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.08)' }}>
      <div className="bg-white px-[16px] py-[16px] flex items-center justify-between gap-[16px] max-w-[600px] mx-auto" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
        <p className="text-[13px] text-[var(--ink-60)] leading-[1.5] m-0" style={{ fontWeight: 400 }}>
          We use cookies to keep you signed in and improve your experience.
        </p>
        <button
          onClick={() => {
            try { localStorage.setItem('nayba_cookie_consent', 'true'); } catch {}
            setVisible(false);
          }}
          className="flex-shrink-0 px-[20px] py-[8px] text-[13px] text-white rounded-[999px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors"
          style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
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
