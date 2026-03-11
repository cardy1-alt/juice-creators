import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/database';

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<UserRole>('creator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, signUp } = useAuth();

  const generateCreatorCode = (name: string) => {
    return name.split(' ')[0].toUpperCase() + '01';
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const additionalData = role === 'creator'
          ? { name, instagramHandle, code: generateCreatorCode(name) }
          : { name, slug: generateSlug(name) };
        await signUp(email, password, role, additionalData);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f0eaff' }}>
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#1a1025' }}>Juice Creators</h1>
          <p className="text-gray-600">Hyperlocal creator network</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
              mode === 'signin'
                ? 'text-white'
                : 'text-gray-600 bg-gray-100'
            }`}
            style={mode === 'signin' ? { backgroundColor: '#5b3df5' } : {}}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
              mode === 'signup'
                ? 'text-white'
                : 'text-gray-600 bg-gray-100'
            }`}
            style={mode === 'signup' ? { backgroundColor: '#5b3df5' } : {}}
          >
            Sign Up
          </button>
        </div>

        {mode === 'signup' && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setRole('creator')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                role === 'creator'
                  ? 'text-white'
                  : 'text-gray-600 bg-gray-100'
              }`}
              style={role === 'creator' ? { backgroundColor: '#5b3df5' } : {}}
            >
              Creator
            </button>
            <button
              onClick={() => setRole('business')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                role === 'business'
                  ? 'text-white'
                  : 'text-gray-600 bg-gray-100'
              }`}
              style={role === 'business' ? { backgroundColor: '#5b3df5' } : {}}
            >
              Business
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#1a1025' }}>
                  {role === 'creator' ? 'Full Name' : 'Business Name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{ focusRingColor: '#5b3df5' }}
                  required
                />
              </div>
              {role === 'creator' && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#1a1025' }}>
                    Instagram Handle
                  </label>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="@yourusername"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ focusRingColor: '#5b3df5' }}
                    required
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#1a1025' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ focusRingColor: '#5b3df5' }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#1a1025' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ focusRingColor: '#5b3df5' }}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-medium transition-all disabled:opacity-50"
            style={{ backgroundColor: '#5b3df5' }}
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="text-xs text-gray-500 text-center mt-4">
            Your account will be reviewed and approved by our admin team
          </p>
        )}
      </div>
    </div>
  );
}
