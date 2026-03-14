import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, Heart, Zap, SlidersHorizontal, Home, Coffee, Sparkles, LayoutGrid, ChevronRight, ChevronLeft, FileText, Bell, Check, LogOut, ExternalLink, Flag, X, User, Users, Clock, Copy, Camera, Instagram, Video } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';
import CreatorOnboarding from './CreatorOnboarding';
import DisputeModal from './DisputeModal';
import { getCategoryGradient, getCategorySolidColor, CategoryIcon } from '../lib/categories';
import { getInitials } from '../lib/avatar';
import { uploadAvatar } from '../lib/upload';
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
  offer_type?: string | null;
  offer_item?: string | null;
  content_type?: string | null;
  specific_ask?: string | null;
  generated_title?: string | null;
  businesses: { name: string; category: string; logo_url?: string | null; latitude?: number; longitude?: number; address?: string };
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
  offers: { description: string; generated_title?: string | null; offer_item?: string | null; specific_ask?: string | null; content_type?: string | null };
  businesses: { name: string; category: string; logo_url?: string | null };
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-[var(--terra)] text-white',
    claimed: 'bg-[var(--terra)] text-white',
    redeemed: 'bg-[#F7F7F7] text-[#222222]',
    visited: 'bg-[#F7F7F7] text-[#222222]',
    reel_due: 'bg-[var(--terra)] text-white',
    submitted: 'bg-emerald-500 text-white',
    expired: 'bg-rose-50 text-rose-500 border border-rose-100',
    overdue: 'bg-orange-50 text-orange-600 border border-orange-100',
    completed: 'bg-[#F7F7F7] text-[rgba(34,34,34,0.5)]',
    disputed: 'bg-rose-100 text-rose-600',
  };
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${styles[status] || 'bg-[#F7F7F7] text-[#222222]'}`}>
      {status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function CreatorApp() {
  const { userProfile, signOut } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activeClaims, setActiveClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [savedOffers, setSavedOffers] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'offers' | 'saved' | 'active' | 'claims' | 'profile'>('offers');
  const [profileSubView, setProfileSubView] = useState<'main' | 'alerts'>('main');
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
  const [releaseConfirmId, setReleaseConfirmId] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releasingClaim, setReleasingClaim] = useState(false);
  const [reelError, setReelError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(userProfile?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { timeLeft, isOverdue } = useCountdown(selectedClaim?.reel_due_at || null);

  // Load saved offers from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nayba_saved_offers');
      if (saved) setSavedOffers(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const toggleSaved = (offerId: string) => {
    setSavedOffers(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) {
        next.delete(offerId);
        setUndoToast('Removed from saved');
        setTimeout(() => setUndoToast(null), 3000);
      } else {
        next.add(offerId);
      }
      localStorage.setItem('nayba_saved_offers', JSON.stringify([...next]));
      return next;
    });
  };

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
      .select('*, businesses(name, category, latitude, longitude, address, logo_url)')
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
      // Deduplicate: if same business_id + same description, keep only one
      const seen = new Set<string>();
      const deduped = offersWithSlots.filter(o => {
        const key = `${o.business_id}::${o.description}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setOffers(deduped as Offer[]);
    }
  };

  const fetchClaims = async () => {
    const { data, error } = await supabase
      .from('claims')
      .select('*, offers(description, generated_title, offer_item, specific_ask, content_type), businesses(name, category, logo_url)')
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

  const handleReleaseOffer = async (claimId: string) => {
    setReleasingClaim(true);
    setReleaseError(null);
    try {
      const { data, error } = await supabase.rpc('unclaim_offer', {
        p_claim_id: claimId,
        p_creator_id: userProfile.id,
      });

      if (error) throw error;
      if (data?.error) {
        setReleaseError(data.error);
        return;
      }

      setReleaseConfirmId(null);
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setUploadError(null);
    const { url, error } = await uploadAvatar(file, userProfile.id, 'creators');
    if (error) {
      setUploadError(error);
    } else if (url) {
      setAvatarUrl(url);
    }
    setUploadingAvatar(false);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const copyCode = () => {
    navigator.clipboard.writeText(userProfile.code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!userProfile?.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-white">
        <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] p-8 max-w-sm text-center">
          <Clock className="w-8 h-8 text-[rgba(34,34,34,0.28)] mx-auto mb-4" />
          <h2 className="text-[26px] font-extrabold mb-2 text-[#222222]">Pending Approval</h2>
          <p className="text-[rgba(34,34,34,0.5)] text-[15px] mb-6">
            Your creator account is under review. You'll be notified once approved!
          </p>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-medium bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors min-h-[48px]"
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
    : 'bg-[var(--terra)]';

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
    { key: 'saved' as const, label: 'Saved', icon: Heart },
    { key: 'active' as const, label: 'Active', icon: Zap, badge: activeClaims.length || undefined, badgeColor: activeBadgeColor },
    { key: 'claims' as const, label: 'Claims', icon: FileText },
    { key: 'profile' as const, label: 'Profile', icon: null as any },
  ];

  // Helper to render business avatar
  const renderBusinessAvatar = (name: string, category: string, logoUrl?: string | null, size = 44) => {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt={name}
          className="object-cover rounded-full"
          style={{ width: size, height: size }}
        />
      );
    }
    return (
      <div
        className="rounded-full flex items-center justify-center"
        style={{ width: size, height: size, background: getCategorySolidColor(category) }}
      >
        <span className="text-[rgba(255,255,255,0.8)] font-extrabold" style={{ fontSize: size * 0.4 }}>{name.charAt(0)}</span>
      </div>
    );
  };

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

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#222222] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full shadow-lg">
          {undoToast}
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
            <div className="relative h-[200px] flex items-center justify-center" style={{ background: getCategoryGradient(offer.businesses.category) }}>
              {offer.businesses.logo_url ? (
                <img src={offer.businesses.logo_url} alt={offer.businesses.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-[64px] h-[64px] rounded-[16px] bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                  <span className="text-[rgba(255,255,255,0.8)] text-[28px] font-extrabold">{offer.businesses.name.charAt(0)}</span>
                </div>
              )}
              <button
                onClick={() => setExpandedOffer(null)}
                className="absolute top-[16px] left-[16px] w-[36px] h-[36px] rounded-full bg-white flex items-center justify-center shadow-[0_2px_8px_rgba(34,34,34,0.1)]"
              >
                <ChevronLeft className="w-[18px] h-[18px] text-[#222222]" />
              </button>
              <button
                onClick={() => toggleSaved(offer.id)}
                className="absolute top-[16px] right-[16px] w-[36px] h-[36px] rounded-full bg-[rgba(255,255,255,0.15)] flex items-center justify-center"
              >
                <Heart className={`w-[16px] h-[16px] ${savedOffers.has(offer.id) ? 'text-[var(--terra)] fill-[var(--terra)]' : 'text-white'}`} strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="p-[20px]">
                {/* A) Business name + category */}
                <h2 className="text-[22px] font-extrabold text-[#222222]" style={{ letterSpacing: '-0.5px' }}>{offer.businesses.name}</h2>
                <p className="text-[14px] text-[var(--mid)] mt-1">{offer.businesses.category}</p>

                {/* Offer headline */}
                <p className="text-[20px] font-extrabold text-[#222222] mt-3" style={{ letterSpacing: '-0.4px' }}>
                  {offer.generated_title || (offer.description.length > 50 ? offer.description.slice(0, 50) + '…' : offer.description)}
                </p>
                <div className="h-[1px] bg-[var(--faint)] my-[14px]" />

                {/* B) What you get */}
                <p className="text-[10px] font-bold text-[var(--soft)] uppercase tracking-[0.8px] mb-2">WHAT YOU GET</p>
                <p className="text-[16px] font-semibold text-[#222222] leading-[1.5] mb-5">
                  {offer.generated_title || offer.description}
                </p>

                {/* C) What to post */}
                <p className="text-[10px] font-bold text-[var(--soft)] uppercase tracking-[0.8px] mb-2">WHAT TO POST</p>
                <div className="flex items-center gap-2 mb-2">
                  <Video className="w-5 h-5 text-[var(--terra)]" />
                  <span className="text-[15px] font-bold text-[#222222]">One Instagram Reel</span>
                </div>
                <p className="text-[13px] text-[var(--mid)] mb-3">Post within 48 hours of your visit</p>
                <div className="flex flex-col gap-2.5 mb-5">
                  {[
                    'Post within 48 hours of your visit',
                    'Tag the business in your reel',
                    'Submit your reel link in the app',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <Check className="w-[13px] h-[13px] text-[var(--terra)] mt-[2px] flex-shrink-0" />
                      <span className="text-[13px] text-[var(--mid)]">{item}</span>
                    </div>
                  ))}
                </div>

                {/* D) They'd love if you… (only if specific_ask exists) */}
                {offer.specific_ask && (
                  <div className="mb-5">
                    <p className="text-[10px] font-bold text-[var(--soft)] uppercase tracking-[0.8px] mb-2">THEY'D LOVE IF YOU…</p>
                    <div className="rounded-[12px] p-[14px]" style={{ background: 'rgba(196,103,74,0.06)' }}>
                      <p className="text-[14px] text-[rgba(26,26,26,0.75)]" style={{ lineHeight: '1.6' }}>{offer.specific_ask}</p>
                    </div>
                  </div>
                )}

                {/* D) Availability row */}
                <div className="flex items-center justify-between rounded-[12px] bg-[#F7F7F7] px-[16px] py-[12px]">
                  <div className="flex items-center gap-2">
                    <Users className="w-[14px] h-[14px] text-[var(--mid)]" />
                    <span className="text-[14px] font-semibold text-[#222222]">
                      {isUnlimited ? 'Open availability' : full ? 'Sold out' : `${slotsLeft} slots left`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-[14px] h-[14px] text-[var(--mid)]" />
                    <span className="text-[14px] font-semibold text-[#222222]">48hrs to post</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky bottom bar */}
            <div className="border-t border-[rgba(34,34,34,0.1)] bg-white px-[20px] py-[14px] flex items-center justify-between">
              <div>
                <p className="text-[15px] font-extrabold text-[#222222]">Free visit</p>
                <p className="text-[12px] text-[var(--mid)]">Post reel within 48hrs</p>
              </div>
              {full ? (
                <button disabled className="px-[22px] py-[12px] rounded-full text-[14px] font-bold bg-[#F7F7F7] text-[rgba(34,34,34,0.28)] cursor-not-allowed min-h-[48px]">
                  Sold Out
                </button>
              ) : alreadyClaimed ? (
                <button disabled className="px-[22px] py-[12px] rounded-full text-[14px] font-bold bg-[#F7F7F7] text-[rgba(34,34,34,0.28)] cursor-not-allowed flex items-center gap-1 min-h-[48px]">
                  <Check className="w-4 h-4" /> Claimed
                </button>
              ) : hasActiveBusiness ? (
                <button disabled className="px-[22px] py-[12px] rounded-full text-[14px] font-bold bg-amber-50 text-amber-700 border border-amber-200 cursor-not-allowed min-h-[48px]">
                  Active
                </button>
              ) : (
                <button
                  onClick={() => { handleClaim(offer); setExpandedOffer(null); }}
                  disabled={loading}
                  className="px-[22px] py-[12px] rounded-full text-[14px] font-bold bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] disabled:opacity-40 transition-all min-h-[48px]"
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
        <div className="bg-white px-[20px] pt-[20px] pb-[14px] border-b border-[rgba(34,34,34,0.1)]">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[14px] font-semibold text-[#222222]">{userProfile.name}</p>
                <span className="inline-block bg-[#F7F7F7] text-[rgba(34,34,34,0.5)] text-[12px] font-bold rounded-full px-[9px] py-[3px] mt-0.5">
                  {userProfile.code}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pb-28">

          {/* -- EXPLORE FEED -- */}
          {view === 'offers' && (
            <>
              {claimError && (
                <div className="mx-[20px] mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                  <p className="text-[14px] text-rose-700">{claimError}</p>
                  <button onClick={() => setClaimError(null)} className="text-rose-400 hover:text-rose-600 text-[13px] font-semibold ml-3">Dismiss</button>
                </div>
              )}

              {/* Search bar */}
              <div className="px-[20px] pt-4 pb-3">
                <div
                  className="w-full rounded-full bg-white flex items-center gap-3 px-[16px] py-[14px]"
                  style={{
                    border: '1px solid rgba(34,34,34,0.12)',
                    boxShadow: '0 2px 8px rgba(34,34,34,0.08)',
                  }}
                >
                  <Search className="w-[15px] h-[15px] text-[rgba(34,34,34,0.28)] flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Find local offers..."
                    className="w-full bg-transparent text-[15px] font-semibold text-[#222222] placeholder:text-[#222222] focus:outline-none"
                    style={{ minHeight: '24px' }}
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
              <div className="px-[20px] border-b border-[rgba(34,34,34,0.1)]">
                <div className="flex">
                  {categoryTabs.map(tab => {
                    const isActive = selectedCategory === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedCategory(tab.key)}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 relative transition-all min-h-[44px] ${
                          isActive ? 'text-[#222222]' : 'text-[rgba(34,34,34,0.28)]'
                        }`}
                      >
                        <tab.icon className="w-[20px] h-[20px]" />
                        <span className="text-[11px] font-semibold">{tab.label}</span>
                        {isActive && (
                          <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[var(--terra)] rounded-full" />
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
                const totalMinutesLeft = Math.max(0, Math.floor((48 * 60) - (now - claimedTime) / (1000 * 60)));
                const hoursLeft = Math.floor(totalMinutesLeft / 60);
                const minutesLeft = totalMinutesLeft % 60;
                const timerLabel = hoursLeft >= 1 ? `${hoursLeft}h left` : `${minutesLeft}m left`;
                const timerColor = hoursLeft < 10 ? 'var(--terra)' : '#222222';
                return (
                  <div
                    className="mx-[20px] mt-[14px] bg-white rounded-2xl p-[16px] flex items-center justify-between"
                    style={{
                      border: '1px solid rgba(34,34,34,0.1)',
                      boxShadow: '0 1px 4px rgba(34,34,34,0.06)',
                    }}
                  >
                    <div>
                      <p className="text-[14px] font-bold text-[#222222]">Active pass</p>
                      <button onClick={() => setView('active')} className="flex items-center gap-1 text-[13px] text-[rgba(34,34,34,0.5)]">
                        {firstActive.businesses.name} <ChevronRight className="w-[10px] h-[10px]" />
                      </button>
                    </div>
                    <span
                      className="text-[14px] font-bold rounded-[50px] whitespace-nowrap"
                      style={{
                        background: '#F5C4A0',
                        color: hoursLeft < 10 ? 'var(--terra)' : '#222222',
                        padding: '6px 14px',
                      }}
                    >
                      {timerLabel}
                    </span>
                  </div>
                );
              })()}

              {/* Section Header */}
              <div className="flex items-center justify-between px-[20px] mt-4 mb-[14px]">
                <h2 className="text-[18px] font-extrabold text-[#222222] tracking-[-0.3px]">Near you</h2>
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
                    if (sortBy === 'name') return a.businesses.name.localeCompare(b.businesses.name);
                    if (sortBy === 'slots') {
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
                      <p className="text-[rgba(34,34,34,0.28)] text-[15px]">No offers found</p>
                      <button
                        onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                        className="mt-2 text-[var(--terra)] text-[13px] font-semibold hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  );
                }

                const renderOfferCard = (offer: Offer) => {
                  const isUnlimited = offer.monthly_cap === null;
                  const slotsUsed = offer.slotsUsed || 0;
                  const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                  const full = !isUnlimited && slotsLeft === 0;

                  return (
                    <button
                      key={offer.id}
                      onClick={() => setExpandedOffer(offer.id)}
                      className="w-[140px] flex-shrink-0 text-left"
                    >
                      {/* Image area */}
                      <div
                        className="w-full h-[130px] rounded-[14px] overflow-hidden relative flex items-center justify-center"
                        style={{ background: getCategoryGradient(offer.businesses.category) }}
                      >
                        {offer.businesses.logo_url ? (
                          <img src={offer.businesses.logo_url} alt={offer.businesses.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-[44px] h-[44px] rounded-[10px] bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                            <span className="text-[rgba(255,255,255,0.8)] text-[18px] font-extrabold">{offer.businesses.name.charAt(0)}</span>
                          </div>
                        )}
                        {/* Business logo overlay top-left */}
                        {offer.businesses.logo_url && (
                          <div className="absolute top-[6px] left-[6px] w-[32px] h-[32px] rounded-[8px] overflow-hidden" style={{ border: '1.5px solid white' }}>
                            <img src={offer.businesses.logo_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {/* Slots badge bottom-left */}
                        {!isUnlimited && !full && (
                          <span className="absolute bottom-[6px] left-[6px] bg-[rgba(255,255,255,0.92)] backdrop-blur text-[#222222] text-[12px] font-bold rounded-full px-[9px] py-[4px]">
                            {slotsLeft} slots left
                          </span>
                        )}
                        {full && (
                          <span className="absolute bottom-[6px] left-[6px] bg-[rgba(255,255,255,0.92)] backdrop-blur text-[rgba(34,34,34,0.28)] text-[12px] font-bold rounded-full px-[9px] py-[4px]">
                            Full
                          </span>
                        )}
                        {/* Reel badge top-right */}
                        <span className="absolute top-[6px] right-[6px] inline-flex items-center gap-1 px-2 py-[3px] rounded-[50px] text-[10px] font-bold text-[#222222]" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
                          <Video className="w-[10px] h-[10px]" /> Reel
                        </span>
                        {/* Heart */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSaved(offer.id); }}
                          className="absolute bottom-[6px] right-[6px]"
                        >
                          <Heart
                            className={`w-[16px] h-[16px] ${savedOffers.has(offer.id) ? 'text-[var(--terra)] fill-[var(--terra)]' : 'text-white'}`}
                            strokeWidth={1.5}
                          />
                        </button>
                      </div>
                      {/* Below image info */}
                      <div className="mt-2">
                        <p className="text-[14px] font-extrabold text-[#222222] tracking-[-0.1px] truncate">{offer.businesses.name}</p>
                        <p className="text-[13px] font-semibold text-[#222222] truncate">
                          {offer.generated_title || offer.description.slice(0, 35)}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Video className="w-[11px] h-[11px] text-[var(--terra)]" />
                          <span className="text-[11px] font-semibold text-[var(--terra)]">Reel</span>
                          {!isUnlimited && !full && (
                            <>
                              <span className="text-[11px] text-[var(--mid)]">·</span>
                              <span className="text-[11px] text-[var(--mid)]">{slotsLeft} slots left</span>
                            </>
                          )}
                          {full && (
                            <>
                              <span className="text-[11px] text-[var(--mid)]">·</span>
                              <span className="text-[11px] text-[var(--mid)]">Full</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                };

                return (
                  <>
                    {/* Horizontal scroll offer cards */}
                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="flex gap-[14px] px-[20px] pb-4" style={{ width: 'max-content' }}>
                        {filteredOffers.map(renderOfferCard)}
                      </div>
                    </div>

                    {/* Second section */}
                    <div className="flex items-center justify-between px-[20px] mt-2 mb-[14px]">
                      <h2 className="text-[18px] font-extrabold text-[#222222] tracking-[-0.3px]">New this week</h2>
                      <button
                        className="w-[30px] h-[30px] rounded-full flex items-center justify-center"
                        style={{ border: '1px solid rgba(34,34,34,0.15)' }}
                      >
                        <ChevronRight className="w-[12px] h-[12px] text-[#222222]" />
                      </button>
                    </div>

                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="flex gap-[14px] px-[20px] pb-4" style={{ width: 'max-content' }}>
                        {filteredOffers.slice().reverse().map(renderOfferCard)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {/* -- SAVED TAB -- */}
          {view === 'saved' && (
            <div className="px-[20px] pt-5">
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-[26px] font-extrabold text-[#222222]">Saved</h1>
                <span className="text-[13px] text-[rgba(34,34,34,0.5)]">{savedOffers.size} saved</span>
              </div>

              {savedOffers.size === 0 ? (
                <div className="text-center py-20">
                  <Heart className="w-12 h-12 text-[rgba(34,34,34,0.28)] mx-auto mb-4" />
                  <p className="text-[16px] font-semibold text-[#222222]">Nothing saved yet</p>
                  <p className="text-[14px] text-[rgba(34,34,34,0.5)] mt-1">Heart an offer to save it for later</p>
                </div>
              ) : (
                <div className="space-y-[14px]">
                  {offers.filter(o => savedOffers.has(o.id)).map(offer => {
                    const isUnlimited = offer.monthly_cap === null;
                    const slotsUsed = offer.slotsUsed || 0;
                    const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                    return (
                      <button
                        key={offer.id}
                        onClick={() => setExpandedOffer(offer.id)}
                        className="w-full bg-white rounded-[16px] p-[16px] flex items-center gap-4 text-left shadow-[0_1px_4px_rgba(34,34,34,0.06)] border border-[rgba(34,34,34,0.1)]"
                      >
                        {/* Business image/gradient */}
                        <div
                          className="w-[56px] h-[56px] rounded-[10px] flex-shrink-0 flex items-center justify-center overflow-hidden"
                          style={{ background: getCategoryGradient(offer.businesses.category) }}
                        >
                          {offer.businesses.logo_url ? (
                            <img src={offer.businesses.logo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-[20px] font-extrabold">{offer.businesses.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-[#222222] truncate">{offer.businesses.name}</p>
                          <p className="text-[13px] text-[rgba(34,34,34,0.5)] truncate">{offer.businesses.category}</p>
                          <p className="text-[13px] font-semibold text-[var(--terra)]">
                            {isUnlimited ? 'Open availability' : slotsLeft ? `${slotsLeft} slots available` : 'Full'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSaved(offer.id); }}
                          className="flex-shrink-0 p-2"
                        >
                          <Heart className="w-5 h-5 text-[var(--terra)] fill-[var(--terra)]" />
                        </button>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* -- ACTIVE PASSES -- */}
          {view === 'active' && (
            <>
              {activeClaims.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <Zap className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[18px] font-bold text-[#222222] mb-1">No active claims</p>
                  <p className="text-[14px] text-[var(--mid)] mb-5">Claim an offer to get started</p>
                  <button
                    onClick={() => setView('offers')}
                    className="bg-[var(--terra)] text-white text-[14px] font-semibold rounded-[50px] px-[28px] py-[12px] hover:bg-[var(--terra-hover)] transition-all"
                  >
                    Browse offers
                  </button>
                </div>
              ) : (
                <div>
                  {/* Pill tab strip */}
                  <div className="flex gap-2 overflow-x-auto px-[20px] pt-[14px] pb-0" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                    {activeClaims.map(claim => {
                      const isSelected = selectedClaim?.id === claim.id;
                      return (
                        <button
                          key={claim.id}
                          onClick={() => {
                            setSelectedClaim(claim);
                            const idx = activeClaims.findIndex(c => c.id === claim.id);
                            const slider = document.getElementById('claims-slider');
                            if (slider) slider.scrollTo({ left: idx * slider.clientWidth, behavior: 'smooth' });
                          }}
                          className={`whitespace-nowrap text-[12px] font-semibold rounded-[50px] px-[14px] flex-shrink-0 transition-all ${
                            isSelected
                              ? 'bg-[#222222] text-white'
                              : 'bg-[#F0EFED] text-[var(--mid)]'
                          }`}
                          style={{ height: '32px' }}
                        >
                          {claim.businesses.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Swipeable slider */}
                  <div
                    id="claims-slider"
                    className="flex overflow-x-auto"
                    style={{
                      scrollSnapType: 'x mandatory',
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'none',
                    }}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const idx = Math.round(el.scrollLeft / el.clientWidth);
                      if (activeClaims[idx] && selectedClaim?.id !== activeClaims[idx].id) {
                        setSelectedClaim(activeClaims[idx]);
                      }
                    }}
                  >
                    {activeClaims.map(claim => {
                      const currentStage = claim.reel_url
                        ? 'submitted'
                        : claim.redeemed_at
                        ? 'reel_due'
                        : 'claimed';

                      const stageIndex = currentStage === 'claimed' ? 0 : currentStage === 'reel_due' ? 2 : currentStage === 'submitted' ? 3 : 1;
                      const stageLabels = ['Claimed', 'Visited', 'Reel Due', 'Done'];

                      // Use generated_title if available, fall back to description truncation
                      const desc = claim.offers.generated_title || claim.offers.description || '';
                      const breakPoints = [' in exchange', ' for a', ' for an', ' when you', ' with your'];
                      let offerTitle = desc;
                      let foundBreak = false;
                      for (const bp of breakPoints) {
                        const bpIdx = desc.indexOf(bp);
                        if (bpIdx > 0 && bpIdx <= 50) { offerTitle = desc.slice(0, bpIdx); foundBreak = true; break; }
                      }
                      if (!foundBreak && desc.length > 40) offerTitle = desc.slice(0, 40).trimEnd() + '…';

                      return (
                        <div
                          key={claim.id}
                          className="flex-shrink-0 w-full"
                          style={{ scrollSnapAlign: 'start' }}
                        >
                          <div className="px-4 pt-3">
                            <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] px-5 pt-4 pb-2">

                              {/* Offer title — one line */}
                              <p className="text-[14px] font-semibold text-[#1A1A1A] truncate mb-[10px]">{offerTitle}</p>

                              {/* Breadcrumb stepper — one line */}
                              <div className="flex items-center flex-nowrap mb-4">
                                {stageLabels.map((label, idx) => {
                                  const isDone = idx < stageIndex;
                                  const isCurrent = idx === stageIndex;
                                  const isFuture = idx > stageIndex;
                                  return (
                                    <span key={label} className="flex items-center">
                                      {idx === 0 && (
                                        <span className="inline-block w-[7px] h-[7px] rounded-full bg-[var(--terra)] mr-1.5" />
                                      )}
                                      <span className={`text-[13px] ${
                                        isCurrent ? 'font-bold text-[#1A1A1A]'
                                        : isDone ? 'font-bold text-[#1A1A1A]'
                                        : 'font-medium'
                                      }`} style={isFuture ? { color: 'rgba(26,26,26,0.3)' } : undefined}>
                                        {label}
                                      </span>
                                      {idx < stageLabels.length - 1 && (
                                        <span className="text-[13px] mx-1" style={{ color: 'rgba(26,26,26,0.25)' }}>→</span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>

                              {/* QR Code section */}
                              {claim.status === 'active' && (
                                <>
                                  <p className="text-[13px] font-semibold text-[#1A1A1A] text-center mb-[10px]">Show this at the door</p>
                                  <QRCodeDisplay
                                    token={claim.qr_token}
                                    claimId={claim.id}
                                    creatorCode={userProfile.code}
                                  />
                                </>
                              )}

                              {/* Reel Countdown/Prompt */}
                              {claim.redeemed_at && !claim.reel_url && (
                                <div className={`p-4 rounded-xl border ${
                                  isOverdue
                                    ? 'bg-rose-50/60 border-rose-200'
                                    : 'bg-amber-50/60 border-amber-200'
                                }`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Clock className={`w-4 h-4 ${isOverdue ? 'text-rose-500' : 'text-amber-500'}`} />
                                    <p className={`text-[14px] font-bold ${isOverdue ? 'text-rose-700' : 'text-amber-700'}`}>
                                      {isOverdue ? 'Overdue!' : `${timeLeft} remaining`}
                                    </p>
                                  </div>
                                  <p className="text-[13px] text-[var(--mid)]">
                                    You have 48 hours to post your reel — it must genuinely feature the business.
                                  </p>
                                </div>
                              )}

                              {/* Submit reel */}
                              {claim.status === 'redeemed' && !claim.reel_url && (
                                <div className="p-4 rounded-xl bg-white border border-[rgba(34,34,34,0.1)]">
                                  <label className="block text-[14px] font-semibold text-[#222222] mb-2">
                                    Submit Your Reel
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="url"
                                      value={reelUrl}
                                      onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
                                      placeholder="https://instagram.com/reel/..."
                                      className="flex-1 px-4 py-[14px] rounded-[12px] bg-[#F7F7F7] border border-[rgba(34,34,34,0.1)] text-[15px] text-[#222222] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)] min-h-[52px]"
                                    />
                                    <button
                                      onClick={handleSubmitReel}
                                      disabled={loading || !reelUrl}
                                      className="px-4 py-2 rounded-full text-white text-[14px] font-semibold bg-[var(--terra)] hover:bg-[var(--terra-hover)] disabled:opacity-40 transition-all min-h-[48px]"
                                    >
                                      Submit
                                    </button>
                                  </div>
                                  {reelError && (
                                    <p className="text-[13px] text-rose-600 mt-2">{reelError}</p>
                                  )}
                                </div>
                              )}

                              {claim.reel_url && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-[rgba(34,34,34,0.1)]">
                                  <Check className="w-4 h-4 text-[var(--terra)] flex-shrink-0" />
                                  <span className="text-[14px] text-[#222222] font-medium">Reel submitted!</span>
                                </div>
                              )}

                              {/* Report / Release links */}
                              <div className="flex items-center justify-center py-[10px] text-[12px]">
                                {releaseConfirmId === claim.id ? (
                                  <div className="flex items-center gap-3">
                                    <span className="text-[var(--mid)]">Release this slot?</span>
                                    <button
                                      onClick={() => handleReleaseOffer(claim.id)}
                                      disabled={releasingClaim}
                                      className="font-bold text-[var(--terra)]"
                                    >
                                      {releasingClaim ? '...' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => setReleaseConfirmId(null)}
                                      className="font-semibold text-[var(--soft)]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => setDisputeClaimId(claim.id)}
                                      className="flex items-center gap-1 font-medium transition-colors"
                                      style={{ color: 'rgba(26,26,26,0.35)' }}
                                    >
                                      <Flag className="w-[11px] h-[11px]" /> Report an issue
                                    </button>
                                    {(() => {
                                      const releaseStatus = canReleaseOffer(claim);
                                      if (releaseStatus.allowed) {
                                        return (
                                          <>
                                            <span className="mx-2" style={{ color: 'rgba(26,26,26,0.2)' }}>·</span>
                                            <button
                                              onClick={() => setReleaseConfirmId(claim.id)}
                                              className="flex items-center gap-1 font-medium transition-colors"
                                              style={{ color: 'rgba(196,103,74,0.65)' }}
                                            >
                                              <X className="w-[11px] h-[11px]" /> Release offer
                                            </button>
                                          </>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </>
                                )}
                              </div>
                              {releaseError && (
                                <p className="text-[13px] text-rose-600 text-center pb-2">{releaseError}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* -- CLAIMS (formerly History/Messages) -- */}
          {view === 'claims' && (
            <div className="px-[20px] pt-5">
              <h1 className="text-[26px] font-extrabold text-[#222222] mb-5">Claims</h1>
              {claims.length === 0 ? (
                <div className="text-center py-20">
                  <Zap className="w-12 h-12 text-[rgba(34,34,34,0.28)] mx-auto mb-4" />
                  <p className="text-[16px] font-semibold text-[#222222]">No claims yet</p>
                  <p className="text-[14px] text-[rgba(34,34,34,0.5)] mt-1">Claim an offer to get started</p>
                </div>
              ) : (
                <div className="space-y-[14px]">
                  {claims.map((claim) => (
                    <button
                      key={claim.id}
                      onClick={() => {
                        if (claim.status === 'active' || (claim.status === 'redeemed' && !claim.reel_url)) {
                          setSelectedClaim(claim);
                          setView('active');
                        }
                      }}
                      className="w-full bg-white rounded-[20px] p-[16px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] text-left"
                    >
                      <div className="flex items-start gap-3">
                        {renderBusinessAvatar(claim.businesses.name, claim.businesses.category, claim.businesses.logo_url, 36)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-[15px] text-[#222222]">{claim.businesses.name}</h3>
                              <p className="text-[13px] text-[rgba(34,34,34,0.5)] mt-0.5">{claim.businesses.category}</p>
                              <p className="text-[13px] text-[rgba(34,34,34,0.5)] mt-0.5 leading-[1.4]" style={{
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
                            <span className="text-[13px] text-[rgba(34,34,34,0.28)]">
                              {formatDate(claim.claimed_at)}
                            </span>
                            {claim.reel_url && (
                              <a
                                href={claim.reel_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-[13px] font-semibold text-[var(--terra)] hover:underline"
                              >
                                View Reel <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* -- PROFILE -- */}
          {view === 'profile' && (
            <div className="px-[20px] pt-8">
              {profileSubView === 'main' ? (
                <>
                  {/* Avatar */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative mb-3">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      {uploadingAvatar ? (
                        <div className="w-[88px] h-[88px] rounded-full bg-[#F7F7F7] flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : avatarUrl ? (
                        <button onClick={() => avatarInputRef.current?.click()}>
                          <img src={avatarUrl} alt="Avatar" className="w-[88px] h-[88px] rounded-full object-cover" />
                        </button>
                      ) : (
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          className="w-[88px] h-[88px] rounded-full flex items-center justify-center"
                          style={{ background: getCategoryGradient(null) }}
                        >
                          <span className="text-white text-[32px] font-extrabold">{getInitials(userProfile.name)}</span>
                        </button>
                      )}
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute bottom-0 right-0 w-[24px] h-[24px] rounded-full bg-[var(--terra)] flex items-center justify-center"
                      >
                        <Camera className="w-[12px] h-[12px] text-white" />
                      </button>
                    </div>
                    {uploadError && <p className="text-[13px] text-rose-600 mb-2">{uploadError}</p>}
                    <h2 className="text-[20px] font-extrabold text-[#222222]">{userProfile.name}</h2>
                    <button onClick={copyCode} className="flex items-center gap-1.5 mt-1 text-[13px] font-semibold text-[rgba(34,34,34,0.5)]">
                      {userProfile.code}
                      {copiedCode ? (
                        <span className="text-[var(--terra)] text-[12px]">Copied!</span>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {userProfile.instagram_handle && (
                      <p className="flex items-center gap-1 mt-1 text-[13px] text-[rgba(34,34,34,0.5)]">
                        <Instagram className="w-3.5 h-3.5" /> {userProfile.instagram_handle}
                      </p>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-center gap-0 mb-8 bg-[#F7F7F7] rounded-2xl p-4">
                    <div className="flex-1 text-center">
                      <p className="text-[20px] font-extrabold text-[#222222]">{claims.length}</p>
                      <p className="text-[12px] text-[rgba(34,34,34,0.5)]">Claimed</p>
                    </div>
                    <div className="w-[1px] h-8 bg-[rgba(34,34,34,0.1)]" />
                    <div className="flex-1 text-center">
                      <p className="text-[20px] font-extrabold text-[#222222]">{collabsCompleted}</p>
                      <p className="text-[12px] text-[rgba(34,34,34,0.5)]">Posted</p>
                    </div>
                    <div className="w-[1px] h-8 bg-[rgba(34,34,34,0.1)]" />
                    <div className="flex-1 text-center">
                      <p className="text-[20px] font-extrabold text-[#222222]">&mdash;</p>
                      <p className="text-[12px] text-[rgba(34,34,34,0.5)]">Rating</p>
                    </div>
                  </div>

                  {/* Settings list */}
                  <div className="space-y-0 bg-white rounded-2xl border border-[rgba(34,34,34,0.1)] overflow-hidden">
                    <button className="w-full flex items-center justify-between px-4 py-4 min-h-[48px] text-left hover:bg-[#F7F7F7] transition-colors">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-[rgba(34,34,34,0.5)]" />
                        <span className="text-[15px] font-semibold text-[#222222]">Edit profile</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[rgba(34,34,34,0.28)]" />
                    </button>
                    <div className="h-[1px] bg-[rgba(34,34,34,0.06)] mx-4" />
                    <button
                      onClick={() => setProfileSubView('alerts')}
                      className="w-full flex items-center justify-between px-4 py-4 min-h-[48px] text-left hover:bg-[#F7F7F7] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-[rgba(34,34,34,0.5)]" />
                        <span className="text-[15px] font-semibold text-[#222222]">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--terra)] text-white text-[11px] font-bold flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-[rgba(34,34,34,0.28)]" />
                    </button>
                    <div className="h-[1px] bg-[rgba(34,34,34,0.06)] mx-4" />
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-3 px-4 py-4 min-h-[48px] text-left hover:bg-[#F7F7F7] transition-colors"
                    >
                      <LogOut className="w-5 h-5 text-[var(--terra)]" />
                      <span className="text-[15px] font-semibold text-[var(--terra)]">Sign out</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Alerts/Notifications sub-view */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setProfileSubView('main')} className="p-2 -ml-2 hover:bg-[#F7F7F7] rounded-xl transition-colors">
                      <ChevronLeft className="w-5 h-5 text-[#222222]" />
                    </button>
                    <h1 className="text-[26px] font-extrabold text-[#222222]">Notifications</h1>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="text-center py-16">
                      <Bell className="w-12 h-12 text-[rgba(34,34,34,0.28)] mx-auto mb-4" />
                      <p className="text-[16px] font-semibold text-[#222222]">No notifications yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => !notif.read && markNotificationRead(notif.id)}
                          className={`w-full text-left bg-white rounded-[20px] p-4 shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] transition-all ${
                            notif.read ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-[rgba(34,34,34,0.1)]' : 'bg-[var(--terra)]'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] text-[#222222]">{notif.message}</p>
                              <p className="text-[13px] text-[rgba(34,34,34,0.28)] mt-1">
                                {formatDate(notif.created_at)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom fade gradient */}
      <div
        className="fixed left-0 right-0 z-30 pointer-events-none"
        style={{
          bottom: 60,
          height: 72,
          background: 'linear-gradient(to bottom, transparent 0%, #ffffff 100%)',
        }}
      />

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white z-40" style={{ borderTop: '1px solid rgba(34,34,34,0.1)' }}>
        <div className="max-w-md mx-auto flex pt-[10px] pb-[12px]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setView(tab.key); if (tab.key === 'profile') setProfileSubView('main'); }}
              className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold transition-all relative min-h-[44px] ${
                view === tab.key ? 'text-[var(--terra)]' : 'text-[rgba(34,34,34,0.28)]'
              }`}
            >
              <div className="relative">
                {tab.icon ? (
                  <tab.icon className="w-[22px] h-[22px]" />
                ) : (
                  avatarUrl ? (
                    <img src={avatarUrl} alt="" className={`w-[22px] h-[22px] rounded-full object-cover ${view === tab.key ? 'ring-1.5 ring-[var(--terra)]' : ''}`} />
                  ) : (
                    <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold ${
                      view === tab.key ? 'bg-[var(--terra)] text-white' : 'bg-[rgba(34,34,34,0.1)] text-[rgba(34,34,34,0.5)]'
                    }`}>
                      {userProfile.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )
                )}
                {tab.badge ? (
                  <span className={`absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${
                    tab.badgeColor || 'bg-[var(--terra)]'
                  }`}>
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && (
                <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-[var(--terra)] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
