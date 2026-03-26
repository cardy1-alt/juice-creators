import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DoodleIcon } from '../lib/doodle-icons';
import QRCodeDisplay from './QRCodeDisplay';
import CreatorOnboarding from './CreatorOnboarding';
import DisputeModal from './DisputeModal';
import LevelBadge from './LevelBadge';
import { getCategorySolidColor, getCategoryPastelBg, getCategoryPastelIcon, CategoryIcon } from '../lib/categories';
import { getInitials } from '../lib/avatar';
import { sendOfferClaimedCreatorEmail, sendNewClaimBusinessEmail } from '../lib/notifications';
import { uploadAvatar } from '../lib/upload';
import { getLevelProgress, getProfileCompleteness, checkStreakStatus, isStreakWarningPeriod, getCurrentMonth, getLevelColour } from '../lib/levels';

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
  min_level?: number;
  slotsUsed?: number;
  offer_type?: string | null;
  offer_item?: string | null;
  content_type?: string | null;
  specific_ask?: string | null;
  generated_title?: string | null;
  offer_photo_url?: string | null;
  businesses: { name: string; category: string; logo_url?: string | null; latitude?: number; longitude?: number; address?: string; bio?: string | null };
}

// ─── Star SVG for streaks (solid fill) ───────────────────────────────────
function FlameIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1L9.79 5.36L14.5 5.95L11.1 9.12L11.95 13.78L8 11.54L4.05 13.78L4.9 9.12L1.5 5.95L6.21 5.36L8 1Z"
        fill={color}
      />
    </svg>
  );
}

interface LeaderboardEntry {
  id: string;
  display_name: string | null;
  name: string;
  avatar_url: string | null;
  level: number;
  level_name: string;
  reels_this_week: number;
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
  snapshot_offer_item?: string | null;
  snapshot_specific_ask?: string | null;
  snapshot_generated_title?: string | null;
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
    claimed: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]',
    redeemed: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]',
    visited: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]',
    reel_due: 'bg-[rgba(232,160,32,0.12)] text-[var(--ochre)]',
    submitted: 'bg-[var(--terra)] text-white',
    expired: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]',
    overdue: 'bg-[var(--peach)] text-[var(--terra)] border border-[var(--terra-15)]',
    completed: 'bg-[var(--terra-10)] text-[var(--terra)]',
    disputed: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]',
  };
  return (
    <span className={`text-[13px] px-2.5 py-1 rounded-[999px] font-semibold ${styles[status] || 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]'}`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Scarcity colour shift helper ─────────────────────────────────────────
function getSlotsBadgeStyle(slotsLeft: number, _totalSlots: number) {
  if (slotsLeft === 0) {
    return { background: 'rgba(34,34,34,0.06)', color: 'rgba(34,34,34,0.4)', text: 'Full' };
  }
  if (slotsLeft === 1) {
    return { background: 'var(--terra)', color: 'white', text: 'Last slot' };
  }
  if (slotsLeft <= 3) {
    return { background: 'var(--terra-10)', color: 'var(--terra)', text: `${slotsLeft} left` };
  }
  return { background: 'rgba(34,34,34,0.06)', color: 'var(--ink-35)', text: `${slotsLeft} left` };
}

const cardPalette = ['var(--card)', '#E8EEE7', '#E4EAED', '#F5C4A0', '#EDE8D0'];
const getCardColor = (index: number) => cardPalette[index % cardPalette.length];

export default function CreatorApp() {
  const { userProfile, signOut } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activeClaims, setActiveClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [savedOffers, setSavedOffers] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'offers' | 'saved' | 'active' | 'claims' | 'profile' | 'all_offers'>('offers');
  const [showQrFullscreen, setShowQrFullscreen] = useState(false);
  const [qrScreenTab, setQrScreenTab] = useState<'pass' | 'reel'>('pass');
  const [qrOpenSource, setQrOpenSource] = useState<'home' | 'active'>('home');
  const [activePassIdx, setActivePassIdx] = useState(0);
  const [showReelCelebration, setShowReelCelebration] = useState<{ offerName: string; businessName: string } | null>(null);
  const [profileSubView, setProfileSubView] = useState<'main' | 'alerts' | 'edit'>('main');
  const [editName, setEditName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [reelUrl, setReelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [offersLoading, setOffersLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [collabsCompleted, setCollabsCompleted] = useState(0);
  const [disputeClaimId, setDisputeClaimId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
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
  const [waitlistedOffers, setWaitlistedOffers] = useState<Record<string, { id: string; position: number }>>({});
  const [waitlistLoading, setWaitlistLoading] = useState<string | null>(null);
  const [waitlistConfirmLeave, setWaitlistConfirmLeave] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [showLevelUpOverlay, setShowLevelUpOverlay] = useState<{ level: number; levelName: string } | null>(null);
  const [streakWarningDismissed, setStreakWarningDismissed] = useState(false);
  const [redeemToast, setRedeemToast] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const prevClaimStatusesRef = useRef<Record<string, string>>({});
  const passTouchRef = useRef<{ startX: number; startY: number } | null>(null);

  // ─── Chunk 4: Swipe stack state ─────────────────────────────────────────
  const [dismissedOfferIds, setDismissedOfferIds] = useState<Set<string>>(new Set());
  const [showClaimSuccess, setShowClaimSuccess] = useState<{ offerTitle: string; businessName: string } | null>(null);
  const [cardDragX, setCardDragX] = useState(0);
  const [cardDragY, setCardDragY] = useState(0);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [swipeExiting, setSwipeExiting] = useState<'left' | 'right' | null>(null);
  const cardDragStartRef = useRef<{ x: number; y: number } | null>(null);

  const { timeLeft, isOverdue } = useCountdown(selectedClaim?.reel_due_at || null);

  // Load saved offers from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nayba_saved_offers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setSavedOffers(new Set(parsed.filter((v): v is string => typeof v === 'string')));
      }
    } catch {}
  }, []);

  const toggleSaved = (offerId: string) => {
    const offer = offers.find(o => o.id === offerId);
    setSavedOffers(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) {
        next.delete(offerId);
        setUndoToast('Removed from saved');
        setTimeout(() => setUndoToast(null), 3000);
        // Remove from saved_businesses table
        if (offer) {
          supabase.from('saved_businesses').delete()
            .eq('creator_id', userProfile.id)
            .eq('business_id', offer.business_id)
            .then(() => {});
        }
      } else {
        next.add(offerId);
        // Save to saved_businesses table for notification triggers
        if (offer) {
          supabase.from('saved_businesses').upsert({
            creator_id: userProfile.id,
            business_id: offer.business_id,
          }, { onConflict: 'creator_id,business_id' }).then(() => {});
        }
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
      fetchWaitlist();
      fetchLeaderboard();
      checkLevelUp();
      checkAndResetStreak();
    }
  }, [userProfile]);

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const { data, error } = await supabase
        .from('weekly_leaderboard')
        .select('*')
        .order('reels_this_week', { ascending: false })
        .limit(10);
      if (data && !error) setLeaderboard(data as LeaderboardEntry[]);
    } catch {
      // view may not exist yet
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const checkLevelUp = () => {
    if (!userProfile?.level) return;
    const storedLevel = localStorage.getItem(`nayba_level_${userProfile.id}`);
    const currentLevel = userProfile.level || 1;
    if (storedLevel && parseInt(storedLevel) < currentLevel) {
      setShowLevelUpOverlay({ level: currentLevel, levelName: userProfile.level_name || 'Newcomer' });
    }
    localStorage.setItem(`nayba_level_${userProfile.id}`, String(currentLevel));
  };

  const checkAndResetStreak = async () => {
    if (!userProfile?.last_reel_month) return;
    const status = checkStreakStatus(userProfile.last_reel_month);
    if (status === 'broken' && userProfile.current_streak > 0) {
      await supabase
        .from('creators')
        .update({ current_streak: 0 })
        .eq('id', userProfile.id);
    }
    // Dismiss streak warning if already posted this month
    const dismissed = localStorage.getItem(`nayba_streak_dismiss_${getCurrentMonth()}`);
    if (dismissed) setStreakWarningDismissed(true);
  };

  const dismissStreakWarning = () => {
    setStreakWarningDismissed(true);
    localStorage.setItem(`nayba_streak_dismiss_${getCurrentMonth()}`, 'true');
  };

  const fetchWaitlist = async () => {
    const { data } = await supabase
      .from('waitlist')
      .select('id, offer_id')
      .eq('creator_id', userProfile.id);
    if (data) {
      const map: Record<string, { id: string; position: number }> = {};
      for (const entry of data) {
        // Get position for this entry
        const { count } = await supabase
          .from('waitlist')
          .select('*', { count: 'exact', head: true })
          .eq('offer_id', entry.offer_id)
          .lte('created_at', new Date().toISOString());
        map[entry.offer_id] = { id: entry.id, position: count || 1 };
      }
      setWaitlistedOffers(map);
    }
  };

  const joinWaitlist = async (offerId: string) => {
    setWaitlistLoading(offerId);
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert({ offer_id: offerId, creator_id: userProfile.id });
      if (error) throw error;
      await fetchWaitlist();
    } catch (err: any) {
      setClaimError(err?.code === '23505' ? 'You are already on this waitlist.' : 'Failed to join waitlist. Please try again.');
    } finally {
      setWaitlistLoading(null);
    }
  };

  const leaveWaitlist = async (offerId: string) => {
    setWaitlistLoading(offerId);
    try {
      const entry = waitlistedOffers[offerId];
      if (entry) {
        await supabase.from('waitlist').delete().eq('id', entry.id);
        setWaitlistedOffers(prev => {
          const next = { ...prev };
          delete next[offerId];
          return next;
        });
      }
    } catch {
      setClaimError('Failed to leave waitlist. Please try again.');
    } finally {
      setWaitlistLoading(null);
      setWaitlistConfirmLeave(null);
    }
  };

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
    setOffersLoading(true);
    const { data, error } = await supabase
      .from('offers')
      .select('*, businesses(name, category, latitude, longitude, address, logo_url, bio)')
      .eq('is_live', true);

    if (error) {
      console.error('Error fetching offers:', error);
      setOffersLoading(false);
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
    setOffersLoading(false);
  };

  const fetchClaims = async () => {
    const { data, error } = await supabase
      .from('claims')
      .select('*, offers(description, generated_title, offer_item, specific_ask, content_type), businesses(name, category, logo_url)')
      .eq('creator_id', userProfile.id)
      .not('status', 'in', '(expired)')
      .order('claimed_at', { ascending: false });

    if (error) {
      console.error('Error fetching claims:', error);
      return;
    }

    if (data) {
      // Filter out claims with missing join data to prevent render crashes
      const newClaims = (data as Claim[]).filter(c => c.businesses && c.offers);
      // Detect newly redeemed claims to show confirmation toast
      for (const claim of newClaims) {
        const prev = prevClaimStatusesRef.current[claim.id];
        if (prev === 'active' && claim.status === 'redeemed') {
          const bizName = (claim as any).businesses?.name;
          setRedeemToast(bizName ? `Visit confirmed at ${bizName}!` : 'Visit confirmed! Time to post your reel.');
          setTimeout(() => setRedeemToast(null), 5000);
        }
      }
      prevClaimStatusesRef.current = Object.fromEntries(newClaims.map(c => [c.id, c.status]));

      setClaims(newClaims);
      const active = newClaims.filter(c =>
        c.status === 'active' ||
        c.status === 'claimed' ||
        c.status === 'visited' ||
        c.status === 'reel_due' ||
        (c.status === 'redeemed' && !c.reel_url)
      );
      setActiveClaims(active);
      if (selectedClaim && !active.find(c => c.id === selectedClaim.id)) {
        setSelectedClaim(active[0] || null);
      } else if (!selectedClaim && active.length > 0) {
        setSelectedClaim(active[0]);
      }
    }
  };

  const handleClaim = async (offer: Offer): Promise<boolean> => {
    setLoading(true);
    setClaimError(null);
    try {
      const { data, error } = await supabase.rpc('claim_offer', {
        p_offer_id: offer.id,
        p_creator_id: userProfile.id,
      });

      if (error) throw error;
      if (data?.error) {
        const errorMessages: Record<string, string> = {
          'monthly_cap_reached': 'This offer has reached its monthly limit. Try again next month or join the waitlist.',
          'already_claimed': 'You already have an active claim for this offer.',
          'not_approved': 'Your account needs to be approved before claiming offers.',
          'offer_not_live': 'This offer is no longer available.',
        };
        setClaimError(errorMessages[data.error] || data.error);
        return false;
      }

      setView('active');
      fetchOffers();
      fetchClaims();

      // Send transactional emails (non-blocking)
      const offerTitle = offer.generated_title || offer.description;
      const businessName = offer.businesses?.name || 'a local business';
      sendOfferClaimedCreatorEmail(userProfile.id, offerTitle, businessName).catch(() => {});
      sendNewClaimBusinessEmail(offer.business_id, userProfile.display_name || userProfile.name, offerTitle).catch(() => {});
      return true;
    } catch (error: any) {
      setClaimError(error.message || 'Failed to claim offer');
      return false;
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

  const handleSubmitReel = async (): Promise<boolean> => {
    if (!reelUrl || !selectedClaim) return false;
    setReelError(null);

    if (selectedClaim.reel_due_at && new Date() > new Date(selectedClaim.reel_due_at)) {
      setReelError('The deadline for this reel has passed. Please contact support if you need an extension.');
      return false;
    }

    const instagramPattern = /^https:\/\/(www\.)?instagram\.com\//i;
    if (!instagramPattern.test(reelUrl)) {
      setReelError('Please enter a valid Instagram reel URL (https://instagram.com/reel/...)');
      return false;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({ reel_url: reelUrl, reel_submitted_at: new Date().toISOString(), status: 'completed' })
        .eq('id', selectedClaim.id);
      if (error) throw error;

      // Update creator stats: total_reels, streak, last_reel_month
      const currentMonth = getCurrentMonth();
      const newTotalReels = (userProfile.total_reels || 0) + 1;
      const isNewMonth = userProfile.last_reel_month !== currentMonth;
      const newStreak = isNewMonth ? (userProfile.current_streak || 0) + 1 : (userProfile.current_streak || 0);
      const newLongest = Math.max(newStreak, userProfile.longest_streak || 0);

      await supabase
        .from('creators')
        .update({
          total_reels: newTotalReels,
          current_streak: newStreak,
          longest_streak: newLongest,
          last_reel_month: currentMonth,
        })
        .eq('id', userProfile.id);

      // Show celebration overlay
      const celebOfferName = selectedClaim.snapshot_generated_title || selectedClaim.offers.generated_title || selectedClaim.offers.description || '';
      const celebBizName = selectedClaim.businesses?.name || '';

      setReelUrl('');
      setReelError(null);
      fetchClaims();
      fetchCollabsCompleted();

      setShowReelCelebration({ offerName: celebOfferName, businessName: celebBizName });
      return true;
    } catch (error: any) {
      setReelError(error.message || 'Failed to submit reel');
      return false;
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

  const isPendingApproval = !userProfile?.approved;

  // If pending approval and not on profile view, force to profile
  if (isPendingApproval && view !== 'profile') {
    setView('profile');
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
  const activeBadgeColor = 'bg-[var(--terra)]';

  const foodCategories = ['restaurant', 'cafe', 'bakery', 'bar', 'food truck', 'food', 'coffee', 'juice bar', 'dessert', 'pizza', 'brunch'];
  const beautyCategories = ['salon', 'spa', 'beauty', 'nails', 'hair', 'skincare', 'barbershop', 'wellness'];

  const getCategoryGroup = (category: string) => {
    const lower = category.toLowerCase();
    if (foodCategories.some(c => lower.includes(c))) return 'food';
    if (beautyCategories.some(c => lower.includes(c))) return 'beauty';
    return 'more';
  };

  const categoryTabs = [
    { key: 'all', label: 'All', icon: 'home' as const },
    { key: 'food', label: 'Food', icon: 'coffee' as const },
    { key: 'beauty', label: 'Beauty', icon: 'sparkles' as const },
    { key: 'more', label: 'More', icon: 'grid' as const },
  ];

  const tabs = [
    { key: 'offers' as const, label: 'Discover', icon: 'discover' as const },
    { key: 'claims' as const, label: 'Claims', icon: 'claims' as const, pip: activeClaims.length > 0 },
    { key: 'all_offers' as const, label: 'All offers', icon: 'all_offers' as const },
  ];

  // ─── Chunk 4: Swipe stack helpers ────────────────────────────────────────

  const getCategoryColour = (category: string): string => {
    const lower = (category || '').toLowerCase();
    if (lower.includes('food') || lower.includes('restaurant') || lower.includes('bar') || lower.includes('pizza') || lower.includes('brunch') || lower.includes('dessert') || lower.includes('juice')) return 'var(--cat-food)';
    if (lower.includes('beauty') || lower.includes('hair') || lower.includes('salon') || lower.includes('nails') || lower.includes('barbershop') || lower.includes('skincare')) return 'var(--cat-beauty)';
    if (lower.includes('cafe') || lower.includes('coffee') || lower.includes('bakery')) return 'var(--cat-cafe)';
    if (lower.includes('wellness') || lower.includes('spa')) return 'var(--cat-wellness)';
    if (lower.includes('fitness') || lower.includes('health') || lower.includes('gym')) return 'var(--cat-fitness)';
    return 'var(--cat-fitness)';
  };

  const getCategoryEmoji = (category: string): string => {
    const lower = (category || '').toLowerCase();
    if (lower.includes('food') || lower.includes('restaurant') || lower.includes('pizza') || lower.includes('brunch')) return '🍽️';
    if (lower.includes('cafe') || lower.includes('coffee') || lower.includes('bakery')) return '☕';
    if (lower.includes('beauty') || lower.includes('hair') || lower.includes('salon') || lower.includes('nails')) return '✂️';
    if (lower.includes('wellness') || lower.includes('spa')) return '🧖';
    if (lower.includes('fitness') || lower.includes('health') || lower.includes('gym')) return '💪';
    if (lower.includes('retail') || lower.includes('shop')) return '🛍️';
    if (lower.includes('art') || lower.includes('entertainment')) return '🎨';
    if (lower.includes('education')) return '📚';
    if (lower.includes('pet')) return '🐾';
    return '✨';
  };

  const handleSwipeClaim = async (offer: Offer) => {
    const offerTitle = offer.generated_title || offer.description;
    const businessName = offer.businesses?.name || '';
    const success = await handleClaim(offer);
    if (success) {
      // Override handleClaim's navigation to 'active' — stay on discover, show overlay
      setView('offers');
      setShowClaimSuccess({ offerTitle, businessName });
    }
  };

  const startCardDrag = (startX: number, startY: number, offer: Offer, isTouch: boolean) => {
    if (swipeExiting) return;
    let dx = 0;
    let dy = 0;
    setIsDraggingCard(true);
    setCardDragX(0);
    setCardDragY(0);

    const handleMove = (clientX: number, clientY: number) => {
      dx = clientX - startX;
      dy = clientY - startY;
      setCardDragX(dx);
      setCardDragY(dy);
    };

    const handleEnd = () => {
      cleanup();
      setIsDraggingCard(false);

      if (dx > 85) {
        setSwipeExiting('right');
        setTimeout(() => {
          setDismissedOfferIds(prev => new Set([...prev, offer.id]));
          setSwipeExiting(null);
          setCardDragX(0);
          setCardDragY(0);
          handleSwipeClaim(offer);
        }, 280);
      } else if (dx < -85) {
        setSwipeExiting('left');
        setTimeout(() => {
          setDismissedOfferIds(prev => new Set([...prev, offer.id]));
          setSwipeExiting(null);
          setCardDragX(0);
          setCardDragY(0);
        }, 280);
      } else {
        setCardDragX(0);
        setCardDragY(0);
      }
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => handleEnd();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => handleEnd();

    const cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };

    if (isTouch) {
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchEnd);
    } else {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  // Helper to render business avatar
  const renderBusinessAvatar = (name: string, category: string, logoUrl?: string | null, size = 46) => {
    return (
      <div
        className="rounded-[12px] flex items-center justify-center"
        style={{ width: size, height: size, background: 'var(--card)' }}
      >
        <CategoryIcon category={category} className="w-[20px] h-[20px]" style={{ color: 'rgba(34,34,34,0.5)' }} />
      </div>
    );
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--shell)]">
      {showOnboarding && (
        <CreatorOnboarding
          profile={userProfile}
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--ink)] text-white text-[15px] font-semibold px-5 py-2.5 rounded-full shadow-lg">
          {undoToast}
        </div>
      )}

      {redeemToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--ink)] text-white text-[15px] font-semibold px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2">
          <DoodleIcon name="check" size={16} />
          {redeemToast}
        </div>
      )}

      {/* Level Up Overlay */}
      {showLevelUpOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(34,34,34,0.85)' }}>
          <div className="bg-[var(--card)] rounded-[18px] p-[36px_28px] text-center max-w-[320px] mx-4">
            <div className="flex justify-center mb-5">
              <LevelBadge level={showLevelUpOverlay.level} levelName={showLevelUpOverlay.levelName} size="lg" />
            </div>
            <h2 className="text-[26px] text-[var(--ink)] mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>
              You're now a {showLevelUpOverlay.levelName === 'Nayba' ? '✦ Nayba' : showLevelUpOverlay.levelName}
            </h2>
            <p className="text-[18px] text-[var(--ink-60)] mb-6 leading-[1.5]">
              {showLevelUpOverlay.level === 2 && 'You posted your first reel. You can now access more offers.'}
              {showLevelUpOverlay.level === 3 && 'Businesses are starting to notice you. Keep it up.'}
              {showLevelUpOverlay.level === 4 && "You're a local favourite. Premium offers are unlocking."}
              {showLevelUpOverlay.level === 5 && 'Trusted creator status. The best offers are now available to you.'}
              {showLevelUpOverlay.level === 6 && 'The highest tier. You are a Nayba.'}
            </p>
            <button
              onClick={() => setShowLevelUpOverlay(null)}
              className="w-full py-[13px] rounded-[999px] text-[15px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}
            >
              Keep going →
            </button>
          </div>
        </div>
      )}

      {/* Claim Success Overlay (Chunk 4 — swipe stack) */}
      {showClaimSuccess && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(34,34,34,0.48)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={() => setShowClaimSuccess(null)}
        >
          <div
            style={{
              background: 'var(--shell)',
              borderRadius: 22,
              padding: '28px 24px',
              maxWidth: 320,
              width: 'calc(100% - 48px)',
              textAlign: 'center' as const,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Checkmark circle */}
            <div style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <h3 style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: 21,
              color: 'var(--ink)',
              margin: '0 0 8px',
              letterSpacing: '-0.03em',
            }}>{showClaimSuccess.offerTitle}</h3>

            <p style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 400,
              fontSize: 13,
              color: 'var(--ink-60)',
              margin: '0 0 20px',
              lineHeight: 1.5,
            }}>Show your QR code at the door. Post your reel within 48 hours of visiting.</p>

            <button
              onClick={() => {
                setShowClaimSuccess(null);
                setView('claims');
              }}
              style={{
                width: '100%',
                padding: '13px 0',
                borderRadius: 999,
                border: 'none',
                background: 'var(--terra)',
                color: 'white',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >View my claims →</button>
          </div>
        </div>
      )}

      {/* Fullscreen QR Pass Overlay */}
      {showQrFullscreen && selectedClaim && (() => {
        const qrClaim = selectedClaim;
        const qrOfferTitle = qrClaim.snapshot_generated_title || qrClaim.offers.generated_title || qrClaim.offers.description || '';
        const isReelDue = !!(qrClaim.redeemed_at && !qrClaim.reel_url);
        const reelDueTimeLeft = (() => {
          if (!qrClaim.reel_due_at) return '';
          const diff = new Date(qrClaim.reel_due_at).getTime() - Date.now();
          if (diff <= 0) return 'Overdue';
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          return `${h}h ${m}m`;
        })();
        const activeTab = isReelDue ? qrScreenTab : 'pass' as const;
        const isSubmitEnabled = reelUrl.startsWith('http') && reelUrl.length > 4;
        return (
          <div
            className="fixed top-0 left-0 right-0 bottom-0"
            style={{ zIndex: 9999, overflowY: 'auto', background: activeTab === 'pass' ? 'var(--terra)' : 'var(--shell)' }}
          >
            {/* Back button — fixed so it stays visible when scrolling */}
            <button
              onClick={() => { setShowQrFullscreen(false); setReelError(null); setReelUrl(''); }}
              className="fixed top-[12px] left-[12px] flex items-center gap-1 text-[17px] font-semibold min-w-[44px] min-h-[44px] px-[8px]"
              style={{ zIndex: 10000, borderRadius: 8, color: activeTab === 'pass' ? '#FFFFFF' : 'var(--ink)' }}
            >
              ← Back
            </button>
            <div className="flex flex-col items-center w-full px-[20px]" style={{ paddingTop: 48, paddingBottom: 40 }}>
              {/* Offer name + business name */}
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 24, color: activeTab === 'pass' ? '#FFFFFF' : 'var(--ink)', letterSpacing: '-0.03em', textAlign: 'center', margin: 0, lineHeight: 1.15 }}>{qrOfferTitle}</p>
              <p className="text-[16px] text-center mt-[2px]" style={{ color: activeTab === 'pass' ? 'rgba(255,255,255,0.7)' : 'var(--ink-60)' }}>{qrClaim.businesses.name}</p>

              {/* Segmented toggle — only for reel_due */}
              {isReelDue && (
                <div
                  className="relative flex items-center mt-[20px]"
                  style={{ width: 240, height: 42, background: activeTab === 'pass' ? 'rgba(255,255,255,0.2)' : 'var(--card)', borderRadius: 999, padding: 3 }}
                >
                  {/* Sliding active indicator */}
                  <div
                    className="absolute"
                    style={{
                      width: 'calc(50% - 3px)',
                      height: 36,
                      borderRadius: 999,
                      background: activeTab === 'pass' ? '#FFFFFF' : 'var(--ink)',
                      left: activeTab === 'pass' ? 3 : 'calc(50%)',
                      transition: 'all 0.2s ease',
                    }}
                  />
                  <button
                    onClick={() => setQrScreenTab('pass')}
                    className="relative flex-1 text-center text-[18px] font-semibold"
                    style={{ height: 36, lineHeight: '36px', color: activeTab === 'pass' ? 'var(--terra)' : 'rgba(34,34,34,0.88)', borderRadius: 999 }}
                  >
                    Show pass
                  </button>
                  <button
                    onClick={() => setQrScreenTab('reel')}
                    className="relative flex-1 text-center text-[18px] font-semibold"
                    style={{ height: 36, lineHeight: '36px', color: activeTab === 'reel' ? '#FFFFFF' : 'rgba(255,255,255,0.7)', borderRadius: 999 }}
                  >
                    Submit reel
                  </button>
                </div>
              )}

              {/* === SHOW PASS STATE === */}
              {activeTab === 'pass' && (
                <div className="flex flex-col items-center w-full" style={{ marginTop: 16, minHeight: isReelDue ? undefined : 'calc(100vh - 240px)', justifyContent: isReelDue ? undefined : 'center' }}>
                  <QRCodeDisplay
                    token={qrClaim.qr_token}
                    claimId={qrClaim.id}
                    creatorCode={userProfile.code}
                    size={220}
                    hideExtras
                  />
                  {/* Ref code pill */}
                  <span
                    className="text-[17px] text-white inline-block rounded-full mt-[20px]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '1.5px', background: 'var(--ink)', padding: '10px 20px' }}
                  >
                    {userProfile.code}
                  </span>
                  {/* Refresh countdown */}
                  <p className="text-[15px] mt-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Auto-refreshes every 30s</p>
                  {/* Level badge — white with low opacity background */}
                  <div className="mt-[20px] rounded-full px-[14px] py-[6px]" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <span className="text-[14px] font-semibold text-white">{userProfile.level_name || 'Newcomer'}</span>
                  </div>
                </div>
              )}

              {/* === SUBMIT REEL STATE === */}
              {activeTab === 'reel' && isReelDue && (
                <div className="flex flex-col w-full" style={{ marginTop: 24, minHeight: '75vh' }}>
                  {/* Timer block */}
                  <div style={{ background: 'rgba(245,196,160,0.12)', border: '1.5px solid #F5C4A0', borderRadius: 12, padding: 16 }}>
                    <div className="flex items-center gap-[8px]">
                      <DoodleIcon name="clock" size={16} className="text-[var(--ink-60)]" />
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 18, color: 'var(--ink)' }}>
                        {reelDueTimeLeft ? `${reelDueTimeLeft} remaining` : 'Post your reel now'}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 16, color: 'rgba(34,34,34,0.68)', marginTop: 8, lineHeight: 1.6 }}>
                      Post your reel within this window — it must clearly feature the business.
                    </p>
                  </div>

                  {/* Reel URL input */}
                  <div style={{ marginTop: 20 }}>
                    <label className="text-[15px] font-semibold text-[var(--ink)]" style={{ marginBottom: 8, display: 'block' }}>
                      Reel URL
                    </label>
                    <input
                      type="url"
                      value={reelUrl}
                      onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
                      placeholder="https://instagram.com/reel/"
                      className="w-full text-[17px] text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none"
                      style={{ background: 'var(--card)', border: '1.5px solid rgba(34,34,34,0.08)', borderRadius: 999, padding: '14px 16px', fontSize: '16px' }}
                      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--ink)'; }}
                      onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(34,34,34,0.15)'; }}
                    />
                    {reelError ? (
                      <p className="text-[15px] text-[var(--ink-60)] mt-[8px]">Please check the URL and try again.</p>
                    ) : (
                      <p className="text-[14px] text-[var(--ink-35)] mt-[8px]">Paste the link from Instagram after you've posted.</p>
                    )}
                  </div>

                  {/* Submit button */}
                  <button
                    onClick={async () => {
                      const success = await handleSubmitReel();
                      if (success) {
                        setShowQrFullscreen(false);
                      }
                    }}
                    disabled={loading || !isSubmitEnabled}
                    className="w-full text-white text-[18px] font-bold flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: isSubmitEnabled ? 'var(--terra)' : 'var(--terra-40)',
                      height: 52,
                      borderRadius: 999,
                      marginTop: 16,
                      cursor: isSubmitEnabled && !loading ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting…
                      </>
                    ) : 'Submit'}
                  </button>

                  {/* Spacer + report link */}
                  <div style={{ flexGrow: 1 }} />
                  <button
                    onClick={() => setDisputeClaimId(qrClaim.id)}
                    className="w-full text-center text-[14px] text-[var(--ink-35)] min-h-[44px]"
                    style={{ marginTop: 24 }}
                  >
                    Report an issue
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Reel Celebration Overlay */}
      {showReelCelebration && (() => {
        const celebrationStyles = `
          @keyframes checkDraw {
            0% { stroke-dashoffset: 48; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes confettiFall {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .confetti-piece { animation: none !important; display: none; }
          }
        `;
        const confettiColors = ['#1A4A2E', '#F5C4A0', '#C8B8F0', '#F4A8C0'];
        const confettiPieces = Array.from({ length: 30 }, (_, i) => ({
          id: i,
          left: Math.random() * 100,
          size: 6 + Math.random() * 6,
          color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
          delay: Math.random() * 1.5,
          duration: 1.5 + Math.random() * 1.5,
          drift: -20 + Math.random() * 40,
        }));
        return (
          <div className="fixed top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center" style={{ zIndex: 9999, background: 'var(--terra)' }}>
            <style>{celebrationStyles}</style>
            {/* Confetti */}
            {confettiPieces.map(p => (
              <div
                key={p.id}
                className="confetti-piece"
                style={{
                  position: 'absolute',
                  top: -10,
                  left: `${p.left}%`,
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size > 9 ? '50%' : '2px',
                  background: p.color,
                  animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
                  transform: `translateX(${p.drift}px)`,
                  opacity: 0,
                  animationFillMode: 'forwards',
                }}
              />
            ))}
            {/* Animated checkmark */}
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" stroke="white" strokeWidth="3" opacity="0.3" />
              <path
                d="M24 40L35 51L56 30"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 48,
                  strokeDashoffset: 48,
                  animation: 'checkDraw 0.6s 0.3s ease forwards',
                }}
              />
            </svg>
            <h2 className="text-[36px] text-white text-center mt-[24px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>
              Reel submitted!
            </h2>
            <p className="text-[18px] text-white text-center mt-[8px]" style={{ opacity: 0.6 }}>
              {showReelCelebration.offerName}
            </p>
            <p className="text-[18px] text-white text-center mt-[2px]" style={{ opacity: 0.6 }}>
              {showReelCelebration.businessName}
            </p>
            <div className="mt-[16px]">
              <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="lg" />
            </div>
            <button
              onClick={() => { setShowReelCelebration(null); setView('offers'); }}
              className="mt-[32px] px-[24px] py-[13px] rounded-[999px] text-white text-[15px] min-h-[48px]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, background: 'var(--terra)' }}
            >
              Back to explore
            </button>
          </div>
        );
      })()}

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
        const detailCreatorLevel = userProfile.level || 1;
        const detailMinLevel = offer.min_level || 1;
        const detailIsLocked = detailCreatorLevel < detailMinLevel;
        const detailLockedName = detailMinLevel === 2 ? 'Explorer' : detailMinLevel === 3 ? 'Regular' : detailMinLevel === 4 ? 'Local' : detailMinLevel === 5 ? 'Trusted' : detailMinLevel === 6 ? 'Nayba' : 'Newcomer';
        const detailReelsToUnlock = (() => {
          const thresholds = [0, 1, 3, 6, 11, 21];
          const needed = thresholds[detailMinLevel - 1] || 0;
          return Math.max(0, needed - (userProfile.total_reels || 0));
        })();

        return (
          <div className="fixed inset-0 z-50 bg-[var(--shell)] flex flex-col">
            {/* Hero — category colour */}
            <div className="relative overflow-hidden flex flex-col justify-end" style={{ minHeight: 220, background: getCategoryPastelBg(offer.businesses.category) }}>
              {/* Back button — 40% opacity */}
              <button
                onClick={() => setExpandedOffer(null)}
                className="absolute top-[16px] left-[16px] w-[36px] h-[36px] rounded-full flex items-center justify-center"
              >
                <DoodleIcon name="chevron-left" size={18} style={{ color: 'rgba(34,34,34,0.4)' }} />
              </button>
              {/* Locked overlay on hero */}
              {detailIsLocked && (
                <div className="absolute inset-0" style={{ background: 'rgba(34,34,34,0.25)' }} />
              )}
              {/* Save button — 40% opacity */}
              <button
                onClick={() => toggleSaved(offer.id)}
                className="absolute top-[16px] right-[16px] w-[36px] h-[36px] rounded-full flex items-center justify-center"
              >
                <DoodleIcon name="heart" size={16} style={{ color: 'rgba(34,34,34,0.4)' }} />
              </button>
              {/* Text overlay */}
              <div className="relative px-[20px] pb-[20px] pt-[56px]">
                <CategoryIcon category={offer.businesses.category} className="w-[44px] h-[44px] mb-[10px]" style={{ color: 'rgba(34,34,34,0.4)' }} />
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0 }}>
                  {offer.generated_title || (offer.description.length > 50 ? offer.description.slice(0, 50) + '…' : offer.description)}
                </p>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'rgba(34,34,34,0.5)', margin: '6px 0 0' }}>{offer.businesses.name}</p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-[var(--shell)]">
              <div className="p-[20px]">
                {/* Level requirement banner */}
                {detailIsLocked && (
                  <div className="flex items-start gap-3 rounded-[12px] p-[12px_14px] mb-[20px]" style={{ background: 'rgba(34,34,34,0.04)' }}>
                    <DoodleIcon name="lock" size={14} className="text-[var(--ink-60)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--ink)', margin: 0 }}>{detailLockedName} creators only</p>
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'rgba(34,34,34,0.5)', marginTop: 2, margin: '2px 0 0' }}>You're Level {detailCreatorLevel} · {detailReelsToUnlock} more reel{detailReelsToUnlock !== 1 ? 's' : ''} to unlock</p>
                    </div>
                  </div>
                )}

                {/* A) Scarcity / urgency row */}
                <div className="flex items-center gap-[20px] mb-[20px]">
                  <div className="flex items-center gap-1.5">
                    <DoodleIcon name="users" size={14} style={{ color: 'rgba(34,34,34,0.5)' }} />
                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'rgba(34,34,34,0.5)' }}>
                      {isUnlimited ? 'Open availability' : full ? 'Sold out' : `${slotsLeft} left`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DoodleIcon name="clock" size={14} style={{ color: 'rgba(34,34,34,0.5)' }} />
                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'rgba(34,34,34,0.5)' }}>48hrs to post</span>
                  </div>
                </div>

                {/* B) WHAT TO POST label */}
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(34,34,34,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10, margin: '0 0 10px' }}>WHAT TO POST</p>

                {/* C) Primary post requirement */}
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--ink)', lineHeight: 1.3, margin: '0 0 14px' }}>One Instagram Reel</p>

                {/* D) Checklist items — no duplicates */}
                <div className="flex flex-col gap-[10px] mb-[24px]">
                  {[
                    'Post within 48 hours of your visit',
                    'Tag the business in your reel',
                    'Submit your reel link in the app',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <DoodleIcon name="check" size={13} style={{ color: 'rgba(34,34,34,0.5)', marginTop: 3, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 16, color: 'rgba(34,34,34,0.7)' }}>{item}</span>
                    </div>
                  ))}
                </div>

                {/* E) They'd love if you… (only if specific_ask exists) */}
                {offer.specific_ask && (
                  <div className="mb-[24px]">
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(34,34,34,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 10px' }}>THEY'D LOVE IF YOU…</p>
                    <div className="rounded-[12px] p-[14px]" style={{ background: 'var(--card)' }}>
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 16, color: 'rgba(34,34,34,0.7)', lineHeight: 1.55, margin: 0 }}>{offer.specific_ask}</p>
                    </div>
                  </div>
                )}

                {/* F) About business */}
                {(offer.businesses.bio || offer.businesses.address) && (
                  <div className="mb-[24px]">
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(34,34,34,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 10px' }}>ABOUT</p>
                    {offer.businesses.bio && (
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'rgba(34,34,34,0.8)', lineHeight: 1.55, margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{offer.businesses.bio}</p>
                    )}
                    {offer.businesses.address && (
                      <div className="flex items-center gap-2">
                        <DoodleIcon name="location-pin" size={15} style={{ color: 'rgba(34,34,34,0.6)', flexShrink: 0 }} />
                        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'rgba(34,34,34,0.6)' }}>{offer.businesses.address}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky bottom bar */}
            <div className="px-[20px] py-[14px] bg-[var(--shell)]" style={{ boxShadow: '0 -1px 0 rgba(34,34,34,0.06)' }}>
              {detailIsLocked ? (
                <div
                  className="w-full py-[14px] rounded-[999px] text-center"
                  style={{ background: 'rgba(34,34,34,0.04)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'rgba(34,34,34,0.5)' }}
                >
                  Unlocks at {detailLockedName}
                </div>
              ) : full && waitlistedOffers[offer.id] ? (
                <div>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(34,34,34,0.5)', textAlign: 'center' as const, margin: '0 0 8px' }}>
                    You're #{waitlistedOffers[offer.id].position || '—'} on the waitlist
                  </p>
                  {waitlistConfirmLeave === offer.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => leaveWaitlist(offer.id)}
                        disabled={waitlistLoading === offer.id}
                        className="flex-1 py-[14px] rounded-[999px] text-center"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--ink)', border: '1.5px solid rgba(34,34,34,0.15)', background: 'transparent' }}
                      >
                        {waitlistLoading === offer.id ? 'Leaving...' : 'Yes, leave'}
                      </button>
                      <button
                        onClick={() => setWaitlistConfirmLeave(null)}
                        className="flex-1 py-[14px] rounded-[999px] text-center"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, color: 'rgba(34,34,34,0.5)', background: 'transparent' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setWaitlistConfirmLeave(offer.id)}
                      className="w-full py-[14px] rounded-[999px] text-center flex items-center justify-center gap-1"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, border: '1.5px solid var(--ink)', color: 'var(--ink)', background: 'transparent' }}
                    >
                      On waitlist <DoodleIcon name="check" size={16} />
                    </button>
                  )}
                </div>
              ) : full ? (
                <div>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(34,34,34,0.5)', textAlign: 'center' as const, margin: '0 0 8px' }}>All slots taken this month</p>
                  <button
                    onClick={() => joinWaitlist(offer.id)}
                    disabled={waitlistLoading === offer.id}
                    className="w-full py-[14px] rounded-[999px] text-center disabled:opacity-40"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, border: '1.5px solid rgba(34,34,34,0.15)', color: 'var(--ink)', background: 'transparent' }}
                  >
                    {waitlistLoading === offer.id ? 'Joining...' : 'Join waitlist'}
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(34,34,34,0.5)', textAlign: 'center' as const, margin: '0 0 8px' }}>
                    {alreadyClaimed ? 'You claimed this offer' : hasActiveBusiness ? 'You have an active visit here' : 'Post a reel within 48hrs'}
                  </p>
                  {alreadyClaimed ? (
                    <button
                      className="w-full py-[14px] rounded-[999px] text-center flex items-center justify-center gap-1.5"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, background: 'var(--terra)', color: '#FFFFFF' }}
                    >
                      <DoodleIcon name="check" size={16} className="text-white" /> Claimed
                    </button>
                  ) : hasActiveBusiness ? (
                    <button
                      disabled
                      className="w-full py-[14px] rounded-[999px] text-center cursor-not-allowed"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, background: 'var(--terra)', color: '#FFFFFF', opacity: 0.5 }}
                    >
                      Active
                    </button>
                  ) : (
                    <button
                      onClick={() => { handleClaim(offer); setExpandedOffer(null); }}
                      disabled={loading}
                      className="w-full py-[14px] rounded-[999px] text-center disabled:opacity-40 transition-all"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, background: 'var(--terra)', color: '#FFFFFF' }}
                    >
                      Claim
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className={`flex-1 ${view === 'offers' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <div className={`max-w-md mx-auto ${view === 'offers' ? 'h-full' : ''}`}>

        {/* Content */}
        <div className={view === 'offers' ? 'h-full' : 'pb-6'}>

          {/* -- DISCOVER SWIPE STACK (Chunk 4) -- */}
          {view === 'offers' && (() => {
            // Filter stack: exclude dismissed, already claimed, and full offers
            const stackOffers = offers.filter(o => {
              if (dismissedOfferIds.has(o.id)) return false;
              if (claims.some(c => c.offer_id === o.id && c.status !== 'expired')) return false;
              const isUnlimited = o.monthly_cap === null;
              if (!isUnlimited) {
                const slotsLeft = Math.max(0, (o.monthly_cap as number) - (o.slotsUsed || 0));
                if (slotsLeft === 0) return false;
              }
              return true;
            });

            const isEmpty = stackOffers.length === 0;
            const totalCardCount = offers.filter(o => {
              if (claims.some(c => c.offer_id === o.id && c.status !== 'expired')) return false;
              const isUnlimited = o.monthly_cap === null;
              if (!isUnlimited && Math.max(0, (o.monthly_cap as number) - (o.slotsUsed || 0)) === 0) return false;
              return true;
            }).length;
            const viewedCount = totalCardCount - stackOffers.length;

            return (
              <div className="flex flex-col h-full" style={{ background: 'var(--shell)' }}>
                {/* 1. Fixed header */}
                <div style={{
                  background: 'var(--shell)',
                  borderBottom: '1px solid var(--ink-08)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontWeight: 800,
                    fontSize: 26,
                    color: 'var(--ink)',
                    letterSpacing: '-0.03em',
                  }}>nayba</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Search button */}
                    <div style={{
                      width: 42,
                      height: 42,
                      background: 'var(--card)',
                      border: '1.5px solid var(--ink-08)',
                      borderRadius: 13,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                    </div>

                    {/* Avatar initials */}
                    <div style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'var(--card)',
                      border: '1.5px solid var(--ink-08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 600,
                      fontSize: 10,
                      color: 'var(--ink-60)',
                    }}>
                      {getInitials(userProfile?.display_name || userProfile?.name || '')}
                    </div>
                  </div>
                </div>

                {/* 2. Active claim bar (conditional) */}
                {activeClaims.length > 0 && activeClaims[0]?.businesses && activeClaims[0]?.offers && (() => {
                  const topClaim = activeClaims[0];
                  const claimTitle = topClaim.snapshot_generated_title || topClaim.offers.generated_title || topClaim.offers.description || '';
                  const claimBiz = topClaim.businesses?.name || '';
                  const claimTimer = (() => {
                    if (topClaim.reel_due_at) {
                      const diff = new Date(topClaim.reel_due_at).getTime() - Date.now();
                      if (diff <= 0) return 'Overdue';
                      const h = Math.floor(diff / (1000 * 60 * 60));
                      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      return `${h}h ${m}m`;
                    }
                    if (topClaim.qr_expires_at) {
                      const diff = new Date(topClaim.qr_expires_at).getTime() - Date.now();
                      if (diff <= 0) return 'Expired';
                      const h = Math.floor(diff / (1000 * 60 * 60));
                      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      return `${h}h ${m}m`;
                    }
                    return 'Active';
                  })();

                  return (
                    <button
                      onClick={() => setView('claims')}
                      style={{
                        width: '100%',
                        background: 'var(--ink)',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left' as const,
                      }}
                    >
                      <div>
                        <div style={{
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontWeight: 600,
                          fontSize: 9,
                          textTransform: 'uppercase' as const,
                          letterSpacing: '1px',
                          color: 'rgba(248,246,241,0.4)',
                          marginBottom: 2,
                        }}>ACTIVE CLAIM</div>
                        <div style={{
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontWeight: 500,
                          fontSize: 13,
                          color: 'rgba(248,246,241,0.92)',
                        }}>
                          {claimTitle} · {claimBiz}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{
                          background: 'var(--terra)',
                          borderRadius: 999,
                          padding: '3px 8px',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontWeight: 600,
                          fontSize: 10,
                          color: 'var(--shell)',
                        }}>{claimTimer}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(248,246,241,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </div>
                    </button>
                  );
                })()}

                {/* Claim error toast */}
                {claimError && (
                  <div style={{
                    margin: '8px 14px 0',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(34,34,34,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                  }}>
                    <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0 }}>{claimError}</p>
                    <button onClick={() => setClaimError(null)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-35)', marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer' }}>Dismiss</button>
                  </div>
                )}

                {/* 3. Card stack OR loading OR empty state */}
                {offersLoading ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink-35)', fontSize: 14 }}>Loading offers…</p>
                  </div>
                ) : isEmpty ? (
                  /* Empty state */
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column' as const,
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--shell)',
                    padding: '0 32px',
                    gap: 8,
                  }}>
                    <h2 style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 600,
                      fontSize: 24,
                      color: 'var(--ink)',
                      margin: 0,
                      letterSpacing: '-0.03em',
                    }}>All caught up</h2>
                    <p style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 400,
                      fontSize: 14,
                      color: 'var(--ink-60)',
                      textAlign: 'center' as const,
                      lineHeight: 1.5,
                      margin: '0 0 16px',
                    }}>New offers drop every Tuesday. Browse everything live below.</p>
                    <button
                      onClick={() => setView('all_offers')}
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'white',
                        background: 'var(--terra)',
                        border: 'none',
                        borderRadius: 999,
                        padding: '13px 24px',
                        cursor: 'pointer',
                      }}
                    >Browse all offers</button>
                  </div>
                ) : (
                  <>
                    {/* Card stack area */}
                    <div style={{ flex: 1, position: 'relative' as const, overflow: 'hidden' }}>
                      {stackOffers.slice(0, 3).map((offer, idx) => {
                        const isTop = idx === 0;

                        const isUnlimited = offer.monthly_cap === null;
                        const slotsUsed = offer.slotsUsed || 0;
                        const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);

                        let transform = '';
                        let transition = 'transform 0.28s ease';
                        const zIndex = idx === 0 ? 10 : idx === 1 ? 1 : 0;

                        if (isTop) {
                          if (swipeExiting === 'right') {
                            transform = `translateX(${window.innerWidth}px) rotate(20deg)`;
                          } else if (swipeExiting === 'left') {
                            transform = `translateX(-${window.innerWidth}px) rotate(-20deg)`;
                          } else if (isDraggingCard) {
                            transform = `translateX(${cardDragX}px) translateY(${cardDragY * 0.12}px) rotate(${cardDragX * 0.04}deg)`;
                            transition = 'none';
                          }
                        } else if (idx === 1) {
                          const progress = isDraggingCard ? Math.min(Math.abs(cardDragX) / 85, 1) : 0;
                          const scale = 0.96 + (0.04 * progress);
                          const ty = 10 - (10 * progress);
                          transform = `scale(${scale}) translateY(${ty}px)`;
                          if (isDraggingCard) transition = 'none';
                        } else if (idx === 2) {
                          const progress = isDraggingCard ? Math.min(Math.abs(cardDragX) / 85, 1) : 0;
                          const scale = 0.92 + (0.04 * progress);
                          const ty = 20 - (10 * progress);
                          transform = `scale(${scale}) translateY(${ty}px)`;
                          if (isDraggingCard) transition = 'none';
                        }

                        const defaultTransform = idx === 1 ? 'scale(0.96) translateY(10px)' : idx === 2 ? 'scale(0.92) translateY(20px)' : 'none';
                        const categoryColour = getCategoryColour(offer.businesses.category);
                        const categoryEmoji = getCategoryEmoji(offer.businesses.category);
                        const offerTitle = offer.generated_title || offer.description;
                        const bizAddress = offer.businesses.address || '';
                        const streetName = bizAddress.split(',')[0] || '';
                        const hintOpacity = isTop && isDraggingCard ? Math.min(Math.abs(cardDragX) / 60, 1) : 0;

                        return (
                          <div
                            key={offer.id}
                            style={{
                              position: 'absolute' as const,
                              top: 8,
                              left: 12,
                              right: 12,
                              bottom: 4,
                              zIndex,
                              transform: transform || defaultTransform,
                              transition,
                              borderRadius: 18,
                              border: '1px solid var(--ink-08)',
                              boxShadow: '0 2px 16px rgba(34,34,34,0.07)',
                              background: 'var(--shell)',
                              display: 'flex',
                              flexDirection: 'column' as const,
                              overflow: 'hidden',
                              touchAction: isTop ? 'none' as const : 'auto' as const,
                              userSelect: 'none' as const,
                              WebkitUserSelect: 'none' as const,
                            }}
                            onMouseDown={isTop ? (e: React.MouseEvent) => {
                              e.preventDefault();
                              startCardDrag(e.clientX, e.clientY, offer, false);
                            } : undefined}
                            onTouchStart={isTop ? (e: React.TouchEvent) => {
                              startCardDrag(e.touches[0].clientX, e.touches[0].clientY, offer, true);
                            } : undefined}
                          >
                            {/* Swipe hint labels */}
                            {isTop && (
                              <>
                                <div style={{
                                  position: 'absolute' as const,
                                  left: 16,
                                  top: 16,
                                  zIndex: 20,
                                  transform: 'rotate(-8deg)',
                                  opacity: cardDragX > 0 ? hintOpacity : 0,
                                  background: '#4E9468',
                                  borderRadius: 999,
                                  padding: '6px 16px',
                                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                                  fontWeight: 700,
                                  fontSize: 14,
                                  textTransform: 'uppercase' as const,
                                  letterSpacing: '1.2px',
                                  color: '#fff',
                                  pointerEvents: 'none' as const,
                                  boxShadow: '0 2px 8px rgba(78,148,104,0.35)',
                                }}>CLAIM</div>
                                <div style={{
                                  position: 'absolute' as const,
                                  right: 16,
                                  top: 16,
                                  zIndex: 20,
                                  transform: 'rotate(8deg)',
                                  opacity: cardDragX < 0 ? hintOpacity : 0,
                                  background: 'var(--terra)',
                                  borderRadius: 999,
                                  padding: '6px 16px',
                                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                                  fontWeight: 700,
                                  fontSize: 14,
                                  textTransform: 'uppercase' as const,
                                  letterSpacing: '1.2px',
                                  color: '#fff',
                                  pointerEvents: 'none' as const,
                                  boxShadow: '0 2px 8px rgba(196,103,74,0.35)',
                                }}>PASS</div>
                              </>
                            )}

                            {/* Emoji zone — proportional, flat category colour */}
                            <div style={{ flex: '2 0 0', position: 'relative' as const, overflow: 'hidden', minHeight: 120 }}>
                              <div style={{
                                width: '100%',
                                height: '100%',
                                background: categoryColour,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <span style={{ fontSize: 64, filter: 'drop-shadow(0 2px 6px rgba(34,34,34,0.10))', lineHeight: 1 }}>
                                  {categoryEmoji}
                                </span>
                              </div>

                              {/* Slot badge */}
                              {!isUnlimited && slotsLeft !== null && slotsLeft <= 3 && (
                                <span style={{
                                  position: 'absolute' as const,
                                  top: 12,
                                  right: 12,
                                  borderRadius: 999,
                                  padding: '4px 10px',
                                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                                  fontWeight: 700,
                                  fontSize: 11,
                                  ...(slotsLeft === 1 ? {
                                    background: 'var(--terra)',
                                    color: 'white',
                                  } : {
                                    background: 'var(--terra-10)',
                                    color: 'var(--terra)',
                                  }),
                                }}>
                                  {slotsLeft === 1 ? 'Last slot' : `${slotsLeft} left`}
                                </span>
                              )}
                            </div>

                            {/* Info panel */}
                            <div style={{
                              flex: '3 0 0',
                              background: 'var(--shell)',
                              borderTop: '1px solid var(--ink-08)',
                              padding: '20px 20px 16px',
                              display: 'flex',
                              flexDirection: 'column' as const,
                              justifyContent: 'center',
                              overflow: 'hidden',
                            }}>
                              {/* Category label */}
                              <span style={{
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                fontWeight: 600,
                                fontSize: 11,
                                textTransform: 'uppercase' as const,
                                letterSpacing: '1.2px',
                                color: 'var(--ink-35)',
                                marginBottom: 6,
                              }}>{offer.businesses.category}</span>

                              {/* Offer title */}
                              <span style={{
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                fontWeight: 400,
                                fontSize: 26,
                                letterSpacing: '-0.03em',
                                color: 'var(--ink)',
                                lineHeight: 1.12,
                                marginBottom: 14,
                              }}>{offerTitle}</span>

                              {/* Business row */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: offer.specific_ask ? 12 : 0 }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <span style={{
                                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                                    fontWeight: 500,
                                    fontSize: 14,
                                    color: 'var(--ink-60)',
                                    display: 'block',
                                    marginBottom: 2,
                                  }}>{offer.businesses.name}</span>
                                  {streetName && (
                                    <span style={{
                                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                                      fontWeight: 400,
                                      fontSize: 13,
                                      color: 'var(--ink-35)',
                                    }}>{streetName}</span>
                                  )}
                                </div>
                                <div style={{
                                  background: 'var(--card)',
                                  border: '1px solid var(--ink-08)',
                                  borderRadius: 999,
                                  padding: '4px 10px',
                                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                                  fontWeight: 500,
                                  fontSize: 11,
                                  color: 'var(--ink-35)',
                                  flexShrink: 0,
                                  marginLeft: 8,
                                }}>Nearby</div>
                              </div>

                              {/* Brief / specific ask */}
                              {offer.specific_ask && (
                                <div style={{
                                  background: 'var(--card)',
                                  borderRadius: 10,
                                  padding: '10px 12px',
                                }}>
                                  <span style={{
                                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                                    fontWeight: 400,
                                    fontSize: 13,
                                    color: 'var(--ink-60)',
                                    lineHeight: 1.5,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical' as const,
                                    overflow: 'hidden',
                                  }}><span style={{ fontWeight: 600, fontSize: 11, letterSpacing: '0.3px', color: 'var(--ink-35)' }}>Brief:</span> {offer.specific_ask}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 4. Progress dots */}
                    {totalCardCount > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        padding: '6px 0',
                        flexShrink: 0,
                      }}>
                        {totalCardCount <= 20 ? Array.from({ length: totalCardCount }, (_, i) => (
                          <div
                            key={i}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: i === viewedCount ? 'var(--ink-60)' : 'var(--ink-08)',
                              transform: i === viewedCount ? 'scale(1.2)' : 'none',
                              transition: 'background 0.2s, transform 0.2s',
                            }}
                          />
                        )) : (
                          /* Too many dots — show count instead */
                          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: 'var(--ink-35)' }}>
                            {viewedCount + 1} / {totalCardCount}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* 5. Action buttons — only when cards exist */}
                {!isEmpty && !offersLoading && (
                  <div style={{
                    background: 'var(--shell)',
                    borderTop: '1px solid var(--ink-08)',
                    padding: '8px 0 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 20,
                    flexShrink: 0,
                  }}>
                    {/* Pass button */}
                    <button
                      onClick={() => {
                        if (stackOffers.length === 0 || swipeExiting) return;
                        setSwipeExiting('left');
                        setTimeout(() => {
                          setDismissedOfferIds(prev => new Set([...prev, stackOffers[0].id]));
                          setSwipeExiting(null);
                          setCardDragX(0);
                          setCardDragY(0);
                        }, 280);
                      }}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'var(--card)',
                        border: '1px solid var(--ink-08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.12s',
                      }}
                      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)'; }}
                      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-60)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>

                    {/* Claim button */}
                    <button
                      onClick={() => {
                        if (stackOffers.length === 0 || swipeExiting) return;
                        const topOffer = stackOffers[0];
                        setSwipeExiting('right');
                        setTimeout(() => {
                          setDismissedOfferIds(prev => new Set([...prev, topOffer.id]));
                          setSwipeExiting(null);
                          setCardDragX(0);
                          setCardDragY(0);
                          handleSwipeClaim(topOffer);
                        }, 280);
                      }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'var(--terra)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(196,103,74,0.25)',
                        transition: 'transform 0.12s',
                      }}
                      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)'; }}
                      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* -- SAVED TAB -- */}
          {view === 'saved' && (() => {
            const matchedSaved = offers.filter(o => savedOffers.has(o.id));
            return (
            <div className="px-[20px] pt-5">
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-[28px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>Saved</h1>
                <span className="text-[15px] text-[var(--ink-60)]">{matchedSaved.length} saved</span>
              </div>

              {matchedSaved.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-[40px]">
                  {/* Heart with map pin SVG */}
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <path d="M40 68S14 48 14 32C14 22 22 14 32 14C36 14 39 16 40 18C41 16 44 14 48 14C58 14 66 22 66 32C66 48 40 68 40 68Z" stroke="var(--peach)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <circle cx="40" cy="36" r="6" stroke="var(--peach)" strokeWidth="2" fill="none" />
                    <circle cx="40" cy="36" r="2" fill="var(--peach)" />
                  </svg>
                  <p className="text-[20px] text-[var(--ink)] mt-[16px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '-0.03em' }}>Nothing saved yet</p>
                  <p className="text-[15px] text-[var(--ink-60)] text-center mt-[8px] max-w-[260px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, lineHeight: 1.65 }}>
                    Heart an offer on the explore feed to save it for later.
                  </p>
                  <button
                    onClick={() => setView('offers')}
                    className="mt-[20px] px-[24px] py-[13px] rounded-full text-white text-[15px] min-h-[44px]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, background: 'var(--terra)', borderRadius: 999 }}
                  >
                    Find offers
                  </button>
                </div>
              ) : (
                <div className="space-y-[14px]">
                  {matchedSaved.map(offer => {
                    const isUnlimited = offer.monthly_cap === null;
                    const slotsUsed = offer.slotsUsed || 0;
                    const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                    return (
                      <button
                        key={offer.id}
                        onClick={() => setExpandedOffer(offer.id)}
                        className="w-full rounded-[16px] p-[16px] flex items-center gap-4 text-left"
                        style={{ background: 'var(--card)', border: '1px solid var(--ink-08)', boxShadow: 'var(--shadow-md)' }}
                      >
                        {/* Category icon square */}
                        <div
                          className="rounded-[12px] flex-shrink-0 flex items-center justify-center"
                          style={{ width: 46, height: 46, background: 'var(--card)' }}
                        >
                          <CategoryIcon category={offer.businesses.category} className="w-[20px] h-[20px]" style={{ color: 'rgba(34,34,34,0.5)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[var(--ink)] truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>{offer.generated_title || offer.description}</p>
                          <p className="text-[12px] text-[var(--ink-60)] truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>{offer.businesses.name}</p>
                          <p className="text-[11px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: !isUnlimited && slotsLeft !== null ? getSlotsBadgeStyle(slotsLeft, offer.monthly_cap as number).color : 'var(--ink-60)' }}>
                            {isUnlimited ? 'Open availability' : getSlotsBadgeStyle(slotsLeft as number, offer.monthly_cap as number).text}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSaved(offer.id); }}
                          className="flex-shrink-0 p-2"
                        >
                          <DoodleIcon name="heart" size={20} className="text-[var(--terra)] fill-[var(--terra)]" />
                        </button>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })()}

          {/* -- ACTIVE PASSES -- */}
          {view === 'active' && (
            <>
              {activeClaims.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <DoodleIcon name="zap" size={48} className="text-[var(--ink-35)] mb-4" />
                  <p className="text-[20px] font-bold text-[var(--ink)] mb-1">No active claims</p>
                  <p className="text-[18px] text-[var(--ink-60)] mb-5">Claim an offer to get started</p>
                  <button
                    onClick={() => setView('offers')}
                    className="bg-[var(--terra)] text-white text-[15px] rounded-[999px] px-[24px] py-[13px] hover:bg-[var(--terra-hover)] transition-all"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}
                  >
                    Browse offers
                  </button>
                </div>
              ) : (
                <div>
                  {/* Pill tab strip */}
                  <div className="flex gap-2 overflow-x-auto px-[20px] pt-[14px] pb-0" style={{ scrollbarWidth: 'none' }}>
                    {activeClaims.filter(c => c.businesses && c.offers).map(claim => {
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
                          className={`whitespace-nowrap text-[14px] font-semibold rounded-[20px] px-[14px] flex-shrink-0 transition-all ${
                            isSelected
                              ? 'bg-[var(--ink)] text-[#FFFFFF]'
                              : 'text-[rgba(34,34,34,0.68)]'
                          }`}
                          style={!isSelected ? { background: 'var(--card)', height: '32px' } : { height: '32px' }}
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
                    {activeClaims.filter(c => c.businesses && c.offers).map((claim, claimIdx) => {
                      const currentStage = claim.reel_url
                        ? 'submitted'
                        : claim.redeemed_at
                        ? 'reel_due'
                        : 'claimed';

                      const stageIndex = currentStage === 'claimed' ? 0 : currentStage === 'reel_due' ? 2 : currentStage === 'submitted' ? 3 : 1;
                      const stageLabels = ['Claimed', 'Visited', 'Reel Due', 'Done'];

                      // Use snapshot fields (frozen at claim time) if available, fall back to live offer data
                      const desc = claim.snapshot_generated_title || claim.offers.generated_title || claim.offers.description || '';
                      const breakPoints = [' in exchange', ' for a', ' for an', ' when you', ' with your'];
                      let offerTitle = desc;
                      let foundBreak = false;
                      for (const bp of breakPoints) {
                        const bpIdx = desc.indexOf(bp);
                        if (bpIdx > 0 && bpIdx <= 50) { offerTitle = desc.slice(0, bpIdx); foundBreak = true; break; }
                      }
                      if (!foundBreak && desc.length > 40) offerTitle = desc.slice(0, 40).trimEnd() + '…';

                      const isPassCard = currentStage === 'claimed';
                      const cardBg = isPassCard ? 'var(--terra)' : 'var(--shell)';

                      return (
                        <div
                          key={claim.id}
                          className="flex-shrink-0 w-full"
                          style={{ scrollSnapAlign: 'start' }}
                        >
                          <div className="px-4 pt-3">
                            <div className="rounded-[20px] px-6 pt-6 pb-2" style={{ minHeight: '75vh', background: isPassCard ? 'var(--terra)' : 'var(--card)', padding: 24 }}>

                              {/* Offer title — one line */}
                              <p className="truncate mb-[10px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 18, color: isPassCard ? '#FFFFFF' : 'var(--ink)', letterSpacing: '-0.03em' }}>{offerTitle}</p>

                              {/* Breadcrumb stepper — one line */}
                              <div className="flex items-center flex-nowrap mb-4">
                                {stageLabels.map((label, idx) => {
                                  const isDone = idx < stageIndex;
                                  const isCurrent = idx === stageIndex;
                                  const isFuture = idx > stageIndex;
                                  return (
                                    <span key={label} className="flex items-center">
                                      {idx === 0 && (
                                        <span className={`inline-block w-[7px] h-[7px] rounded-full mr-1.5 ${isPassCard ? 'bg-white' : 'bg-[var(--terra)]'}`} />
                                      )}
                                      <span className={`text-[15px] ${
                                        isCurrent ? 'font-bold'
                                        : isDone ? 'font-bold'
                                        : 'font-medium'
                                      }`} style={{ color: isPassCard
                                        ? (isFuture ? 'rgba(255,255,255,0.4)' : '#FFFFFF')
                                        : (isFuture ? 'rgba(34,34,34,0.3)' : 'var(--ink)')
                                      }}>
                                        {label}
                                      </span>
                                      {idx < stageLabels.length - 1 && (
                                        <span className="text-[15px] mx-1" style={{ color: isPassCard ? 'rgba(255,255,255,0.35)' : 'rgba(34,34,34,0.25)' }}>→</span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>

                              {/* QR Code section — tap to go fullscreen */}
                              {claim.status === 'active' && (
                                <button
                                  onClick={() => { setQrOpenSource('active'); setQrScreenTab('pass'); setShowQrFullscreen(true); }}
                                  className="w-full text-left"
                                >
                                  <p className="text-[15px] font-semibold text-center mb-[10px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'rgba(255,255,255,0.5)' }}>Tap to show pass</p>
                                  <QRCodeDisplay
                                    token={claim.qr_token}
                                    claimId={claim.id}
                                    creatorCode={userProfile.code}
                                    hideExtras
                                  />
                                  <div className="flex items-center justify-center gap-2 mt-[16px]">
                                    <span
                                      className="text-[17px] text-white inline-block rounded-full"
                                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '1.5px', background: 'var(--ink)', padding: '10px 20px' }}
                                    >
                                      {userProfile.code}
                                    </span>
                                  </div>
                                  <p className="text-[15px] mt-[12px] text-center" style={{ color: 'rgba(255,255,255,0.5)' }}>Auto-refreshes every 30s</p>
                                  <div className="flex items-center justify-center gap-2 mt-[16px]">
                                    <div className="rounded-full px-[14px] py-[6px]" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                      <span className="text-[14px] font-semibold text-white">{userProfile.level_name || 'Newcomer'}</span>
                                    </div>
                                  </div>
                                </button>
                              )}

                              {/* Reel Countdown/Prompt */}
                              {claim.redeemed_at && !claim.reel_url && (
                                <div className="p-4 rounded-[12px]" style={{
                                  border: isOverdue ? '1.5px solid var(--terra-20)' : '1.5px solid #F5C4A0',
                                  background: isOverdue ? 'var(--terra-10)' : 'rgba(245,196,160,0.12)',
                                }}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <DoodleIcon name="clock" size={16} className="text-[var(--ink-60)]" />
                                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 18, color: isOverdue ? '#D97706' : 'var(--ink)', margin: 0 }}>
                                      {isOverdue ? 'Overdue!' : `${timeLeft} remaining`}
                                    </p>
                                  </div>
                                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 16, color: 'rgba(34,34,34,0.68)', margin: 0 }}>
                                    You have 48 hours to post your reel — it must clearly feature the business.
                                  </p>
                                </div>
                              )}

                              {/* Submit reel */}
                              {claim.status === 'redeemed' && !claim.reel_url && (
                                <div style={{ marginTop: 20 }}>
                                  <label className="text-[15px] font-semibold text-[var(--ink)]" style={{ marginBottom: 8, display: 'block' }}>
                                    Reel URL
                                  </label>
                                  <input
                                    type="url"
                                    value={reelUrl}
                                    onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
                                    placeholder="https://instagram.com/reel/"
                                    className="w-full text-[17px] text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none"
                                    style={{ background: 'var(--card)', border: '1.5px solid rgba(34,34,34,0.08)', borderRadius: 999, padding: '14px 16px', fontSize: '16px' }}
                                    onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--ink)'; }}
                                    onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(34,34,34,0.08)'; }}
                                  />
                                  {reelError ? (
                                    <p className="text-[15px] text-[var(--ink-60)] mt-[8px]">Please check the URL and try again.</p>
                                  ) : (
                                    <p className="text-[14px] text-[var(--ink-35)] mt-[8px]">Paste the link from Instagram after you've posted.</p>
                                  )}
                                  <button
                                    onClick={handleSubmitReel}
                                    disabled={loading || !reelUrl}
                                    className="w-full text-white text-[18px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                                    style={{
                                      background: (reelUrl && reelUrl.startsWith('http') && reelUrl.length > 4) ? 'var(--terra)' : 'var(--terra-40)',
                                      height: 52,
                                      borderRadius: 999,
                                      marginTop: 16,
                                    }}
                                  >
                                    Submit
                                  </button>
                                </div>
                              )}

                              {claim.reel_url && (
                                <div className="flex items-center gap-2 p-3 rounded-[12px] bg-[var(--card)]">
                                  <DoodleIcon name="check" size={16} className="text-[var(--terra)] flex-shrink-0" />
                                  <span className="text-[18px] text-[var(--ink)] font-medium">Reel submitted!</span>
                                </div>
                              )}

                              {/* Report / Release links */}
                              <div className="flex items-center justify-center text-[14px]" style={{ marginTop: 16, paddingBottom: 10 }}>
                                {releaseConfirmId === claim.id ? (
                                  <div className="flex items-center gap-3">
                                    <span style={{ color: isPassCard ? 'rgba(255,255,255,0.6)' : 'var(--ink-60)' }}>Release this slot?</span>
                                    <button
                                      onClick={() => handleReleaseOffer(claim.id)}
                                      disabled={releasingClaim}
                                      className={`font-bold ${isPassCard ? 'text-white' : 'text-[var(--ink)]'}`}
                                    >
                                      {releasingClaim ? '...' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => setReleaseConfirmId(null)}
                                      className="font-semibold"
                                      style={{ color: isPassCard ? 'rgba(255,255,255,0.5)' : 'var(--ink-35)' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => setDisputeClaimId(claim.id)}
                                      className="flex items-center gap-1 font-medium transition-colors"
                                      style={{ color: isPassCard ? 'rgba(255,255,255,0.45)' : 'rgba(34,34,34,0.35)' }}
                                    >
                                      <DoodleIcon name="flag" size={11} /> Report an issue
                                    </button>
                                    {(() => {
                                      const releaseStatus = canReleaseOffer(claim);
                                      if (releaseStatus.allowed) {
                                        return (
                                          <>
                                            <span className="mx-2" style={{ color: isPassCard ? 'rgba(255,255,255,0.3)' : 'rgba(34,34,34,0.2)' }}>·</span>
                                            <button
                                              onClick={() => setReleaseConfirmId(claim.id)}
                                              className="flex items-center gap-1 font-medium transition-colors"
                                              style={{ color: isPassCard ? 'rgba(255,255,255,0.5)' : 'rgba(34,34,34,0.45)' }}
                                            >
                                              <DoodleIcon name="x" size={11} /> Release offer
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
                                <p className="text-[15px] text-center pb-2" style={{ color: isPassCard ? 'rgba(255,255,255,0.7)' : 'var(--ink-60)' }}>{releaseError}</p>
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
              <h1 className="text-[28px] text-[var(--ink)] mb-5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>Claims</h1>
              {claims.length === 0 ? (
                <div className="text-center py-20">
                  <DoodleIcon name="zap" size={48} className="text-[var(--ink-35)] mx-auto mb-4" />
                  <p className="text-[18px] font-semibold text-[var(--ink)]">No claims yet</p>
                  <p className="text-[18px] text-[var(--ink-60)] mt-1">Claim an offer to get started</p>
                </div>
              ) : (
                <div className="space-y-[14px]">
                  {claims.filter(c => c.businesses && c.offers).map((claim, claimCardIdx) => (
                    <button
                      key={claim.id}
                      onClick={() => {
                        if (claim.status === 'active' || (claim.status === 'redeemed' && !claim.reel_url)) {
                          setSelectedClaim(claim);
                          setView('active');
                        }
                      }}
                      className="w-full rounded-[16px] p-[16px] text-left"
                      style={{ background: 'var(--card)', border: '1px solid var(--ink-08)', boxShadow: 'var(--shadow-md)' }}
                    >
                      <div className="flex items-start gap-3">
                        {renderBusinessAvatar(claim.businesses.name, claim.businesses.category, claim.businesses.logo_url, 36)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] text-[var(--ink)] truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>{claim.offers.generated_title || claim.offers.description}</p>
                              <p className="text-[13px] text-[var(--ink-60)] mt-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>{claim.businesses.name}</p>
                            </div>
                            <StatusPill status={claim.status} />
                          </div>
                          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[var(--ink-08)]">
                            <span className="text-[12px] text-[var(--ink-35)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>
                              {formatDate(claim.claimed_at)}
                            </span>
                            {claim.reel_url && (
                              <a
                                href={claim.reel_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-[15px] font-semibold text-[var(--ink-60)] hover:underline"
                              >
                                View Reel <DoodleIcon name="external-link" size={12} />
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

          {/* -- ALL OFFERS (placeholder — Chunk 6 builds full screen) -- */}
          {view === 'all_offers' && (
            <div className="px-[20px] pt-5">
              <h1 className="text-[26px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>All offers</h1>
              <p className="text-[12px] mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink-35)' }}>
                {offers.length} live this week
              </p>
              <div className="text-center py-20">
                <p className="text-[14px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink-60)' }}>
                  Full list coming in Chunk 6.
                </p>
              </div>
            </div>
          )}

          {/* -- PROFILE -- */}
          {view === 'profile' && (
            <div className="px-[20px] pt-8">
              {isPendingApproval && (
                <div className="mb-6 rounded-[18px] p-5 text-center" style={{ background: 'rgba(34,34,34,0.04)' }}>
                  <DoodleIcon name="clock" size={28} className="text-[var(--ink-60)] mx-auto mb-2.5" />
                  <h3 className="text-[19px] font-bold text-[var(--ink)] mb-1">Account Under Review</h3>
                  <p className="text-[15px] text-[var(--ink-60)] leading-[1.5]">We're reviewing your profile — you'll get an email once approved. In the meantime, make sure your profile is looking great!</p>
                </div>
              )}
              {profileSubView === 'main' ? (
                <>
                  {/* ═══ Profile card (Airbnb-style) ═══ */}
                  <div className="rounded-[18px] p-[24px] mb-[24px]" style={{ background: 'var(--card)' }}>
                    <div className="flex items-start gap-[16px]">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleAvatarUpload}
                        />
                        {uploadingAvatar ? (
                          <div className="w-[80px] h-[80px] rounded-full bg-[var(--shell)] flex items-center justify-center" style={{ border: '3px solid var(--card)', boxShadow: 'var(--shadow-md)' }}>
                            <div className="w-6 h-6 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : avatarUrl ? (
                          <button onClick={() => avatarInputRef.current?.click()}>
                            <img src={avatarUrl} alt="Avatar" className="w-[80px] h-[80px] rounded-full object-cover" style={{ border: '3px solid var(--card)', boxShadow: 'var(--shadow-md)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </button>
                        ) : (
                          <button
                            onClick={() => avatarInputRef.current?.click()}
                            className="w-[80px] h-[80px] rounded-full flex items-center justify-center"
                            style={{ background: getCategorySolidColor(null), border: '3px solid var(--card)', boxShadow: 'var(--shadow-md)' }}
                          >
                            <span className="text-white text-[28px] font-extrabold">{getInitials(userProfile.name)}</span>
                          </button>
                        )}
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 w-[24px] h-[24px] rounded-full bg-[var(--terra)] flex items-center justify-center border-2 border-[var(--shell)]"
                        >
                          <DoodleIcon name="camera" size={11} className="text-white" />
                        </button>
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0 pt-[2px]">
                        <h2 className="text-[22px] text-[var(--ink)] leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>{userProfile.name}</h2>
                        <div className="flex items-center gap-[6px] mt-[4px] flex-wrap">
                          <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="sm" />
                          {userProfile.profile_complete && (
                            <span className="flex items-center gap-[3px] text-[13px] font-semibold text-[var(--terra)]">
                              <DoodleIcon name="badge-check" size={13} /> Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-[10px] mt-[6px]">
                          <button onClick={copyCode} className="flex items-center gap-1 text-[14px] font-semibold text-[var(--ink-35)]">
                            {userProfile.code}
                            {copiedCode ? (
                              <span className="text-[var(--ink)] text-[13px]">Copied!</span>
                            ) : (
                              <DoodleIcon name="copy" size={12} />
                            )}
                          </button>
                          {userProfile.instagram_handle && (
                            <span className="flex items-center gap-1 text-[14px] text-[var(--ink-35)]">
                              <DoodleIcon name="instagram" size={12} /> {userProfile.instagram_handle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {uploadError && <p className="text-[15px] text-[var(--ink-60)] mt-2">{uploadError}</p>}

                    {/* Stats row inside card */}
                    <div className="flex items-center gap-[8px] mt-[20px] pt-[16px] border-t border-[var(--ink-08)]">
                      <div className="flex-1 text-center rounded-[14px] py-[10px]" style={{ background: 'var(--card)', border: '1px solid var(--ink-08)' }}>
                        <p className="text-[20px] text-[var(--terra)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>{claims.length}</p>
                        <p className="text-[11px] text-[var(--ink-35)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Claimed</p>
                      </div>
                      <div className="flex-1 text-center rounded-[14px] py-[10px]" style={{ background: 'var(--card)', border: '1px solid var(--ink-08)' }}>
                        <p className="text-[20px] text-[var(--terra)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>{collabsCompleted}</p>
                        <p className="text-[11px] text-[var(--ink-35)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Posted</p>
                      </div>
                      <div className="flex-1 text-center rounded-[14px] py-[10px]" style={{ background: 'var(--card)', border: '1px solid var(--ink-08)' }}>
                        <p className="text-[20px] text-[var(--terra)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>{userProfile.average_rating ? userProfile.average_rating.toFixed(1) : '—'}</p>
                        <p className="text-[11px] text-[var(--ink-35)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Rating</p>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Profile completeness ═══ */}
                  {(() => {
                    const completeness = getProfileCompleteness(userProfile);
                    if (completeness.score === 100) {
                      return (
                        <div className="flex items-center gap-[10px] rounded-[18px] p-[14px_16px] mb-[16px]" style={{ background: 'var(--card)' }}>
                          <div className="w-[36px] h-[36px] rounded-full bg-[rgba(26,60,52,0.06)] flex items-center justify-center flex-shrink-0">
                            <DoodleIcon name="badge-check" size={18} className="text-[var(--terra)]" />
                          </div>
                          <div>
                            <p className="text-[18px] font-bold text-[var(--ink)]">Profile complete</p>
                            <p className="text-[14px] text-[var(--ink-60)]">Your profile is ready for businesses</p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-[18px] p-[16px] mb-[16px]" style={{ background: 'var(--card)' }}>
                        <div className="flex items-center justify-between mb-[10px]">
                          <span className="text-[18px] font-bold text-[var(--ink)]">Complete your profile</span>
                          <span className="text-[14px] font-semibold text-[var(--ink)]">{completeness.score}%</span>
                        </div>
                        <div className="h-[6px] rounded-[999px] mb-[12px]" style={{ background: 'var(--ink-08)' }}>
                          <div className="h-full rounded-[999px] transition-all" style={{ width: `${completeness.score}%`, background: 'var(--terra)' }} />
                        </div>
                        <div className="flex flex-wrap gap-[6px]">
                          {completeness.missing.map(field => (
                            <span key={field.key} className="flex items-center gap-1 px-[10px] py-[6px] rounded-[999px] text-[14px] font-semibold text-[var(--ink-60)] bg-[var(--shell)]">
                              <DoodleIcon name="plus" size={16} className="w-[10px] h-[10px]" /> {field.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ═══ Level + streak section (Airbnb-style) ═══ */}
                  <div className="rounded-[18px] bg-[var(--card)] p-[20px] mb-[16px]">
                    {(() => {
                      const progress = getLevelProgress(userProfile.total_reels || 0, userProfile.average_rating || 0, userProfile.level || 1);
                      const levelColours: Record<number, string> = {
                        1: '#9E9E9E',
                        2: '#8FAF8F',
                        3: '#4CAF7D',
                        4: '#1A4A2E',
                        5: 'var(--terra)',
                        6: 'var(--ink)',
                      };
                      const levels = [1, 2, 3, 4, 5, 6];
                      const levelNames = ['Newcomer', 'Explorer', 'Regular', 'Local', 'Trusted', 'Nayba'];
                      const currentLvl = userProfile.level || 1;

                      return (
                        <>
                          {/* Level journey row */}
                          <div className="flex items-center mb-[16px]">
                            {levels.map((lvl, idx) => {
                              const isCompleted = lvl < currentLvl;
                              const isCurrent = lvl === currentLvl;
                              const isLocked = lvl > currentLvl;
                              const colour = levelColours[lvl];

                              return (
                                <div key={lvl} className="flex items-center" style={{ flex: idx < levels.length - 1 ? 1 : 'none' }}>
                                  {/* Circle */}
                                  <div className="relative flex items-center justify-center" style={{ width: 40, height: 40 }}>
                                    {/* Glow ring for current level */}
                                    {isCurrent && (
                                      <div
                                        className="absolute rounded-full"
                                        style={{
                                          width: 48,
                                          height: 48,
                                          border: '3px solid var(--terra)',
                                        }}
                                      />
                                    )}
                                    <div
                                      className="rounded-full flex items-center justify-center"
                                      style={{
                                        width: 40,
                                        height: 40,
                                        background: isCompleted ? 'var(--terra)' : isCurrent ? 'var(--terra-10)' : 'var(--card)',
                                        border: isLocked ? '1.5px solid var(--ink-08)' : 'none',
                                      }}
                                    >
                                      {isCompleted ? (
                                        /* Checkmark for completed levels — white tick */
                                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                          <path d="M4.5 9L7.5 12L13.5 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      ) : (
                                        /* Number for current + locked */
                                        <span
                                          style={{
                                            fontWeight: isCurrent ? 700 : 500,
                                            fontSize: 18,
                                            color: isLocked ? 'var(--ink-35)' : isCurrent ? 'var(--terra)' : 'white',
                                          }}
                                        >
                                          {lvl === 6 ? '✦' : lvl}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {/* Connector line */}
                                  {idx < levels.length - 1 && (
                                    <div
                                      className="flex-1 mx-[4px]"
                                      style={{
                                        height: 3,
                                        borderRadius: 3,
                                        background: isCompleted
                                          ? 'var(--terra)'
                                          : 'var(--ink-08)',
                                      }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* Level name pill + progress text */}
                          <div className="flex items-center gap-[8px]">
                            <span
                              className="inline-block rounded-full px-[12px] py-[3px]"
                              style={{
                                background: currentLvl === 6 ? 'var(--ink)' : 'var(--terra)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 15,
                              }}
                            >
                              {currentLvl === 6 ? '✦ Nayba' : levelNames[currentLvl - 1]}
                            </span>
                            {!progress.isMaxLevel && (
                              <span
                                style={{
                                  color: 'var(--ink-60)',
                                  fontWeight: 400,
                                  fontSize: 16,
                                }}
                              >
                                · {progress.reelsToNext} reel{progress.reelsToNext !== 1 ? 's' : ''} to {progress.nextName}
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}

                    {/* Streak row */}
                    <div className="mt-[20px] pt-[20px] border-t border-[var(--ink-08)]">
                      <div className="flex items-center">
                        <div className="flex items-center gap-[8px]">
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 32,
                              color: 'var(--ink)',
                              lineHeight: 1,
                            }}
                          >
                            {userProfile.current_streak || 0}
                          </span>
                          <div className="flex items-center gap-[3px]">
                            {(() => {
                              const streak = userProfile.current_streak || 0;
                              const streakStatus = checkStreakStatus(userProfile.last_reel_month);
                              const showMax = Math.min(streak > 0 ? streak : 1, 6);
                              const flames = [];
                              for (let i = 0; i < showMax; i++) {
                                const isCurrentMonthPending = i === showMax - 1 && streakStatus === 'at_risk';
                                flames.push(
                                  <FlameIcon
                                    key={i}
                                    color={isCurrentMonthPending ? '#F5C4A0' : 'var(--terra)'}
                                    size={18}
                                  />
                                );
                              }
                              if (streak > 6) {
                                flames.push(
                                  <span key="more" className="text-[13px] font-semibold ml-[2px]" style={{ color: 'var(--ink-35)' }}>+{streak - 6}</span>
                                );
                              }
                              return flames;
                            })()}
                          </div>
                        </div>
                        <span
                          className="ml-auto"
                          style={{
                            fontWeight: 400,
                            fontSize: 16,
                            color: 'var(--ink-35)',
                          }}
                        >
                          {(userProfile.current_streak || 0) > 0 ? 'month streak' : 'No streak yet'}
                        </span>
                      </div>
                      {/* Motivational subline */}
                      <p
                        className="mt-[6px]"
                        style={{
                          fontWeight: 400,
                          fontSize: 15,
                          color: 'var(--ink-35)',
                        }}
                      >
                        {(userProfile.current_streak || 0) > 0
                          ? 'Keep posting to protect your streak'
                          : 'Post a reel this month to start your streak'}
                      </p>
                    </div>
                  </div>

                  {/* ═══ Settings ═══ */}
                  <div className="mt-[8px]">
                    <button
                      onClick={() => { setEditName(userProfile.name || ''); setEditHandle(userProfile.instagram_handle || ''); setProfileSubView('edit'); }}
                      className="w-full flex items-center justify-between py-[16px] border-b border-[var(--ink-08)] text-left"
                    >
                      <div className="flex items-center gap-[12px]">
                        <DoodleIcon name="user" size={20} className="text-[var(--ink-60)]" />
                        <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Edit profile</span>
                      </div>
                      <DoodleIcon name="chevron-right" size={18} className="text-[var(--ink-35)]" />
                    </button>
                    <button
                      onClick={() => setProfileSubView('alerts')}
                      className="w-full flex items-center justify-between py-[16px] border-b border-[var(--ink-08)] text-left"
                    >
                      <div className="flex items-center gap-[12px]">
                        <DoodleIcon name="bell" size={20} className="text-[var(--ink-60)]" />
                        <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Notifications</span>
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--terra)] text-white text-[13px] font-bold flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <DoodleIcon name="chevron-right" size={18} className="text-[var(--ink-35)]" />
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-[12px] py-[16px] text-left"
                    >
                      <DoodleIcon name="logout" size={20} className="text-[var(--terra)]" />
                      <span className="text-[15px] text-[var(--terra)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Sign out</span>
                    </button>
                  </div>
                </>
              ) : profileSubView === 'alerts' ? (
                /* Alerts/Notifications sub-view */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setProfileSubView('main')} className="p-2 -ml-2 hover:bg-[var(--shell)] rounded-[12px] transition-colors">
                      <DoodleIcon name="chevron-left" size={20} className="text-[var(--ink)]" />
                    </button>
                    <h1 className="text-[28px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>Notifications</h1>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-[40px]">
                      {/* Envelope with spark SVG */}
                      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                        <rect x="12" y="24" width="56" height="36" rx="4" stroke="var(--peach)" strokeWidth="2.5" fill="none" />
                        <path d="M12 28L40 48L68 28" stroke="var(--peach)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        <path d="M58 18L62 14" stroke="var(--peach)" strokeWidth="2" strokeLinecap="round" />
                        <path d="M62 20L64 16" stroke="var(--peach)" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="60" cy="16" r="1.5" fill="var(--peach)" />
                      </svg>
                      <p className="text-[20px] text-[var(--ink)] mt-[16px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>Nothing yet</p>
                      <p className="text-[17px] text-[var(--ink-60)] text-center mt-[8px] max-w-[260px]" style={{ lineHeight: 1.65 }}>
                        You'll see a notification when a business confirms your visit or when a new offer drops nearby.
                      </p>
                      <button
                        onClick={() => setView('offers')}
                        className="mt-[20px] px-[24px] py-[13px] rounded-[999px] text-white text-[15px] min-h-[44px]"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, background: 'var(--terra)' }}
                      >
                        Browse offers
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((notif, notifIdx) => (
                        <button
                          key={notif.id}
                          onClick={() => !notif.read && markNotificationRead(notif.id)}
                          className={`w-full text-left rounded-[18px] p-4 transition-all ${
                            notif.read ? 'opacity-50' : ''
                          }`}
                          style={{ background: getCardColor(notifIdx) }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-[rgba(34,34,34,0.1)]' : 'bg-[var(--terra)]'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[17px] text-[var(--ink)]">{notif.message}</p>
                              <p className="text-[15px] text-[var(--ink-35)] mt-1">
                                {formatDate(notif.created_at)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Edit Profile sub-view */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setProfileSubView('main')} className="p-2 -ml-2 hover:bg-[var(--shell)] rounded-[12px] transition-colors">
                      <DoodleIcon name="chevron-left" size={20} className="text-[var(--ink)]" />
                    </button>
                    <h1 className="text-[28px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>Edit profile</h1>
                  </div>
                  <div className="space-y-[16px]">
                    {/* Avatar upload */}
                    <div className="flex flex-col items-center mb-[8px]">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        className="relative"
                        disabled={uploadingAvatar}
                      >
                        {uploadingAvatar ? (
                          <div className="w-[80px] h-[80px] rounded-full bg-[var(--shell)] flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-[80px] h-[80px] rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div
                            className="w-[80px] h-[80px] rounded-full flex items-center justify-center"
                            style={{ background: getCategorySolidColor(null) }}
                          >
                            <span className="text-white text-[32px] font-extrabold">{getInitials(userProfile.name)}</span>
                          </div>
                        )}
                        <div
                          className="absolute -bottom-1 -right-1 w-[28px] h-[28px] rounded-full bg-[var(--terra)] flex items-center justify-center border-2 border-[var(--shell)]"
                        >
                          <DoodleIcon name="camera" size={13} className="text-white" />
                        </div>
                      </button>
                      <p className="text-[14px] text-[var(--ink-35)] mt-[8px]">Tap to change photo</p>
                      {uploadError && <p className="text-[14px] text-[var(--ink-60)] mt-[4px]">{uploadError}</p>}
                    </div>
                    <div>
                      <label className="block text-[15px] font-semibold text-[var(--ink-60)] mb-[6px]">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-[16px] py-[12px] rounded-[999px] bg-[var(--card)] border-[1.5px] border-[rgba(34,34,34,0.08)] text-[16px] text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--ink)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[15px] font-semibold text-[var(--ink-60)] mb-[6px]">Instagram handle</label>
                      <input
                        type="text"
                        value={editHandle}
                        onChange={(e) => setEditHandle(e.target.value)}
                        placeholder="@yourhandle"
                        className="w-full px-[16px] py-[12px] rounded-[999px] bg-[var(--card)] border-[1.5px] border-[rgba(34,34,34,0.08)] text-[16px] text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--ink)]"
                      />
                    </div>
                    <button
                      disabled={editSaving || !editName.trim()}
                      onClick={async () => {
                        setEditSaving(true);
                        await supabase.from('creators').update({
                          name: editName.trim(),
                          instagram_handle: editHandle.trim() || null,
                        }).eq('id', userProfile.id);
                        setEditSaving(false);
                        setProfileSubView('main');
                        window.location.reload();
                      }}
                      className="w-full py-[13px] rounded-[999px] bg-[var(--terra)] text-white text-[15px] disabled:opacity-50 hover:bg-[var(--terra-hover)] transition-all"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}
                    >
                      {editSaving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      </div>{/* end scroll container */}

      {/* Bottom Navigation Bar */}
      <div
        className="flex-shrink-0"
        style={{
          background: 'rgba(246,243,238,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--ink-08)',
          padding: '10px 0 28px',
          paddingBottom: 'env(safe-area-inset-bottom, 28px)',
        }}
      >
        <div className="max-w-md mx-auto flex">
          {tabs.map(tab => {
            const isActive = view === tab.key;
            const iconColor = isActive ? 'var(--terra)' : 'var(--ink-35)';
            return (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className="flex-1 flex flex-col items-center gap-[3px] min-h-[44px]"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 10,
                  color: isActive ? 'var(--terra)' : 'var(--ink-35)',
                }}
              >
                <div className="relative flex items-center justify-center" style={{ width: 24, height: 24 }}>
                  {tab.icon === 'discover' && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  )}
                  {tab.icon === 'claims' && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3" />
                      <path d="M14 2h6v6" />
                      <path d="M10 14L20 4" />
                    </svg>
                  )}
                  {tab.icon === 'all_offers' && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                  )}
                  {/* Notification pip for Claims when active claims exist */}
                  {'pip' in tab && tab.pip && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -4,
                        width: 15,
                        height: 15,
                        borderRadius: '50%',
                        background: 'var(--terra)',
                        border: '1.5px solid var(--shell)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: 8,
                        color: 'white',
                      }}
                    >
                      {activeClaims.length}
                    </span>
                  )}
                </div>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
