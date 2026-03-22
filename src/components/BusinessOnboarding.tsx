import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Camera, Gift, Sparkles, Tag, Star, Minus, Plus, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/upload';
import { CategoryIcon, getCategoryGradient } from '../lib/categories';
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
    setScreen(s => s - 1);
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
    // Try to get the town/city — usually 2nd or 3rd part
    if (parts.length >= 3) return parts[parts.length - 2];
    if (parts.length >= 2) return parts[1];
    return parts[0];
  })();

  const totalScreens = 4; // progress dots for screens 1-4 (screen 5 is success, no dots)
  const animClass = direction === 'forward' ? 'slideInRight' : 'slideInLeft';

  const offerTiles = [
    { key: 'product', label: 'Free Product', icon: Gift, sub: 'Coffee, meal, item' },
    { key: 'service', label: 'Free Service', icon: Sparkles, sub: 'Haircut, facial, class' },
    { key: 'discount', label: 'Discount', icon: Tag, sub: '% off or £ off' },
    { key: 'experience', label: 'Experience', icon: Star, sub: 'Tasting, tour, event' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#F7F4F0] flex flex-col">
      <style>{onboardingStyles}</style>

      {/* ─── Top bar ─── */}
      {screen <= totalScreens && (
        <div className="flex items-center justify-between px-[20px] pt-[16px] pb-[8px] flex-shrink-0">
          {screen > 1 ? (
            <button onClick={goBack} className="w-[40px] h-[40px] flex items-center justify-center -ml-[8px]">
              <ChevronLeft className="w-[20px] h-[20px] text-[var(--soft)]" />
            </button>
          ) : (
            <div className="w-[40px]" />
          )}
          <Logo variant="icon" size={32} color="var(--forest)" />
          {screen === 3 ? (
            <button onClick={goForward} className="text-[13px] text-[var(--soft)] font-medium w-[40px] text-right">Skip</button>
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
                background: dot === screen ? 'var(--terra)' : dot < screen ? 'var(--terra)' : 'var(--faint)',
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
                <Logo variant="icon" size={120} color="var(--forest)" />
              </div>

              <h1
                className="text-[28px] font-display font-normal text-[var(--near-black)] text-center"
                style={{ letterSpacing: '-0.5px' }}
              >
                Welcome to nayba
              </h1>
              <p
                className="text-[16px] text-[var(--mid)] text-center mt-[12px] max-w-[280px] mx-auto"
                style={{ fontWeight: 400, lineHeight: 1.6 }}
              >
                Turn local creators into your marketing&nbsp;team — no&nbsp;budget&nbsp;required.
              </p>
            </div>

            <div className="flex-1" />

            <button
              onClick={goForward}
              className="w-full py-[16px] rounded-[50px] text-white text-[15px] font-bold min-h-[52px] transition-all"
              style={{ background: 'var(--terra)', boxShadow: '0 4px 16px rgba(222,78,12,0.25)' }}
            >
              Let's get started →
            </button>
            <p className="text-[12px] text-[var(--soft)] text-center mt-[10px]">Takes about 3 minutes</p>
            <button
              onClick={handleFinishLater}
              className="w-full text-center mt-[8px] py-[8px] text-[14px] text-[var(--soft)]"
              style={{ fontWeight: 400 }}
            >
              Finish later
            </button>
          </div>
        )}

        {/* ═══ SCREEN 2 — THE CONCEPT ═══ */}
        {screen === 2 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1
                className="text-[24px] font-display font-normal text-[var(--near-black)]"
                style={{ letterSpacing: '-0.4px' }}
              >
                Here's how it works
              </h1>
              <p className="text-[15px] text-[var(--mid)] mt-[6px]">Creators visit. They post. You grow.</p>

              <div className="flex flex-col gap-[20px] mt-[28px]">
                {[
                  { num: 1, bg: 'var(--terra)', title: 'You create an offer', desc: 'Choose what you\'ll give away \u2014 a free coffee, a haircut, whatever feels right.' },
                  { num: 2, bg: 'var(--forest)', title: 'Creators visit your business', desc: 'Local creators claim your offer, visit in person, and experience what you do.' },
                  { num: 3, bg: 'var(--near-black)', title: 'They post a reel about you', desc: 'Within 48 hours they post an Instagram reel. Real content. Real people. Real reach.' },
                ].map(step => (
                  <div key={step.num} className="flex items-start gap-[16px]">
                    <div
                      className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: step.bg }}
                    >
                      <span className="text-[15px] font-bold text-white">{step.num}</span>
                    </div>
                    <div className="flex-1 pt-[2px]">
                      <p className="text-[15px] font-bold text-[var(--near-black)]" style={{ marginBottom: 3 }}>{step.title}</p>
                      <p className="text-[13px] text-[var(--mid)]" style={{ lineHeight: 1.6 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            <button
              onClick={goForward}
              className="w-full py-[16px] rounded-[50px] text-white text-[15px] font-bold min-h-[52px] transition-all"
              style={{ background: 'var(--terra)', boxShadow: '0 4px 16px rgba(222,78,12,0.25)' }}
            >
              Sounds good →
            </button>
            <button
              onClick={handleFinishLater}
              className="w-full text-center mt-[8px] py-[8px] text-[14px] text-[var(--soft)]"
              style={{ fontWeight: 400 }}
            >
              Finish later
            </button>
          </div>
        )}

        {/* ═══ SCREEN 3 — BUSINESS PROFILE (logo + Instagram only; name & category already collected at signup) ═══ */}
        {screen === 3 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1
                className="text-[24px] font-display font-normal text-[var(--near-black)]"
                style={{ letterSpacing: '-0.4px' }}
              >
                Polish your profile
              </h1>
              <p className="text-[14px] text-[var(--mid)] mt-[6px] mb-[28px]">Add a logo and Instagram so creators can find you</p>

              {/* Logo upload */}
              <div className="flex flex-col items-center mb-[24px]">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="relative"
                  disabled={logoUploading}
                >
                  <div
                    className="w-[80px] h-[80px] rounded-[16px] flex items-center justify-center overflow-hidden"
                    style={{ background: logoUrl ? undefined : getCategoryGradient(profile.category || 'Food & Drink') }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-[28px] font-extrabold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {getInitials(profile.name || 'B')}
                      </span>
                    )}
                  </div>
                  <div
                    className="absolute -bottom-[4px] -right-[4px] w-[24px] h-[24px] rounded-full flex items-center justify-center"
                    style={{ background: 'var(--terra)' }}
                  >
                    <Camera className="w-[12px] h-[12px] text-white" />
                  </div>
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <p className="text-[12px] text-[var(--soft)] mt-[10px] text-center">
                  {logoUploading ? 'Uploading...' : 'Add your logo or a photo of your business'}
                </p>
              </div>

              {/* Instagram */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--near-black)] mb-[6px]">Instagram handle</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={e => setInstagram(e.target.value)}
                  placeholder="@yourbusiness"
                  className="w-full px-[16px] py-[14px] rounded-[12px] bg-[var(--bg)] text-[15px] text-[var(--near-black)] placeholder:text-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)]"
                />
                <p className="text-[12px] text-[var(--soft)] mt-[4px]">Optional — add later if you prefer</p>
              </div>
            </div>

            <div className="flex-1 min-h-[24px]" />

            <button
              onClick={goForward}
              className="w-full py-[16px] rounded-[50px] text-[15px] font-bold min-h-[52px] transition-all"
              style={{
                background: 'var(--terra)',
                color: 'white',
                boxShadow: '0 4px 16px rgba(222,78,12,0.25)',
              }}
            >
              Looking good →
            </button>
            <button
              onClick={handleFinishLater}
              className="w-full text-center mt-[8px] py-[8px] text-[14px] text-[var(--soft)]"
              style={{ fontWeight: 400 }}
            >
              Finish later
            </button>
          </div>
        )}

        {/* ═══ SCREEN 4 — CREATE YOUR OFFER ═══ */}
        {screen === 4 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1
                className="text-[24px] font-display font-normal text-[var(--near-black)]"
                style={{ letterSpacing: '-0.4px' }}
              >
                Create your offer
              </h1>
              <p className="text-[14px] text-[var(--mid)] mt-[6px] mb-[24px]">This is what you'll give creators in exchange for a reel</p>

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
                    className="flex flex-col items-center justify-center gap-[8px] rounded-[16px] min-h-[100px] transition-all"
                    style={{
                      padding: '20px 16px',
                      border: offerType === t.key ? '1.5px solid var(--terra)' : '1.5px solid var(--faint)',
                      background: offerType === t.key ? 'rgba(222,78,12,0.08)' : 'white',
                    }}
                  >
                    <t.icon className="w-[24px] h-[24px] text-[var(--near-black)]" />
                    <div className="text-center">
                      <p className="text-[13px] font-bold text-[var(--near-black)]">{t.label}</p>
                      <p className="text-[11px] text-[var(--mid)] mt-[2px]">{t.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Fill-in field — appears after type selection */}
              {offerType && offerType !== 'discount' && (
                <div className="mt-[20px]">
                  <div className="flex items-baseline gap-[8px] mb-[4px]">
                    <span className="text-[20px] font-display font-normal text-[var(--near-black)]">Free</span>
                    <input
                      type="text"
                      value={offerItem}
                      onChange={e => setOfferItem(e.target.value.slice(0, 60))}
                      placeholder={getCategoryPlaceholder(profile.category, offerType)}
                      className="flex-1 text-[20px] font-display font-normal text-[var(--near-black)] border-b-2 border-[var(--terra)] bg-transparent outline-none placeholder:text-[var(--soft)] placeholder:font-normal"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-[var(--soft)] text-right">{offerItem.length}/60</p>
                  <p className="text-[13px] text-[var(--mid)] mt-[4px]">
                    Creators will see: <span className="font-semibold">Free {offerItem || getCategoryPlaceholder(profile.category, offerType)}</span>
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
                      className="text-[40px] font-display font-normal text-[var(--near-black)] border-b-2 border-[var(--terra)] bg-transparent outline-none text-center"
                      style={{ width: '100px' }}
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-center gap-[8px] mb-[8px]">
                    <button
                      onClick={() => { setDiscountUnit('%'); if (parseInt(discountAmount) > 100) setDiscountAmount('100'); }}
                      className="px-[20px] py-[8px] rounded-[50px] text-[14px] font-bold transition-all"
                      style={{ background: discountUnit === '%' ? 'var(--near-black)' : 'var(--bg)', color: discountUnit === '%' ? 'white' : 'var(--mid)' }}
                    >%</button>
                    <button
                      onClick={() => setDiscountUnit('£')}
                      className="px-[20px] py-[8px] rounded-[50px] text-[14px] font-bold transition-all"
                      style={{ background: discountUnit === '£' ? 'var(--near-black)' : 'var(--bg)', color: discountUnit === '£' ? 'white' : 'var(--mid)' }}
                    >£</button>
                  </div>
                  <p className="text-[13px] text-[var(--mid)] text-center">
                    Creators will see: <span className="font-semibold">{discountAmount}{discountUnit} off</span>
                  </p>
                </div>
              )}

              {/* DECISION 2 — Monthly creators */}
              {offerType && (
                <div className="mt-[24px]">
                  <label className="block text-[11px] font-semibold text-[var(--near-black)] mb-[12px]">Monthly creators</label>

                  {!hasCap ? (
                    <div className="text-center">
                      <p className="text-[15px] font-bold text-[var(--near-black)]">Unlimited</p>
                      <p className="text-[12px] text-[var(--soft)] mt-[4px]">Accept as many creators as you like each month</p>
                      <button
                        onClick={() => setHasCap(true)}
                        className="mt-[12px] text-[13px] font-semibold text-[var(--terra)]"
                      >
                        Set a monthly cap instead
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-[24px]">
                        <button
                          onClick={() => setMonthlySlots(Math.max(1, monthlySlots - 1))}
                          className="w-[48px] h-[48px] rounded-full flex items-center justify-center transition-all"
                          style={{ border: '1.5px solid var(--faint)' }}
                        >
                          <Minus className="w-[18px] h-[18px] text-[var(--mid)]" />
                        </button>
                        <span className="text-[48px] font-display font-normal text-[var(--near-black)]" style={{ minWidth: 48, textAlign: 'center' }}>
                          {monthlySlots}
                        </span>
                        <button
                          onClick={() => setMonthlySlots(Math.min(20, monthlySlots + 1))}
                          className="w-[48px] h-[48px] rounded-full flex items-center justify-center transition-all"
                          style={{ background: 'var(--terra)' }}
                        >
                          <Plus className="w-[18px] h-[18px] text-white" />
                        </button>
                      </div>
                      <p className="text-[12px] text-[var(--soft)] text-center mt-[8px]">
                        {monthlySlots} creator{monthlySlots === 1 ? '' : 's'} per month
                      </p>
                      <button
                        onClick={() => setHasCap(false)}
                        className="block mx-auto mt-[8px] text-[13px] font-semibold text-[var(--terra)]"
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
              <p className="text-[13px] text-[var(--terra)] text-center mb-[12px]">{error}</p>
            )}

            <button
              onClick={handleLaunch}
              disabled={saving || !offerType || (offerType !== 'discount' && offerItem.trim().length < 3) || (offerType === 'discount' && !discountAmount)}
              className="w-full py-[16px] rounded-[50px] text-[15px] font-bold min-h-[52px] transition-all"
              style={{
                background: (!saving && offerType && (offerType === 'discount' ? discountAmount : offerItem.trim().length >= 3))
                  ? 'var(--terra)' : 'var(--bg)',
                color: (!saving && offerType && (offerType === 'discount' ? discountAmount : offerItem.trim().length >= 3))
                  ? 'white' : 'var(--soft)',
                boxShadow: (!saving && offerType && (offerType === 'discount' ? discountAmount : offerItem.trim().length >= 3))
                  ? '0 4px 16px rgba(222,78,12,0.25)' : 'none',
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
              className="w-full text-center mt-[8px] py-[8px] text-[14px] text-[var(--soft)]"
              style={{ fontWeight: 400 }}
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
                style={{ background: 'var(--lavender)', animation: 'ringExpand3 1.2s ease-out 0.6s forwards', opacity: 0 }}
              />
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <CheckCircle className="w-[48px] h-[48px] text-[var(--terra)]" />
              </div>
            </div>

            <h1
              className="text-[32px] font-display font-normal text-[var(--near-black)] text-center mt-[28px]"
              style={{ letterSpacing: '-0.8px' }}
            >
              You're live.
            </h1>

            <p
              className="text-[15px] text-[var(--mid)] text-center mt-[12px] max-w-[280px] mx-auto"
              style={{ fontWeight: 400, lineHeight: 1.7 }}
            >
              Your offer for {generatedTitle} is now live on nayba.
              {' '}Creators in {town} can discover and claim it right now.
            </p>

            {/* Offer summary card */}
            <div
              className="mt-[24px] w-full max-w-[260px] rounded-[20px] p-[16px] flex items-center gap-[12px]"
              style={{ background: 'white', border: '1px solid var(--faint)' }}
            >
              <div
                className="w-[40px] h-[40px] rounded-[8px] flex items-center justify-center flex-shrink-0"
                style={{ background: getCategoryGradient(profile.category) }}
              >
                <CategoryIcon category={profile.category} className="w-[18px] h-[18px] text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-[var(--near-black)] truncate">{generatedTitle}</p>
                <p className="text-[12px] text-[var(--mid)]">{hasCap ? `${monthlySlots} creator${monthlySlots === 1 ? '' : 's'} per month` : 'Unlimited creators'}</p>
              </div>
              <span
                className="inline-flex items-center gap-[4px] px-[8px] py-[3px] rounded-[50px] text-[10px] font-bold flex-shrink-0"
                style={{ background: 'rgba(26,74,46,0.08)', color: 'var(--forest)' }}
              >
                <span className="w-[5px] h-[5px] rounded-full bg-[var(--forest)]" style={{ animation: 'livePulse 2s infinite' }} />
                Live
              </span>
            </div>

            <div className="flex-1 min-h-[24px]" />

            <button
              onClick={onComplete}
              className="w-full py-[16px] rounded-[50px] text-white text-[15px] font-bold min-h-[52px] transition-all"
              style={{ background: 'var(--terra)', boxShadow: '0 4px 16px rgba(222,78,12,0.25)' }}
            >
              Go to my dashboard →
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}?ref=${profile.slug || profile.id}`);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="text-[12px] text-[var(--soft)] text-center mt-[10px] py-[8px]"
            >
              {linkCopied ? 'Link copied \u2713' : 'Share nayba with another local business'}
            </button>
          </div>
        )}
      </div>

      {/* livePulse for the success card badge */}
      <style>{`@keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.75); } }`}</style>
    </div>
  );
}
