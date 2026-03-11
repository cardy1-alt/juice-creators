import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import CreatorApp from './components/CreatorApp';
import BusinessPortal from './components/BusinessPortal';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0eaff' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#5b3df5', borderTopColor: 'transparent' }}></div>
          <p className="text-gray-600">Loading...</p>
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

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f0eaff' }}>
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center">
        <h2 className="text-2xl font-bold mb-4" style={{ color: '#1a1025' }}>
          Account Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          Your account could not be found. Please contact support.
        </p>
      </div>
    </div>
  );
}

export default App;
