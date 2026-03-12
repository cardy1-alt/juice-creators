import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, ExternalLink, Sparkles, Gift, History, Bell, CheckCircle2, Clock, Flag, Map, Search, SlidersHorizontal, LayoutGrid, List } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';
import CreatorOnboarding from './CreatorOnboarding';
import DisputeModal from './DisputeModal';
import DiscoveryMap from './DiscoveryMap';
import { getCategoryEmoji, getCategoryColor, getCategoryIconBg, getCategoryBorderColor } from '../lib/categories';
import { getInitials, getAvatarGradient } from '../lib/avatar';

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!targetDate) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff < 0) {
        setIsOverdue(true);
        setTimeLeft('Overdue');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}m`);
      setIsOverdue(false);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return { timeLeft, isOverdue };
}

interface Offer {
  id: string;
  business_id: string;
  description: string;
  monthly_cap: number | null;
  slotsUsed?: number;
  businesses: { name: string; category: string };
}

interface Claim {
  id: string;
  status: string;
  qr_token: string;
  qr_expires_at: string;
  claimed_at: string;
  redeemed_at: string | null;
  reel_url: string | null;
  reel_due_at: string | null;
  offer_id: string;
  business_id: string;
  offers: { description: string };
  businesses: { name: string; category: string };
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
    overdue: 'bg-orange-50 text-orange-600 border border-orange-100',
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
  const [view, setView] = useState<'offers' | 'map' | 'active' | 'history' | 'notifications'>('offers');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [reelUrl, setReelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [collabsCompleted, setCollabsCompleted] = useState(0);
  const [disputeClaimId, setDisputeClaimId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'slots' | 'name'>('newest');
  const [viewMode, setViewMode] = useState<'card' | 'compact'>('card');
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releasingClaim, setReleasingClaim] = useState(false);
  const [reelError, setReelError] = useState<string | null>(null);

  const { timeLeft, isOverdue } = useCountdown(selectedClaim?.reel_due_at || null);

  useEffect(() => {
    if (userProfile?.approved && !userProfile.onboarding_complete) {
      setShowOnboarding(true);
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile?.approved) {
      fetchOffers();
      fetchClaims();
      fetchNotifications();
      fetchCollabsCompleted();
    }
  }, [userProfile]);

  const fetchCollabsCompleted = async () => {
    const { count } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', userProfile.id)
      .not('reel_url', 'is', null);
    setCollabsCompleted(count || 0);
  };

  // Realtime subscriptions for claims and notifications
  useEffect(() => {
    if (!userProfile?.approved) return;

    const channel = supabase
      .channel('creator-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims', filter: `creator_id=eq.${userProfile.id}` },
        () => { fetchClaims(); fetchOffers(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userProfile.id}` },
        () => { fetchNotifications(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
    const { data, error } = await supabase
      .from('offers')
      .select('*, businesses(name, category)')
      .eq('is_live', true);

    if (error) {
      console.error('Error fetching offers:', error);
      return;
    }

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
    const { data, error } = await supabase
      .from('claims')
      .select('*, offers(description), businesses(name, category)')
      .eq('creator_id', userProfile.id)
      .order('claimed_at', { ascending: false });

    if (error) {
      console.error('Error fetching claims:', error);
      return;
    }

    if (data) {
      setClaims(data as Claim[]);
      const active = (data as Claim[]).filter(c => c.status === 'active' || (c.status === 'redeemed' && !c.reel_url));
      setActiveClaims(active);
      if (selectedClaim && !active.find(c => c.id === selectedClaim.id)) {
        setSelectedClaim(active[0] || null);
      } else if (!selectedClaim && active.length > 0) {
        setSelectedClaim(active[0]);
      }
    }
  };

  const handleClaim = async (offer: Offer) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('claim_offer', {
        p_offer_id: offer.id,
        p_creator_id: userProfile.id,
      });

      if (error) throw error;
      if (data?.error) {
        alert(data.error);
        return;
      }

      setView('active');
      fetchOffers();
      fetchClaims();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimOffer = async (offerId: string) => {
    const offer = offers.find(o => o.id === offerId);
    if (offer) {
      await handleClaim(offer);
    }
  };

  const handleSubmitReel = async () => {
    if (!reelUrl || !selectedClaim) return;
    setReelError(null);

    const instagramPattern = /^https:\/\/(www\.)?instagram\.com\//i;
    if (!instagramPattern.test(reelUrl)) {
      setReelError('Please enter a valid Instagram reel URL (https://instagram.com/reel/...)');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({ reel_url: reelUrl })
        .eq('id', selectedClaim.id);
      if (error) throw error;
      setReelUrl('');
      setReelError(null);
      fetchClaims();
    } catch (error: any) {
      setReelError(error.message || 'Failed to submit reel');
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseOffer = async () => {
    if (!selectedClaim) return;
    setReleasingClaim(true);
    setReleaseError(null);
    try {
      const { data, error } = await supabase.rpc('unclaim_offer', {
        p_claim_id: selectedClaim.id,
        p_creator_id: userProfile.id,
      });

      if (error) throw error;
      if (data?.error) {
        setReleaseError(data.error);
        return;
      }

      setReleaseModalOpen(false);
      fetchOffers();
      fetchClaims();
    } catch (error: any) {
      setReleaseError(error.message || 'Failed to release offer');
    } finally {
      setReleasingClaim(false);
    }
  };

  const canReleaseOffer = (claim: Claim) => {
    if (claim.status !== 'active') return { allowed: false, reason: null };
    const claimedTime = new Date(claim.claimed_at).getTime();
    const now = new Date().getTime();
    const hoursSinceClaim = (now - claimedTime) / (1000 * 60 * 60);
    if (hoursSinceClaim > 24) {
      return { allowed: false, reason: 'Release window expired' };
    }
    return { allowed: true, reason: null };
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

  const getActiveUrgency = () => {
    if (activeClaims.length === 0) return 'none';

    const now = new Date().getTime();
    const hasOverdue = activeClaims.some(claim => {
      if (!claim.reel_due_at || claim.reel_url) return false;
      return new Date(claim.reel_due_at).getTime() < now;
    });

    if (hasOverdue) return 'overdue';

    const hasSoon = activeClaims.some(claim => {
      if (!claim.reel_due_at || claim.reel_url) return false;
      const hoursLeft = (new Date(claim.reel_due_at).getTime() - now) / (1000 * 60 * 60);
      return hoursLeft <= 12;
    });

    if (hasSoon) return 'soon';
    return 'normal';
  };

  const activeUrgency = getActiveUrgency();
  const activeBadgeColor = activeUrgency === 'overdue'
    ? 'bg-rose-500'
    : activeUrgency === 'soon'
    ? 'bg-amber-500'
    : 'bg-[#5b3df5]';

  const tabs = [
    { key: 'offers' as const, label: 'Offers', icon: Gift },
    { key: 'map' as const, label: 'Map', icon: Map },
    { key: 'active' as const, label: 'Active', icon: Sparkles, badge: activeClaims.length || undefined, badgeColor: activeBadgeColor },
    { key: 'history' as const, label: 'History', icon: History },
    { key: 'notifications' as const, label: 'Alerts', icon: Bell, badge: unreadCount || undefined },
  ];

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      {showOnboarding && (
        <CreatorOnboarding
          creatorId={userProfile.id}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
      {disputeClaimId && (
        <DisputeModal
          claimId={disputeClaimId}
          reporterRole="creator"
          onClose={() => setDisputeClaimId(null)}
        />
      )}
      {releaseModalOpen && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-[#1a1025] mb-2">Release this offer?</h3>
            <p className="text-sm text-gray-600 mb-4">
              The slot goes back to the pool. You won't be able to claim this offer again.
            </p>
            {releaseError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200">
                <p className="text-sm text-rose-700">{releaseError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setReleaseModalOpen(false);
                  setReleaseError(null);
                }}
                disabled={releasingClaim}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Keep it
              </button>
              <button
                onClick={handleReleaseOffer}
                disabled={releasingClaim}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-40"
              >
                {releasingClaim ? 'Releasing...' : 'Release'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(userProfile.name)} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                {getInitials(userProfile.name)}
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-[#1a1025]">{userProfile.name}</h1>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">{userProfile.instagram_handle}</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1a1025] text-white">
                    {userProfile.code}
                  </span>
                  {collabsCompleted > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white">
                      {collabsCompleted} collab{collabsCompleted !== 1 ? 's' : ''}
                    </span>
                  )}
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
                  <span className={`absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${
                    tab.badgeColor || 'bg-[#5b3df5]'
                  }`}>
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
              {/* Search and Controls */}
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm mb-3 space-y-3">
                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search businesses..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/20 focus:border-[#5b3df5]"
                  />
                </div>

                {/* Controls row */}
                <div className="flex items-center justify-between gap-2">
                  {/* Sort dropdown */}
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'newest' | 'slots' | 'name')}
                      className="text-xs font-semibold text-gray-600 bg-transparent border-none focus:outline-none cursor-pointer"
                    >
                      <option value="newest">Newest</option>
                      <option value="slots">Most Available</option>
                      <option value="name">A-Z</option>
                    </select>
                  </div>

                  {/* View toggle */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode('card')}
                      className={`p-1.5 rounded transition-colors ${
                        viewMode === 'card' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('compact')}
                      className={`p-1.5 rounded transition-colors ${
                        viewMode === 'compact' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Category Filter */}
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm mb-3 relative">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedCategory === 'all'
                        ? 'bg-[#5b3df5] text-white'
                        : 'border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    All
                  </button>
                  {Array.from(new Set(offers.map(o => o.businesses.category))).map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        selectedCategory === category
                          ? 'bg-[#5b3df5] text-white'
                          : 'border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span>{getCategoryEmoji(category)}</span>
                      <span>{category}</span>
                    </button>
                  ))}
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none" />
              </div>

              {(() => {
                const filteredOffers = offers
                  .filter(o => {
                    const matchesCategory = selectedCategory === 'all' || o.businesses.category === selectedCategory;
                    const matchesSearch = searchQuery === '' ||
                      o.businesses.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      o.description.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesCategory && matchesSearch;
                  })
                  .sort((a, b) => {
                    if (sortBy === 'name') {
                      return a.businesses.name.localeCompare(b.businesses.name);
                    } else if (sortBy === 'slots') {
                      const aSlots = a.monthly_cap === null ? Infinity : (a.monthly_cap - (a.slotsUsed || 0));
                      const bSlots = b.monthly_cap === null ? Infinity : (b.monthly_cap - (b.slotsUsed || 0));
                      return bSlots - aSlots;
                    }
                    return 0;
                  });

                if (filteredOffers.length === 0) {
                  return (
                    <div className="text-center py-16">
                      <div className="text-4xl mb-3">🔍</div>
                      <p className="text-gray-400 text-sm">No offers found</p>
                      <button
                        onClick={() => {
                          setSelectedCategory('all');
                          setSearchQuery('');
                        }}
                        className="mt-2 text-[#5b3df5] text-xs font-semibold hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Results count */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <p className="text-xs font-semibold text-gray-500">
                        {filteredOffers.length} offer{filteredOffers.length !== 1 ? 's' : ''} available
                      </p>
                    </div>

                    <div className={viewMode === 'card' ? 'space-y-3' : 'space-y-2'}>
                      {filteredOffers
                  .map((offer) => {
                    const emoji = getCategoryEmoji(offer.businesses.category);
                    const isUnlimited = offer.monthly_cap === null;
                    const slotsUsed = offer.slotsUsed || 0;
                    const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                    const pct = isUnlimited ? 0 : Math.min((slotsUsed / (offer.monthly_cap as number)) * 100, 100);
                    const full = !isUnlimited && pct >= 100;
                    const alreadyClaimed = claims.some(c => c.offer_id === offer.id && c.status !== 'expired');
                    const hasActiveBusiness = activeClaims.some(c => c.business_id === offer.business_id);

                    // Progress bar color logic
                    let barColor = 'bg-emerald-500';
                    if (pct >= 76) {
                      barColor = 'bg-red-500';
                    } else if (pct >= 51) {
                      barColor = 'bg-amber-500';
                    }

                    if (viewMode === 'compact') {
                      return (
                        <div
                          key={offer.id}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${getCategoryIconBg(offer.businesses.category)} border ${getCategoryBorderColor(offer.businesses.category)} flex items-center justify-center text-lg flex-shrink-0`}>
                              {emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="font-bold text-sm text-[#1a1025] truncate">{offer.businesses.name}</h3>
                                {isUnlimited ? (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-white flex-shrink-0">
                                    Open
                                  </span>
                                ) : full ? (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500 text-white flex-shrink-0">
                                    Full
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex-shrink-0">
                                    {slotsLeft} left
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{offer.description}</p>
                            </div>
                            <div className="flex-shrink-0">
                              {full ? (
                                <button
                                  disabled
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-400 cursor-not-allowed"
                                >
                                  Full
                                </button>
                              ) : alreadyClaimed ? (
                                <button
                                  disabled
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-500 cursor-not-allowed"
                                >
                                  Claimed
                                </button>
                              ) : hasActiveBusiness ? (
                                <button
                                  disabled
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 cursor-not-allowed"
                                >
                                  Active
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleClaim(offer)}
                                  disabled={loading}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40"
                                >
                                  Claim
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={offer.id}
                        className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all text-left relative overflow-hidden group"
                      >
                        {/* Gradient accent */}
                        <div className={`absolute inset-0 opacity-[0.02] ${getCategoryColor(offer.businesses.category)}`} />

                        <div className="relative p-5">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-12 h-12 rounded-xl ${getCategoryIconBg(offer.businesses.category)} border-2 ${getCategoryBorderColor(offer.businesses.category)} flex items-center justify-center text-xl flex-shrink-0 shadow-sm`}>
                                {emoji}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base text-[#1a1025] mb-0.5">{offer.businesses.name}</h3>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${getCategoryColor(offer.businesses.category).replace('bg-', 'bg-opacity-10 bg-')} ${getCategoryColor(offer.businesses.category).replace('bg-', 'text-')}`}>
                                  {offer.businesses.category}
                                </span>
                              </div>
                            </div>

                            {/* Status badge */}
                            <div className="flex-shrink-0">
                              {isUnlimited ? (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 text-white shadow-sm">
                                  Open
                                </span>
                              ) : full ? (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500 text-white shadow-sm">
                                  Full
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">
                                  {slotsLeft} left
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Offer description */}
                          <p className="text-sm text-gray-600 leading-relaxed mb-4">
                            {offer.description}
                          </p>

                          {/* Availability section */}
                          <div className="space-y-3">
                            {isUnlimited ? (
                              <div className="pb-1">
                                <span className="text-xs font-medium text-gray-400">Unlimited slots</span>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-medium text-gray-500">Availability</span>
                                  <span className="text-xs font-bold text-gray-700">
                                    {slotsUsed}/{offer.monthly_cap}
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                  <div
                                    className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Action button */}
                            <div className="pt-1">
                              {full ? (
                                <button
                                  disabled
                                  className="w-full px-4 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-400 cursor-not-allowed"
                                >
                                  Sold Out
                                </button>
                              ) : alreadyClaimed ? (
                                <button
                                  disabled
                                  className="w-full px-4 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-500 cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Already Claimed
                                </button>
                              ) : hasActiveBusiness ? (
                                <button
                                  disabled
                                  className="w-full px-4 py-3 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 border-2 border-amber-200 cursor-not-allowed"
                                >
                                  Complete Active Pass First
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleClaim(offer)}
                                  disabled={loading}
                                  className="w-full px-4 py-3 rounded-xl text-sm font-bold transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 shadow-sm hover:shadow-md active:scale-[0.98]"
                                >
                                  {isUnlimited ? 'Claim Offer' : 'Claim Now'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {/* ── MAP ── */}
          {view === 'map' && (
            <DiscoveryMap
              businesses={offers.map(offer => ({
                id: offer.business_id,
                name: offer.businesses.name,
                category: offer.businesses.category,
                latitude: offer.businesses.latitude || 0,
                longitude: offer.businesses.longitude || 0,
                address: offer.businesses.address || '',
                offers: [{
                  id: offer.id,
                  description: offer.description,
                  reward_value: offer.reward_value,
                  monthly_cap: offer.monthly_cap,
                  slotsUsed: offer.slotsUsed
                }]
              })).reduce((acc, curr) => {
                const existing = acc.find(b => b.id === curr.id);
                if (existing) {
                  existing.offers.push(...curr.offers);
                } else {
                  acc.push(curr);
                }
                return acc;
              }, [] as Array<{
                id: string;
                name: string;
                category: string;
                latitude: number;
                longitude: number;
                address: string;
                offers: Array<{
                  id: string;
                  description: string;
                  reward_value: string;
                  monthly_cap: number | null;
                  slotsUsed?: number;
                }>;
              }>)}
              onClaimOffer={handleClaimOffer}
              userLocation={userLocation}
            />
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
                    <div className="relative">
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                        {activeClaims.map(claim => {
                          const emoji = getCategoryEmoji(claim.businesses.category);
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
                              <span className="max-w-[140px] truncate">{claim.businesses.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none" />
                    </div>
                  )}

                  {selectedClaim && (
                    <>
                      {(() => {
                        const currentStage = selectedClaim.reel_url
                          ? 'submitted'
                          : selectedClaim.redeemed_at
                          ? 'reel_due'
                          : 'claimed';

                        const stages = [
                          { key: 'claimed', label: 'Claimed', active: currentStage === 'claimed' },
                          { key: 'visited', label: 'Visited', active: currentStage === 'reel_due' || currentStage === 'submitted' },
                          { key: 'reel_due', label: 'Reel Due', active: currentStage === 'reel_due' },
                          { key: 'submitted', label: 'Submitted', active: currentStage === 'submitted' }
                        ];

                        return (
                      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm shadow-black/[0.03]">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50 flex items-center justify-center text-xl flex-shrink-0">
                            {getCategoryEmoji(selectedClaim.businesses.category)}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-[15px] text-[#1a1025]">{selectedClaim.businesses.name}</h3>
                            <p className="text-gray-500 text-[13px] mt-0.5">{selectedClaim.offers.description}</p>
                          </div>
                        </div>

                        {/* Status Rail */}
                        <div className="mb-5 bg-gray-50/80 rounded-xl p-4">
                          <div className="relative">
                            <div className="grid grid-cols-4">
                              {stages.map((stage, idx) => (
                                <div key={stage.key} className="flex flex-col items-center">
                                  <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    stage.active
                                      ? 'bg-[#5b3df5] text-white'
                                      : stages.findIndex(s => s.active) > idx
                                      ? 'bg-emerald-400 text-white'
                                      : 'bg-gray-200 text-gray-400'
                                  }`}>
                                    {stages.findIndex(s => s.active) > idx ? '✓' : idx + 1}
                                  </div>
                                  <p className={`text-[9px] font-semibold mt-1.5 text-center px-1 ${stage.active ? 'text-[#1a1025]' : 'text-gray-400'}`}>
                                    {stage.label}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {/* Connecting lines */}
                            <div className="absolute top-[13px] left-0 right-0 flex items-center px-[12.5%]">
                              {[0, 1, 2].map((idx) => (
                                <div
                                  key={idx}
                                  className={`h-0.5 flex-1 ${
                                    stages.findIndex(s => s.active) > idx ? 'bg-emerald-400' : 'bg-gray-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Reel Countdown/Prompt */}
                        {selectedClaim.redeemed_at && !selectedClaim.reel_url && (
                          <div className={`mb-5 p-4 rounded-xl border ${
                            isOverdue
                              ? 'bg-rose-50/60 border-rose-200'
                              : 'bg-amber-50/60 border-amber-200'
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className={`w-4 h-4 ${isOverdue ? 'text-rose-500' : 'text-amber-500'}`} />
                              <p className={`text-sm font-bold ${isOverdue ? 'text-rose-700' : 'text-amber-700'}`}>
                                {isOverdue ? 'Overdue!' : `${timeLeft} remaining`}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600">
                              You have 48 hours to post your reel — it must genuinely feature the business.
                            </p>
                          </div>
                        )}

                        {selectedClaim.status === 'active' && (
                          <QRCodeDisplay
                            token={selectedClaim.qr_token}
                            claimId={selectedClaim.id}
                            creatorCode={userProfile.code}
                          />
                        )}

                        {selectedClaim.status === 'redeemed' && !selectedClaim.reel_url && (
                          <div className="mt-5 p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                            <label className="block text-sm font-semibold text-[#1a1025] mb-2">
                              🎬 Submit Your Reel
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={reelUrl}
                                onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
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
                            {reelError && (
                              <p className="text-xs text-rose-600 mt-2">{reelError}</p>
                            )}
                          </div>
                        )}

                        {selectedClaim.reel_url && (
                          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="text-sm text-emerald-700 font-medium">Reel submitted!</span>
                          </div>
                        )}

                        <div className="mt-3 flex flex-col items-center gap-1">
                          <button
                            onClick={() => setDisputeClaimId(selectedClaim.id)}
                            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-amber-600 transition-colors"
                          >
                            <Flag className="w-3 h-3" /> Report an issue
                          </button>
                          {(() => {
                            const releaseStatus = canReleaseOffer(selectedClaim);
                            if (releaseStatus.allowed) {
                              return (
                                <button
                                  onClick={() => setReleaseModalOpen(true)}
                                  className="text-xs text-gray-400 hover:text-rose-500 transition-colors"
                                >
                                  Release offer
                                </button>
                              );
                            } else if (releaseStatus.reason) {
                              return (
                                <span className="text-xs text-gray-300">
                                  {releaseStatus.reason}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                        );
                      })()}
                    </>
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
                      {getCategoryEmoji(claim.businesses.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-[13px] text-[#1a1025]">{claim.businesses.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5 leading-[1.4]" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word'
                          }}>{claim.offers.description}</p>
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
