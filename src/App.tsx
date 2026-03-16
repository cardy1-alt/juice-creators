import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import CreatorApp from './components/CreatorApp';
import BusinessPortal from './components/BusinessPortal';
import AdminDashboard from './components/AdminDashboard';
import { AlertCircle, LogOut, QrCode } from 'lucide-react';

function DemoBanner() {
  if (import.meta.env.VITE_ENABLE_DEMO !== 'true') return null;
  const params = new URLSearchParams(window.location.search);
  const current = params.get('demo');
  if (!current) return null;

  const roles = ['creator', 'business', 'admin'] as const;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#222222] text-white px-4 py-2 flex items-center justify-between text-xs">
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] p-8 max-w-sm text-center border border-[var(--faint)]">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-10)] mb-4">
          <QrCode className="w-7 h-7 text-[var(--terra)]" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-[#222222]">
          Creator Pass
        </h2>
        <p className="text-[var(--mid)] text-sm mb-6">
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

function App() {
  const { user, userRole, loading, signOut } = useAuth();
  const isDemo = import.meta.env.VITE_ENABLE_DEMO === 'true' && new URLSearchParams(window.location.search).has('demo');
  const hasRedeemParam = new URLSearchParams(window.location.search).has('redeem');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--mid)] text-sm font-medium">Loading...</p>
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

  if (userRole === 'admin') {
    return <>{isDemo && <DemoBanner />}<div className={isDemo ? 'pt-10' : ''}><AdminDashboard /></div></>;
  }

  if (userRole === 'creator') {
    return <>{isDemo && <DemoBanner />}<div className={isDemo ? 'pt-10' : ''}><CreatorApp /></div></>;
  }

  if (userRole === 'business') {
    return <>{isDemo && <DemoBanner />}<div className={isDemo ? 'pt-10' : ''}><BusinessPortal /></div></>;
  }

  // Fallback — user authenticated but no profile found
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] p-8 max-w-md text-center border border-[var(--faint)]">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--terra-10)] mb-4">
          <AlertCircle className="w-7 h-7 text-[var(--terra)]" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-[#222222]">
          Account Not Found
        </h2>
        <p className="text-[var(--mid)] text-sm mb-6">
          Your account profile could not be found. Please sign out and try again, or contact support.
        </p>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default App;
