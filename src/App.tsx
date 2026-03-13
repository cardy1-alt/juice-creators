import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import CreatorApp from './components/CreatorApp';
import BusinessPortal from './components/BusinessPortal';
import AdminDashboard from './components/AdminDashboard';
import { AlertCircle, LogOut } from 'lucide-react';
import { Logo } from './components/Logo';

function App() {
  const { user, userRole, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F2]">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-[#C4674A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#2C2C2C]/60 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (userRole === 'admin') {
    return <AdminDashboard />;
  }

  if (userRole === 'creator') {
    return <CreatorApp />;
  }

  if (userRole === 'business') {
    return <BusinessPortal />;
  }

  // Fallback — user authenticated but no profile found
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAF8F2]">
      <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(44,44,44,0.06),0_4px_16px_rgba(44,44,44,0.04)] p-8 max-w-md text-center border border-[rgba(44,44,44,0.1)]">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#C4674A]/10 mb-4">
          <AlertCircle className="w-7 h-7 text-[#C4674A]" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-[#2C2C2C]">
          Account Not Found
        </h2>
        <p className="text-[#2C2C2C]/60 text-sm mb-6">
          Your account profile could not be found. Please sign out and try again, or contact support.
        </p>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[13px] text-white font-semibold bg-[#C4674A] hover:bg-[#b35a3f] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default App;
