import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Camera, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/upload';
import { getInitials } from '../lib/avatar';
import { Logo } from './Logo';

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

interface CreatorOnboardingProps {
  profile: any;
  onComplete: () => void;
}

export default function CreatorOnboarding({ profile, onComplete }: CreatorOnboardingProps) {
  const [screen, setScreen] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [animKey, setAnimKey] = useState(0);

  // Screen 3 state
  const [displayName, setDisplayName] = useState(profile.display_name || profile.name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Stats for success screen
  const [businessCount, setBusinessCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      const { count: bCount } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('approved', true);
      const { count: oCount } = await supabase
        .from('offers')
        .select('*', { count: 'exact', head: true })
        .eq('is_live', true);
      setBusinessCount(bCount || 0);
      setOfferCount(oCount || 0);
    };
    fetchStats();
  }, []);

  const goForward = () => {
    setDirection('forward');
    setAnimKey(k => k + 1);
    setScreen(s => s + 1);
  };

  const goBack = () => {
    setDirection('back');
    setAnimKey(k => k + 1);
    setScreen(s => s - 1);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const { url, error } = await uploadAvatar(file, profile.id, 'creators');
    if (url) setAvatarUrl(url);
    if (error) console.error('Avatar upload failed:', error);
    setAvatarUploading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await supabase.from('creators').update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        onboarding_complete: true,
      }).eq('id', profile.id);
      if (updateError) throw updateError;

      goForward(); // go to screen 4 (success)
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const totalScreens = 3; // progress dots for screens 1-3 (screen 4 is success)
  const animClass = direction === 'forward' ? 'slideInRight' : 'slideInLeft';

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
          <span className="text-[18px] font-display font-normal text-[var(--forest)]" style={{ letterSpacing: '-0.3px' }}>nayba</span>
          {screen === 3 ? (
            <button onClick={() => { supabase.from('creators').update({ onboarding_complete: true }).eq('id', profile.id).then(() => onComplete()).catch((err: any) => console.error('[Onboarding] Skip failed:', err)); }} className="text-[13px] text-[var(--soft)] font-medium w-[40px] text-right">Skip</button>
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
                Discover local businesses, claim&nbsp;offers, and create authentic&nbsp;content.
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
            <p className="text-[12px] text-[var(--soft)] text-center mt-[10px]">Takes about 1 minute</p>
          </div>
        )}

        {/* ═══ SCREEN 2 — HOW IT WORKS ═══ */}
        {screen === 2 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1
                className="text-[24px] font-display font-normal text-[var(--near-black)]"
                style={{ letterSpacing: '-0.4px' }}
              >
                Here's how it works
              </h1>
              <p className="text-[15px] text-[var(--mid)] mt-[6px]">Claim. Visit. Post. Get rewarded.</p>

              <div className="flex flex-col gap-[20px] mt-[28px]">
                {[
                  { num: 1, bg: 'var(--terra)', title: 'Browse & claim an offer', desc: 'Find local businesses offering free products, services, or discounts in exchange for a reel.' },
                  { num: 2, bg: 'var(--forest)', title: 'Visit the business', desc: 'Show your QR pass at the door, enjoy the experience, and soak in the vibes.' },
                  { num: 3, bg: 'var(--near-black)', title: 'Post your reel', desc: 'You have 48 hours to post an authentic Instagram reel featuring the business. That\'s it!' },
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
              Got it →
            </button>
          </div>
        )}

        {/* ═══ SCREEN 3 — COMPLETE YOUR PROFILE ═══ */}
        {screen === 3 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1
                className="text-[24px] font-display font-normal text-[var(--near-black)]"
                style={{ letterSpacing: '-0.4px' }}
              >
                Complete your profile
              </h1>
              <p className="text-[14px] text-[var(--mid)] mt-[6px] mb-[28px]">Businesses will see this when you claim their offers</p>

              {/* Avatar upload */}
              <div className="flex flex-col items-center mb-[24px]">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative"
                  disabled={avatarUploading}
                >
                  <div
                    className="w-[80px] h-[80px] rounded-full flex items-center justify-center overflow-hidden"
                    style={{ background: avatarUrl ? undefined : 'linear-gradient(135deg, #DE4E0C 0%, #E8956D 100%)' }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[28px] font-extrabold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {getInitials(displayName || profile.name || 'C')}
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
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <p className="text-[12px] text-[var(--soft)] mt-[10px] text-center">
                  {avatarUploading ? 'Uploading...' : 'Add a profile photo'}
                </p>
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-[14px]">
                {/* Display name */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--near-black)] mb-[6px]">Display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="How you want to be known"
                    className="w-full px-[16px] py-[14px] rounded-[12px] bg-[var(--bg)] text-[15px] text-[var(--near-black)] placeholder:text-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)]"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--near-black)] mb-[6px]">Bio</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value.slice(0, 150))}
                    placeholder="Tell businesses a little about yourself..."
                    rows={3}
                    className="w-full px-[16px] py-[14px] rounded-[12px] bg-[var(--bg)] text-[15px] text-[var(--near-black)] placeholder:text-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] resize-none"
                  />
                  <p className="text-[11px] text-[var(--soft)] text-right mt-[2px]">{bio.length}/150</p>
                </div>

                {/* Instagram (read-only, already collected at signup) */}
                {profile.instagram_handle && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--near-black)] mb-[6px]">Instagram</label>
                    <div className="px-[16px] py-[14px] rounded-[12px] bg-[var(--bg)] text-[15px] text-[var(--mid)]">
                      {profile.instagram_handle}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-[24px]" />

            {error && (
              <p className="text-[13px] text-[var(--terra)] text-center mb-[12px]">{error}</p>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full py-[16px] rounded-[50px] text-white text-[15px] font-bold min-h-[52px] transition-all"
              style={{ background: 'var(--terra)', boxShadow: '0 4px 16px rgba(222,78,12,0.25)' }}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : 'Looking good →'}
            </button>
          </div>
        )}

        {/* ═══ SCREEN 4 — SUCCESS ═══ */}
        {screen === 4 && (
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
              You're in.
            </h1>

            <p
              className="text-[15px] text-[var(--mid)] text-center mt-[12px] max-w-[280px] mx-auto"
              style={{ fontWeight: 400, lineHeight: 1.7 }}
            >
              {businessCount} local businesses with {offerCount} live offers are waiting for you to explore.
            </p>

            {/* Stats cards */}
            <div className="flex gap-[12px] mt-[24px]">
              <div className="rounded-[16px] p-[16px_20px] text-center min-w-[100px]" style={{ background: 'var(--bg)' }}>
                <p className="text-[28px] font-display font-normal text-[var(--near-black)]">{businessCount}</p>
                <p className="text-[10px] font-medium text-[var(--mid)]">Businesses</p>
              </div>
              <div className="rounded-[16px] p-[16px_20px] text-center min-w-[100px]" style={{ background: 'var(--bg)' }}>
                <p className="text-[28px] font-display font-normal text-[var(--near-black)]">{offerCount}</p>
                <p className="text-[10px] font-medium text-[var(--mid)]">Live Offers</p>
              </div>
            </div>

            <div className="flex-1 min-h-[24px]" />

            <button
              onClick={onComplete}
              className="w-full py-[16px] rounded-[50px] text-white text-[15px] font-bold min-h-[52px] transition-all"
              style={{ background: 'var(--terra)', boxShadow: '0 4px 16px rgba(222,78,12,0.25)' }}
            >
              Start exploring →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
