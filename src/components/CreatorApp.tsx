import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Clock, ExternalLink, Sparkles, Gift, History, Bell, CheckCircle2 } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';

interface Offer {
  id: string;
  business_id: string;
  description: string;
  monthly_cap: number;
  slotsUsed?: number;
  businesses: {
    name: string;
  };
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
  offers: {
    description: string;
  };
  businesses: {
    id: string;
    name: string;
  };
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function CreatorApp() {
  const { userProfile, signOut } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activeClaim, setActiveClaim] = useState<Claim | null>(null);
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
      .select('*, offers(description), businesses(name, id)')
      .eq('creator_id', userProfile.id)
      .order('claimed_at', { ascending: false });

    if (data) {
      setClaims(data as Claim[]);
      // Keep activeClaim for backward compatibility, but we'll show all active claims in the view
      const active = data.find((c: any) => c.status === 'active');
      if (active) {
        setActiveClaim(active as Claim);
      } else {
        setActiveClaim(null);
      }
    }
  };

  const handleClaim = async (offer: Offer) => {
    // Count active claims for this specific business
    const activeClaimsForBusiness = claims.filter(
      c => c.status === 'active' && c.businesses.id === offer.business_id
    );

    if (activeClaimsForBusiness.length >= 2) {
      alert('You already have 2 active claims with this business. Please redeem or wait for them to expire.');
      return;
    }

    // Check for duplicate claim on same offer
    const existingActiveClaim = claims.find(
      c => c.offer_id === offer.id && c.status === 'active'
    );
    if (existingActiveClaim) {
      alert('You already have an active claim on this offer.');
      return;
    }

    setLoading(true);
    try {
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

      setActiveClaim(data as Claim);
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
    if (!reelUrl || !activeClaim) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({ reel_url: reelUrl })
        .eq('id', activeClaim.id);

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
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#f0eaff] via-[#e8e0f5] to-[#f5f0ff]">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm text-center border border-gray-100">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
            <Clock className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-[#1a1025]">
            Pending Approval
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Your creator account is under review. You'll be notified once approved!
          </p>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium bg-[#5b3df5] hover:bg-[#4e35d4] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const activeClaimCount = claims.filter(c => c.status === 'active').length;

  const tabs = [
    { key: 'offers' as const, label: 'Offers', icon: Gift },
    { key: 'active' as const, label: 'Active', icon: Sparkles, badge: activeClaimCount > 0 ? activeClaimCount : undefined },
    { key: 'history' as const, label: 'History', icon: History },
    { key: 'notifications' as const, label: 'Alerts', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0eaff] via-[#f5f0ff] to-[#e8e0f5]">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-lg border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#1a1025]">
                {userProfile.name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{userProfile.instagram_handle}</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#f0eaff] text-[#5b3df5]">
                  {userProfile.code}
                </span>
              </div>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-white/80 backdrop-blur-lg border-b border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-all relative ${
                view === tab.key ? 'text-[#5b3df5]' : 'text-gray-400'
              }`}
            >
              <div className="relative">
                <tab.icon className="w-5 h-5" />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#5b3df5] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 pb-8">
          {/* Available Offers */}
          {view === 'offers' && (
            <>
              {offers.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No offers available right now. Check back soon!
                </div>
              )}
              {offers.map((offer) => (
                <div key={offer.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-[#1a1025]">{offer.businesses.name}</h3>
                      <p className="text-gray-500 text-sm mt-1">{offer.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#5b3df5] rounded-full transition-all"
                          style={{ width: `${Math.min(((offer.slotsUsed || 0) / offer.monthly_cap) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {offer.slotsUsed}/{offer.monthly_cap}
                      </span>
                    </div>
                    <button
                      onClick={() => handleClaim(offer)}
                      disabled={loading || (offer.slotsUsed || 0) >= offer.monthly_cap}
                      className="px-5 py-2 rounded-xl text-white text-sm font-semibold bg-[#5b3df5] hover:bg-[#4e35d4] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      Claim
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Active Passes */}
          {view === 'active' && (
            <>
              {claims.filter(c => c.status === 'active').length > 0 ? (
                <>
                  {claims.filter(c => c.status === 'active').map((claim) => (
                    <div key={claim.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-[#1a1025]">{claim.businesses.name}</h3>
                          <p className="text-gray-500 text-sm mt-0.5">{claim.offers.description}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-[11px] font-semibold">
                          Active
                        </span>
                      </div>

                      <QRCodeDisplay
                        token={claim.qr_token}
                        claimId={claim.id}
                        creatorCode={userProfile.code}
                      />

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-xl bg-[#f8f5ff] text-center">
                          <p className="text-[11px] text-gray-500">Visit within</p>
                          <p className="text-sm font-bold text-[#1a1025]">7 days</p>
                        </div>
                        <div className="p-3 rounded-xl bg-[#f8f5ff] text-center">
                          <p className="text-[11px] text-gray-500">Post within</p>
                          <p className="text-sm font-bold text-[#1a1025]">48 hours</p>
                        </div>
                      </div>

                      {claim.redeemed_at && !claim.reel_url && (
                        <div className="mt-5 p-4 rounded-xl bg-[#f8f5ff] border border-[#e8e0f5]">
                          <label className="block text-sm font-semibold text-[#1a1025] mb-2">
                            Submit Your Reel
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={reelUrl}
                              onChange={(e) => setReelUrl(e.target.value)}
                              placeholder="https://instagram.com/reel/..."
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5]"
                            />
                            <button
                              onClick={() => {
                                const claimId = claim.id;
                                if (!reelUrl) return;
                                setLoading(true);
                                supabase
                                  .from('claims')
                                  .update({ reel_url: reelUrl })
                                  .eq('id', claimId)
                                  .then(() => {
                                    setReelUrl('');
                                    fetchClaims();
                                  })
                                  .catch((error: any) => alert(error.message))
                                  .finally(() => setLoading(false));
                              }}
                              disabled={loading || !reelUrl}
                              className="px-4 py-2 rounded-lg text-white text-sm font-semibold bg-[#5b3df5] hover:bg-[#4e35d4] disabled:opacity-40 transition-all"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      )}

                      {claim.reel_url && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-green-700 font-medium">Reel submitted</span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#f0eaff] mb-4">
                    <Sparkles className="w-7 h-7 text-[#5b3df5]" />
                  </div>
                  <p className="text-gray-500 text-sm">No active passes right now.</p>
                  <button
                    onClick={() => setView('offers')}
                    className="mt-3 text-[#5b3df5] text-sm font-semibold hover:underline"
                  >
                    Browse offers
                  </button>
                </div>
              )}
            </>
          )}

          {/* History */}
          {view === 'history' && (
            <>
              {claims.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No claims yet. Grab an offer to get started!
                </div>
              )}
              {claims.map((claim) => (
                <div key={claim.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#1a1025] text-sm">{claim.businesses.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{claim.offers.description}</p>
                    </div>
                    <span
                      className={`ml-2 flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full font-semibold ${
                        claim.status === 'redeemed'
                          ? 'bg-green-50 text-green-600'
                          : claim.status === 'expired'
                          ? 'bg-red-50 text-red-500'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {claim.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
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
              ))}
            </>
          )}

          {/* Notifications */}
          {view === 'notifications' && (
            <>
              {notifications.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No notifications yet.
                </div>
              )}
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => !notif.read && markNotificationRead(notif.id)}
                  className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border transition-all ${
                    notif.read ? 'border-gray-100 opacity-60' : 'border-[#5b3df5]/20 bg-[#faf8ff]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-gray-300' : 'bg-[#5b3df5]'}`} />
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
