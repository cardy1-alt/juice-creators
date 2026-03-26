import { useState, useRef, useEffect } from 'react';
import { DoodleIcon } from '../lib/doodle-icons';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/upload';
import { CategoryIcon, getCategorySolidColor } from '../lib/categories';
import { getInitials } from '../lib/avatar';
import { Logo } from './Logo';

// ─── Category-aware placeholder map (mirrors BusinessPortal) ─────────────
function getCategoryPlaceholder(category: string, type: string): string {
  const map: Record<string, Record<string, string>> = {
    'Cafe & Coffee':        { product: 'coffee + pastry',           service: 'barista experience',       experience: 'coffee tasting session' },
    'Food & Drink':         { product: 'meal or drink',             service: 'chef experience',          experience: 'tasting session' },
    'Hair & Beauty':        { product: 'product of your choice',    service: 'express facial',           experience: 'pamper session' },
    'Health & Fitness':     { product: 'supplement of your choice', service: 'personal training session', experience: 'fitness class' },
    'Retail':               { product: 'item of your choice',       service: 'styling session',          experience: 'shopping experience' },
    'Wellness & Spa':       { product: 'product of your choice',    service: '30-minute massage',        experience: 'wellness session' },
    'Arts & Entertainment': { product: 'item of your choice',       service: 'class or lesson',          experience: 'event or show entry' },
    'Pets':                 { product: 'treat or accessory',        service: 'grooming session',         experience: 'pet experience' },
    'Education':            { product: 'resource or material',      service: 'tutoring session',         experience: 'workshop or class' },
    'Services':             { product: 'service of your choice',    service: 'consultation',             experience: 'experience session' },
  };
  return map[category]?.[type] ?? 'your choice';
}

// ─── CSS keyframes for slide transitions & success animation ─────────────
const onboardingStyles = `
@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slideInLeft {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes ringExpand1 {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes ringExpand2 {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes ringExpand3 {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(2.5); opacity: 0; }
}
`;

interface BusinessOnboardingProps {
  profile: any;
  onComplete: () => void;
  onFinishLater?: () => void;
}

export default function BusinessOnboarding({ profile, onComplete, onFinishLater }: BusinessOnboardingProps) {
  // Resume from saved step if available
  const [screen, setScreen] = useState(() => {
    const saved = profile.onboarding_step;
    return saved && saved >= 1 && saved <= 4 ? saved : 1;
  });
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [animKey, setAnimKey] = useState(0);

  // Screen 3 state — only collects fields NOT already gathered at signup
  const [instagram, setInstagram] = useState(profile.instagram_handle || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(profile.logo_url || null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Screen 4 state
  const [offerType, setOfferType] = useState('');
  const [offerItem, setOfferItem] = useState('');
  const [discountAmount, setDiscountAmount] = useState('20');
  const [discountUnit, setDiscountUnit] = useState<'%' | '£'>('%');
  const [hasCap, setHasCap] = useState(false);
  const [monthlySlots, setMonthlySlots] = useState(4);

  // Screen 5 state
  const [linkCopied, setLinkCopied] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saveStep = async (step: number) => {
    await supabase.from('businesses').update({ onboarding_step: step }).eq('id', profile.id);
  };

  const goForward = () => {
    const nextScreen = screen + 1;
    setDirection('forward');
    setAnimKey(k => k + 1);
    setScreen(nextScreen);
    saveStep(nextScreen);
  };

  const goBack = () => {
    setDirection('back');
    setAnimKey(k => k + 1);
    setScreen((s: number) => s - 1);
  };

  const handleFinishLater = () => {
    saveStep(screen);
    if (onFinishLater) {
      onFinishLater();
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const { url, error } = await uploadAvatar(file, profile.id, 'businesses');
    if (url) setLogoUrl(url);
    if (error) console.error('Logo upload failed:', error);
    setLogoUploading(false);
  };

  const handleLaunch = async () => {
    setSaving(true);
    setError('');
    try {
      const generatedTitle = offerType === 'discount'
        ? `${discountAmount}${discountUnit} off`
        : `Free ${offerItem}`;

      // Update business profile — only new fields (name & category already set at signup)
      const { error: updateError } = await supabase.from('businesses').update({
        instagram_handle: instagram || null,
        logo_url: logoUrl || null,
        onboarding_complete: true,
        onboarding_step: 5,
      }).eq('id', profile.id);
      if (updateError) throw updateError;

      // Deactivate any existing offers
      await supabase.from('offers').update({ is_live: false }).eq('business_id', profile.id);

      // Create offer
      const { error: offerError } = await supabase.from('offers').insert({
        business_id: profile.id,
        description: generatedTitle,
        generated_title: generatedTitle,
        offer_type: offerType,
        offer_item: offerType === 'discount' ? `${discountAmount}${discountUnit}` : offerItem,
        monthly_cap: hasCap ? monthlySlots : null,
        is_live: true,
        content_type: 'reel',
      });
      if (offerError) throw offerError;

      goForward(); // go to screen 5 (success)
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const generatedTitle = offerType === 'discount'
    ? `${discountAmount}${discountUnit} off`
    : `Free ${offerItem}`;

  // Extract town from address for success screen
  const town = (() => {
    if (!profile.address) return 'your area';
    const parts = profile.address.split(',').map((s: string) => s.trim());
    if (parts.length >= 3) return parts[parts.length - 2];
    if (parts.length >= 2) return parts[1];
    return parts[0];
  })();

  const totalScreens = 4; // progress dots for screens 1-4 (screen 5 is success, no dots)
  const animClass = direction === 'forward' ? 'slideInRight' : 'slideInLeft';

  const offerTiles = [
    { key: 'product', label: 'Free Product', icon: 'gift', sub: 'Coffee, meal, item' },
    { key: 'service', label: 'Free Service', icon: 'sparkles', sub: 'Haircut, facial, class' },
    { key: 'discount', label: 'Discount', icon: 'tag', sub: '% off or £ off' },
    { key: 'experience', label: 'Experience', icon: 'star', sub: 'Tasting, tour, event' },
  ];

  // PJS helper for inline styles
  const pjs = (weight: number, size: string, color: string, extra?: Record<string, string>) => ({
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: weight,
    fontSize: size,
    color,
    ...extra,
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--shell)' }}>
      <style>{onboardingStyles}</style>

      {/* ─── Top bar ─── */}
      {screen <= totalScreens && (
        <div className="flex items-center justify-between px-[20px] pt-[16px] pb-[8px] flex-shrink-0">
          {screen > 1 ? (
            <button onClick={goBack} className="w-[40px] h-[40px] flex items-center justify-center -ml-[8px]">
              <DoodleIcon name="chevron-left" size={20} className="text-[var(--ink-35)]" />
            </button>
          ) : (
            <div className="w-[40px]" />
          )}
          <Logo variant="icon" size={32} />
          {screen === 3 ? (
            <button onClick={goForward} className="w-[40px] text-right" style={pjs(500, '15px', 'var(--ink-35)')}>Skip</button>
          ) : (
            <div className="w-[40px]" />
          )}
        </div>
      )}

      {/* ─── Progress dots ─── */}
      {screen <= totalScreens && (
        <div className="flex items-center justify-center gap-[8px] py-[8px]">
          {Array.from({ length: totalScreens }, (_, i) => i + 1).map(dot => (
            <div
              key={dot}
              className="rounded-full transition-all duration-300"
              style={{
                width: dot === screen ? 8 : 6,
                height: dot === screen ? 8 : 6,
                background: dot <= screen ? 'var(--terra)' : 'var(--ink-08)',
              }}
            />
          ))}
        </div>
      )}

      {/* ─── Screen content ─── */}
      <div
        key={animKey}
        className="flex-1 flex flex-col overflow-y-auto px-[20px] pb-[20px]"
        style={{ animation: `${animClass} 280ms ease` }}
      >
        {/* ═══ SCREEN 1 — WELCOME ═══ */}
        {screen === 1 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[60px] flex flex-col items-center">
              <div className="h-[200px] flex items-center justify-center">
                <Logo variant="icon" size={120} />
              </div>

              <h1 style={pjs(800, '26px', 'var(--ink)', { letterSpacing: '-0.03em', textAlign: 'center' })}>
                Welcome to nayba
              </h1>
              <p style={pjs(400, '15px', 'var(--ink-60)', { textAlign: 'center', marginTop: '12px', maxWidth: '280px', lineHeight: '1.65' })}>
                Turn local creators into your marketing&nbsp;team — no&nbsp;budget&nbsp;required.
              </p>
            </div>

            <div className="flex-1" />

            <button
              onClick={goForward}
              className="w-full min-h-[52px] text-white transition-all"
              style={{ ...pjs(700, '15px', 'white'), background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
            >
              Let's get started →
            </button>
            <p style={pjs(400, '14px', 'var(--ink-35)', { textAlign: 'center', marginTop: '10px' })}>Takes about 3 minutes</p>
            <button
              onClick={handleFinishLater}
              className="w-full text-center mt-[8px] py-[8px]"
              style={pjs(500, '15px', 'var(--terra)')}
            >
              Finish later
            </button>
          </div>
        )}

        {/* ═══ SCREEN 2 — THE CONCEPT ═══ */}
        {screen === 2 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1 style={pjs(800, '26px', 'var(--ink)', { letterSpacing: '-0.03em' })}>
                Here's how it works
              </h1>
              <p style={pjs(400, '15px', 'var(--ink-60)', { marginTop: '6px' })}>Creators visit. They post. You grow.</p>

              <div className="flex flex-col gap-[20px] mt-[28px]">
                {[
                  { num: 1, bg: 'var(--terra)', title: 'You create an offer', desc: 'Choose what you\'ll give away — a free coffee, a haircut, whatever feels right.' },
                  { num: 2, bg: 'var(--ink)', title: 'Creators visit your business', desc: 'Local creators claim your offer, visit in person, and experience what you do.' },
                  { num: 3, bg: 'var(--ink)', title: 'They post a reel about you', desc: 'Within 48 hours they post an Instagram reel. Real content. Real people. Real reach.' },
                ].map(step => (
                  <div key={step.num} className="flex items-start gap-[16px]">
                    <div
                      className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: step.bg }}
                    >
                      <span style={pjs(700, '17px', 'white')}>{step.num}</span>
                    </div>
                    <div className="flex-1 pt-[2px]">
                      <p style={pjs(700, '17px', 'var(--ink)', { marginBottom: '3px' })}>{step.title}</p>
                      <p style={pjs(400, '15px', 'var(--ink-60)', { lineHeight: '1.65' })}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            <button
              onClick={goForward}
              className="w-full min-h-[52px] text-white transition-all"
              style={{ ...pjs(700, '15px', 'white'), background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
            >
              Sounds good →
            </button>
            <button
              onClick={handleFinishLater}
              className="w-full text-center mt-[8px] py-[8px]"
              style={pjs(500, '15px', 'var(--terra)')}
            >
              Finish later
            </button>
          </div>
        )}

        {/* ═══ SCREEN 3 — BUSINESS PROFILE (logo + Instagram only) ═══ */}
        {screen === 3 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1 style={pjs(800, '26px', 'var(--ink)', { letterSpacing: '-0.03em' })}>
                Polish your profile
              </h1>
              <p style={pjs(400, '15px', 'var(--ink-60)', { marginTop: '6px', marginBottom: '28px' })}>Add a logo and Instagram so creators can find you</p>

              {/* Logo upload */}
              <div className="flex flex-col items-center mb-[24px]">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="relative"
                  disabled={logoUploading}
                >
                  <div
                    className="w-[80px] h-[80px] rounded-[18px] flex items-center justify-center overflow-hidden"
                    style={{ background: logoUrl ? undefined : getCategorySolidColor(profile.category || 'Food & Drink') }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span style={pjs(800, '32px', 'rgba(255,255,255,0.8)')}>
                        {getInitials(profile.name || 'B')}
                      </span>
                    )}
                  </div>
                  <div
                    className="absolute -bottom-[4px] -right-[4px] w-[24px] h-[24px] rounded-full flex items-center justify-center"
                    style={{ background: 'var(--terra)' }}
                  >
                    <DoodleIcon name="camera" size={12} className="text-white" />
                  </div>
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <p style={pjs(400, '14px', 'var(--ink-35)', { marginTop: '10px', textAlign: 'center' })}>
                  {logoUploading ? 'Uploading...' : 'Add your logo or a photo of your business'}
                </p>
              </div>

              {/* Instagram */}
              <div>
                <label style={pjs(600, '13px', 'var(--ink-60)', { display: 'block', marginBottom: '6px' })}>Instagram handle</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={e => setInstagram(e.target.value)}
                  placeholder="@yourbusiness"
                  className="w-full focus:outline-none"
                  style={{
                    ...pjs(400, '15px', 'var(--ink)'),
                    background: 'var(--card)',
                    border: '1.5px solid var(--ink-08)',
                    borderRadius: '14px',
                    padding: '14px 16px',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--terra)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--terra-ring)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ink-08)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <p style={pjs(400, '14px', 'var(--ink-35)', { marginTop: '4px' })}>Optional — add later if you prefer</p>
              </div>
            </div>

            <div className="flex-1 min-h-[24px]" />

            <button
              onClick={goForward}
              className="w-full min-h-[52px] text-white transition-all"
              style={{ ...pjs(700, '15px', 'white'), background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
            >
              Looking good →
            </button>
            <button
              onClick={handleFinishLater}
              className="w-full text-center mt-[8px] py-[8px]"
              style={pjs(500, '15px', 'var(--terra)')}
            >
              Finish later
            </button>
          </div>
        )}

        {/* ═══ SCREEN 4 — CREATE YOUR OFFER ═══ */}
        {screen === 4 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1 style={pjs(800, '26px', 'var(--ink)', { letterSpacing: '-0.03em' })}>
                Create your offer
              </h1>
              <p style={pjs(400, '15px', 'var(--ink-60)', { marginTop: '6px', marginBottom: '24px' })}>This is what you'll give creators in exchange for a reel</p>

              {/* DECISION 1 — Offer type tiles */}
              <div className="grid grid-cols-2 gap-[10px]">
                {offerTiles.map(t => (
                  <button
                    key={t.key}
                    onClick={() => {
                      setOfferType(t.key);
                      setOfferItem('');
                      setDiscountAmount('20');
                      setDiscountUnit('%');
                    }}
                    className="flex flex-col items-center justify-center gap-[8px] min-h-[100px] transition-all"
                    style={{
                      padding: '20px 16px',
                      borderRadius: '16px',
                      border: offerType === t.key ? '2px solid var(--terra)' : '2px solid var(--ink-08)',
                      background: offerType === t.key ? 'var(--terra-5)' : 'var(--card)',
                    }}
                  >
                    <DoodleIcon name={t.icon} size={24} className="text-[var(--ink)]" />
                    <div className="text-center">
                      <p style={pjs(700, '16px', 'var(--ink)')}>{t.label}</p>
                      <p style={pjs(400, '13px', 'var(--ink-60)', { marginTop: '2px' })}>{t.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Fill-in field — appears after type selection */}
              {offerType && offerType !== 'discount' && (
                <div className="mt-[20px]">
                  <div className="flex items-baseline gap-[8px] mb-[4px]">
                    <span style={pjs(800, '24px', 'var(--ink)')}>Free</span>
                    <input
                      type="text"
                      value={offerItem}
                      onChange={e => setOfferItem(e.target.value.slice(0, 60))}
                      placeholder={getCategoryPlaceholder(profile.category, offerType)}
                      className="flex-1 bg-transparent outline-none"
                      style={{ ...pjs(800, '24px', 'var(--ink)'), borderBottom: '2px solid var(--terra)' }}
                      autoFocus
                    />
                  </div>
                  <p style={pjs(400, '13px', 'var(--ink-35)', { textAlign: 'right' })}>{offerItem.length}/60</p>
                  <p style={pjs(400, '15px', 'var(--ink-60)', { marginTop: '4px' })}>
                    Creators will see: <span style={{ fontWeight: 600 }}>Free {offerItem || getCategoryPlaceholder(profile.category, offerType)}</span>
                  </p>
                </div>
              )}

              {/* Discount fill-in */}
              {offerType === 'discount' && (
                <div className="mt-[20px]">
                  <div className="flex justify-center mb-[12px]">
                    <input
                      type="number"
                      value={discountAmount}
                      onChange={e => {
                        const max = discountUnit === '%' ? 100 : 999;
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= max)) {
                          setDiscountAmount(val);
                        }
                      }}
                      className="bg-transparent outline-none text-center"
                      style={{ ...pjs(800, '44px', 'var(--ink)'), width: '100px', borderBottom: '2px solid var(--terra)' }}
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-center gap-[8px] mb-[8px]">
                    <button
                      onClick={() => { setDiscountUnit('%'); if (parseInt(discountAmount) > 100) setDiscountAmount('100'); }}
                      className="px-[20px] py-[8px] transition-all"
                      style={{ ...pjs(700, '18px', discountUnit === '%' ? 'white' : 'var(--ink-60)'), background: discountUnit === '%' ? 'var(--ink)' : 'var(--card)', borderRadius: '999px' }}
                    >%</button>
                    <button
                      onClick={() => setDiscountUnit('£')}
                      className="px-[20px] py-[8px] transition-all"
                      style={{ ...pjs(700, '18px', discountUnit === '£' ? 'white' : 'var(--ink-60)'), background: discountUnit === '£' ? 'var(--ink)' : 'var(--card)', borderRadius: '999px' }}
                    >£</button>
                  </div>
                  <p style={pjs(400, '15px', 'var(--ink-60)', { textAlign: 'center' })}>
                    Creators will see: <span style={{ fontWeight: 600 }}>{discountAmount}{discountUnit} off</span>
                  </p>
                </div>
              )}

              {/* DECISION 2 — Monthly creators */}
              {offerType && (
                <div className="mt-[24px]">
                  <label style={pjs(600, '13px', 'var(--ink-60)', { display: 'block', marginBottom: '12px' })}>Monthly creators</label>

                  {!hasCap ? (
                    <div className="text-center">
                      <p style={pjs(700, '17px', 'var(--ink)')}>Unlimited</p>
                      <p style={pjs(400, '14px', 'var(--ink-35)', { marginTop: '4px' })}>Accept as many creators as you like each month</p>
                      <button
                        onClick={() => setHasCap(true)}
                        className="mt-[12px]"
                        style={pjs(600, '15px', 'var(--terra)')}
                      >
                        Set a monthly cap instead
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-[24px]">
                        <button
                          onClick={() => setMonthlySlots(Math.max(1, monthlySlots - 1))}
                          className="w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all"
                          style={{ background: 'var(--card)', border: '1.5px solid var(--ink-08)' }}
                        >
                          <DoodleIcon name="minus" size={18} className="text-[var(--ink-60)]" />
                        </button>
                        <span style={pjs(800, '28px', 'var(--ink)', { minWidth: '48px', textAlign: 'center', display: 'inline-block' })}>
                          {monthlySlots}
                        </span>
                        <button
                          onClick={() => setMonthlySlots(Math.min(20, monthlySlots + 1))}
                          className="w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all"
                          style={{ background: 'var(--terra)' }}
                        >
                          <DoodleIcon name="plus" size={18} className="text-white" />
                        </button>
                      </div>
                      <p style={pjs(400, '14px', 'var(--ink-35)', { textAlign: 'center', marginTop: '8px' })}>
                        {monthlySlots} creator{monthlySlots === 1 ? '' : 's'} per month
                      </p>
                      <button
                        onClick={() => setHasCap(false)}
                        className="block mx-auto mt-[8px]"
                        style={pjs(600, '15px', 'var(--terra)')}
                      >
                        Remove cap
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 min-h-[24px]" />

            {error && (
              <p style={pjs(500, '15px', 'var(--terra)', { textAlign: 'center', marginBottom: '12px' })}>{error}</p>
            )}

            <button
              onClick={handleLaunch}
              disabled={saving || !offerType || (offerType !== 'discount' && offerItem.trim().length < 3) || (offerType === 'discount' && !discountAmount)}
              className="w-full min-h-[52px] transition-all"
              style={{
                ...pjs(700, '15px', (!saving && offerType && (offerType === 'discount' ? discountAmount : offerItem.trim().length >= 3)) ? 'white' : 'var(--ink-35)'),
                background: (!saving && offerType && (offerType === 'discount' ? discountAmount : offerItem.trim().length >= 3))
                  ? 'var(--terra)' : 'var(--card)',
                borderRadius: '999px',
                padding: '13px 24px',
              }}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : 'Launch my campaign →'}
            </button>
            <button
              onClick={handleFinishLater}
              className="w-full text-center mt-[8px] py-[8px]"
              style={pjs(500, '15px', 'var(--terra)')}
            >
              Finish later
            </button>
          </div>
        )}

        {/* ═══ SCREEN 5 — SUCCESS ═══ */}
        {screen === 5 && (
          <div className="flex-1 flex flex-col items-center justify-center">
            {/* Expanding rings animation */}
            <div className="relative w-[60px] h-[60px] mb-[8px]">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--terra)', animation: 'ringExpand1 1.2s ease-out forwards' }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--peach)', animation: 'ringExpand2 1.2s ease-out 0.3s forwards', opacity: 0 }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: '#C8B8F0', animation: 'ringExpand3 1.2s ease-out 0.6s forwards', opacity: 0 }}
              />
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <DoodleIcon name="check" size={48} className="text-[var(--terra)]" />
              </div>
            </div>

            <h1 style={pjs(800, '36px', 'var(--ink)', { textAlign: 'center', marginTop: '28px', letterSpacing: '-0.03em' })}>
              You're live.
            </h1>

            <p style={pjs(400, '15px', 'var(--ink-60)', { textAlign: 'center', marginTop: '12px', maxWidth: '280px', lineHeight: '1.65' })}>
              Your offer for {generatedTitle} is now live on nayba.
              {' '}Creators in {town} can discover and claim it right now.
            </p>

            {/* Offer summary card */}
            <div
              className="mt-[24px] w-full max-w-[260px] flex items-center gap-[12px]"
              style={{ background: 'var(--card)', border: '1px solid var(--ink-08)', borderRadius: '16px', padding: '16px' }}
            >
              <div
                className="w-[40px] h-[40px] rounded-[8px] flex items-center justify-center flex-shrink-0"
                style={{ background: getCategorySolidColor(profile.category) }}
              >
                <CategoryIcon category={profile.category} className="w-[18px] h-[18px] text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={pjs(700, '18px', 'var(--ink)')}>{generatedTitle}</p>
                <p style={pjs(500, '14px', 'var(--ink-60)')}>{hasCap ? `${monthlySlots} creator${monthlySlots === 1 ? '' : 's'} per month` : 'Unlimited creators'}</p>
              </div>
              <span
                className="inline-flex items-center gap-[4px] flex-shrink-0"
                style={{ ...pjs(700, '12px', 'var(--terra)'), background: 'var(--terra-10)', borderRadius: '999px', padding: '3px 8px' }}
              >
                <span className="w-[5px] h-[5px] rounded-full animate-pulse" style={{ background: 'var(--terra)' }} />
                Live
              </span>
            </div>

            <div className="flex-1 min-h-[24px]" />

            <button
              onClick={onComplete}
              className="w-full min-h-[52px] text-white transition-all"
              style={{ ...pjs(700, '15px', 'white'), background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
            >
              Go to my dashboard →
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}?ref=${profile.slug || profile.id}`);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              style={pjs(500, '14px', 'var(--ink-35)', { textAlign: 'center', marginTop: '10px', padding: '8px' })}
            >
              {linkCopied ? 'Link copied ✓' : 'Share nayba with another local business'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
