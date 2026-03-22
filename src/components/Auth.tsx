import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';
import { Building2, Eye, EyeOff, MapPin, Sparkles, Check, ArrowLeft, ArrowRight, Mail, Lock, User, Instagram, Users, ChevronRight, Cake } from 'lucide-react';
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
      if (!apiKey || !/^AIza[a-zA-Z0-9_-]{31,}$/.test(apiKey)) {
        console.warn('[GoogleMaps] No valid API key found. Set VITE_GOOGLE_MAPS_API_KEY in your .env file.');
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.onload = () => {
        window._gmapsLoaded = true;
        window._gmapsCallbacks?.forEach(cb => cb());
        window._gmapsCallbacks = [];
      };
      script.onerror = () => {
        console.error('[GoogleMaps] Failed to load Google Maps script. Check your API key and allowed referrers.');
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
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState(false);
  const [focused, setFocused] = useState(false);
  const serviceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let mounted = true;
    loadGoogleMaps().then(async () => {
      if (!mounted) return;
      if (window.google?.maps) {
        try {
          await window.google.maps.importLibrary('places');
          serviceRef.current = new window.google.maps.places.AutocompleteService();
          geocoderRef.current = new window.google.maps.Geocoder();
          setMapsReady(true);
        } catch (err) {
          console.error('[AddressAutocomplete] Failed to initialize Places:', err);
          setMapsError(true);
        }
      } else {
        // Google Maps script didn't load — API key likely missing or invalid
        setMapsError(true);
      }
    }).catch(() => {
      if (mounted) setMapsError(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchSuggestions = (input: string) => {
    if (!serviceRef.current || input.length < 2) {
      setSuggestions([]);
      return;
    }
    serviceRef.current.getPlacePredictions(
      { input, componentRestrictions: { country: 'gb' }, types: ['geocode'] },
      (predictions: any[] | null) => {
        setSuggestions(predictions || []);
        setShowSuggestions(true);
      }
    );
  };

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val, null, null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const handleSelect = (suggestion: any) => {
    const description = suggestion.description;
    setQuery(description);
    setShowSuggestions(false);
    if (geocoderRef.current) {
      geocoderRef.current.geocode({ placeId: suggestion.place_id }, (results: any[], status: string) => {
        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location;
          onChange(description, loc.lat(), loc.lng());
        } else {
          onChange(description, null, null);
        }
      });
    } else {
      onChange(description, null, null);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-[13px] font-semibold text-[var(--near-black)] mb-2">Address</label>
      <div className={`relative rounded-[14px] border transition-all duration-200 ${
        focused
          ? 'border-[var(--terra)] bg-white shadow-[0_0_0_3px_var(--terra-ring)]'
          : mapsError
          ? 'border-[rgba(222,78,12,0.3)] bg-[var(--bg)]'
          : 'border-[var(--faint)] bg-[var(--bg)]'
      }`}>
        <MapPin className={`absolute left-[14px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] transition-colors ${
          focused ? 'text-[var(--terra)]' : mapsError ? 'text-[var(--terra)]' : 'text-[var(--soft)]'
        }`} />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { setFocused(true); if (suggestions.length > 0) setShowSuggestions(true); }}
          onBlur={() => setFocused(false)}
          placeholder={mapsError ? 'Type your address manually' : 'Enter your address'}
          className="w-full pl-[40px] pr-[14px] py-[15px] bg-transparent text-[16px] text-[var(--near-black)] placeholder:text-[var(--soft)] focus:outline-none"
          autoComplete={mapsError ? 'street-address' : 'off'}
        />
      </div>
      {mapsError && (
        <p className="text-[11px] text-[var(--terra)] mt-[4px]">Address suggestions unavailable — type your address manually</p>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-[4px] bg-white rounded-[14px] border border-[var(--faint)] shadow-[0_4px_16px_rgba(26,26,26,0.10)] overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-[14px] py-[12px] text-[14px] text-[var(--near-black)] hover:bg-[var(--bg)] transition-colors flex items-center gap-[10px] border-b border-[#f7f7f7] last:border-b-0"
            >
              <MapPin className="w-[14px] h-[14px] text-[var(--soft)] flex-shrink-0" />
              <span className="truncate">{s.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Floating label input component */
function FloatingInput({ label, icon: Icon, type = 'text', value, onChange, placeholder, required, minLength, rightElement }: {
  label: string;
  icon?: any;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className={`relative rounded-[14px] border transition-all duration-200 ${
      focused
        ? 'border-[var(--terra)] bg-white shadow-[0_0_0_3px_var(--terra-ring)]'
        : hasValue
          ? 'border-[var(--faint)] bg-[var(--bg)]'
          : 'border-[var(--faint)] bg-[var(--bg)]'
    }`}>
      {Icon && (
        <Icon className={`absolute left-[14px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] transition-colors ${
          focused ? 'text-[var(--terra)]' : 'text-[var(--soft)]'
        }`} />
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={focused ? placeholder : label}
        className={`w-full ${Icon ? 'pl-[40px]' : 'pl-[14px]'} ${rightElement ? 'pr-[44px]' : 'pr-[14px]'} py-[15px] bg-transparent text-[16px] text-[var(--near-black)] placeholder:text-[var(--soft)] focus:outline-none`}
        required={required}
        minLength={minLength}
      />
      {rightElement && (
        <div className="absolute right-[14px] top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
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
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const dateOfBirth = dobDay && dobMonth && dobYear
    ? `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`
    : '';
  const [category, setCategory] = useState(CATEGORY_LIST[0]);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const { signIn, signUp } = useAuth();

  const generateCreatorCode = (name: string): string => {
    const base = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
    const suffix = Math.floor(Math.random() * 900 + 100);
    return (base || 'CREATOR') + suffix;
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email');
    } finally {
      setResetLoading(false);
    }
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
          ? { name, instagramHandle, followerCount, code: generateCreatorCode(name), dateOfBirth: dateOfBirth || null, address: address || null, latitude, longitude }
          : { name, slug: generateSlug(name), category, address: address || null, latitude, longitude, bio: bio || null };
        await signUp(email, password, role, additionalData);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Signup step titles
  const creatorStepTitles = [
    { title: 'About you', subtitle: 'Tell us a bit about yourself' },
    { title: 'Your details', subtitle: 'Help us verify your identity' },
    { title: 'Almost there', subtitle: 'Set up your login' },
  ];

  const businessStepTitles = [
    { title: 'About your business', subtitle: 'Help creators find you' },
    { title: 'Location & vibe', subtitle: 'Where can creators visit?' },
    { title: 'Almost there', subtitle: 'Set up your login' },
  ];

  const stepTitles = role === 'creator' ? creatorStepTitles : businessStepTitles;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F4F0] overscroll-none">
      {/* Top section with branding */}
      <div className="flex flex-col items-center pt-[52px] pb-[32px] px-6">
        <div className="mt-[10px]">
          <Logo size={24} variant="wordmark" />
        </div>
        <p className="text-[rgba(26,26,26,0.5)] mt-[6px] text-[13px] tracking-[0.2px]">Hyperlocal creator network</p>
      </div>

      <div className="flex-1 px-5 pb-8 max-w-md mx-auto w-full">
        {/* Sign In / Sign Up toggle — pill style */}
        <div className="flex gap-[4px] mb-[28px] p-[3px] bg-[var(--elevated)] rounded-[14px]">
          <button
            onClick={() => { setMode('signin'); setError(''); setSignupStep(1); setForgotPassword(false); }}
            className={`flex-1 py-[11px] rounded-[11px] text-[14px] font-semibold transition-all duration-200 ${
              mode === 'signin'
                ? 'bg-white text-[var(--near-black)] shadow-[0_1px_3px_rgba(26,26,26,0.06),0_1px_2px_rgba(26,26,26,0.04)]'
                : 'text-[var(--soft)] hover:text-[var(--mid)]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); setSignupStep(1); setForgotPassword(false); }}
            className={`flex-1 py-[11px] rounded-[11px] text-[14px] font-semibold transition-all duration-200 ${
              mode === 'signup'
                ? 'bg-white text-[var(--near-black)] shadow-[0_1px_3px_rgba(26,26,26,0.06),0_1px_2px_rgba(26,26,26,0.04)]'
                : 'text-[var(--soft)] hover:text-[var(--mid)]'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* ─── SIGN IN ─── */}
        {mode === 'signin' && !forgotPassword && (
          <form onSubmit={handleSubmit} className="space-y-[14px]">
            <div className="space-y-[12px]">
              <FloatingInput
                label="Email"
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                required
              />
              <FloatingInput
                label="Password"
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                required
                minLength={8}
                rightElement={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[var(--soft)] hover:text-[var(--mid)] transition-colors p-1">
                    {showPassword ? <EyeOff className="w-[16px] h-[16px]" /> : <Eye className="w-[16px] h-[16px]" />}
                  </button>
                }
              />
            </div>

            {error && (
              <div className="flex items-center gap-[10px] bg-[var(--terra-10)] text-[var(--terra)] px-[14px] py-[12px] rounded-[12px] text-[13px] font-medium">
                <span className="flex-shrink-0 w-[6px] h-[6px] rounded-full bg-[var(--terra)]" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-[15px] rounded-[14px] text-white text-[15px] font-bold bg-[var(--terra)] hover:bg-[var(--terra-hover)] active:scale-[0.98] min-h-[52px] transition-all disabled:opacity-50 shadow-[0_2px_8px_rgba(222,78,12,0.3)]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => { setForgotPassword(true); setResetEmail(email); setResetSent(false); setResetError(''); }}
              className="block text-[13px] font-medium text-[var(--soft)] text-center mt-[16px] hover:text-[var(--terra)] transition-colors mx-auto"
            >
              Forgot password?
            </button>
          </form>
        )}

        {/* ─── FORGOT PASSWORD ─── */}
        {mode === 'signin' && forgotPassword && (
          <div>
            <button
              type="button"
              onClick={() => setForgotPassword(false)}
              className="flex items-center gap-[6px] text-[13px] font-semibold text-[var(--mid)] mb-[20px] hover:text-[var(--near-black)] transition-colors"
            >
              <ArrowLeft className="w-[14px] h-[14px]" /> Back to sign in
            </button>

            {resetSent ? (
              <div className="text-center py-[32px]">
                <div className="w-[56px] h-[56px] rounded-full bg-[var(--terra-10)] flex items-center justify-center mx-auto mb-[16px]">
                  <Mail className="w-[24px] h-[24px] text-[var(--terra)]" />
                </div>
                <p className="text-[17px] font-bold text-[var(--near-black)] mb-[6px]">Check your email</p>
                <p className="text-[13px] text-[var(--mid)] leading-[1.5]">We sent a reset link to<br /><span className="font-semibold text-[var(--near-black)]">{resetEmail}</span></p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-[14px]">
                <div className="mb-[4px]">
                  <p className="text-[17px] font-bold text-[var(--near-black)] mb-[4px]">Reset password</p>
                  <p className="text-[13px] text-[var(--mid)]">Enter your email and we'll send a reset link.</p>
                </div>
                <FloatingInput
                  label="Email"
                  icon={Mail}
                  type="email"
                  value={resetEmail}
                  onChange={setResetEmail}
                  placeholder="you@example.com"
                  required
                />
                {resetError && (
                  <div className="flex items-center gap-[10px] bg-[var(--terra-10)] text-[var(--terra)] px-[14px] py-[12px] rounded-[12px] text-[13px] font-medium">
                    <span className="flex-shrink-0 w-[6px] h-[6px] rounded-full bg-[var(--terra)]" />
                    {resetError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-[15px] rounded-[14px] text-white text-[15px] font-bold bg-[var(--terra)] hover:bg-[var(--terra-hover)] active:scale-[0.98] min-h-[52px] transition-all disabled:opacity-50 shadow-[0_2px_8px_rgba(222,78,12,0.3)]"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ─── SIGN UP ─── */}
        {mode === 'signup' && (
          <form onSubmit={handleSubmit}>
            {/* Role selector cards */}
            <div className="flex gap-[10px] mb-[24px]">
              <button
                type="button"
                onClick={() => { setRole('creator'); setSignupStep(1); setError(''); }}
                className={`flex-1 flex flex-col items-center gap-[8px] py-[18px] rounded-[16px] border-[1.5px] transition-all duration-200 ${
                  role === 'creator'
                    ? 'border-[var(--terra)] bg-[var(--terra-5)] shadow-[0_0_0_3px_var(--terra-ring)]'
                    : 'border-[var(--faint)] bg-white hover:border-[var(--soft)]'
                }`}
              >
                <div className={`w-[40px] h-[40px] rounded-[12px] flex items-center justify-center transition-colors ${
                  role === 'creator' ? 'bg-[var(--terra-15)]' : 'bg-[var(--bg)]'
                }`}>
                  <Sparkles className={`w-[18px] h-[18px] ${role === 'creator' ? 'text-[var(--terra)]' : 'text-[var(--soft)]'}`} />
                </div>
                <span className={`text-[13px] font-bold ${role === 'creator' ? 'text-[var(--terra)]' : 'text-[var(--mid)]'}`}>
                  Creator
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setRole('business'); setSignupStep(1); setError(''); }}
                className={`flex-1 flex flex-col items-center gap-[8px] py-[18px] rounded-[16px] border-[1.5px] transition-all duration-200 ${
                  role === 'business'
                    ? 'border-[var(--terra)] bg-[var(--terra-5)] shadow-[0_0_0_3px_var(--terra-ring)]'
                    : 'border-[var(--faint)] bg-white hover:border-[var(--soft)]'
                }`}
              >
                <div className={`w-[40px] h-[40px] rounded-[12px] flex items-center justify-center transition-colors ${
                  role === 'business' ? 'bg-[var(--terra-15)]' : 'bg-[var(--bg)]'
                }`}>
                  <Building2 className={`w-[18px] h-[18px] ${role === 'business' ? 'text-[var(--terra)]' : 'text-[var(--soft)]'}`} />
                </div>
                <span className={`text-[13px] font-bold ${role === 'business' ? 'text-[var(--terra)]' : 'text-[var(--mid)]'}`}>
                  Business
                </span>
              </button>
            </div>

            {/* Step indicator (both Creator & Business) */}
            <div className="flex items-center gap-[6px] mb-[20px]">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-[6px]">
                  <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300 ${
                    signupStep > step
                      ? 'bg-[var(--terra)] text-white'
                      : signupStep === step
                        ? 'bg-[var(--terra)] text-white shadow-[0_0_0_3px_var(--terra-ring)]'
                        : 'bg-[var(--elevated)] text-[var(--soft)]'
                  }`}>
                    {signupStep > step ? <Check className="w-[13px] h-[13px]" /> : step}
                  </div>
                  {step < 3 && <div className={`w-[24px] h-[2px] rounded-full transition-colors duration-300 ${signupStep > step ? 'bg-[var(--terra)]' : 'bg-[var(--elevated)]'}`} />}
                </div>
              ))}
            </div>

            {/* Step header */}
            <div className="mb-[20px]">
              <h2 className="text-[19px] font-display font-normal text-[var(--near-black)]" style={{ letterSpacing: '-0.3px' }}>
                {stepTitles[signupStep - 1].title}
              </h2>
              <p className="text-[13px] text-[var(--mid)] mt-[2px]">{stepTitles[signupStep - 1].subtitle}</p>
            </div>

            {/* ── Creator signup (multi-step) ── */}
            {role === 'creator' && (
              <>
                {/* Step 1: Name, Instagram, Follower Count */}
                {signupStep === 1 && (
                  <div className="space-y-[12px]">
                    <FloatingInput label="Full Name" icon={User} value={name} onChange={setName} placeholder="Sophie Taylor" required />
                    <FloatingInput label="Instagram Handle" icon={Instagram} value={instagramHandle} onChange={setInstagramHandle} placeholder="@yourusername" required />

                    <div>
                      <label className="block text-[13px] font-semibold text-[var(--near-black)] mb-[8px]">Follower Count</label>
                      <div className="flex gap-[8px]">
                        {['Under 1k', '1k–5k', '5k–10k', '10k+'].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFollowerCount(opt)}
                            className="flex-1 py-[10px] rounded-[10px] text-[12px] font-semibold transition-all"
                            style={{
                              background: followerCount === opt ? 'var(--terra)' : 'white',
                              color: followerCount === opt ? 'white' : 'var(--near-black)',
                              border: followerCount === opt ? 'none' : '0.5px solid var(--near-black)',
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Date of Birth & Address */}
                {signupStep === 2 && (
                  <div className="space-y-[12px]">
                    <div>
                      <label className="block text-[13px] font-semibold text-[var(--near-black)] mb-[8px]">Date of Birth</label>
                      <div className="flex items-center gap-[8px]">
                        <Cake className="w-[16px] h-[16px] text-[var(--soft)] flex-shrink-0" />
                        <select
                          value={dobDay}
                          onChange={(e) => setDobDay(e.target.value)}
                          className="flex-1 px-[10px] py-[14px] rounded-[14px] border border-[var(--faint)] bg-[var(--bg)] text-[16px] text-[var(--near-black)] focus:outline-none focus:border-[var(--terra)] focus:bg-white focus:shadow-[0_0_0_3px_var(--terra-ring)] transition-all appearance-none"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          required
                        >
                          <option value="" disabled>Day</option>
                          {Array.from({ length: 31 }, (_, i) => (
                            <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                          ))}
                        </select>
                        <select
                          value={dobMonth}
                          onChange={(e) => setDobMonth(e.target.value)}
                          className="flex-1 px-[10px] py-[14px] rounded-[14px] border border-[var(--faint)] bg-[var(--bg)] text-[16px] text-[var(--near-black)] focus:outline-none focus:border-[var(--terra)] focus:bg-white focus:shadow-[0_0_0_3px_var(--terra-ring)] transition-all appearance-none"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          required
                        >
                          <option value="" disabled>Month</option>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                            <option key={i + 1} value={String(i + 1)}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={dobYear}
                          onChange={(e) => setDobYear(e.target.value)}
                          className="flex-1 px-[10px] py-[14px] rounded-[14px] border border-[var(--faint)] bg-[var(--bg)] text-[16px] text-[var(--near-black)] focus:outline-none focus:border-[var(--terra)] focus:bg-white focus:shadow-[0_0_0_3px_var(--terra-ring)] transition-all appearance-none"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          required
                        >
                          <option value="" disabled>Year</option>
                          {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 13 - i).map((y) => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[11px] text-[var(--soft)] mt-[6px]">You must be at least 13 years old</p>
                    </div>

                    <AddressAutocomplete
                      value={address}
                      onChange={(addr, lat, lng) => { setAddress(addr); setLatitude(lat); setLongitude(lng); }}
                    />
                  </div>
                )}

                {/* Step 3: Email & Password */}
                {signupStep === 3 && (
                  <div className="space-y-[12px]">
                    <FloatingInput label="Email" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
                    <FloatingInput
                      label="Password"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={setPassword}
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      rightElement={
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[var(--soft)] hover:text-[var(--mid)] transition-colors p-1">
                          {showPassword ? <EyeOff className="w-[16px] h-[16px]" /> : <Eye className="w-[16px] h-[16px]" />}
                        </button>
                      }
                    />
                  </div>
                )}
              </>
            )}

            {/* ── Business signup (multi-step) ── */}
            {role === 'business' && (
              <>
                {/* Step 1: Name & Category */}
                {signupStep === 1 && (
                  <div className="space-y-[16px]">
                    <FloatingInput label="Business Name" icon={Building2} value={name} onChange={setName} placeholder="Juice Bar Co" required />

                    <div>
                      <label className="block text-[13px] font-semibold text-[var(--near-black)] mb-[10px]">Category</label>
                      <div className="grid grid-cols-2 gap-[8px]">
                        {CATEGORY_LIST.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className="flex items-center gap-[8px] px-[12px] py-[12px] rounded-[12px] text-left transition-all duration-200"
                            style={{
                              border: category === cat ? '1.5px solid var(--terra)' : '1.5px solid var(--faint)',
                              background: category === cat ? 'rgba(222,78,12,0.08)' : 'white',
                              color: category === cat ? 'var(--terra)' : undefined,
                            }}
                          >
                            <CategoryIcon category={cat} className={`w-[16px] h-[16px] flex-shrink-0 ${category === cat ? 'text-[var(--terra)]' : 'text-[var(--soft)]'}`} />
                            <span className={`text-[13px] font-semibold truncate ${category === cat ? 'text-[var(--terra)]' : 'text-[var(--mid)]'}`}>{cat}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Address & Bio */}
                {signupStep === 2 && (
                  <div className="space-y-[14px]">
                    <AddressAutocomplete
                      value={address}
                      onChange={(addr, lat, lng) => { setAddress(addr); setLatitude(lat); setLongitude(lng); }}
                    />
                    <div>
                      <label className="block text-[13px] font-semibold text-[var(--near-black)] mb-2">Bio</label>
                      <div className="relative">
                        <textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value.slice(0, 150))}
                          placeholder="Tell creators a bit about your business..."
                          maxLength={150}
                          rows={3}
                          className="w-full px-[14px] py-[14px] rounded-[14px] bg-[var(--bg)] text-[16px] text-[var(--near-black)] placeholder:text-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:bg-white transition-all resize-none"
                          required
                        />
                        <span className={`absolute bottom-[10px] right-[12px] text-[11px] font-medium ${bio.length > 130 ? 'text-[var(--terra)]' : 'text-[var(--soft)]'}`}>{bio.length}/150</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Email & Password */}
                {signupStep === 3 && (
                  <div className="space-y-[12px]">
                    <FloatingInput label="Email" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
                    <FloatingInput
                      label="Password"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={setPassword}
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      rightElement={
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[var(--soft)] hover:text-[var(--mid)] transition-colors p-1">
                          {showPassword ? <EyeOff className="w-[16px] h-[16px]" /> : <Eye className="w-[16px] h-[16px]" />}
                        </button>
                      }
                    />
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="flex items-center gap-[10px] bg-[var(--terra-10)] text-[var(--terra)] px-[14px] py-[12px] rounded-[12px] text-[13px] font-medium mt-[14px]">
                <span className="flex-shrink-0 w-[6px] h-[6px] rounded-full bg-[var(--terra)]" />
                {error}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-[20px]">
              {signupStep < 3 ? (
                <div className="flex gap-[10px]">
                  {signupStep > 1 && (
                    <button
                      type="button"
                      onClick={() => { setSignupStep(signupStep - 1); setError(''); }}
                      className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center bg-[var(--elevated)] hover:bg-[var(--pressed)] transition-all active:scale-[0.96]"
                    >
                      <ArrowLeft className="w-[18px] h-[18px] text-[var(--near-black)]" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (role === 'creator' && signupStep === 1 && (!name || !instagramHandle)) {
                        setError('Please enter your name and Instagram handle');
                        return;
                      }
                      if (role === 'creator' && signupStep === 2 && !dateOfBirth) {
                        setError('Please enter your date of birth');
                        return;
                      }
                      if (role === 'business' && signupStep === 1 && !name) {
                        setError('Please enter your business name');
                        return;
                      }
                      if (role === 'business' && signupStep === 2 && (!address || !bio)) {
                        setError('Please enter your business address and bio');
                        return;
                      }
                      setError('');
                      setSignupStep(signupStep + 1);
                    }}
                    className="flex-1 py-[15px] rounded-[14px] text-white text-[15px] font-bold bg-[var(--terra)] hover:bg-[var(--terra-hover)] active:scale-[0.98] min-h-[52px] transition-all shadow-[0_2px_8px_rgba(222,78,12,0.3)] inline-flex items-center justify-center gap-[6px]"
                  >
                    Continue <ArrowRight className="w-[16px] h-[16px]" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-[10px]">
                  <button
                    type="button"
                    onClick={() => { setSignupStep(signupStep - 1); setError(''); }}
                    className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center bg-[var(--elevated)] hover:bg-[var(--pressed)] transition-all active:scale-[0.96]"
                  >
                    <ArrowLeft className="w-[18px] h-[18px] text-[var(--near-black)]" />
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-[15px] rounded-[14px] text-white text-[15px] font-bold bg-[var(--terra)] hover:bg-[var(--terra-hover)] active:scale-[0.98] min-h-[52px] transition-all disabled:opacity-50 shadow-[0_2px_8px_rgba(222,78,12,0.3)]"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </span>
                    ) : 'Create Account'}
                  </button>
                </div>
              )}
            </div>

            <p className="text-[12px] text-[var(--soft)] text-center mt-[20px] leading-[1.5]">
              By signing up you agree to our terms. Your account will be reviewed by our team.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
