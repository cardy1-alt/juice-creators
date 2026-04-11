import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';
import { friendlyError } from '../lib/errors';
import { Eye, EyeOff, ArrowLeft, ChevronLeft, ChevronRight, Mail, Store, Check, Cake, User, AtSign, Lock, X, Camera, Building2, Megaphone, Gift, Star, Film } from 'lucide-react';
import { CATEGORY_LIST, CategoryIcon } from '../lib/categories';
import { Logo } from './Logo';
import NaybaLogo from '../assets/logomark.svg';

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
    <div className={`relative transition-all duration-200 rounded-[10px] ${focused ? 'border-[1.5px] border-[var(--terra)]' : 'border border-[rgba(42,32,24,0.12)]'}`} style={{ background: '#ffffff' }}>
      {iconName && (
        <span className={`absolute left-[14px] top-1/2 -translate-y-1/2 transition-colors ${
          focused ? 'text-[var(--ink-60)]' : 'text-[var(--ink-50)]'
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
        className={`w-full min-h-[44px] ${iconName ? 'pl-[40px]' : 'pl-[16px]'} ${rightElement ? 'pr-[44px]' : 'pr-[16px]'} py-[10px] bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-50)] focus:outline-none`}
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
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
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

  // Capture referral code from URL
  const referredBy = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null;

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
        // Age check — must be 18+
        if (dob) {
          const birthDate = new Date(dob);
          const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (age < 18) { setError('You must be 18 or over to use Nayba'); setLoading(false); return; }
        }
        const additionalData = { name, instagramHandle, followerCount, code: generateCreatorCode(name), address: address || null, latitude, longitude, phone: phone || null, referred_by: referredBy || null, dateOfBirth: dob || null };
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
    <div className="flex flex-col overscroll-none" style={{ minHeight: '100dvh', background: 'var(--chalk)' }}>
      {mode === 'signin' ? (
        /* ─── SIGN IN: two-column on desktop ─── */
        <div className="flex-1 flex flex-col md:flex-row" style={{ background: 'white' }}>
          {/* Left — branding */}
          <div className="flex flex-col items-center justify-center px-6 py-8 md:flex-1 md:px-12 md:py-16 relative overflow-hidden" style={{ background: 'var(--chalk)' }}>
            {/* Floating product cards — desktop only */}
            <div className="hidden md:block absolute inset-0 pointer-events-none">
              {[
                { icon: Megaphone, tint: 'rgba(217,95,59,0.08)', color: '#D95F3B', text: 'New campaign just went live', sub: 'Suffolk Music Fest · 2 spots left', top: '5%', left: '4%', rotate: -3 },
                { icon: Film, tint: 'rgba(122,160,184,0.12)', color: '#5A8AA8', text: 'Reel submitted — nice work!', sub: 'Revamp Gym · Summer Challenge', top: '8%', right: '3%', rotate: 2 },
                { icon: Star, tint: 'rgba(140,122,170,0.12)', color: '#7A6A9A', text: 'Glow Wellness selected you', sub: 'Confirm your free facial', bottom: '18%', left: '2%', rotate: 3 },
                { icon: Gift, tint: 'rgba(122,148,120,0.12)', color: '#5A8A58', text: 'You redeemed a free coffee & pastry', sub: 'The Buttermarket Brew Co.', bottom: '8%', right: '5%', rotate: -2 },
              ].map((card, i) => (
                <div key={i} className="absolute rounded-[12px] px-3.5 py-3 bg-white flex items-start gap-2.5" style={{
                  width: 230,
                  top: card.top, right: card.right, bottom: card.bottom, left: card.left,
                  transform: `rotate(${card.rotate}deg)`,
                  opacity: 0.85,
                  boxShadow: '0 2px 12px rgba(42,32,24,0.08)',
                }}>
                  <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ background: card.tint }}>
                    <card.icon size={15} style={{ color: card.color }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#2A2018', margin: 0, lineHeight: 1.4 }}>{card.text}</p>
                    <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 11, color: '#7A7168', margin: '3px 0 0', lineHeight: 1.3 }}>{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="w-full max-w-[420px] relative z-10">
              <div style={{ marginBottom: 32 }}>
                <Logo size={28} variant="wordmark" />
              </div>

              <h1 className="text-[36px]" style={{ fontFamily: "'Hornbill', Georgia, serif", fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15, margin: '0 0 16px', color: 'var(--ink)' }}>
                <span style={{ display: 'block' }}>Discover local brands.</span>
                Get <span style={{ color: 'var(--terra)' }}>rewarded</span> for sharing.
              </h1>

              <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 15, fontWeight: 400, color: 'var(--ink-60)', lineHeight: 1.65, maxWidth: 360, margin: '0 0 28px' }}>
                New campaigns drop in your county every week. Browse local brands, express your interest, and get rewarded with free experiences — no follower minimums, ever.
              </p>

              {/* Social proof */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-[8px]">
                  {[
                    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face',
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
                    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face',
                    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face',
                  ].map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="w-[30px] h-[30px] rounded-full object-cover border-2"
                      style={{ borderColor: 'var(--chalk)', zIndex: 4 - i, position: 'relative' }}
                      loading="lazy"
                    />
                  ))}
                </div>
                <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--ink-50)' }}>
                  Join 50+ Suffolk creators
                </span>
              </div>
            </div>
          </div>

          {/* Right / main — form */}
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-6 md:px-12 md:py-16" style={{ background: 'white' }}>
            <div className="w-full max-w-[380px]">
              <h2 className="text-[20px] font-semibold text-[var(--ink)] mb-1">Sign in</h2>
              <p className="text-[14px] text-[var(--ink-60)] mb-6">Welcome back to Nayba</p>

              {/* ─── FORGOT PASSWORD ─── */}
              {forgotPassword ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setForgotPassword(false)}
                    className="flex items-center gap-[6px] text-[14px] font-medium text-[var(--ink-60)] mb-[20px] hover:text-[var(--ink)] transition-colors"
                  >
                    <ChevronLeft size={14} strokeWidth={1.5} /> Back to sign in
                  </button>

                  {resetSent ? (
                    <div className="text-center py-[32px]">
                      <div className="w-[56px] h-[56px] rounded-full bg-[var(--terra-10)] flex items-center justify-center mx-auto mb-[16px]">
                        <Mail size={24} strokeWidth={1.5} className="text-[var(--terra)]" />
                      </div>
                      <p className="text-[19px] text-[var(--ink)] mb-[6px]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, letterSpacing: '-0.03em' }}>Check your email</p>
                      <p className="text-[14px] text-[var(--ink-60)] leading-[1.5]">We sent a reset link to<br /><span className="font-semibold text-[var(--ink)]">{resetEmail}</span></p>
                    </div>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-[14px]">
                      <div className="mb-[4px]">
                        <p className="text-[19px] text-[var(--ink)] mb-[4px]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, letterSpacing: '-0.03em' }}>Reset password</p>
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
                        className="w-full h-[48px] text-white transition-all disabled:opacity-50 active:scale-[0.98]"
                        style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '14px', background: 'var(--terra)', borderRadius: '10px', padding: '8px 16px' }}
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
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-[var(--ink-50)] hover:text-[var(--ink-60)] transition-colors p-1">
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
                    className="w-full h-[48px] text-white rounded-[10px] transition-all disabled:opacity-50 active:scale-[0.98]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '14px', background: 'var(--terra)' }}
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
                      className="font-semibold hover:underline transition-colors"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'inherit', color: 'var(--terra)' }}
                    >
                      Apply for access
                    </button>
                  </p>

                  <button
                    type="button"
                    onClick={() => { setForgotPassword(true); setResetEmail(email); setResetSent(false); setResetError(''); }}
                    className="block text-sm text-center mt-[4px] transition-colors mx-auto"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", color: 'var(--ink-50)' }}
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12" style={{ background: 'var(--chalk)' }}>
          <div className="max-w-[440px] w-full text-center">
            <button onClick={() => setMode('signin')} className="flex items-center gap-1 text-[14px] font-medium mb-8 mx-auto transition-colors" style={{ color: 'var(--ink-60)' }}>
              <ChevronLeft size={14} /> Back to sign in
            </button>
            <h2 className="text-[20px] font-semibold text-[var(--ink)]" style={{ margin: '0 0 8px', color: 'var(--ink)' }}>Join Nayba</h2>
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 15, color: 'var(--ink-60)', margin: '0 0 32px' }}>Which best describes you?</p>
            <div className="flex gap-4">
              {([
                { key: 'creator' as const, icon: Camera, label: "I'm a Creator", sub: 'I create content and want brand collabs' },
                { key: 'brand' as const, icon: Building2, label: "I'm a Brand", sub: 'I want creators to promote my business' },
              ]).map(opt => {
                const selected = selectedRole === opt.key;
                return (
                  <button key={opt.key} onClick={() => setSelectedRole(opt.key)}
                    className="flex-1 text-left p-6 rounded-[12px] transition-all"
                    style={{
                      background: selected ? 'var(--terra-5)' : 'white',
                      border: selected ? '1.5px solid var(--terra)' : '1px solid rgba(42,32,24,0.10)',
                      boxShadow: selected ? 'none' : '0 2px 8px rgba(42,32,24,0.06)',
                    }}>
                    <opt.icon size={24} style={{ color: selected ? 'var(--terra)' : 'var(--ink-35)', marginBottom: 12 }} />
                    <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>{opt.label}</p>
                    <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 14, color: 'var(--ink-60)', margin: 0, lineHeight: 1.45 }}>{opt.sub}</p>
                  </button>
                );
              })}
            </div>
            {selectedRole && (
              <button onClick={() => {
                if (selectedRole === 'creator') { setRole('creator'); setMode('signup'); setSignupStep(1); }
                else { setMode('brand-contact'); }
              }}
                className="mt-8 px-10 h-[48px] rounded-[10px] text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--terra)', fontWeight: 700, fontSize: '14px' }}>
                Continue
              </button>
            )}
          </div>
        </div>
      ) : mode === 'brand-contact' ? (
        /* ─── BRAND CONTACT ─── */
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12" style={{ background: 'var(--chalk)' }}>
          <div className="max-w-[400px] w-full text-center">
            <button onClick={() => setMode('roleselect')} className="flex items-center gap-1 text-[14px] font-medium mb-8 mx-auto transition-colors" style={{ color: 'var(--ink-60)' }}>
              <ChevronLeft size={14} /> Back
            </button>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--terra-10)' }}>
              <Building2 size={24} style={{ color: 'var(--terra)' }} />
            </div>
            <h2 className="text-[20px] font-semibold text-[var(--ink)]" style={{ margin: '0 0 10px', color: 'var(--ink)' }}>Get your brand on Nayba</h2>
            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 15, color: 'var(--ink-60)', lineHeight: 1.65, margin: '0 0 32px' }}>
              Get in touch at hello@nayba.app to get your brand set up. We'll have you live within 24 hours.
            </p>
            <a href="mailto:hello@nayba.app"
              className="inline-flex items-center gap-2 px-8 h-[48px] rounded-[10px] text-white hover:opacity-90 transition-opacity"
              style={{ textDecoration: 'none', background: 'var(--terra)', fontWeight: 700, fontSize: '14px', lineHeight: '48px' }}>
              <Mail size={16} /> Email hello@nayba.app
            </a>
          </div>
        </div>
      ) : (
        /* ─── SIGN UP: multi-step experience ─── */
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 md:py-16" style={{ background: 'white', minHeight: '100dvh' }}>
          <div className="w-full flex flex-col items-center" style={{ maxWidth: 380 }}>

            {/* Logo — links back to sign in */}
            <button onClick={() => { setMode('signin'); setError(''); setSignupStep(1); }} style={{ marginBottom: 24, background: 'none', border: 'none', cursor: 'pointer' }}>
              <Logo size={28} variant="wordmark" />
            </button>

            {/* Progress stepper */}
            <div className="flex items-center gap-2 mb-8">
              {[1, 2, 3].map(s => (
                <div key={s} className="rounded-full transition-all duration-300" style={{
                  width: signupStep === s ? 24 : 8,
                  height: 8,
                  background: signupStep >= s ? 'var(--terra)' : 'rgba(42,32,24,0.10)',
                  borderRadius: 999,
                }} />
              ))}
            </div>

            {/* Step 1: The basics */}
            {signupStep === 1 && (
              <div className="w-full tab-fade-in">
                <h2 className="text-[22px] font-semibold text-[var(--ink)] mb-1 text-center">Your first collab is a few taps away</h2>
                <p className="text-[14px] text-[var(--ink-60)] mb-8 text-center">Create your account to start browsing campaigns</p>

                <div className="space-y-3.5">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3.5 py-3 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white min-h-[44px] text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-50)] focus:outline-none focus:border-[var(--terra)]"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3.5 py-3 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white min-h-[44px] text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-50)] focus:outline-none focus:border-[var(--terra)]"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Create a password"
                      minLength={8}
                      className="w-full px-3.5 py-3 pr-11 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white min-h-[44px] text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-50)] focus:outline-none focus:border-[var(--terra)]"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: 'var(--ink-50)' }}>
                      {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                    </button>
                  </div>
                  <p className="text-[14px] text-[var(--ink-50)]">At least 8 characters</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-[10px] text-[14px] font-medium mt-3" style={{ background: 'var(--terra-10)', color: 'var(--terra)' }}>
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--terra)' }} />
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (!name.trim() || !email.trim() || password.length < 8) {
                      setError(!name.trim() ? 'Please enter your name' : !email.trim() ? 'Please enter your email' : 'Password must be at least 8 characters');
                      return;
                    }
                    setError('');
                    setSignupStep(2);
                  }}
                  className="w-full h-[48px] text-white rounded-[10px] transition-all active:scale-[0.98] mt-6"
                  style={{ fontWeight: 700, fontSize: '14px', background: 'var(--terra)' }}
                >
                  Continue
                </button>

                <p className="text-center mt-6 text-[14px] text-[var(--ink-50)]">
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('signin'); setError(''); }}
                    style={{ color: 'var(--terra)', fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13 }}>
                    Sign in
                  </button>
                </p>
              </div>
            )}

            {/* Step 2: Location + Instagram */}
            {signupStep === 2 && (
              <div className="w-full tab-fade-in">
                <button type="button" onClick={() => { setSignupStep(1); setError(''); }}
                  className="flex items-center gap-1 text-[14px] mb-6 transition-colors"
                  style={{ color: 'var(--ink-50)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <ChevronLeft size={14} /> Back
                </button>

                <h2 className="text-[22px] font-semibold text-[var(--ink)] mb-1 text-center">Where should we look?</h2>
                <p className="text-[14px] text-[var(--ink-60)] mb-8 text-center">We'll match you with brands in your area</p>

                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-[14px] font-medium text-[var(--ink-60)] mb-1.5">Your county</label>
                    <select
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white min-h-[44px] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)]"
                    >
                      <option value="">Select your county</option>
                      <option value="Suffolk">Suffolk</option>
                      <option value="Norfolk">Norfolk</option>
                      <option value="Cambridgeshire">Cambridgeshire</option>
                      <option value="Essex">Essex</option>
                    </select>
                    <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] mt-1.5">So we can show you campaigns near you</p>
                  </div>

                  <div>
                    <label className="block text-[14px] font-medium text-[var(--ink-60)] mb-1.5">Instagram handle</label>
                    <input
                      type="text"
                      value={instagramHandle}
                      onChange={e => setInstagramHandle(e.target.value)}
                      placeholder="@yourhandle"
                      required
                      className="w-full px-3.5 py-3 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white min-h-[44px] text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-50)] focus:outline-none focus:border-[var(--terra)]"
                    />
                    <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] mt-1.5">So we can check out your content</p>
                  </div>

                  <div>
                    <label className="block text-[14px] font-medium text-[var(--ink-60)] mb-1.5">Date of birth</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      required
                      className="w-full px-3.5 py-3 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white min-h-[44px] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)]"
                    />
                    <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] mt-1.5">You must be 18 or over to use Nayba</p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-[10px] text-[14px] font-medium" style={{ background: 'var(--terra-10)', color: 'var(--terra)' }}>
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--terra)' }} />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[48px] text-white rounded-[10px] transition-all disabled:opacity-50 active:scale-[0.98] mt-4"
                    style={{ fontWeight: 700, fontSize: '14px', background: 'var(--terra)' }}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </span>
                    ) : 'Apply for access'}
                  </button>
                </form>

                <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] text-center mt-6 leading-[1.5]">
                  By signing up you agree to our terms and privacy policy.
                </p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" onClick={() => setShowTerms(false)}>
          <div className="absolute inset-0 bg-[rgba(42,32,24,0.40)]" />
          <div
            className="relative bg-white rounded-[12px] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            style={{ border: '1px solid rgba(42,32,24,0.10)', boxShadow: '0 4px 16px rgba(42,32,24,0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-sans font-semibold text-[var(--ink)]">Terms of Service</h2>
              <button
                onClick={() => setShowTerms(false)}
                className="w-[36px] h-[36px] flex items-center justify-center rounded-full hover:bg-[rgba(42,32,24,0.04)] transition-colors"
              >
                <X size={20} strokeWidth={1.5} className="text-[var(--ink-60)]" />
              </button>
            </div>

            <div className="space-y-4 text-[14px] leading-[1.6] text-[var(--ink-60)]">
              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-1">What is Nayba?</h3>
                <p>
                  Nayba is a platform that connects local creators with independent businesses. Creators discover participating businesses, visit in person, and create short-form content (Reels) in exchange for complimentary products or services.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-1">Content Standards</h3>
                <p>
                  All content created through Nayba must be honest, genuine, and based on a real visit to the business. Misleading, fabricated, or AI-generated content that misrepresents the experience is not permitted. You retain ownership of your content.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-1">Account &amp; Conduct</h3>
                <p>
                  Nayba reserves the right to suspend or remove accounts that violate these terms, engage in fraudulent activity, abuse the platform, or behave in a way that harms the community, businesses, or other creators.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-1">Pilot / Beta</h3>
                <p>
                  Nayba is currently in pilot. Features may change, and the service is provided as-is without guarantees of uptime or availability. By participating you acknowledge the platform is under active development.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-1">Contact</h3>
                <p>
                  If you have questions about these terms or need support, please email{' '}
                  <a href="mailto:hello@nayba.app" className="text-[var(--terra)] underline">hello@nayba.app</a>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowTerms(false)}
              className="w-full mt-6 h-[48px] rounded-[10px] text-white text-[14px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors" style={{ fontWeight: 700 }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" onClick={() => setShowPrivacy(false)}>
          <div className="absolute inset-0 bg-[rgba(42,32,24,0.40)]" />
          <div
            className="relative bg-white rounded-[12px] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            style={{ border: '1px solid rgba(42,32,24,0.10)', boxShadow: '0 4px 16px rgba(42,32,24,0.12)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-sans font-semibold text-[var(--ink)]">Privacy Policy</h2>
              <button
                onClick={() => setShowPrivacy(false)}
                className="w-[36px] h-[36px] flex items-center justify-center rounded-full hover:bg-[rgba(42,32,24,0.04)] transition-colors"
              >
                <X size={20} strokeWidth={1.5} className="text-[var(--ink-60)]" />
              </button>
            </div>

            <div className="space-y-4 text-[14px] leading-[1.6] text-[var(--ink-60)]">
              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-1">What We Collect</h3>
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
                <h3 className="font-semibold text-[var(--ink)] mb-1">Why We Collect It</h3>
                <p>Your data is used to:</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Create and manage your Nayba account</li>
                  <li>Verify you meet the minimum age requirement</li>
                  <li>Match you with relevant local offers based on your location</li>
                  <li>Enable businesses to verify creator visits</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-1">Third Parties</h3>
                <p>
                  We do not sell your personal data to third parties. Your information is only shared with businesses you choose to interact with through the platform.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-1">Data Storage</h3>
                <p>
                  Your data is stored securely using Supabase, a cloud-hosted database platform with encryption at rest and in transit.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-1">Your Rights</h3>
                <p>
                  You have the right to request deletion of your account and all associated data at any time. To make a request, email{' '}
                  <a href="mailto:hello@nayba.app" className="text-[var(--terra)] underline">hello@nayba.app</a>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPrivacy(false)}
              className="w-full mt-6 h-[48px] rounded-[10px] text-white text-[14px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors" style={{ fontWeight: 700 }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
