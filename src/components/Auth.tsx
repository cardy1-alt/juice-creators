import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/database';
import { Building2, Eye, EyeOff, MapPin, Sparkles } from 'lucide-react';
import { BUSINESS_CATEGORIES, CATEGORY_LIST } from '../lib/categories';
import { Logo } from './Logo';

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
      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
        <MapPin className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
        Address
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value, null, null)}
        placeholder={mapsReady ? 'Start typing to search...' : 'Enter your business address'}
        className="w-full px-4 py-3 rounded-lg bg-[#E8EDE8] border border-[rgba(26,60,52,0.15)] focus:outline-none focus:ring-2 focus:ring-[#1A3C34]/30 focus:border-[#1A3C34] transition-all text-sm text-[#2C2C2C]"
        required
      />
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [role, setRole] = useState<UserRole>('creator');
  const [signupStep, setSignupStep] = useState(1);
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
    const suffix = Math.floor(Math.random() * 900 + 100);
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

  const inputClass = "w-full px-4 py-3 rounded-lg bg-[#E8EDE8] border border-[rgba(26,60,52,0.15)] focus:outline-none focus:ring-2 focus:ring-[#1A3C34]/30 focus:border-[#1A3C34] transition-all text-sm text-[#2C2C2C]";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#FAF8F2]">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-5">
            <Logo size={48} color="#1A3C34" />
          </div>
          <h1 className="text-4xl text-[#1A3C34] tracking-tight" style={{ fontFamily: "'Crimson Pro', serif", fontWeight: 600 }}>nayba</h1>
          <p className="text-[#2C2C2C]/60 mt-2 text-sm">Hyperlocal creator-business network</p>
        </div>

        {/* Card */}
        <div className="bg-[#E8EDE8] rounded-2xl shadow-lg shadow-black/[0.04] p-8 border border-[rgba(26,60,52,0.1)]">
          {/* Sign In / Sign Up toggle */}
          <div className="flex gap-1 mb-6 p-1 bg-[#FAF8F2] rounded-lg">
            <button
              onClick={() => { setMode('signin'); setError(''); setSignupStep(1); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signin'
                  ? 'bg-[#1A3C34] text-[#FAF8F2] shadow-sm'
                  : 'text-[#2C2C2C]/60 hover:text-[#2C2C2C]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setSignupStep(1); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-[#1A3C34] text-[#FAF8F2] shadow-sm'
                  : 'text-[#2C2C2C]/60 hover:text-[#2C2C2C]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Role selector (sign-up only) */}
          {mode === 'signup' && (
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => { setRole('creator'); setSignupStep(1); }}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  role === 'creator'
                    ? 'border-[#1A3C34] bg-[#FAF8F2]'
                    : 'border-[rgba(26,60,52,0.15)] hover:border-[rgba(26,60,52,0.3)]'
                }`}
              >
                <Sparkles className={`w-5 h-5 ${role === 'creator' ? 'text-[#1A3C34]' : 'text-[#2C2C2C]/40'}`} />
                <span className={`text-sm font-semibold ${role === 'creator' ? 'text-[#1A3C34]' : 'text-[#2C2C2C]/60'}`}>
                  Creator
                </span>
              </button>
              <button
                onClick={() => { setRole('business'); setSignupStep(1); }}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  role === 'business'
                    ? 'border-[#1A3C34] bg-[#FAF8F2]'
                    : 'border-[rgba(26,60,52,0.15)] hover:border-[rgba(26,60,52,0.3)]'
                }`}
              >
                <Building2 className={`w-5 h-5 ${role === 'business' ? 'text-[#1A3C34]' : 'text-[#2C2C2C]/40'}`} />
                <span className={`text-sm font-semibold ${role === 'business' ? 'text-[#1A3C34]' : 'text-[#2C2C2C]/60'}`}>
                  Business
                </span>
              </button>
            </div>
          )}

          {/* Multi-step progress for business signup */}
          {mode === 'signup' && role === 'business' && (
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    signupStep === step
                      ? 'bg-[#1A3C34] text-[#FAF8F2]'
                      : signupStep > step
                      ? 'bg-[#C4674A] text-[#FAF8F2]'
                      : 'bg-[#FAF8F2] text-[#2C2C2C]/40'
                  }`}>
                    {signupStep > step ? '✓' : step}
                  </div>
                  {step < 3 && <div className={`w-8 h-0.5 mx-1 ${signupStep > step ? 'bg-[#C4674A]' : 'bg-[#FAF8F2]'}`} />}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                {role === 'creator' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Full Name</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sophie Taylor" className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Instagram Handle</label>
                      <input type="text" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@yourusername" className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Follower Count</label>
                      <select value={followerCount} onChange={(e) => setFollowerCount(e.target.value)} className={inputClass} required>
                        <option value="Under 1k">Under 1k</option>
                        <option value="1k–5k">1k–5k</option>
                        <option value="5k–10k">5k–10k</option>
                        <option value="10k+">10k+</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Email</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Password</label>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={`${inputClass} pr-11`} required minLength={8} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2C2C2C]/40 hover:text-[#2C2C2C]/70">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {role === 'business' && signupStep === 1 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Business Name</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juice Bar Co" className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Category</label>
                      <div className="grid grid-cols-2 gap-2">
                        {CATEGORY_LIST.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-left text-sm transition-all ${
                              category === cat
                                ? 'border-[#1A3C34] bg-[#FAF8F2] font-semibold text-[#1A3C34]'
                                : 'border-[rgba(26,60,52,0.15)] text-[#2C2C2C]/60 hover:border-[rgba(26,60,52,0.3)]'
                            }`}
                          >
                            <span>{BUSINESS_CATEGORIES[cat]}</span>
                            <span className="truncate">{cat}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {role === 'business' && signupStep === 2 && (
                  <>
                    <AddressAutocomplete
                      value={address}
                      onChange={(addr, lat, lng) => { setAddress(addr); setLatitude(lat); setLongitude(lng); }}
                    />
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Bio</label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value.slice(0, 150))}
                        placeholder="Tell creators a bit about your business"
                        maxLength={150}
                        rows={2}
                        className={`${inputClass} resize-none`}
                        required
                      />
                      <p className="text-xs text-[#2C2C2C]/40 mt-1 text-right">{bio.length}/150</p>
                    </div>
                  </>
                )}

                {role === 'business' && signupStep === 3 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Email</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Password</label>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={`${inputClass} pr-11`} required minLength={8} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2C2C2C]/40 hover:text-[#2C2C2C]/70">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {mode === 'signin' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={`${inputClass} pr-11`} required minLength={8} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2C2C2C]/40 hover:text-[#2C2C2C]/70">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100">
                {error}
              </div>
            )}

            {/* Navigation buttons */}
            {mode === 'signup' && role === 'business' && signupStep < 3 ? (
              <div className="flex gap-3">
                {signupStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setSignupStep(signupStep - 1)}
                    className="px-6 py-3 rounded-lg text-[#2C2C2C] font-semibold bg-[#FAF8F2] hover:bg-[#FAF8F2]/80 transition-all"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (signupStep === 1 && !name) {
                      setError('Please enter your business name');
                      return;
                    }
                    if (signupStep === 2 && (!address || !bio)) {
                      setError('Please enter your business address and bio');
                      return;
                    }
                    setError('');
                    setSignupStep(signupStep + 1);
                  }}
                  className="flex-1 py-3 rounded-lg text-[#FAF8F2] font-semibold bg-[#1A3C34] hover:bg-[#15332c] transition-all"
                >
                  Next
                </button>
              </div>
            ) : mode === 'signup' && role === 'business' && signupStep === 3 ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSignupStep(signupStep - 1)}
                  className="px-6 py-3 rounded-lg text-[#2C2C2C] font-semibold bg-[#FAF8F2] hover:bg-[#FAF8F2]/80 transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-lg text-[#FAF8F2] font-semibold bg-[#1A3C34] hover:bg-[#15332c] active:bg-[#112a24] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#FAF8F2]/30 border-t-[#FAF8F2] rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : 'Create Account'}
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg text-[#FAF8F2] font-semibold bg-[#1A3C34] hover:bg-[#15332c] active:bg-[#112a24] transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#FAF8F2]/30 border-t-[#FAF8F2] rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            )}
          </form>

          {mode === 'signup' && (
            <p className="text-xs text-[#2C2C2C]/40 text-center mt-5">
              Your account will be reviewed and approved by our admin team
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
