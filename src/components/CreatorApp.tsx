import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, Heart, Zap, MessageCircle, SlidersHorizontal, Home, Coffee, Sparkles, LayoutGrid, ChevronRight, ChevronLeft, Clock, Bell, Check, LogOut, ExternalLink, Flag } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';
import CreatorOnboarding from './CreatorOnboarding';
import DisputeModal from './DisputeModal';
import DiscoveryMap from './DiscoveryMap';
import { getCategoryIconName, getCategoryColor, getCategoryIconBg, getCategoryBorderColor, CategoryIcon } from '../lib/categories';
import { getInitials, getAvatarGradient } from '../lib/avatar';
import { Logo } from './Logo';

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
    active: 'bg-[#F7F7F7] text-[#222222]',
    claimed: 'bg-[#F7F7F7] text-[#222222]',
    redeemed: 'bg-[#F7F7F7] text-[#222222]',
    visited: 'bg-[#F7F7F7] text-[#222222]',
    reel_due: 'bg-[#C4674A] text-white',
    submitted: 'bg-[#C4674A] text-white',
    expired: 'bg-rose-50 text-rose-500 border border-rose-100',
    overdue: 'bg-orange-50 text-orange-600 border border-orange-100',
  };
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${styles[status] || 'bg-[#F7F7F7] text-[#222222]'}`}>
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
  const [claimError, setClaimError] = useState<string | null>(null);

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
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
      fetchNotifications();
    } catch (err: any) {
      console.error('Failed to mark notification read:', err.message);
    }
  };

  const fetchOffers = async () => {
    const { data, error } = await supabase
      .from('offers')
      .select('*, businesses(name, category, latitude, longitude, address)')
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
    setClaimError(null);
    try {
      const { data, error } = await supabase.rpc('claim_offer', {
        p_offer_id: offer.id,
        p_creator_id: userProfile.id,
      });

      if (error) throw error;
      if (data?.error) {
        setClaimError(data.error);
        return;
      }

      setView('active');
      fetchOffers();
      fetchClaims();
    } catch (error: any) {
      setClaimError(error.message || 'Failed to claim offer');
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
      <div className="min-h-screen flex items-center justify-center px-4 bg-white">
        <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] p-8 max-w-sm text-center">
          <Clock className="w-8 h-8 text-[rgba(34,34,34,0.28)] mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-[#222222]">Pending Approval</h2>
          <p className="text-[rgba(34,34,34,0.5)] text-sm mb-6">
            Your creator account is under review. You'll be notified once approved!
          </p>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-medium bg-[#C4674A] hover:bg-[#b35a3f] transition-colors"
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
    : 'bg-[#C4674A]';

  const foodCategories = ['restaurant', 'cafe', 'bakery', 'bar', 'food truck', 'food', 'coffee', 'juice bar', 'dessert', 'pizza', 'brunch'];
  const beautyCategories = ['salon', 'spa', 'beauty', 'nails', 'hair', 'skincare', 'barbershop', 'wellness'];

  const getCategoryGroup = (category: string) => {
    const lower = category.toLowerCase();
    if (foodCategories.some(c => lower.includes(c))) return 'food';
    if (beautyCategories.some(c => lower.includes(c))) return 'beauty';
    return 'more';
  };

  const categoryTabs = [
    { key: 'all', label: 'All', icon: Home },
    { key: 'food', label: 'Food', icon: Coffee },
    { key: 'beauty', label: 'Beauty', icon: Sparkles },
    { key: 'more', label: 'More', icon: LayoutGrid },
  ];

  const tabs = [
    { key: 'offers' as const, label: 'Explore', icon: Search },
    { key: 'map' as const, label: 'Saved', icon: Heart },
    { key: 'active' as const, label: 'Active', icon: Zap, badge: activeClaims.length || undefined, badgeColor: activeBadgeColor },
    { key: 'history' as const, label: 'Messages', icon: MessageCircle },
    { key: 'notifications' as const, label: 'Profile', icon: null as any },
  ];

  return (
    <div className="min-h-screen bg-white">
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
          <div className="bg-white rounded-[20px] p-6 max-w-sm w-full shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)]">
            <h3 className="text-lg font-bold text-[#222222] mb-2">Release this offer?</h3>
            <p className="text-sm text-[rgba(34,34,34,0.5)] mb-4">
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
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold border-2 border-[rgba(34,34,34,0.1)] text-[#222222] hover:bg-[#F7F7F7] transition-colors disabled:opacity-40"
              >
                Keep it
              </button>
              <button
                onClick={handleReleaseOffer}
                disabled={releasingClaim}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-40"
              >
                {releasingClaim ? 'Releasing...' : 'Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Offer Detail Modal */}
      {expandedOffer && (() => {
        const offer = offers.find(o => o.id === expandedOffer);
        if (!offer) return null;
        const isUnlimited = offer.monthly_cap === null;
        const slotsUsed = offer.slotsUsed || 0;
        const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
        const full = !isUnlimited && slotsLeft === 0;
        const alreadyClaimed = claims.some(c => c.offer_id === offer.id && c.status !== 'expired');
        const hasActiveBusiness = activeClaims.some(c => c.business_id === offer.business_id);

        return (
          <div className="fixed inset-0 z-50 bg-white flex flex-col">
            {/* Hero */}
            <div className="relative h-[200px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2C3A2A, #1A3C34)' }}>
              <div className="w-[64px] h-[64px] rounded-[16px] bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                <span className="text-[rgba(255,255,255,0.8)] text-[28px] font-extrabold">{offer.businesses.name.charAt(0)}</span>
              </div>
              <button
                onClick={() => setExpandedOffer(null)}
                className="absolute top-[16px] left-[16px] w-[36px] h-[36px] rounded-full bg-white flex items-center justify-center shadow-[0_2px_8px_rgba(34,34,34,0.1)]"
              >
                <ChevronLeft className="w-[18px] h-[18px] text-[#222222]" />
              </button>
              <button className="absolute top-[16px] right-[16px] w-[36px] h-[36px] rounded-full bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                <Heart className="w-[16px] h-[16px] text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="p-[20px]">
                <h2 className="text-[20px] font-extrabold text-[#222222] mb-1">{offer.businesses.name}</h2>
                <p className="text-[13px] text-[rgba(34,34,34,0.5)] mb-4">{offer.businesses.category}</p>
                <div className="h-[1px] bg-[rgba(34,34,34,0.1)] mb-4" />

                {/* Offered by row */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2C3A2A, #1A3C34)' }}>
                    <span className="text-[rgba(255,255,255,0.8)] text-[14px] font-bold">{offer.businesses.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#222222]">{offer.businesses.name}</p>
                    <p className="text-[11px] text-[rgba(34,34,34,0.5)]">On nayba since 2024 &middot; &#9733; 4.9</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[13px] text-[rgba(34,34,34,0.5)] leading-[1.6] mb-4">{offer.description}</p>

                {/* Pill row */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {isUnlimited ? (
                    <span className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#F5C4A0] text-[#222222]">Open availability</span>
                  ) : full ? (
                    <span className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#F7F7F7] text-[rgba(34,34,34,0.28)]">Sold out</span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#F5C4A0] text-[#222222]">{slotsLeft} slots left</span>
                  )}
                  <span className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#F7F7F7] text-[rgba(34,34,34,0.5)]">{offer.businesses.category}</span>
                </div>
              </div>
            </div>

            {/* Sticky bottom bar */}
            <div className="border-t border-[rgba(34,34,34,0.1)] bg-white px-[20px] py-[14px] flex items-center justify-between">
              <div>
                <p className="text-[15px] font-extrabold text-[#222222]">Free visit</p>
                <p className="text-[11px] text-[rgba(34,34,34,0.5)]">Post reel within 48hrs</p>
              </div>
              {full ? (
                <button disabled className="px-[22px] py-[12px] rounded-full text-[13px] font-bold bg-[#F7F7F7] text-[rgba(34,34,34,0.28)] cursor-not-allowed">
                  Sold Out
                </button>
              ) : alreadyClaimed ? (
                <button disabled className="px-[22px] py-[12px] rounded-full text-[13px] font-bold bg-[#F7F7F7] text-[rgba(34,34,34,0.28)] cursor-not-allowed flex items-center gap-1">
                  <Check className="w-4 h-4" /> Claimed
                </button>
              ) : hasActiveBusiness ? (
                <button disabled className="px-[22px] py-[12px] rounded-full text-[13px] font-bold bg-amber-50 text-amber-700 border border-amber-200 cursor-not-allowed">
                  Active
                </button>
              ) : (
                <button
                  onClick={() => { handleClaim(offer); setExpandedOffer(null); }}
                  disabled={loading}
                  className="px-[22px] py-[12px] rounded-full text-[13px] font-bold bg-[#C4674A] text-white hover:bg-[#b35a3f] disabled:opacity-40 transition-all"
                >
                  Claim
                </button>
              )}
            </div>
          </div>
        );
      })()}

      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white px-[18px] pt-[20px] pb-[14px] border-b border-[rgba(34,34,34,0.1)]">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[12px] font-semibold text-[#222222]">{userProfile.name}</p>
                <span className="inline-block bg-[#F7F7F7] text-[rgba(34,34,34,0.5)] text-[10px] font-bold rounded-full px-[9px] py-[3px] mt-0.5">
                  {userProfile.code}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pb-28">

          {/* -- OFFERS -- */}
          {view === 'offers' && (
            <>
              {claimError && (
                <div className="mx-[18px] mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                  <p className="text-sm text-rose-700">{claimError}</p>
                  <button onClick={() => setClaimError(null)} className="text-rose-400 hover:text-rose-600 text-xs font-semibold ml-3">Dismiss</button>
                </div>
              )}

              {/* Search bar - Airbnb pill style */}
              <div className="px-[18px] pt-4 pb-3">
                <div
                  className="w-full rounded-full bg-white flex items-center gap-3 px-[16px] py-[12px]"
                  style={{
                    border: '1px solid rgba(34,34,34,0.15)',
                    boxShadow: '0 2px 8px rgba(34,34,34,0.1)',
                  }}
                >
                  <Search className="w-[15px] h-[15px] text-[rgba(34,34,34,0.28)] flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Find local offers..."
                    className="w-full bg-transparent text-[13px] font-semibold text-[#222222] placeholder:text-[#222222] focus:outline-none"
                  />
                  <button
                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ border: '1px solid rgba(34,34,34,0.15)' }}
                  >
                    <SlidersHorizontal className="w-[12px] h-[12px] text-[#222222]" />
                  </button>
                </div>
              </div>

              {/* Category Tabs */}
              <div className="px-[18px] border-b border-[rgba(34,34,34,0.1)]">
                <div className="flex">
                  {categoryTabs.map(tab => {
                    const isActive = selectedCategory === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedCategory(tab.key)}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 relative transition-all ${
                          isActive ? 'text-[#222222]' : 'text-[rgba(34,34,34,0.28)]'
                        }`}
                      >
                        <tab.icon className="w-[20px] h-[20px]" />
                        <span className="text-[10px] font-semibold">{tab.label}</span>
                        {isActive && (
                          <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#222222] rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Claim Banner */}
              {activeClaims.length > 0 && (() => {
                const firstActive = activeClaims[0];
                const claimedTime = new Date(firstActive.claimed_at).getTime();
                const now = new Date().getTime();
                const hoursLeft = Math.max(0, Math.floor(48 - (now - claimedTime) / (1000 * 60 * 60)));
                return (
                  <div
                    className="mx-[18px] mt-[14px] bg-white rounded-2xl p-[14px_16px] flex items-center justify-between"
                    style={{
                      border: '1px solid rgba(34,34,34,0.1)',
                      boxShadow: '0 1px 4px rgba(34,34,34,0.06)',
                    }}
                  >
                    <div>
                      <p className="text-[13px] font-bold text-[#222222]">Active pass</p>
                      <button onClick={() => setView('active')} className="flex items-center gap-1 text-[11px] text-[rgba(34,34,34,0.5)]">
                        {firstActive.businesses.name} <ChevronRight className="w-[10px] h-[10px]" />
                      </button>
                    </div>
                    <div className="w-[50px] h-[50px] rounded-xl bg-[#F5C4A0] flex flex-col items-center justify-center">
                      <span className="text-[20px] font-extrabold text-[#222222] leading-none">{hoursLeft}</span>
                      <span className="text-[8px] font-bold text-[rgba(34,34,34,0.28)] leading-none mt-0.5">HRS LEFT</span>
                    </div>
                  </div>
                );
              })()}

              {/* Section Header */}
              <div className="flex items-center justify-between px-[18px] mt-4 mb-[12px]">
                <h2 className="text-[16px] font-extrabold text-[#222222] tracking-[-0.3px]">Near you</h2>
                <button
                  className="w-[30px] h-[30px] rounded-full flex items-center justify-center"
                  style={{ border: '1px solid rgba(34,34,34,0.15)' }}
                >
                  <ChevronRight className="w-[12px] h-[12px] text-[#222222]" />
                </button>
              </div>

              {(() => {
                const filteredOffers = offers
                  .filter(o => {
                    let matchesCategory = true;
                    if (selectedCategory === 'food') {
                      matchesCategory = getCategoryGroup(o.businesses.category) === 'food';
                    } else if (selectedCategory === 'beauty') {
                      matchesCategory = getCategoryGroup(o.businesses.category) === 'beauty';
                    } else if (selectedCategory === 'more') {
                      matchesCategory = getCategoryGroup(o.businesses.category) === 'more';
                    }
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
                      <Search className="w-8 h-8 text-[rgba(34,34,34,0.28)] mx-auto mb-3" />
                      <p className="text-[rgba(34,34,34,0.28)] text-sm">No offers found</p>
                      <button
                        onClick={() => {
                          setSelectedCategory('all');
                          setSearchQuery('');
                        }}
                        className="mt-2 text-[#C4674A] text-xs font-semibold hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Horizontal scroll offer cards */}
                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="flex gap-[12px] px-[18px] pb-4" style={{ width: 'max-content' }}>
                        {filteredOffers.map((offer) => {
                          const isUnlimited = offer.monthly_cap === null;
                          const slotsUsed = offer.slotsUsed || 0;
                          const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                          const full = !isUnlimited && slotsLeft === 0;

                          return (
                            <button
                              key={offer.id}
                              onClick={() => setExpandedOffer(offer.id)}
                              className="w-[130px] flex-shrink-0 text-left"
                            >
                              {/* Image area */}
                              <div
                                className="w-full h-[120px] rounded-[14px] overflow-hidden relative flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #2C3A2A, #1A3C34)' }}
                              >
                                <div className="w-[44px] h-[44px] rounded-[10px] bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                                  <span className="text-[rgba(255,255,255,0.8)] text-[18px] font-extrabold">{offer.businesses.name.charAt(0)}</span>
                                </div>
                                {/* Slots badge bottom-left */}
                                {!isUnlimited && !full && (
                                  <span className="absolute bottom-[6px] left-[6px] bg-[rgba(255,255,255,0.92)] backdrop-blur text-[#222222] text-[10px] font-bold rounded-full px-[9px] py-[4px]">
                                    {slotsLeft} slots left
                                  </span>
                                )}
                                {full && (
                                  <span className="absolute bottom-[6px] left-[6px] bg-[rgba(255,255,255,0.92)] backdrop-blur text-[rgba(34,34,34,0.28)] text-[10px] font-bold rounded-full px-[9px] py-[4px]">
                                    Full
                                  </span>
                                )}
                                {/* Heart top-right */}
                                <div className="absolute top-[6px] right-[6px]">
                                  <Heart className="w-[16px] h-[16px] text-white" strokeWidth={1.5} />
                                </div>
                              </div>
                              {/* Below image info */}
                              <div className="mt-2">
                                <p className="text-[12px] font-extrabold text-[#222222] tracking-[-0.1px] truncate">{offer.businesses.name}</p>
                                <p className="text-[11px] text-[rgba(34,34,34,0.5)] truncate">{offer.businesses.category} &middot; collab</p>
                                <p className="text-[11px]">
                                  <span className="font-semibold text-[#222222]">Free</span>
                                  <span className="text-[rgba(34,34,34,0.5)]"> &middot; &#9733; 4.9</span>
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Second section */}
                    <div className="flex items-center justify-between px-[18px] mt-2 mb-[12px]">
                      <h2 className="text-[16px] font-extrabold text-[#222222] tracking-[-0.3px]">New this week</h2>
                      <button
                        className="w-[30px] h-[30px] rounded-full flex items-center justify-center"
                        style={{ border: '1px solid rgba(34,34,34,0.15)' }}
                      >
                        <ChevronRight className="w-[12px] h-[12px] text-[#222222]" />
                      </button>
                    </div>

                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="flex gap-[12px] px-[18px] pb-4" style={{ width: 'max-content' }}>
                        {filteredOffers.slice().reverse().map((offer) => {
                          const isUnlimited = offer.monthly_cap === null;
                          const slotsUsed = offer.slotsUsed || 0;
                          const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                          const full = !isUnlimited && slotsLeft === 0;

                          return (
                            <button
                              key={offer.id}
                              onClick={() => setExpandedOffer(offer.id)}
                              className="w-[130px] flex-shrink-0 text-left"
                            >
                              <div
                                className="w-full h-[120px] rounded-[14px] overflow-hidden relative flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #2C3A2A, #1A3C34)' }}
                              >
                                <div className="w-[44px] h-[44px] rounded-[10px] bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                                  <span className="text-[rgba(255,255,255,0.8)] text-[18px] font-extrabold">{offer.businesses.name.charAt(0)}</span>
                                </div>
                                {!isUnlimited && !full && (
                                  <span className="absolute bottom-[6px] left-[6px] bg-[rgba(255,255,255,0.92)] backdrop-blur text-[#222222] text-[10px] font-bold rounded-full px-[9px] py-[4px]">
                                    {slotsLeft} slots left
                                  </span>
                                )}
                                {full && (
                                  <span className="absolute bottom-[6px] left-[6px] bg-[rgba(255,255,255,0.92)] backdrop-blur text-[rgba(34,34,34,0.28)] text-[10px] font-bold rounded-full px-[9px] py-[4px]">
                                    Full
                                  </span>
                                )}
                                <div className="absolute top-[6px] right-[6px]">
                                  <Heart className="w-[16px] h-[16px] text-white" strokeWidth={1.5} />
                                </div>
                              </div>
                              <div className="mt-2">
                                <p className="text-[12px] font-extrabold text-[#222222] tracking-[-0.1px] truncate">{offer.businesses.name}</p>
                                <p className="text-[11px] text-[rgba(34,34,34,0.5)] truncate">{offer.businesses.category} &middot; collab</p>
                                <p className="text-[11px]">
                                  <span className="font-semibold text-[#222222]">Free</span>
                                  <span className="text-[rgba(34,34,34,0.5)]"> &middot; &#9733; 4.9</span>
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {/* -- MAP -- */}
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

          {/* -- ACTIVE PASSES -- */}
          {view === 'active' && (
            <>
              {activeClaims.length === 0 ? (
                <div className="text-center py-16">
                  <Zap className="w-8 h-8 text-[rgba(34,34,34,0.28)] mx-auto mb-3" />
                  <p className="text-[rgba(34,34,34,0.5)] text-sm font-medium">No active passes</p>
                  <button
                    onClick={() => setView('offers')}
                    className="mt-3 text-[#C4674A] text-sm font-semibold hover:underline"
                  >
                    Browse offers
                  </button>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {/* Pass selector (when multiple active) */}
                  {activeClaims.length > 1 && (
                    <div className="relative">
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                        {activeClaims.map(claim => {
                          const isSelected = selectedClaim?.id === claim.id;
                          return (
                            <button
                              key={claim.id}
                              onClick={() => setSelectedClaim(claim)}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                                isSelected
                                  ? 'bg-[#222222] text-white'
                                  : 'bg-[#F7F7F7] text-[rgba(34,34,34,0.5)]'
                              }`}
                            >
                              <span className="w-5 h-5 rounded-[6px] bg-gradient-to-br from-[#3a3a3a] to-[#222222] flex items-center justify-center flex-shrink-0">
                                <span className="text-[rgba(255,255,255,0.9)] text-[9px] font-bold">{claim.businesses.name.charAt(0)}</span>
                              </span>
                              <span className="max-w-[140px] truncate">{claim.businesses.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
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
                          { key: 'submitted', label: 'Done', active: currentStage === 'submitted' }
                        ];

                        return (
                      <div className="bg-white rounded-[20px] p-5 shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)]">
                        {/* Business row */}
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2C3A2A, #1A3C34)' }}>
                            <span className="text-[rgba(255,255,255,0.8)] text-[18px] font-bold">{selectedClaim.businesses.name.charAt(0)}</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-[14px] text-[#222222]">{selectedClaim.businesses.name}</h3>
                            <p className="text-[11px] text-[rgba(34,34,34,0.5)] mt-0.5">{selectedClaim.offers.description}</p>
                          </div>
                        </div>

                        {/* Stepper */}
                        <div className="mb-5">
                          <div className="relative">
                            <div className="grid grid-cols-4">
                              {stages.map((stage, idx) => {
                                const activeIdx = stages.findIndex(s => s.active);
                                const isCompleted = activeIdx > idx;
                                const isCurrent = stage.active;
                                return (
                                <div key={stage.key} className="flex flex-col items-center">
                                  <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                    isCurrent || isCompleted
                                      ? 'bg-[#C4674A] text-white'
                                      : 'bg-[#F7F7F7] text-[rgba(34,34,34,0.28)]'
                                  }`}>
                                    {isCompleted ? <Check className="w-3 h-3" /> : idx + 1}
                                  </div>
                                  <p className={`text-[9px] mt-1.5 text-center px-1 ${
                                    isCurrent ? 'font-semibold text-[#C4674A]' : 'font-medium text-[rgba(34,34,34,0.28)]'
                                  }`}>
                                    {stage.label}
                                  </p>
                                </div>
                                );
                              })}
                            </div>
                            {/* Connecting lines */}
                            <div className="absolute top-[13px] left-0 right-0 flex items-center px-[12.5%]">
                              {[0, 1, 2].map((idx) => (
                                <div
                                  key={idx}
                                  className="h-[1.5px] flex-1 bg-[rgba(34,34,34,0.1)]"
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
                            <p className="text-xs text-[rgba(34,34,34,0.5)]">
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
                          <div className="mt-5 p-4 rounded-xl bg-white border border-[rgba(34,34,34,0.1)]">
                            <label className="block text-sm font-semibold text-[#222222] mb-2">
                              Submit Your Reel
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={reelUrl}
                                onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
                                placeholder="https://instagram.com/reel/..."
                                className="flex-1 px-3 py-2 rounded-[12px] bg-[#F7F7F7] border border-[rgba(34,34,34,0.1)] text-sm text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#C4674A]/30 focus:border-[#C4674A]"
                              />
                              <button
                                onClick={handleSubmitReel}
                                disabled={loading || !reelUrl}
                                className="px-4 py-2 rounded-full text-white text-sm font-semibold bg-[#C4674A] hover:bg-[#b35a3f] disabled:opacity-40 transition-all"
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
                          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-white border border-[rgba(34,34,34,0.1)]">
                            <Check className="w-4 h-4 text-[#C4674A] flex-shrink-0" />
                            <span className="text-sm text-[#222222] font-medium">Reel submitted!</span>
                          </div>
                        )}

                        <div className="mt-3 flex flex-col items-center gap-1">
                          <button
                            onClick={() => setDisputeClaimId(selectedClaim.id)}
                            className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-medium text-[rgba(34,34,34,0.28)] hover:text-amber-600 transition-colors"
                          >
                            <Flag className="w-3 h-3" /> Report an issue
                          </button>
                          {(() => {
                            const releaseStatus = canReleaseOffer(selectedClaim);
                            if (releaseStatus.allowed) {
                              return (
                                <button
                                  onClick={() => setReleaseModalOpen(true)}
                                  className="text-xs text-[rgba(34,34,34,0.28)] hover:text-rose-500 transition-colors"
                                >
                                  Release offer
                                </button>
                              );
                            } else if (releaseStatus.reason) {
                              return (
                                <span className="text-xs text-[rgba(34,34,34,0.28)]">
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
                </div>
              )}
            </>
          )}

          {/* -- HISTORY -- */}
          {view === 'history' && (
            <div className="p-4 space-y-3">
              {claims.length === 0 && (
                <div className="text-center py-16">
                  <Clock className="w-8 h-8 text-[rgba(34,34,34,0.28)] mx-auto mb-3" />
                  <p className="text-[rgba(34,34,34,0.28)] text-sm">No claims yet. Grab an offer to get started!</p>
                </div>
              )}
              {claims.map((claim) => (
                <div key={claim.id} className="bg-white rounded-[20px] p-4 shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)]">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[rgba(255,255,255,0.9)] text-[14px] font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2C3A2A, #1A3C34)' }}>
                      {claim.businesses.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-[13px] text-[#222222]">{claim.businesses.name}</h3>
                          <p className="text-xs text-[rgba(34,34,34,0.5)] mt-0.5 leading-[1.4]" style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word'
                          }}>{claim.offers.description}</p>
                        </div>
                        <StatusPill status={claim.status} />
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[rgba(34,34,34,0.1)]">
                        <span className="text-[11px] text-[rgba(34,34,34,0.28)]">
                          {new Date(claim.claimed_at).toLocaleDateString()}
                        </span>
                        {claim.reel_url && (
                          <a
                            href={claim.reel_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] font-semibold text-[#C4674A] hover:underline"
                          >
                            View Reel <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* -- NOTIFICATIONS -- */}
          {view === 'notifications' && (
            <div className="p-4 space-y-3">
              {/* Sign out button in profile/notifications view */}
              <div className="flex justify-end mb-2">
                <button
                  onClick={signOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-[rgba(34,34,34,0.5)] bg-[#F7F7F7] hover:bg-[rgba(34,34,34,0.1)] transition-colors"
                >
                  <LogOut className="w-3 h-3" /> Sign out
                </button>
              </div>
              {notifications.length === 0 && (
                <div className="text-center py-16">
                  <Bell className="w-8 h-8 text-[rgba(34,34,34,0.28)] mx-auto mb-3" />
                  <p className="text-[rgba(34,34,34,0.28)] text-sm">No notifications yet</p>
                </div>
              )}
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => !notif.read && markNotificationRead(notif.id)}
                  className={`w-full text-left bg-white rounded-[20px] p-4 shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] transition-all ${
                    notif.read
                      ? 'opacity-50'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-[rgba(34,34,34,0.1)]' : 'bg-[#C4674A]'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#222222]">{notif.message}</p>
                      <p className="text-[11px] text-[rgba(34,34,34,0.28)] mt-1">
                        {new Date(notif.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white z-40" style={{ borderTop: '1px solid rgba(34,34,34,0.1)' }}>
        <div className="max-w-md mx-auto flex pt-[10px] pb-[12px]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex-1 flex flex-col items-center gap-1 text-[10px] font-semibold transition-all relative ${
                view === tab.key ? 'text-[#C4674A]' : 'text-[rgba(34,34,34,0.28)]'
              }`}
            >
              <div className="relative">
                {tab.icon ? (
                  <tab.icon className="w-[22px] h-[22px]" />
                ) : (
                  <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold ${
                    view === tab.key ? 'bg-[#C4674A] text-white' : 'bg-[rgba(34,34,34,0.1)] text-[rgba(34,34,34,0.5)]'
                  }`}>
                    {userProfile.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                {tab.badge ? (
                  <span className={`absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${
                    tab.badgeColor || 'bg-[#C4674A]'
                  }`}>
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && (
                <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#C4674A] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
