import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/database';
import { Sparkles, Building2, Eye, EyeOff, MapPin } from 'lucide-react';
import { BUSINESS_CATEGORIES, CATEGORY_LIST } from '../lib/categories';

// TODO: Set VITE_GOOGLE_MAPS_API_KEY in your environment variables with a valid Google Maps API key
// that has the Places API enabled. The script loads from:
// https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&libraries=places
declare global {
  interface Window {
    google?: any;
    _gmapsLoaded?: boolean;
    _gmapsCallbacks?: (() => void)[];
  }
}

function loadGoogleMaps(): Promise<void> {
  if (window._gmapsLoaded && window.google?.maps?.places) return Promise.resolve();
  return new Promise((resolve) => {
    if (!window._gmapsCallbacks) {
      window._gmapsCallbacks = [];
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
      if (!apiKey) {
        // No API key — resolve silently, component will show a plain text input
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onload = () => {
        window._gmapsLoaded = true;
        window._gmapsCallbacks?.forEach(cb => cb());
        window._gmapsCallbacks = [];
      };
      document.head.appendChild(script);
    }
    window._gmapsCallbacks!.push(resolve);
  });
}

function AddressAutocomplete({ value, onChange }: {
  value: string;
  onChange: (address: string, lat: number | null, lng: number | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mapsReady, setMapsReady] = useState(false);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (window.google?.maps?.places) setMapsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!mapsReady || !inputRef.current) return;
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment', 'geocode'],
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const lat = place.geometry?.location?.lat() ?? null;
      const lng = place.geometry?.location?.lng() ?? null;
      onChange(place.formatted_address || place.name || '', lat, lng);
    });
  }, [mapsReady]);

  return (
    <div>
      <label className="block text-sm font-medium text-[#1a1025] mb-1.5">
        <MapPin className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
        Address <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value, null, null)}
        placeholder={mapsReady ? 'Start typing to search...' : 'Enter your business address'}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5] transition-all text-sm"
      />
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<UserRole>('creator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [followerCount, setFollowerCount] = useState('Under 1k');
  const [category, setCategory] = useState(CATEGORY_LIST[0]);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, signUp } = useAuth();

  const generateCreatorCode = (name: string): string => {
    const base = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
    const suffix = Math.floor(Math.random() * 900 + 100); // 3-digit random number
    return (base || 'CREATOR') + suffix;
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
          ? { name, instagramHandle, followerCount, code: generateCreatorCode(name) }
          : { name, slug: generateSlug(name), category, address: address || null, latitude, longitude, bio: bio || null };
        await signUp(email, password, role, additionalData);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#f0eaff] via-[#e8e0f5] to-[#f5f0ff]">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#5b3df5] mb-4 shadow-lg shadow-[#5b3df5]/25">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#1a1025] tracking-tight">Juice Creators</h1>
          <p className="text-gray-500 mt-1 text-sm">Hyperlocal creator-business network</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-black/5 p-8 border border-gray-100">
          {/* Sign In / Sign Up toggle */}
          <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signin'
                  ? 'bg-white text-[#1a1025] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-white text-[#1a1025] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Role selector (sign-up only) */}
          {mode === 'signup' && (
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setRole('creator')}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  role === 'creator'
                    ? 'border-[#5b3df5] bg-[#f8f5ff]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Sparkles className={`w-5 h-5 ${role === 'creator' ? 'text-[#5b3df5]' : 'text-gray-400'}`} />
                <span className={`text-sm font-semibold ${role === 'creator' ? 'text-[#5b3df5]' : 'text-gray-600'}`}>
                  Creator
                </span>
              </button>
              <button
                onClick={() => setRole('business')}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  role === 'business'
                    ? 'border-[#5b3df5] bg-[#f8f5ff]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Building2 className={`w-5 h-5 ${role === 'business' ? 'text-[#5b3df5]' : 'text-gray-400'}`} />
                <span className={`text-sm font-semibold ${role === 'business' ? 'text-[#5b3df5]' : 'text-gray-600'}`}>
                  Business
                </span>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#1a1025] mb-1.5">
                    {role === 'creator' ? 'Full Name' : 'Business Name'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'creator' ? 'Sophie Taylor' : 'Juice Bar Co'}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5] transition-all text-sm"
                    required
                  />
                </div>
                {role === 'creator' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1025] mb-1.5">
                        Instagram Handle
                      </label>
                      <input
                        type="text"
                        value={instagramHandle}
                        onChange={(e) => setInstagramHandle(e.target.value)}
                        placeholder="@yourusername"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5] transition-all text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1025] mb-1.5">
                        Follower Count
                      </label>
                      <select
                        value={followerCount}
                        onChange={(e) => setFollowerCount(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5] transition-all text-sm bg-white"
                        required
                      >
                        <option value="Under 1k">Under 1k</option>
                        <option value="1k–5k">1k–5k</option>
                        <option value="5k–10k">5k–10k</option>
                        <option value="10k+">10k+</option>
                      </select>
                    </div>
                  </>
                )}
                {role === 'business' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#1a1025] mb-1.5">
                        Category
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {CATEGORY_LIST.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left text-sm transition-all ${
                              category === cat
                                ? 'border-[#5b3df5] bg-[#f8f5ff] font-semibold text-[#5b3df5]'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <span>{BUSINESS_CATEGORIES[cat]}</span>
                            <span className="truncate">{cat}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <AddressAutocomplete
                      value={address}
                      onChange={(addr, lat, lng) => { setAddress(addr); setLatitude(lat); setLongitude(lng); }}
                    />
                    <div>
                      <label className="block text-sm font-medium text-[#1a1025] mb-1.5">
                        Bio <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value.slice(0, 150))}
                        placeholder="Tell creators a bit about your business"
                        maxLength={150}
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5] transition-all text-sm resize-none"
                      />
                      <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/150</p>
                    </div>
                  </>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-[#1a1025] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5] transition-all text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1025] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5] transition-all text-sm pr-11"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold bg-[#5b3df5] hover:bg-[#4e35d4] active:bg-[#4430b8] transition-all disabled:opacity-50 shadow-lg shadow-[#5b3df5]/25"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'signup' && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Your account will be reviewed and approved by our admin team
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
