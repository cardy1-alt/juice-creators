import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, ExternalLink, Sparkles, Gift, History, Bell, CheckCircle2 } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';

// Deterministic emoji avatar from business name
const BUSINESS_EMOJIS = ['🍊', '🥤', '🧃', '🍋', '🫐', '🥑', '🍇', '🍓', '🥭', '🍍', '🥝', '🍉', '🫒', '🌶️', '🍑', '🥥'];
function getBusinessEmoji(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return BUSINESS_EMOJIS[Math.abs(hash) % BUSINESS_EMOJIS.length];
}

interface Offer {
  id: string;
  business_id: string;
  description: string;
  monthly_cap: number;
  slotsUsed?: number;
  businesses: { name: string };
}

interface Claim {
  id: string;
  status: string;
  qr_token: string;
  qr_expires_at: string;
  claimed_at: string;
  redeemed_at: string | null;
  reel_url: string | null;
  offer_id: string;
  business_id: string;
  offers: { description: string };
  businesses: { name: string };
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-sky-50 text-sky-600 border border-sky-100',
    redeemed: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    expired: 'bg-rose-50 text-rose-500 border border-rose-100',
  };
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${styles[status] || 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
      {status}
    </span>
  );
}

export default function CreatorApp() {
  const { userProfile, signOut } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activeClaims, setActiveClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'offers' | 'active' | 'history' | 'notifications'>('offers');
  const [reelUrl, setReelUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userProfile?.approved) {
      fetchOffers();
      fetchClaims();
      fetchNotifications();
    }
  }, [userProfile]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    fetchNotifications();
  };

  const fetchOffers = async () => {
    const { data } = await supabase
      .from('offers')
      .select('*, businesses(name)')
      .eq('is_live', true);

    if (data) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const offersWithSlots = await Promise.all(
        data.map(async (offer) => {
          const { count } = await supabase
            .from('claims')
            .select('*', { count: 'exact', head: true })
            .eq('offer_id', offer.id)
            .eq('month', currentMonth);
          return { ...offer, slotsUsed: count || 0 };
        })
      );
      setOffers(offersWithSlots as Offer[]);
    }
  };

  const fetchClaims = async () => {
    const { data } = await supabase
      .from('claims')
      .select('*, offers(description), businesses(name)')
      .eq('creator_id', userProfile.id)
      .order('claimed_at', { ascending: false });

    if (data) {
      setClaims(data as Claim[]);
      const active = (data as Claim[]).filter(c => c.status === 'active');
      setActiveClaims(active);
      if (selectedClaim && !active.find(c => c.id === selectedClaim.id)) {
        setSelectedClaim(active[0] || null);
      } else if (!selectedClaim && active.length > 0) {
        setSelectedClaim(active[0]);
      }
    }
  };

  const handleClaim = async (offer: Offer) => {
    // Block: same business already has an active claim
    const existingForBusiness = activeClaims.find(c => c.business_id === offer.business_id);
    if (existingForBusiness) {
      alert('You already have an active claim with this business.');
      return;
    }

    // Block: same offer already claimed (non-expired)
    const existingClaim = claims.find(c => c.offer_id === offer.id && c.status !== 'expired');
    if (existingClaim) {
      alert('You already have a claim on this offer.');
      return;
    }

    setLoading(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const qrToken = crypto.randomUUID() + '-' + crypto.randomUUID();
      const qrExpiresAt = new Date(Date.now() + 30000).toISOString();

      const { data, error } = await supabase
        .from('claims')
        .insert({
          creator_id: userProfile.id,
          offer_id: offer.id,
          business_id: offer.business_id,
          status: 'active',
          qr_token: qrToken,
          qr_expires_at: qrExpiresAt,
          month: currentMonth
        })
        .select('*, offers(description), businesses(name)')
        .single();

      if (error) throw error;

      setSelectedClaim(data as Claim);
      setView('active');
      fetchOffers();
      fetchClaims();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReel = async () => {
    if (!reelUrl || !selectedClaim) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({ reel_url: reelUrl })
        .eq('id', selectedClaim.id);
      if (error) throw error;
      setReelUrl('');
      fetchClaims();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!userProfile?.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#faf8ff] to-[#f0eaff]">
        <div className="bg-white rounded-2xl shadow-xl shadow-black/5 p-8 max-w-sm text-center border border-gray-100">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-xl font-bold mb-2 text-[#1a1025]">Pending Approval</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your creator account is under review. You'll be notified once approved!
          </p>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium bg-[#1a1025] hover:bg-[#2d1f45] transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'offers' as const, label: 'Offers', icon: Gift },
    { key: 'active' as const, label: 'Active', icon: Sparkles, badge: activeClaims.length || undefined },
    { key: 'history' as const, label: 'History', icon: History },
    { key: 'notifications' as const, label: 'Alerts', icon: Bell, badge: unreadCount || undefined },
  ];

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5b3df5] to-[#8b6cf7] flex items-center justify-center text-white font-bold text-sm">
                {userProfile.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-[#1a1025]">{userProfile.name}</h1>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">{userProfile.instagram_handle}</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1a1025] text-white">
                    {userProfile.code}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={signOut} className="p-2 rounded-xl hover:bg-gray-50 transition-colors">
              <LogOut className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-white border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-all relative ${
                view === tab.key ? 'text-[#1a1025]' : 'text-gray-400'
              }`}
            >
              <div className="relative">
                <tab.icon className="w-[18px] h-[18px]" />
                {tab.badge ? (
                  <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#5b3df5] text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && (
                <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#1a1025] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 pb-8">

          {/* ── OFFERS ── */}
          {view === 'offers' && (
            <>
              {offers.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🍊</div>
                  <p className="text-gray-400 text-sm">No offers available right now</p>
                  <p className="text-gray-300 text-xs mt-1">Check back soon!</p>
                </div>
              )}
              {offers.map((offer) => {
                const emoji = getBusinessEmoji(offer.businesses.name);
                const pct = Math.min(((offer.slotsUsed || 0) / offer.monthly_cap) * 100, 100);
                const full = pct >= 100;
                const alreadyClaimed = claims.some(c => c.offer_id === offer.id && c.status !== 'expired');
                const hasActiveBusiness = activeClaims.some(c => c.business_id === offer.business_id);

                return (
                  <div key={offer.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm shadow-black/[0.03]">
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50 flex items-center justify-center text-xl flex-shrink-0">
                        {emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[15px] text-[#1a1025]">{offer.businesses.name}</h3>
                        <p className="text-gray-500 text-[13px] mt-0.5 leading-snug">{offer.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${full ? 'bg-rose-400' : 'bg-emerald-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-medium ${full ? 'text-rose-400' : 'text-gray-400'}`}>
                          {offer.slotsUsed}/{offer.monthly_cap}
                        </span>
                      </div>
                      <button
                        onClick={() => handleClaim(offer)}
                        disabled={loading || full || alreadyClaimed || hasActiveBusiness}
                        className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                          alreadyClaimed
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                            : 'bg-[#1a1025] text-white hover:bg-[#2d1f45] disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        {alreadyClaimed ? 'Claimed' : 'Claim'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ── ACTIVE PASSES ── */}
          {view === 'active' && (
            <>
              {activeClaims.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">✨</div>
                  <p className="text-gray-500 text-sm font-medium">No active passes</p>
                  <button
                    onClick={() => setView('offers')}
                    className="mt-3 text-[#5b3df5] text-sm font-semibold hover:underline"
                  >
                    Browse offers →
                  </button>
                </div>
              ) : (
                <>
                  {/* Pass selector (when multiple active) */}
                  {activeClaims.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {activeClaims.map(claim => {
                        const emoji = getBusinessEmoji(claim.businesses.name);
                        const isSelected = selectedClaim?.id === claim.id;
                        return (
                          <button
                            key={claim.id}
                            onClick={() => setSelectedClaim(claim)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border ${
                              isSelected
                                ? 'bg-[#1a1025] text-white border-[#1a1025]'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-base">{emoji}</span>
                            {claim.businesses.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedClaim && (
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm shadow-black/[0.03]">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50 flex items-center justify-center text-xl flex-shrink-0">
                          {getBusinessEmoji(selectedClaim.businesses.name)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-[15px] text-[#1a1025]">{selectedClaim.businesses.name}</h3>
                          <p className="text-gray-500 text-[13px] mt-0.5">{selectedClaim.offers.description}</p>
                        </div>
                        <StatusPill status="active" />
                      </div>

                      <QRCodeDisplay
                        token={selectedClaim.qr_token}
                        claimId={selectedClaim.id}
                        creatorCode={userProfile.code}
                      />

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100/50 text-center">
                          <p className="text-[11px] text-sky-500 font-medium">Visit within</p>
                          <p className="text-sm font-bold text-[#1a1025]">7 days</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100/50 text-center">
                          <p className="text-[11px] text-amber-500 font-medium">Post within</p>
                          <p className="text-sm font-bold text-[#1a1025]">48 hours</p>
                        </div>
                      </div>

                      {selectedClaim.redeemed_at && !selectedClaim.reel_url && (
                        <div className="mt-5 p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                          <label className="block text-sm font-semibold text-[#1a1025] mb-2">
                            🎬 Submit Your Reel
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={reelUrl}
                              onChange={(e) => setReelUrl(e.target.value)}
                              placeholder="https://instagram.com/reel/..."
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
                            />
                            <button
                              onClick={handleSubmitReel}
                              disabled={loading || !reelUrl}
                              className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 transition-all"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedClaim.reel_url && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-sm text-emerald-700 font-medium">Reel submitted!</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── HISTORY ── */}
          {view === 'history' && (
            <>
              {claims.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-gray-400 text-sm">No claims yet. Grab an offer to get started!</p>
                </div>
              )}
              {claims.map((claim) => (
                <div key={claim.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm shadow-black/[0.03]">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50 flex items-center justify-center text-base flex-shrink-0">
                      {getBusinessEmoji(claim.businesses.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[13px] text-[#1a1025]">{claim.businesses.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{claim.offers.description}</p>
                        </div>
                        <StatusPill status={claim.status} />
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
                        <span className="text-[11px] text-gray-400">
                          {new Date(claim.claimed_at).toLocaleDateString()}
                        </span>
                        {claim.reel_url && (
                          <a
                            href={claim.reel_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] font-semibold text-[#5b3df5] hover:underline"
                          >
                            View Reel <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── NOTIFICATIONS ── */}
          {view === 'notifications' && (
            <>
              {notifications.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🔔</div>
                  <p className="text-gray-400 text-sm">No notifications yet</p>
                </div>
              )}
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => !notif.read && markNotificationRead(notif.id)}
                  className={`w-full text-left bg-white rounded-2xl p-4 border transition-all ${
                    notif.read
                      ? 'border-gray-100 opacity-50'
                      : 'border-sky-200 bg-sky-50/30 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-gray-300' : 'bg-sky-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1a1025]">{notif.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {new Date(notif.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
