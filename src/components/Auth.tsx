import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/database';
import { Building2, Eye, EyeOff, MapPin, Sparkles, Check } from 'lucide-react';
import { CATEGORY_ICONS, CATEGORY_LIST, CategoryIcon } from '../lib/categories';
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
      <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">
        <MapPin className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
        Address
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value, null, null)}
        placeholder={mapsReady ? 'Start typing to search...' : 'Enter your business address'}
        className="w-full px-[14px] py-3 rounded-[12px] bg-[#F7F7F7] text-[13px] text-[#222222] placeholder:text-[rgba(34,34,34,0.28)] focus:outline-none focus:ring-2 focus:ring-[#C4674A]/30 transition-all"
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

  const inputClass = "w-full px-[14px] py-3 rounded-[12px] bg-[#F7F7F7] text-[13px] text-[#222222] placeholder:text-[rgba(34,34,34,0.28)] focus:outline-none focus:ring-2 focus:ring-[#C4674A]/30 transition-all";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-[52px] bg-[#FFFFFF]">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-10">
          <Logo size={20} />
          <h1 className="text-[26px] font-extrabold text-[#222222] tracking-[-0.5px]">nayba</h1>
          <p className="text-[rgba(34,34,34,0.28)] mt-2 text-[12px] font-normal">Hyperlocal creator network</p>
        </div>

        {/* Sign In / Sign Up toggle */}
        <div className="flex gap-1 mb-6 p-1 bg-[#F7F7F7] rounded-full">
          <button
            onClick={() => { setMode('signin'); setError(''); setSignupStep(1); }}
            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${
              mode === 'signin'
                ? 'bg-white text-[#222222] shadow-[0_1px_4px_rgba(34,34,34,0.08)]'
                : 'text-[rgba(34,34,34,0.28)] hover:text-[#222222]/50'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setSignupStep(1); }}
            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${
              mode === 'signup'
                ? 'bg-white text-[#222222] shadow-[0_1px_4px_rgba(34,34,34,0.08)]'
                : 'text-[rgba(34,34,34,0.28)] hover:text-[#222222]/50'
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
                  ? 'border-[#C4674A] bg-[#FFFFFF]'
                  : 'border-[rgba(34,34,34,0.1)] hover:border-[rgba(34,34,34,0.2)]'
              }`}
            >
              <Sparkles className={`w-5 h-5 ${role === 'creator' ? 'text-[#C4674A]' : 'text-[#222222]/40'}`} />
              <span className={`text-sm font-semibold ${role === 'creator' ? 'text-[#C4674A]' : 'text-[#222222]/60'}`}>
                Creator
              </span>
            </button>
            <button
              onClick={() => { setRole('business'); setSignupStep(1); }}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                role === 'business'
                  ? 'border-[#C4674A] bg-[#FFFFFF]'
                  : 'border-[rgba(34,34,34,0.1)] hover:border-[rgba(34,34,34,0.2)]'
              }`}
            >
              <Building2 className={`w-5 h-5 ${role === 'business' ? 'text-[#C4674A]' : 'text-[#222222]/40'}`} />
              <span className={`text-sm font-semibold ${role === 'business' ? 'text-[#C4674A]' : 'text-[#222222]/60'}`}>
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
                    ? 'bg-[#C4674A] text-white'
                    : signupStep > step
                    ? 'bg-[#C4674A] text-white'
                    : 'bg-[#F7F7F7] text-[rgba(34,34,34,0.28)]'
                }`}>
                  {signupStep > step ? <Check className="w-3.5 h-3.5" /> : step}
                </div>
                {step < 3 && <div className={`w-8 h-0.5 mx-1 ${signupStep > step ? 'bg-[#C4674A]' : 'bg-[#F7F7F7]'}`} />}
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
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Full Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sophie Taylor" className={inputClass} required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Instagram Handle</label>
                    <input type="text" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@yourusername" className={inputClass} required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Follower Count</label>
                    <select value={followerCount} onChange={(e) => setFollowerCount(e.target.value)} className={inputClass} required>
                      <option value="Under 1k">Under 1k</option>
                      <option value="1k–5k">1k–5k</option>
                      <option value="5k–10k">5k–10k</option>
                      <option value="10k+">10k+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={`${inputClass} pr-11`} required minLength={8} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#222222]/40 hover:text-[#222222]/70">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {role === 'business' && signupStep === 1 && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Business Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juice Bar Co" className={inputClass} required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Category</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORY_LIST.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-left text-sm transition-all ${
                            category === cat
                              ? 'border-[#C4674A] bg-[#FFFFFF] font-semibold text-[#C4674A]'
                              : 'border-[rgba(34,34,34,0.1)] text-[rgba(34,34,34,0.5)] hover:border-[rgba(34,34,34,0.2)]'
                          }`}
                        >
                          <CategoryIcon category={cat} className="w-4 h-4" />
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
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, 150))}
                      placeholder="Tell creators a bit about your business"
                      maxLength={150}
                      rows={2}
                      className={`${inputClass} resize-none`}
                      required
                    />
                    <p className="text-xs text-[#222222]/40 mt-1 text-right">{bio.length}/150</p>
                  </div>
                </>
              )}

              {role === 'business' && signupStep === 3 && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={`${inputClass} pr-11`} required minLength={8} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#222222]/40 hover:text-[#222222]/70">
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
                <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} required />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#222222] tracking-[0.2px] mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={`${inputClass} pr-11`} required minLength={8} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#222222]/40 hover:text-[#222222]/70">
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
                  className="px-6 py-3 rounded-full text-[#222222] text-[14px] font-semibold bg-[#FFFFFF] hover:bg-[#FFFFFF]/80 transition-all"
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
                className="flex-1 py-3 rounded-full text-white text-[14px] font-semibold bg-[#C4674A] hover:bg-[#b35a3f] transition-all"
              >
                Next
              </button>
            </div>
          ) : mode === 'signup' && role === 'business' && signupStep === 3 ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSignupStep(signupStep - 1)}
                className="px-6 py-3 rounded-full text-[#222222] text-[14px] font-semibold bg-[#FFFFFF] hover:bg-[#FFFFFF]/80 transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-full text-white text-[14px] font-semibold bg-[#C4674A] hover:bg-[#b35a3f] active:bg-[#a04f36] transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : 'Create Account'}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full text-white text-[14px] font-semibold bg-[#C4674A] hover:bg-[#b35a3f] active:bg-[#a04f36] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          )}
        </form>

        {mode === 'signin' && (
          <p className="text-[11px] font-medium text-[rgba(34,34,34,0.28)] text-center mt-5">
            Forgot password?
          </p>
        )}

        {mode === 'signup' && (
          <p className="text-xs text-[#222222]/40 text-center mt-5">
            Your account will be reviewed and approved by our admin team
          </p>
        )}
      </div>
    </div>
  );
}
