import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import CreatorApp from './components/CreatorApp';
import BusinessPortal from './components/BusinessPortal';
import AdminDashboard from './components/AdminDashboard';
import { AlertCircle, LogOut } from 'lucide-react';

function App() {
  const { user, userRole, loading, retryingProfile, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0eaff] via-[#e8e0f5] to-[#f5f0ff]">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-[#5b3df5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-medium">Loading...</p>
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

  // Show loading spinner while retrying profile fetch
  if (retryingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0eaff] via-[#e8e0f5] to-[#f5f0ff]">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-[#5b3df5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-medium">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Fallback — user authenticated but no profile found after all retries
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#f0eaff] via-[#e8e0f5] to-[#f5f0ff]">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border border-gray-100">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
          <AlertCircle className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-[#1a1025]">
          Account Not Found
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Your account profile could not be found. Please sign out and try again, or contact support.
        </p>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium bg-[#5b3df5] hover:bg-[#4e35d4] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default App;
