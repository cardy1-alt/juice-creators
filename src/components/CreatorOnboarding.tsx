import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Camera, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../lib/upload';
import { friendlyError } from '../lib/errors';
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

  // Screen 2 state
  const [displayName, setDisplayName] = useState(profile.display_name || profile.name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [town, setTown] = useState(profile.address || '');
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
        address: town || null,
        onboarding_complete: true,
      }).eq('id', profile.id);
      if (updateError) throw updateError;

      goForward(); // go to screen 3 (success)
    } catch (err: any) {
      setError(friendlyError(err.message));
    } finally {
      setSaving(false);
    }
  };

  const totalScreens = 2; // progress dots for screens 1-2 (screen 3 is success)
  const animClass = direction === 'forward' ? 'slideInRight' : 'slideInLeft';

  // Step-specific background colours
  const getScreenBg = (s: number) => {
    if (s === 1) return 'var(--peach)';
    return 'var(--shell)';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: getScreenBg(screen) }}>
      <style>{onboardingStyles}</style>

      {/* ─── Top bar ─── */}
      {screen <= totalScreens && (
        <div className="flex items-center justify-between px-[20px] pt-[16px] pb-[8px] flex-shrink-0">
          {screen > 1 ? (
            <button onClick={goBack} className="w-[40px] h-[40px] flex items-center justify-center -ml-[8px]">
              <ChevronLeft size={20} strokeWidth={1.5} className="text-[var(--ink-35)]" />
            </button>
          ) : (
            <div className="w-[40px]" />
          )}
          <Logo variant="wordmark" size={22} />
          {screen === 2 ? (
            <button onClick={() => { supabase.from('creators').update({ onboarding_complete: true }).eq('id', profile.id).then(() => onComplete()).catch((err: any) => console.error('[Onboarding] Skip failed:', err)); }} className="w-[40px] text-right" style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: '15px', fontWeight: 500, color: 'var(--ink-35)' }}>Skip</button>
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
        {/* ═══ SCREEN 1 — HOW IT WORKS ═══ */}
        {screen === 1 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1 style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '26px', color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                Here's how it works
              </h1>
              <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '15px', color: 'var(--ink-60)', marginTop: '6px' }}>Claim. Visit. Post. Get rewarded.</p>

              <div className="flex flex-col gap-[20px] mt-[28px]">
                {[
                  { num: 1, bg: 'var(--terra)', title: 'Browse & claim a collab', desc: 'Find local businesses offering free products, services, or discounts in exchange for a reel.' },
                  { num: 2, bg: 'var(--ink)', title: 'Visit the business', desc: 'Show your QR pass at the door, enjoy the experience, and soak in the vibes.' },
                  { num: 3, bg: 'var(--ink)', title: 'Post your reel', desc: 'You have 48 hours to post an authentic Instagram reel featuring the business. That\'s it!' },
                ].map(step => (
                  <div key={step.num} className="flex items-start gap-[16px]">
                    <div
                      className="w-[40px] h-[40px] rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: step.bg }}
                    >
                      <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '17px', color: 'white' }}>{step.num}</span>
                    </div>
                    <div className="flex-1 pt-[2px]">
                      <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '17px', color: 'var(--ink)', marginBottom: '3px' }}>{step.title}</p>
                      <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '15px', color: 'var(--ink-60)', lineHeight: 1.65 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            <button
              onClick={goForward}
              className="w-full min-h-[52px] text-white transition-all"
              style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '15px', background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
            >
              Got it →
            </button>
          </div>
        )}

        {/* ═══ SCREEN 2 — COMPLETE YOUR PROFILE ═══ */}
        {screen === 2 && (
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 pt-[24px]">
              <h1 style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '26px', color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                Complete your profile
              </h1>
              <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '15px', color: 'var(--ink-60)', marginTop: '6px', marginBottom: '28px' }}>Businesses will see this when you claim their collabs</p>

              {/* Avatar upload */}
              <div className="flex flex-col items-center mb-[24px]">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative"
                  disabled={avatarUploading}
                >
                  <div
                    className="w-[80px] h-[80px] rounded-full flex items-center justify-center overflow-hidden"
                    style={{ background: avatarUrl ? undefined : 'var(--terra)' }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '32px', color: 'rgba(255,255,255,0.8)' }}>
                        {getInitials(displayName || profile.name || 'C')}
                      </span>
                    )}
                  </div>
                  <div
                    className="absolute -bottom-[4px] -right-[4px] w-[24px] h-[24px] rounded-full flex items-center justify-center"
                    style={{ background: 'var(--terra)' }}
                  >
                    <Camera size={12} strokeWidth={1.5} className="text-white" />
                  </div>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '14px', color: 'var(--ink-35)', marginTop: '10px', textAlign: 'center' }}>
                  {avatarUploading ? 'Uploading...' : 'Add a profile photo'}
                </p>
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-[14px]">
                {/* Display name */}
                <div>
                  <label style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '13px', color: 'var(--ink-60)', display: 'block', marginBottom: '6px' }}>Display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="How you want to be known"
                    className="w-full focus:outline-none"
                    style={{
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontWeight: 400,
                      fontSize: '15px',
                      color: 'var(--ink)',
                      background: 'var(--card)',
                      border: '1.5px solid var(--ink-08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--terra)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--terra-ring)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ink-08)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* Bio */}
                <div>
                  <label style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '13px', color: 'var(--ink-60)', display: 'block', marginBottom: '6px' }}>Bio</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value.slice(0, 150))}
                    placeholder="Tell businesses a little about yourself..."
                    rows={3}
                    className="w-full resize-none focus:outline-none"
                    style={{
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontWeight: 400,
                      fontSize: '15px',
                      color: 'var(--ink)',
                      background: 'var(--card)',
                      border: '1.5px solid var(--ink-08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--terra)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--terra-ring)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ink-08)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                  <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '13px', color: 'var(--ink-35)', textAlign: 'right', marginTop: '2px' }}>{bio.length}/150</p>
                </div>

                {/* Your town */}
                <div>
                  <label style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '13px', color: 'var(--ink-60)', display: 'block', marginBottom: '6px' }}>Your town</label>
                  <select
                    value={town}
                    onChange={e => setTown(e.target.value)}
                    className="w-full focus:outline-none appearance-none"
                    style={{
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontWeight: 400,
                      fontSize: '15px',
                      color: town ? 'var(--ink)' : 'var(--ink-35)',
                      background: 'var(--card)',
                      border: '1.5px solid var(--ink-08)',
                      borderRadius: '14px',
                      padding: '14px 16px',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--terra)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--terra-ring)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ink-08)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <option value="" disabled>Select your town</option>
                    <option value="Bury St Edmunds">Bury St Edmunds</option>
                    <option value="Ipswich" disabled>Ipswich — coming soon</option>
                    <option value="Norwich" disabled>Norwich — coming soon</option>
                    <option value="Cambridge" disabled>Cambridge — coming soon</option>
                  </select>
                </div>

                {/* Instagram (read-only, already collected at signup) */}
                {profile.instagram_handle && (
                  <div>
                    <label style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '13px', color: 'var(--ink-60)', display: 'block', marginBottom: '6px' }}>Instagram</label>
                    <div style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '15px', color: 'var(--ink-60)', background: 'var(--card)', border: '1.5px solid var(--ink-08)', borderRadius: '14px', padding: '14px 16px' }}>
                      {profile.instagram_handle}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-[24px]" />

            {error && (
              <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500, fontSize: '15px', color: 'var(--terra)', textAlign: 'center', marginBottom: '12px' }}>{error}</p>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full min-h-[52px] text-white transition-all"
              style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '15px', background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </span>
              ) : 'Looking good →'}
            </button>
          </div>
        )}

        {/* ═══ SCREEN 3 — SUCCESS ═══ */}
        {screen === 3 && (
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
                <Check size={48} strokeWidth={1.5} className="text-[var(--terra)]" />
              </div>
            </div>

            <h1 style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '36px', color: 'var(--ink)', textAlign: 'center', marginTop: '28px', letterSpacing: '-0.03em' }}>
              You're in.
            </h1>

            <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400, fontSize: '15px', color: 'var(--ink-60)', textAlign: 'center', marginTop: '12px', maxWidth: '280px', lineHeight: 1.65 }}>
              {businessCount} local businesses with {offerCount} live collabs are waiting for you to explore.
            </p>

            {/* Stats cards */}
            <div className="flex gap-[12px] mt-[24px]">
              <div className="text-center min-w-[100px]" style={{ background: 'var(--card)', borderRadius: '16px', border: '1px solid var(--ink-08)', padding: '16px 20px' }}>
                <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '32px', color: 'var(--ink)' }}>{businessCount}</p>
                <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500, fontSize: '12px', color: 'var(--ink-60)' }}>Businesses</p>
              </div>
              <div className="text-center min-w-[100px]" style={{ background: 'var(--card)', borderRadius: '16px', border: '1px solid var(--ink-08)', padding: '16px 20px' }}>
                <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, fontSize: '32px', color: 'var(--ink)' }}>{offerCount}</p>
                <p style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500, fontSize: '12px', color: 'var(--ink-60)' }}>Live Collabs</p>
              </div>
            </div>

            <div className="flex-1 min-h-[24px]" />

            <button
              onClick={onComplete}
              className="w-full min-h-[52px] text-white transition-all"
              style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: '15px', background: 'var(--terra)', borderRadius: '999px', padding: '13px 24px' }}
            >
              Start exploring →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
