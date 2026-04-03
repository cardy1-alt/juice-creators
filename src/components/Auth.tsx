import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';
import { friendlyError } from '../lib/errors';
import { Eye, EyeOff, ArrowLeft, ChevronLeft, ChevronRight, Mail, Store, Check, Cake, User, AtSign, Lock, X, Camera, Building2 } from 'lucide-react';
import { CATEGORY_LIST, CategoryIcon } from '../lib/categories';
import { Logo } from './Logo';

/* Floating label input component */
function FloatingInput({ label, icon: iconName, type = 'text', value, onChange, placeholder, required, minLength, rightElement }: {
  label: string;
  icon?: string;
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
    <div className={`relative transition-all duration-200 bg-white rounded-2xl ${focused ? 'border border-[#C4674A] ring-2 ring-[rgba(196,103,74,0.12)]' : 'border border-[rgba(34,34,34,0.10)]'}`}>
      {iconName && (
        <span className={`absolute left-[14px] top-1/2 -translate-y-1/2 transition-colors ${
          focused ? 'text-[var(--ink-60)]' : 'text-[var(--ink-35)]'
        }`}>
          {iconName === 'user' && <User size={16} strokeWidth={1.5} />}
          {iconName === 'instagram' && <AtSign size={16} strokeWidth={1.5} />}
          {iconName === 'mail' && <Mail size={16} strokeWidth={1.5} />}
          {iconName === 'lock' && <Lock size={16} strokeWidth={1.5} />}
          {iconName === 'shop' && <Store size={16} strokeWidth={1.5} />}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={focused ? placeholder : label}
        className={`w-full ${iconName ? 'pl-[40px]' : 'pl-[16px]'} ${rightElement ? 'pr-[44px]' : 'pr-[16px]'} py-[15px] bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-35)] focus:outline-none`}
        style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
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
  const [mode, setMode] = useState<'signin' | 'roleselect' | 'signup' | 'brand-contact'>('signin');
  const [role, setRole] = useState<UserRole>('creator');
  const [selectedRole, setSelectedRole] = useState<'creator' | 'brand' | null>(null);
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
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const { signIn, signUp } = useAuth();

  const generateCreatorCode = (name: string): string => {
    const base = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
    const suffix = Math.floor(Math.random() * 900 + 100);
    return (base || 'CREATOR') + suffix;
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
      setResetError(friendlyError(err.message));
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
        const additionalData = { name, instagramHandle, followerCount, code: generateCreatorCode(name), dateOfBirth: dateOfBirth || null, address: address || null, latitude, longitude };
        await signUp(email, password, 'creator', additionalData);
      }
    } catch (err: any) {
      setError(friendlyError(err.message));
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

  const stepTitles = creatorStepTitles;

  return (
    <div className="flex flex-col bg-[#F6F3EE] overscroll-none" style={{ minHeight: '100dvh' }}>
      {mode === 'signin' ? (
        /* ─── SIGN IN: single centred column ─── */
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 md:px-6 md:py-12" style={{ background: '#F7F7F5' }}>
          <style>{`@keyframes nayba-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(0.85)}}`}</style>
          <div className="w-full flex flex-col items-center text-center" style={{ maxWidth: 480 }}>

            {/* 1. Wordmark */}
            <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 28, fontWeight: 700, color: '#C4674A', letterSpacing: '-0.5px', marginBottom: 32 }}>nayba</span>

            {/* 2. Location pill */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-[8px] px-[14px] py-[7px]" style={{ background: 'white', border: '1px solid #E6E2DB', borderRadius: '999px' }}>
                <span className="relative flex h-[8px] w-[8px]">
                  <span className="relative inline-flex rounded-full h-[8px] w-[8px]" style={{ background: '#C4674A', animation: 'nayba-pulse 2s ease-in-out infinite' }} />
                </span>
                <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'rgba(28,28,26,0.55)' }}>Now live in Bury St Edmunds</span>
              </div>
            </div>

            {/* 3. Headline */}
            <h1 className="text-[38px] md:text-[48px]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, letterSpacing: '-1.5px', lineHeight: 1.1, margin: '0 0 20px', color: '#1C1C1A', textAlign: 'center' }}>
              <span style={{ display: 'block' }}>Discover local brands.</span>
              Get <span style={{ color: '#C4674A' }}>rewarded</span> for sharing.
            </h1>

            {/* 4. Subheadline */}
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 16, fontWeight: 400, color: 'rgba(28,28,26,0.55)', lineHeight: 1.65, maxWidth: 380, margin: '0 0 36px' }}>
              New campaigns drop in your county every week. Browse local brands, express your interest, and get rewarded with free experiences — no follower minimums, ever.
            </p>

            {/* 5. Form card */}
            <div className="w-full bg-white border border-[#E6E2DB] rounded-[16px] p-6 md:p-8 text-left" style={{ boxShadow: '0 4px 24px rgba(28,28,26,0.06)' }}>

              {/* ─── FORGOT PASSWORD ─── */}
              {forgotPassword ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setForgotPassword(false)}
                    className="flex items-center gap-[6px] text-[13px] font-medium text-[var(--ink-60)] mb-[20px] hover:text-[var(--ink)] transition-colors"
                  >
                    <ChevronLeft size={14} strokeWidth={1.5} /> Back to sign in
                  </button>

                  {resetSent ? (
                    <div className="text-center py-[32px]">
                      <div className="w-[56px] h-[56px] rounded-full bg-[var(--terra-10)] flex items-center justify-center mx-auto mb-[16px]">
                        <Mail size={24} strokeWidth={1.5} className="text-[var(--terra)]" />
                      </div>
                      <p className="text-[19px] text-[var(--ink)] mb-[6px]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, letterSpacing: '-0.03em' }}>Check your email</p>
                      <p className="text-[14px] text-[var(--ink-60)] leading-[1.5]">We sent a reset link to<br /><span className="font-semibold text-[var(--ink)]">{resetEmail}</span></p>
                    </div>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-[14px]">
                      <div className="mb-[4px]">
                        <p className="text-[19px] text-[var(--ink)] mb-[4px]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, letterSpacing: '-0.03em' }}>Reset password</p>
                        <p className="text-[14px] text-[var(--ink-60)]">Enter your email and we'll send a reset link.</p>
                      </div>
                      <FloatingInput
                        label="Email"
                        type="email"
                        value={resetEmail}
                        onChange={setResetEmail}
                        placeholder="you@example.com"
                        required
                      />
                      {resetError && (
                        <div className="flex items-center gap-[10px] bg-[var(--terra-10)] text-[var(--terra)] px-[14px] py-[12px] rounded-[12px] text-[15px] font-medium">
                          <span className="flex-shrink-0 w-[6px] h-[6px] rounded-full bg-[var(--terra)]" />
                          {resetError}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="w-full min-h-[52px] text-white transition-all disabled:opacity-50 active:scale-[0.98]"
                        style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '15px', background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
                      >
                        {resetLoading ? 'Sending...' : 'Send Reset Link'}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <>
                {/* Sign in form */}
                <form onSubmit={handleSubmit} className="space-y-[12px]">
                  <FloatingInput
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    required
                  />
                  <FloatingInput
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={setPassword}
                    placeholder="Enter your password"
                    required
                    minLength={8}
                    rightElement={
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[var(--ink-35)] hover:text-[var(--ink-60)] transition-colors p-1">
                        {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                      </button>
                    }
                  />

                  {error && (
                    <div className="flex items-center gap-[10px] bg-[var(--terra-10)] text-[var(--terra)] px-[14px] py-[12px] rounded-[12px] text-[15px] font-medium">
                      <span className="flex-shrink-0 w-[6px] h-[6px] rounded-full bg-[var(--terra)]" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 bg-[#C4674A] text-white rounded-full font-bold text-base transition-all disabled:opacity-50 active:scale-[0.98]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </span>
                    ) : 'Sign In'}
                  </button>

                  <p className="text-center mt-[16px] text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif", color: 'var(--ink-60)' }}>
                    Not a member?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('roleselect'); setError(''); setSelectedRole(null); setForgotPassword(false); }}
                      className="text-[#C4674A] font-bold hover:underline transition-colors"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'inherit' }}
                    >
                      Apply for access
                    </button>
                  </p>

                  <button
                    type="button"
                    onClick={() => { setForgotPassword(true); setResetEmail(email); setResetSent(false); setResetError(''); }}
                    className="block text-sm text-center mt-[4px] transition-colors mx-auto text-[rgba(34,34,34,0.35)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    Forgot password?
                  </button>
                </form>
                </>
              )}
            </div>

            {/* 6. Social proof */}
            <div className="flex items-center justify-center gap-[10px] mt-6">
              <div className="flex -space-x-[10px]">
                {['S', 'M', 'J', 'R'].map((initial, i) => (
                  <div
                    key={initial}
                    className="w-[32px] h-[32px] rounded-full flex items-center justify-center border-2 border-[#F7F7F5]"
                    style={{
                      background: ['#C4674A', '#F5C4A0', '#FFFFFF', 'rgba(34,34,34,0.10)'][i],
                      zIndex: 4 - i,
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontWeight: 700,
                      fontSize: 12,
                      color: i === 0 ? 'white' : 'rgba(34,34,34,0.60)',
                    }}
                  >
                    {initial}
                  </div>
                ))}
              </div>
              <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500, fontSize: 13, color: 'rgba(34,34,34,0.35)' }}>
                Real creators · real local brands · no follower minimums
              </span>
            </div>

          </div>
        </div>
      ) : mode === 'roleselect' ? (
        /* ─── ROLE SELECTION ─── */
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#F7F7F5]">
          <div className="max-w-[440px] w-full text-center">
            <button onClick={() => setMode('signin')} className="flex items-center gap-1 text-[13px] font-medium text-[rgba(34,34,34,0.60)] mb-8 hover:text-[#222] mx-auto">
              <ChevronLeft size={14} /> Back to sign in
            </button>
            <h2 style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 20, fontWeight: 700, color: '#222', margin: '0 0 6px' }}>Join nayba</h2>
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: 'rgba(34,34,34,0.60)', margin: '0 0 28px' }}>Which best describes you?</p>
            <div className="flex gap-3">
              {([
                { key: 'creator' as const, icon: Camera, label: "I'm a Creator", sub: 'I create content and want brand collabs' },
                { key: 'brand' as const, icon: Building2, label: "I'm a Brand", sub: 'I want creators to promote my business' },
              ]).map(opt => {
                const selected = selectedRole === opt.key;
                return (
                  <button key={opt.key} onClick={() => setSelectedRole(opt.key)}
                    className="flex-1 text-left p-5 rounded-[12px] border transition-all"
                    style={{
                      background: selected ? 'rgba(196,103,74,0.06)' : 'white',
                      borderColor: selected ? '#C4674A' : '#E6E2DB',
                    }}>
                    <opt.icon size={22} style={{ color: selected ? '#C4674A' : 'rgba(34,34,34,0.45)', marginBottom: 10 }} />
                    <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 15, fontWeight: 600, color: '#222', margin: '0 0 4px' }}>{opt.label}</p>
                    <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: 'rgba(34,34,34,0.50)', margin: 0, lineHeight: 1.4 }}>{opt.sub}</p>
                  </button>
                );
              })}
            </div>
            {selectedRole && (
              <button onClick={() => {
                if (selectedRole === 'creator') { setRole('creator'); setMode('signup'); setSignupStep(1); }
                else { setMode('brand-contact'); }
              }}
                className="mt-6 px-8 py-3 rounded-[999px] bg-[#C4674A] text-white text-[14px] font-semibold hover:opacity-90 transition-opacity"
                style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
                Continue
              </button>
            )}
          </div>
        </div>
      ) : mode === 'brand-contact' ? (
        /* ─── BRAND CONTACT ─── */
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#F7F7F5]">
          <div className="max-w-[400px] w-full text-center">
            <button onClick={() => setMode('roleselect')} className="flex items-center gap-1 text-[13px] font-medium text-[rgba(34,34,34,0.60)] mb-8 hover:text-[#222] mx-auto">
              <ChevronLeft size={14} /> Back
            </button>
            <div className="w-14 h-14 rounded-full bg-[rgba(196,103,74,0.08)] flex items-center justify-center mx-auto mb-5">
              <Building2 size={24} className="text-[#C4674A]" />
            </div>
            <h2 style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 20, fontWeight: 700, color: '#222', margin: '0 0 10px' }}>Get your brand on nayba</h2>
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 15, color: 'rgba(34,34,34,0.60)', lineHeight: 1.65, margin: '0 0 28px' }}>
              Get in touch at hello@nayba.app to get your brand set up. We'll have you live within 24 hours.
            </p>
            <a href="mailto:hello@nayba.app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[999px] bg-[#C4674A] text-white text-[14px] font-semibold hover:opacity-90 transition-opacity"
              style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)', textDecoration: 'none' }}>
              <Mail size={16} /> Email hello@nayba.app
            </a>
          </div>
        </div>
      ) : (
        /* ─── SIGN UP: single page form ─── */
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 md:px-6" style={{ background: '#F7F7F5', minHeight: '100dvh' }}>
          <div className="w-full flex flex-col items-center text-center" style={{ maxWidth: 480 }}>

            {/* Wordmark */}
            <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 28, fontWeight: 700, color: '#C4674A', letterSpacing: '-0.5px', marginBottom: 12 }}>nayba</span>

            {/* Back link */}
            <button
              type="button"
              onClick={() => { setMode('roleselect'); setError(''); }}
              className="flex items-center gap-1 text-[13px] mb-8 transition-colors"
              style={{ fontFamily: "'Instrument Sans', sans-serif", color: 'rgba(34,34,34,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <ChevronLeft size={14} /> Back
            </button>

            {/* Heading */}
            <h1 style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 28, fontWeight: 700, color: '#222', letterSpacing: '-0.5px', margin: '0 0 6px' }}>Create your account</h1>
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: 'rgba(34,34,34,0.60)', margin: '0 0 28px' }}>You'll be reviewed by our team before getting access.</p>

            {/* Form card */}
            <div className="w-full bg-white border border-[#E6E2DB] rounded-[16px] p-6 md:p-8 text-left" style={{ boxShadow: '0 4px 24px rgba(28,28,26,0.06)' }}>
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Full Name */}
                <div>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className="w-full px-3.5 py-3 rounded-[10px] border border-[#E6E2DB] bg-[#F7F7F5] text-[14px] text-[#222] placeholder:text-[rgba(34,34,34,0.35)] focus:outline-none focus:border-[#C4674A] focus:shadow-[0_0_0_3px_rgba(196,103,74,0.12)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  />
                </div>

                {/* Email */}
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-3.5 py-3 rounded-[10px] border border-[#E6E2DB] bg-[#F7F7F5] text-[14px] text-[#222] placeholder:text-[rgba(34,34,34,0.35)] focus:outline-none focus:border-[#C4674A] focus:shadow-[0_0_0_3px_rgba(196,103,74,0.12)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="w-full px-3.5 py-3 pr-11 rounded-[10px] border border-[#E6E2DB] bg-[#F7F7F5] text-[14px] text-[#222] placeholder:text-[rgba(34,34,34,0.35)] focus:outline-none focus:border-[#C4674A] focus:shadow-[0_0_0_3px_rgba(196,103,74,0.12)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(34,34,34,0.35)] hover:text-[rgba(34,34,34,0.60)]">
                    {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                  </button>
                </div>

                {/* Instagram handle */}
                <div>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={e => setInstagramHandle(e.target.value)}
                    placeholder="@yourhandle"
                    className="w-full px-3.5 py-3 rounded-[10px] border border-[#E6E2DB] bg-[#F7F7F5] text-[14px] text-[#222] placeholder:text-[rgba(34,34,34,0.35)] focus:outline-none focus:border-[#C4674A] focus:shadow-[0_0_0_3px_rgba(196,103,74,0.12)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  />
                  <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, color: 'rgba(34,34,34,0.35)', marginTop: 4 }}>Optional — you can add this later</p>
                </div>

                {/* City */}
                <div>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. Bury St Edmunds"
                    className="w-full px-3.5 py-3 rounded-[10px] border border-[#E6E2DB] bg-[#F7F7F5] text-[14px] text-[#222] placeholder:text-[rgba(34,34,34,0.35)] focus:outline-none focus:border-[#C4674A] focus:shadow-[0_0_0_3px_rgba(196,103,74,0.12)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                  />
                  <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, color: 'rgba(34,34,34,0.35)', marginTop: 4 }}>So we can show you local campaigns</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 bg-[rgba(196,103,74,0.08)] text-[#C4674A] px-3.5 py-3 rounded-[10px] text-[14px] font-medium">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#C4674A]" />
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-[#C4674A] text-white rounded-full font-bold text-base transition-all disabled:opacity-50 active:scale-[0.98]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </span>
                  ) : 'Apply for access'}
                </button>
              </form>
            </div>

            {/* Footer links */}
            <p className="text-center mt-5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, color: 'rgba(34,34,34,0.35)', lineHeight: 1.5 }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); }}
                style={{ color: '#C4674A', fontWeight: 500, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13 }}
              >
                Sign in
              </button>
            </p>
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, color: 'rgba(34,34,34,0.35)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
              By signing up you agree to our terms and privacy policy. Your account will be reviewed by our team.
            </p>

          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" onClick={() => setShowTerms(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-[var(--card)] rounded-[16px] shadow-[var(--shadow-md)] border border-[var(--ink-08)] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-sans font-semibold text-[var(--near-black)]">Terms of Service</h2>
              <button
                onClick={() => setShowTerms(false)}
                className="w-[36px] h-[36px] flex items-center justify-center rounded-full hover:bg-[var(--ink-08)] transition-colors"
              >
                <X size={20} strokeWidth={1.5} className="text-[var(--ink-60)]" />
              </button>
            </div>

            <div className="space-y-4 text-[14px] leading-[1.6] text-[var(--ink-60)]">
              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">What is Nayba?</h3>
                <p>
                  Nayba is a platform that connects local creators with independent businesses. Creators discover participating businesses, visit in person, and create short-form content (Reels) in exchange for complimentary products or services.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">Content Standards</h3>
                <p>
                  All content created through Nayba must be honest, genuine, and based on a real visit to the business. Misleading, fabricated, or AI-generated content that misrepresents the experience is not permitted. You retain ownership of your content.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">Account &amp; Conduct</h3>
                <p>
                  Nayba reserves the right to suspend or remove accounts that violate these terms, engage in fraudulent activity, abuse the platform, or behave in a way that harms the community, businesses, or other creators.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">Pilot / Beta</h3>
                <p>
                  Nayba is currently in pilot. Features may change, and the service is provided as-is without guarantees of uptime or availability. By participating you acknowledge the platform is under active development.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">Contact</h3>
                <p>
                  If you have questions about these terms or need support, please email{' '}
                  <a href="mailto:hello@nayba.app" className="text-[var(--terra)] underline">hello@nayba.app</a>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowTerms(false)}
              className="w-full mt-6 py-2.5 rounded-full text-white font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" onClick={() => setShowPrivacy(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-[var(--card)] rounded-[16px] shadow-[var(--shadow-md)] border border-[var(--ink-08)] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-sans font-semibold text-[var(--near-black)]">Privacy Policy</h2>
              <button
                onClick={() => setShowPrivacy(false)}
                className="w-[36px] h-[36px] flex items-center justify-center rounded-full hover:bg-[var(--ink-08)] transition-colors"
              >
                <X size={20} strokeWidth={1.5} className="text-[var(--ink-60)]" />
              </button>
            </div>

            <div className="space-y-4 text-[14px] leading-[1.6] text-[var(--ink-60)]">
              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">What We Collect</h3>
                <p>When you create an account, we collect the following personal information:</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Date of birth</li>
                  <li>Town / location</li>
                  <li>Instagram handle</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">Why We Collect It</h3>
                <p>Your data is used to:</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Create and manage your Nayba account</li>
                  <li>Verify you meet the minimum age requirement</li>
                  <li>Match you with relevant local offers based on your location</li>
                  <li>Enable businesses to verify creator visits</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">Third Parties</h3>
                <p>
                  We do not sell your personal data to third parties. Your information is only shared with businesses you choose to interact with through the platform.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">Data Storage</h3>
                <p>
                  Your data is stored securely using Supabase, a cloud-hosted database platform with encryption at rest and in transit.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--near-black)] mb-1">Your Rights</h3>
                <p>
                  You have the right to request deletion of your account and all associated data at any time. To make a request, email{' '}
                  <a href="mailto:hello@nayba.app" className="text-[var(--terra)] underline">hello@nayba.app</a>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPrivacy(false)}
              className="w-full mt-6 py-2.5 rounded-full text-white font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
