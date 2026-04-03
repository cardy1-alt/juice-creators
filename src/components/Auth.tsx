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
        /* ─── SIGN IN: two-column on desktop, single on mobile ─── */
        <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden" style={{ minHeight: '100dvh' }}>
          <style>{`
            @media(min-width:768px){.auth-left{flex:0 0 54%;height:100vh;overflow-y:auto;padding:0 64px 0 72px !important}}
            @media(min-width:768px){.auth-right{flex:0 0 46%;height:100vh;overflow-y:auto;padding:48px !important}}
            @media(min-width:768px){.auth-wordmark-abs{position:absolute !important;top:32px;left:72px}}
            @media(min-width:768px) and (min-height:700px){.auth-grid-tall{display:block !important}}
            @keyframes nayba-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(0.85)}}
          `}</style>

          {/* Left column — hero */}
          <div className="auth-left bg-[#F7F7F5] flex flex-col justify-center relative" style={{ padding: '32px 24px' }}>
            {/* Wordmark — absolute on desktop, inline on mobile */}
            <div className="auth-wordmark-abs flex justify-center md:justify-start mb-8 md:mb-0" style={{ position: 'relative' }}>
              <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 26, fontWeight: 700, color: '#C4674A', letterSpacing: '-0.5px' }}>nayba</span>
            </div>

            <div className="max-w-[480px] w-full mx-auto md:mx-0">
              {/* Live pill */}
              <div className="flex justify-center md:justify-start mb-4">
                <div className="inline-flex items-center gap-[8px] px-[14px] py-[7px]" style={{ background: 'var(--card)', border: '1px solid var(--ink-08)', borderRadius: '999px' }}>
                  <span className="relative flex h-[8px] w-[8px]">
                    <span className="relative inline-flex rounded-full h-[8px] w-[8px]" style={{ background: 'var(--terra)', animation: 'nayba-pulse 2s ease-in-out infinite' }} />
                  </span>
                  <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--ink-60)' }}>Now live in Bury St Edmunds</span>
                </div>
              </div>

              {/* Headline */}
              <div className="text-center md:text-left mb-4 md:mt-4">
                <h1 className="text-[38px] md:text-[36px] lg:text-[44px]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, letterSpacing: '-1.2px', color: '#1C1C1A', lineHeight: 1.1, margin: 0 }}>
                  Discover local brands.<br />Get <span style={{ color: '#C4674A' }}>rewarded</span> for sharing.
                </h1>
              </div>

              {/* Subheadline */}
              <p className="text-center md:text-left" style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 17, fontWeight: 400, color: 'rgba(34,34,34,0.60)', lineHeight: 1.65, margin: '20px 0 0', maxWidth: 420 }}>
                New campaigns drop in your county every week. Browse local brands, express your interest, and get rewarded with free experiences — no follower minimums, ever.
              </p>

              {/* Social proof */}
              <div className="flex justify-center md:justify-start mt-8">
                <div className="inline-flex items-center gap-[10px] px-3.5 py-2 rounded-[999px]" style={{ background: 'rgba(196,103,74,0.06)' }}>
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
                  <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500, fontSize: 13, color: 'rgba(34,34,34,0.60)' }}>
                    Real creators · real local brands · no follower minimums
                  </span>
                </div>
              </div>

              {/* Campaign preview grid — only on tall desktop screens */}
              <div className="hidden auth-grid-tall relative mt-8" style={{ maxHeight: 220, overflow: 'hidden', display: 'none' }}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { color: '#F5C4A0', brand: 'Wildcraft Coffee', perk: 'Free cold brew' },
                    { color: '#C4674A', brand: 'Studio Flow', perk: 'Free yoga class' },
                    { color: '#2A7A4F', brand: 'The Nail Room', perk: 'Free nail set' },
                    { color: '#E8E3DC', brand: 'Ember & Rye', perk: 'Free brunch for 2' },
                    { color: '#D4A847', brand: 'Bloom Beauty', perk: 'Free facial' },
                    { color: '#C8B8F0', brand: 'The Larder', perk: 'Free deli hamper' },
                  ].map((c, i) => (
                    <div key={i} className="bg-white rounded-[10px] border border-[#E6E2DB] p-3 overflow-hidden">
                      <div className="rounded-[6px]" style={{ background: c.color, aspectRatio: '16/9' }} />
                      <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#222', marginTop: 8, marginBottom: 0 }}>{c.brand}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-[999px] text-[10px] font-medium" style={{ background: 'rgba(196,103,74,0.08)', color: '#C4674A' }}>{c.perk}</span>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent 60%, #F7F7F5 100%)' }} />
              </div>
            </div>
            {/* Gradient divider — right edge (desktop only) */}
            <div className="hidden md:block absolute right-0 top-0 w-[1px] h-full" style={{ background: 'linear-gradient(to bottom, transparent, #E6E2DB 20%, #E6E2DB 80%, transparent)' }} />
          </div>

          {/* Right column — form */}
          <div className="auth-right flex flex-col justify-center items-center" style={{ padding: '32px 24px', background: '#FAFAF9' }}>
            <div className="w-full md:bg-white md:border md:border-[#E6E2DB] md:rounded-[16px] md:p-10 md:max-w-[400px]" style={{ boxShadow: 'var(--auth-card-shadow, none)' }}>
              <style>{`@media(min-width:768px){:root{--auth-card-shadow:0 4px 24px rgba(28,28,26,0.06)}}`}</style>

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
                <p className="text-[19px] text-[var(--ink)] mb-[6px]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, letterSpacing: '-0.03em', fontWeight: 400 }}>Check your email</p>
                <p className="text-[14px] text-[var(--ink-60)] leading-[1.5]">We sent a reset link to<br /><span className="font-semibold text-[var(--ink)]">{resetEmail}</span></p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-[14px]">
                <div className="mb-[4px]">
                  <p className="text-[19px] text-[var(--ink)] mb-[4px]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, letterSpacing: '-0.03em', fontWeight: 400 }}>Reset password</p>
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
          {/* Sign in heading */}
          <h2 style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#222', letterSpacing: '-0.3px', margin: '0 0 24px', textAlign: 'center' }}>Sign in</h2>

          {/* Sign in form */}
          <form onSubmit={handleSubmit} className="space-y-[12px]">
            {/* 7. Email input */}
            <FloatingInput
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              required
            />
            {/* 8. Password input with eye toggle */}
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

            {/* 9. Sign in button */}
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

            {/* 10. Apply for access */}
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

            {/* 11. Forgot password — de-emphasised */}
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
        /* ─── SIGN UP: scrollable form ─── */
        <div className="flex-1 flex flex-col">
          {/* Signup header */}
          <div className="flex flex-col items-center pt-[44px] pb-[24px] px-6">
            <Logo variant="wordmark" size={24} />
          </div>

          <div className="flex-1 px-5 pb-8 max-w-md mx-auto w-full">
          <form onSubmit={handleSubmit}>
            {/* Step indicator */}
            <div className="flex items-center gap-[6px] mb-[20px]">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-[6px]">
                  <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-300" style={{
                    background: signupStep >= step ? 'var(--terra)' : 'var(--ink-08)',
                    color: signupStep >= step ? 'white' : 'var(--ink-35)',
                  }}>
                    {signupStep > step ? <Check size={13} strokeWidth={1.5} /> : step}
                  </div>
                  {step < 3 && <div className="w-[24px] h-[2px] rounded-full transition-colors duration-300" style={{ background: signupStep > step ? 'var(--terra)' : 'var(--ink-08)' }} />}
                </div>
              ))}
            </div>

            {/* Step header */}
            <div className="mb-[20px]">
              <h2 style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontWeight: 400, fontSize: '26px', color: '#222222', letterSpacing: '-0.03em' }}>
                {stepTitles[signupStep - 1].title}
              </h2>
              <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '15px', color: 'var(--ink-60)', lineHeight: 1.65, marginTop: 2 }}>{stepTitles[signupStep - 1].subtitle}</p>
            </div>

            {/* ── Creator signup (multi-step) ── */}
            {role === 'creator' && (
              <>
                {/* Step 1: Name, Instagram, Follower Count */}
                {signupStep === 1 && (
                  <div className="space-y-[12px]">
                    <FloatingInput label="Full Name" icon="user" value={name} onChange={setName} placeholder="Sophie Taylor" required />
                    <FloatingInput label="Instagram Handle" icon="instagram" value={instagramHandle} onChange={setInstagramHandle} placeholder="@yourusername" required />

                    <div>
                      <label className="block text-[15px] font-semibold text-[var(--ink)] mb-[8px]">Instagram following</label>
                      <div className="flex gap-[8px]">
                        {['Under 1k', '1k–5k', '5k–10k', '10k+'].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFollowerCount(opt)}
                            className="flex-1 py-[10px] text-[14px] transition-all"
                            style={{
                              fontFamily: "'Instrument Sans', sans-serif",
                              fontWeight: followerCount === opt ? 700 : 600,
                              borderRadius: '999px',
                              background: followerCount === opt ? 'var(--terra)' : 'var(--card)',
                              color: followerCount === opt ? 'white' : 'var(--ink-35)',
                              border: followerCount === opt ? '1.5px solid var(--terra)' : '1.5px solid var(--ink-08)',
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <p className="text-[13px] text-[var(--ink-60)] mt-[6px]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Don't worry — we welcome all sizes</p>
                    </div>
                  </div>
                )}

                {/* Step 2: Date of Birth & Address */}
                {signupStep === 2 && (
                  <div className="space-y-[12px]">
                    <div>
                      <label className="block text-[15px] font-semibold text-[var(--ink)] mb-[8px]">Date of Birth</label>
                      <div className="flex items-center gap-[8px]">
                        <Cake size={16} strokeWidth={1.5} className="text-[var(--ink-35)] flex-shrink-0" />
                        <select
                          value={dobDay}
                          onChange={(e) => setDobDay(e.target.value)}
                          className="flex-1 px-[10px] py-[14px] rounded-[12px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] transition-all appearance-none"
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
                          className="flex-1 px-[10px] py-[14px] rounded-[12px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] transition-all appearance-none"
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
                          className="flex-1 px-[10px] py-[14px] rounded-[12px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] transition-all appearance-none"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          required
                        >
                          <option value="" disabled>Year</option>
                          {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 13 - i).map((y) => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[13px] text-[var(--ink-35)] mt-[6px]">We use this to verify your age. You must be 13 or over.</p>
                    </div>

                    <div>
                      <label className="block text-[15px] font-semibold text-[var(--ink)] mb-[8px]">Your town</label>
                      <select
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full px-[14px] py-[15px] rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] transition-all appearance-none"
                        style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
                        required
                      >
                        <option value="" disabled>Select your town</option>
                        <option value="Bury St Edmunds">Bury St Edmunds</option>
                        <option value="Ipswich" disabled style={{ color: 'var(--ink-35)' }}>Ipswich — coming soon</option>
                        <option value="Norwich" disabled style={{ color: 'var(--ink-35)' }}>Norwich — coming soon</option>
                        <option value="Cambridge" disabled style={{ color: 'var(--ink-35)' }}>Cambridge — coming soon</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Step 3: Email & Password */}
                {signupStep === 3 && (
                  <div className="space-y-[12px]">
                    <FloatingInput label="Email" icon="mail" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
                    <FloatingInput
                      label="Password"
                      icon="lock"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={setPassword}
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      rightElement={
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[var(--ink-35)] hover:text-[var(--ink-60)] transition-colors p-1">
                          {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                        </button>
                      }
                    />
                  </div>
                )}
              </>
            )}

            {/* ── Business signup disabled for pilot ── */}
            {role === 'business' && (
              <div className="text-center py-[32px]">
                <div className="w-[56px] h-[56px] rounded-full bg-[var(--terra-10)] flex items-center justify-center mx-auto mb-[16px]">
                  <Store size={24} strokeWidth={1.5} className="text-[var(--terra)]" />
                </div>
                <p className="text-[15px] text-[var(--ink-60)] leading-[1.65]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                  Want to list your business on nayba? Get in touch at{' '}
                  <a href="mailto:hello@nayba.app" className="text-[var(--terra)] font-semibold hover:underline">hello@nayba.app</a>
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-[10px] bg-[var(--terra-10)] text-[var(--terra)] px-[14px] py-[12px] rounded-[12px] text-[15px] font-medium mt-[14px]">
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
                      className="flex items-center gap-[4px] text-[13px] font-medium text-[var(--ink-60)] transition-colors hover:text-[var(--ink)]"
                    >
                      <ArrowLeft size={14} strokeWidth={1.5} /> Back
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
                      setError('');
                      setSignupStep(signupStep + 1);
                    }}
                    className="flex-1 min-h-[52px] text-white transition-all active:scale-[0.98] inline-flex items-center justify-center gap-[6px]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '15px', background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
                  >
                    Continue <ChevronRight size={16} strokeWidth={1.5} />
                  </button>
                </div>
              ) : (
                <>
                <div className="text-center mb-[14px]">
                  <p className="text-[15px] font-bold text-[var(--ink)] mb-[4px]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Application received</p>
                  <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '13px', fontWeight: 400, color: 'var(--ink-60)', lineHeight: 1.5 }}>We review every application personally. You'll hear from us within 24 hours — check your email (and your spam folder just in case).</p>
                  <p className="text-[12px] text-[var(--ink-35)] mt-[6px]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Questions? <a href="mailto:hello@nayba.app" className="text-[var(--terra)] font-semibold hover:underline">hello@nayba.app</a></p>
                </div>
                <div className="flex gap-[10px]">
                  <button
                    type="button"
                    onClick={() => { setSignupStep(signupStep - 1); setError(''); }}
                    className="flex items-center gap-[4px] text-[13px] font-medium text-[var(--ink-60)] transition-colors hover:text-[var(--ink)]"
                  >
                    <ArrowLeft size={14} strokeWidth={1.5} /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 min-h-[52px] text-white transition-all disabled:opacity-50 active:scale-[0.98]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '15px', background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </span>
                    ) : 'Create Account'}
                  </button>
                </div>
                </>
              )}
            </div>

            <p className="text-center mt-[16px]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, fontWeight: 400, color: 'var(--ink-35)', lineHeight: 1.5 }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setSignupStep(1); setForgotPassword(false); }}
                className="hover:text-[var(--ink)] transition-colors"
                style={{ color: 'var(--terra)', fontWeight: 500, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13 }}
              >
                Sign in
              </button>
            </p>
            <p className="text-[13px] text-[var(--ink-35)] text-center mt-[8px] leading-[1.5]">
              By signing up you agree to{' '}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="underline text-[var(--terra)] hover:text-[var(--terra-hover)] transition-colors"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}
              >
                our terms
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="underline text-[var(--terra)] hover:text-[var(--terra-hover)] transition-colors"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}
              >
                privacy policy
              </button>
              . Your account will be reviewed by our team.
            </p>
          </form>
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
