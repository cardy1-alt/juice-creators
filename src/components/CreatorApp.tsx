import { useState, useEffect, useRef, ComponentType } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Check, Clock, ChevronLeft, Heart, Lock, Users, MapPin, Zap, Camera, BadgeCheck, Copy, AtSign, Plus, User, ChevronRight, Bell, LogOut, Flag, X, ExternalLink, Home, Sparkles, LayoutGrid, Coffee, Clapperboard, Search, SlidersHorizontal } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';
import CreatorOnboarding from './CreatorOnboarding';
import DisputeModal from './DisputeModal';
import LevelBadge from './LevelBadge';
import { getCategorySolidColor, getCategoryPastelBg, getCategoryPastelIcon, CategoryIcon } from '../lib/categories';
import { Logo } from './Logo';
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
    queued: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]',
    slot_ready: 'bg-[rgba(196,103,74,0.15)] text-[var(--terra)]',
    redeemed: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]',
    visited: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]',
    reel_due: 'bg-[rgba(232,160,32,0.12)] text-[var(--ochre)]',
    submitted: 'bg-[var(--terra-10)] text-[var(--terra)]',
    expired: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-35)]',
    overdue: 'bg-[var(--peach)] text-[var(--terra)] border border-[var(--terra-15)]',
    completed: 'bg-[var(--terra-10)] text-[var(--terra)]',
    disputed: 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]',
  };
  const labels: Record<string, string> = {
    active: 'Active',
    claimed: 'Claimed',
    queued: 'On the list',
    slot_ready: 'Slot ready',
    redeemed: 'Visited',
    visited: 'Visited',
    reel_due: 'Reel Due',
    submitted: 'Completed',
    expired: 'Expired',
    overdue: 'Overdue',
    completed: 'Completed',
    disputed: 'Disputed',
  };
  return (
    <span className={`text-[13px] px-2.5 py-1 rounded-[999px] font-semibold ${styles[status] || 'bg-[rgba(34,34,34,0.06)] text-[var(--ink-60)]'}`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {labels[status] || status}
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
  const [confirmVisitClaimId, setConfirmVisitClaimId] = useState<string | null>(null);
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

  // ─── Discovery feed state ─────────────────────────────────────────

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

  const categoryTabIconMap: Record<string, ComponentType<{ size?: number; strokeWidth?: number; color?: string; className?: string }>> = {
    home: Home,
    coffee: Coffee,
    sparkles: Sparkles,
    grid: LayoutGrid,
  };

  const tabs = [
    { key: 'offers' as const, label: 'Explore', icon: 'explore' as const },
    { key: 'saved' as const, label: 'Saved', icon: 'saved' as const },
    { key: 'active' as const, label: 'Active', icon: 'active' as const, badge: activeClaims.length > 0 ? activeClaims.length : 0 },
    { key: 'claims' as const, label: 'Claims', icon: 'claims' as const },
    { key: 'profile' as const, label: 'Profile', icon: 'profile' as const },
  ];

  // ─── Discovery feed helpers ────────────────────────────────────────

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const toggleSave = (offerId: string) => {
    setSavedOffers(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) next.delete(offerId); else next.add(offerId);
      localStorage.setItem('nayba_saved_offers', JSON.stringify([...next]));
      return next;
    });
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
          <Check size={16} strokeWidth={1.5} />
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

              {/* Segmented toggle — only for reel_due */}
              {isReelDue && (
                <div
                  className="relative flex items-center"
                  style={{ width: 240, height: 42, background: activeTab === 'pass' ? 'rgba(255,255,255,0.2)' : 'var(--card)', borderRadius: 999, padding: 3, marginBottom: 20 }}
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
                <div className="flex flex-col items-center w-full" style={{ marginTop: isReelDue ? 0 : 0, minHeight: isReelDue ? undefined : 'calc(100vh - 200px)', justifyContent: isReelDue ? undefined : 'center' }}>
                  {/* QR card with offer title inside */}
                  <div style={{ background: 'white', borderRadius: 24, padding: '24px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.03em', textAlign: 'center', margin: '0 0 2px', lineHeight: 1.2 }}>{qrOfferTitle}</p>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink-60)', textAlign: 'center', margin: '0 0 16px' }}>{qrClaim.businesses.name}</p>
                    <QRCodeDisplay
                      token={qrClaim.qr_token}
                      claimId={qrClaim.id}
                      creatorCode={userProfile.code}
                      size={220}
                      hideExtras
                    />
                  </div>
                  {/* Ref code pill */}
                  <span
                    className="text-[17px] text-white inline-block rounded-full mt-[20px]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '1.5px', background: 'var(--ink)', padding: '10px 20px' }}
                  >
                    {userProfile.code}
                  </span>
                  {/* Refresh countdown */}
                  <p className="text-[15px] mt-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Auto-refreshes every 30s</p>
                  {/* Level badge */}
                  <div className="mt-[20px] flex flex-col items-center gap-[4px]">
                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your level</span>
                    <div className="rounded-full px-[14px] py-[6px]" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <span className="text-[14px] font-semibold text-white">{userProfile.level_name || 'Newcomer'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* === SUBMIT REEL STATE === */}
              {activeTab === 'reel' && isReelDue && (
                <div className="flex flex-col w-full" style={{ marginTop: 24, minHeight: '75vh' }}>
                  {/* Timer block */}
                  <div style={{ background: 'rgba(245,196,160,0.12)', border: '1.5px solid #F5C4A0', borderRadius: 12, padding: 16 }}>
                    <div className="flex items-center gap-[8px]">
                      <Clock size={16} strokeWidth={1.5} className="text-[var(--ink-60)]" />
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
          <div className="fixed inset-0 z-50 bg-[var(--shell)] flex flex-col overflow-y-auto">
            {/* Hero — full-bleed image */}
            <div className="relative" style={{ minHeight: 300, flexShrink: 0 }}>
              {offer.offer_photo_url ? (
                <img src={offer.offer_photo_url} alt="" style={{ width: '100%', height: 300, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: 300, background: getCategoryPastelBg(offer.businesses.category), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CategoryIcon category={offer.businesses.category} className="w-[48px] h-[48px]" style={{ color: getCategoryPastelIcon(offer.businesses.category) }} />
                </div>
              )}
              {/* Gradient overlay */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(34,34,34,0.80) 0%, rgba(34,34,34,0) 55%)', pointerEvents: 'none' }} />
              {/* Locked overlay */}
              {detailIsLocked && (
                <div className="absolute inset-0" style={{ background: 'rgba(34,34,34,0.25)' }} />
              )}
              {/* Back button — frosted glass */}
              <button
                onClick={() => setExpandedOffer(null)}
                className="absolute flex items-center justify-center"
                style={{ top: 52, left: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(246,243,238,0.88)', backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer' }}
              >
                <ChevronLeft size={18} strokeWidth={1.5} color="var(--ink)" />
              </button>
              {/* Heart button — frosted glass */}
              <button
                onClick={() => toggleSaved(offer.id)}
                className="absolute flex items-center justify-center"
                style={{ top: 52, right: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(246,243,238,0.88)', backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer' }}
              >
                <Heart size={18} strokeWidth={1.5} color={savedOffers.has(offer.id) ? 'var(--terra)' : 'var(--ink)'} fill={savedOffers.has(offer.id) ? 'var(--terra)' : 'none'} />
              </button>
              {/* Text at bottom of image */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px 24px' }}>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '0 0 4px' }}>{offer.businesses.name}</p>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 26, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>
                  {offer.generated_title || (offer.description.length > 50 ? offer.description.slice(0, 50) + '…' : offer.description)}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="bg-[var(--shell)]" style={{ paddingBottom: 120 }}>
              {/* Metadata row — below hero */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={14} strokeWidth={1.5} color="var(--ink-60)" />
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink-60)' }}>
                    {isUnlimited ? 'Open availability' : full ? 'Sold out' : `${slotsLeft} left`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={14} strokeWidth={1.5} color="var(--ink-60)" />
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--ink-60)' }}>48hrs to post</span>
                </div>
              </div>
              {/* Divider */}
              <div style={{ height: 1, background: 'var(--ink-08)', margin: '0 20px' }} />

              <div style={{ padding: '20px 20px 0' }}>
                {/* Level requirement banner */}
                {detailIsLocked && (
                  <div className="flex items-start gap-3 rounded-[12px] p-[12px_14px] mb-[20px]" style={{ background: 'rgba(34,34,34,0.04)' }}>
                    <Lock size={14} strokeWidth={1.5} className="text-[var(--ink-60)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--ink)', margin: 0 }}>{detailLockedName} creators only</p>
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'rgba(34,34,34,0.5)', marginTop: 2, margin: '2px 0 0' }}>You're Level {detailCreatorLevel} · {detailReelsToUnlock} more reel{detailReelsToUnlock !== 1 ? 's' : ''} to unlock</p>
                    </div>
                  </div>
                )}

                {/* WHAT TO POST label */}
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 8px' }}>WHAT TO POST</p>

                {/* C) Primary post requirement */}
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--ink)', lineHeight: 1.3, margin: '0 0 14px' }}>One Instagram Reel</p>

                {/* D) Checklist items — no duplicates */}
                <div className="flex flex-col gap-[10px] mb-[24px]">
                  {[
                    'Post within 48 hours of your visit',
                    'Tag the business in your reel',
                    'Submit your reel link in the app',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <Check size={14} strokeWidth={1.5} color="var(--terra)" style={{ marginTop: 3, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'var(--ink-60)', lineHeight: 1.65 }}>{item}</span>
                    </div>
                  ))}
                </div>

                {/* E) They'd love if you… (only if specific_ask exists) */}
                {offer.specific_ask && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 8px' }}>THEY'D LOVE IF YOU…</p>
                    <div style={{ borderRadius: 12, padding: '14px 16px', background: 'var(--card)' }}>
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'var(--ink)', lineHeight: 1.65, margin: 0 }}>{offer.specific_ask}</p>
                    </div>
                  </div>
                )}

                {/* F) About business */}
                {(offer.businesses.bio || offer.businesses.address) && (
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--ink-60)', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 8px' }}>ABOUT</p>
                    {offer.businesses.bio && (
                      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'var(--ink-60)', lineHeight: 1.65, margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{offer.businesses.bio}</p>
                    )}
                    {offer.businesses.address && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} strokeWidth={1.5} color="var(--ink-60)" style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'var(--ink-60)' }}>{offer.businesses.address}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* How this works — capped offers only, not yet on list */}
                {!isUnlimited && !alreadyClaimed && !waitlistedOffers[offer.id] && (
                  <div style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--ink)', margin: '0 0 10px' }}>How this works</p>
                    {[
                      { icon: Clapperboard, text: 'Join the list to reserve your spot' },
                      { icon: Bell, text: "We'll notify you when it's your turn" },
                      { icon: Clock, text: "You'll have 5 days to visit once notified" },
                      { icon: Clapperboard, text: 'Post your Reel within 48hrs of your visit' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < 3 ? 8 : 0 }}>
                        <item.icon size={14} strokeWidth={1.5} color="var(--terra)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'var(--ink-60)', lineHeight: 1.4 }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* On the list — capped offers, already queued */}
                {!isUnlimited && waitlistedOffers[offer.id] && !alreadyClaimed && (
                  <div style={{ background: 'var(--card)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--ink)', margin: '0 0 4px' }}>You're on the list</p>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'var(--ink-60)', margin: '0 0 8px' }}>
                      {(waitlistedOffers[offer.id].position || 0) <= 1 ? "You're next!" : `${waitlistedOffers[offer.id].position} people ahead of you`}
                    </p>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'var(--ink-60)', margin: 0, lineHeight: 1.65 }}>
                      We'll send you a notification when it's your turn. Keep an eye on your alerts.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky bottom bar */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', paddingBottom: 32, background: 'rgba(246,243,238,0.96)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--ink-08)', zIndex: 10 }}>
              {detailIsLocked ? (
                <div
                  className="w-full py-[14px] rounded-[999px] text-center"
                  style={{ background: 'rgba(34,34,34,0.04)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'rgba(34,34,34,0.5)' }}
                >
                  Unlocks at {detailLockedName}
                </div>
              ) : alreadyClaimed ? (
                <button
                  className="w-full py-[14px] rounded-[999px] text-center flex items-center justify-center gap-1.5"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, background: 'var(--terra)', color: '#FFFFFF', border: 'none' }}
                >
                  <Check size={16} strokeWidth={1.5} color="white" /> Active visit
                </button>
              ) : hasActiveBusiness ? (
                <button
                  className="w-full py-[14px] rounded-[999px] text-center"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, background: 'var(--terra)', color: '#FFFFFF', border: 'none', borderRadius: 999 }}
                >
                  Active visit
                </button>
              ) : waitlistedOffers[offer.id] ? (
                <div>
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
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, color: 'rgba(34,34,34,0.5)', background: 'transparent', border: 'none' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setWaitlistConfirmLeave(offer.id)}
                      className="w-full py-[14px] rounded-[999px] text-center"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink-35)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Leave the list
                    </button>
                  )}
                </div>
              ) : !isUnlimited && full ? (
                <button
                  onClick={() => joinWaitlist(offer.id)}
                  disabled={waitlistLoading === offer.id}
                  className="w-full py-[14px] rounded-[999px] text-center disabled:opacity-40"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, background: 'var(--terra)', color: '#FFFFFF', border: 'none' }}
                >
                  {waitlistLoading === offer.id ? 'Joining...' : 'Join the list'}
                </button>
              ) : !isUnlimited ? (
                <button
                  onClick={() => joinWaitlist(offer.id)}
                  disabled={waitlistLoading === offer.id}
                  className="w-full py-[14px] rounded-[999px] text-center disabled:opacity-40"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, background: 'var(--terra)', color: '#FFFFFF', border: 'none' }}
                >
                  {waitlistLoading === offer.id ? 'Joining...' : 'Join the list'}
                </button>
              ) : (
                <div>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(34,34,34,0.5)', textAlign: 'center' as const, margin: '0 0 8px' }}>Post a reel within 48hrs</p>
                  <button
                    onClick={() => { handleClaim(offer); setExpandedOffer(null); }}
                    disabled={loading}
                    className="w-full py-[14px] rounded-[999px] text-center disabled:opacity-40 transition-all"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, background: 'var(--terra)', color: '#FFFFFF', border: 'none' }}
                  >
                    Claim offer
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-md mx-auto">

        {/* Content */}
        <div className="pb-6">

          {/* -- DISCOVER — VERTICAL SCROLL FEED -- */}
          {view === 'offers' && (() => {
            // Filter available offers: exclude already claimed and full offers
            const feedOffers = offers.filter(o => {
              if (claims.some(c => c.offer_id === o.id && c.status !== 'expired')) return false;
              const isUnlimited = o.monthly_cap === null;
              if (!isUnlimited) {
                const slotsLeft = Math.max(0, (o.monthly_cap as number) - (o.slotsUsed || 0));
                if (slotsLeft === 0) return false;
              }
              return true;
            });

            // Apply category filter
            const filteredOffers = selectedCategory === 'all'
              ? feedOffers
              : feedOffers.filter(o => getCategoryGroup(o.businesses.category) === selectedCategory);

            // Split into near-you (horizontal row) and new-this-week (vertical list)
            const nearYouOffers = filteredOffers.slice(0, 8);
            const newThisWeekOffers = filteredOffers.slice(8);

            // Extract city from first offer's address
            const cityName = (() => {
              const addr = offers[0]?.businesses?.address;
              if (!addr) return '';
              const parts = addr.split(',').map((s: string) => s.trim());
              if (parts.length >= 3) return parts[parts.length - 2];
              if (parts.length >= 2) return parts[1];
              return parts[0];
            })();

            return (
              <div style={{ background: 'var(--shell)' }}>
                {/* ── Header: search bar + categories only ── */}
                <div style={{ padding: '16px 20px 0' }}>
                  {/* Full-width pill search bar */}
                  <div
                    onClick={() => setShowSearchBar(!showSearchBar)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0 16px', height: 52, marginBottom: 12,
                      background: 'white', border: '1.5px solid var(--border)', borderRadius: 999, cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Search size={18} strokeWidth={1.5} color="var(--ink-35)" />
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 16, color: 'var(--ink-35)' }}>Find local offers…</span>
                    </div>
                    <SlidersHorizontal size={18} strokeWidth={1.5} color="var(--ink-35)" />
                  </div>
                </div>

                {/* ── Category tabs — Airbnb style with underline ── */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--ink-08)', padding: '0 20px' }}>
                  {categoryTabs.map(cat => {
                    const isActive = selectedCategory === cat.key;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setSelectedCategory(cat.key)}
                        style={{
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0 10px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: isActive ? '2px solid var(--terra)' : '2px solid transparent',
                          marginBottom: -1, transition: 'all 0.15s ease',
                        }}
                      >
                        {(() => { const TabIcon = categoryTabIconMap[cat.icon]; return TabIcon ? <TabIcon size={22} strokeWidth={1.5} color={isActive ? 'var(--terra)' : 'var(--ink-35)'} /> : null; })()}
                        <span style={{
                          fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: isActive ? 600 : 500, fontSize: 13,
                          color: isActive ? 'var(--terra)' : 'var(--ink-35)',
                        }}>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Your passes — compact banner ── */}
                {activeClaims.length > 0 && (() => {
                  const filtered = activeClaims.filter(c => c.businesses && c.offers);
                  if (filtered.length === 0) return null;
                  const firstClaim = filtered[0];
                  const claimTitle = firstClaim.snapshot_generated_title || firstClaim.offers.generated_title || firstClaim.offers.description || '';
                  const claimBiz = firstClaim.businesses?.name || '';
                  return (
                    <div style={{ marginTop: 16, padding: '0 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>Your passes</span>
                        <button onClick={() => setView('active')} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--terra)', background: 'none', border: 'none', cursor: 'pointer' }}>View all</button>
                      </div>
                      <button
                        onClick={() => { setSelectedClaim(firstClaim); setView('active'); }}
                        style={{
                          width: '100%', background: 'var(--terra)', borderRadius: 14, padding: '12px 16px',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claimTitle}</p>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: '2px 0 0' }}>{claimBiz}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--ink)', background: '#F5C4A0', borderRadius: 999, padding: '3px 10px' }}>48h left</span>
                          <ChevronRight size={16} strokeWidth={1.5} color="rgba(255,255,255,0.75)" />
                        </div>
                      </button>
                      {filtered.length > 1 && (
                        <button
                          onClick={() => setView('active')}
                          style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--ink-60)' }}
                        >
                          and {filtered.length - 1} more active pass{filtered.length - 1 > 1 ? 'es' : ''}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* ── Claim error toast ── */}
                {claimError && (
                  <div style={{ margin: '8px 20px 0', padding: '10px 14px', borderRadius: 12, background: 'rgba(34,34,34,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: 'var(--ink)', margin: 0 }}>{claimError}</p>
                    <button onClick={() => setClaimError(null)} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--ink-35)', marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer' }}>Dismiss</button>
                  </div>
                )}

                {/* ── Loading state ── */}
                {offersLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink-35)', fontSize: 14 }}>Loading offers…</p>
                  </div>
                )}

                {/* ── Empty state ── */}
                {!offersLoading && filteredOffers.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px', gap: 8 }}>
                    <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 24, color: 'var(--ink)', margin: 0, letterSpacing: '-0.03em' }}>All caught up</h2>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'var(--ink-60)', textAlign: 'center', lineHeight: 1.65, margin: '0 0 16px' }}>New offers drop every Tuesday.</p>
                  </div>
                )}

                {/* ── Near you — horizontal card row ── */}
                {!offersLoading && nearYouOffers.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: 12 }}>
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>Near you</span>
                      <button onClick={() => setView('all_offers')} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--terra)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}>
                      {nearYouOffers.map((offer) => {
                        const offerTitle = offer.generated_title || offer.description;
                        const isUnlimited = offer.monthly_cap === null;
                        const slotsUsed = offer.slotsUsed || 0;
                        const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                        const isSaved = savedOffers.has(offer.id);

                        return (
                          <div
                            key={offer.id}
                            onClick={() => setExpandedOffer(offer.id)}
                            style={{
                              width: 'calc(50vw - 24px)', flexShrink: 0,
                              cursor: 'pointer', position: 'relative',
                            }}
                          >
                            {/* Image area */}
                            <div style={{ position: 'relative', height: 180, borderRadius: 12, overflow: 'hidden' }}>
                              {offer.offer_photo_url ? (
                                <img src={offer.offer_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', background: getCategoryPastelBg(offer.businesses.category), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <CategoryIcon category={offer.businesses.category} className="w-[32px] h-[32px]" style={{ color: getCategoryPastelIcon(offer.businesses.category) }} />
                                </div>
                              )}
                              {/* Slot badge */}
                              {!isUnlimited && (
                                waitlistedOffers[offer.id] ? (
                                  <span style={{
                                    position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                    background: 'var(--terra)', color: 'white',
                                  }}>
                                    On the list ✓
                                  </span>
                                ) : slotsLeft === 0 ? (
                                  <span style={{
                                    position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                    background: '#F5C4A0', color: 'var(--ink)',
                                  }}>
                                    Join the list
                                  </span>
                                ) : slotsLeft !== null ? (
                                  <span style={{
                                    position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                    background: '#F5C4A0', color: 'var(--ink)',
                                  }}>
                                    {slotsLeft <= 1 ? 'Last slot' : `${slotsLeft} left`}
                                  </span>
                                ) : null
                              )}
                              {/* Heart button */}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleSave(offer.id); }}
                                style={{
                                  position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%',
                                  background: 'rgba(246,243,238,0.88)', backdropFilter: 'blur(4px)', border: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? 'var(--terra)' : 'none'} stroke={isSaved ? 'var(--terra)' : 'var(--ink-60)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                              </button>
                            </div>
                            {/* Text below image — no container */}
                            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--ink)', margin: '6px 0 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offerTitle}</p>
                            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'var(--ink-60)', margin: '2px 0 0', lineHeight: 1.3 }}>{offer.businesses.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── New this week — horizontal scroll cards ── */}
                {!offersLoading && newThisWeekOffers.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: 12 }}>
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>New this week</span>
                      <button onClick={() => setView('all_offers')} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--terra)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}>
                      {newThisWeekOffers.map((offer) => {
                        const offerTitle = offer.generated_title || offer.description;
                        const isUnlimited = offer.monthly_cap === null;
                        const slotsUsed = offer.slotsUsed || 0;
                        const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                        const isSaved = savedOffers.has(offer.id);

                        return (
                          <div
                            key={offer.id}
                            onClick={() => setExpandedOffer(offer.id)}
                            style={{
                              width: 'calc(50vw - 24px)', flexShrink: 0,
                              cursor: 'pointer', position: 'relative',
                            }}
                          >
                            <div style={{ position: 'relative', height: 180, borderRadius: 12, overflow: 'hidden' }}>
                              {offer.offer_photo_url ? (
                                <img src={offer.offer_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', background: getCategoryPastelBg(offer.businesses.category), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <CategoryIcon category={offer.businesses.category} className="w-[32px] h-[32px]" style={{ color: getCategoryPastelIcon(offer.businesses.category) }} />
                                </div>
                              )}
                              {!isUnlimited && (
                                waitlistedOffers[offer.id] ? (
                                  <span style={{
                                    position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                    background: 'var(--terra)', color: 'white',
                                  }}>
                                    On the list ✓
                                  </span>
                                ) : slotsLeft === 0 ? (
                                  <span style={{
                                    position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                    background: '#F5C4A0', color: 'var(--ink)',
                                  }}>
                                    Join the list
                                  </span>
                                ) : slotsLeft !== null ? (
                                  <span style={{
                                    position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                    background: '#F5C4A0', color: 'var(--ink)',
                                  }}>
                                    {slotsLeft <= 1 ? 'Last slot' : `${slotsLeft} left`}
                                  </span>
                                ) : null
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleSave(offer.id); }}
                                style={{
                                  position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%',
                                  background: 'rgba(246,243,238,0.88)', backdropFilter: 'blur(4px)', border: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? 'var(--terra)' : 'none'} stroke={isSaved ? 'var(--terra)' : 'var(--ink-60)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                              </button>
                            </div>
                            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--ink)', margin: '6px 0 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offerTitle}</p>
                            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'var(--ink-60)', margin: '2px 0 0', lineHeight: 1.3 }}>{offer.businesses.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── All offers — horizontal scroll row ── */}
                {!offersLoading && filteredOffers.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: 12 }}>
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>All offers</span>
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--ink-35)' }}>{filteredOffers.length} available</span>
                    </div>
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}>
                      {filteredOffers.map((offer) => {
                        const offerTitle = offer.generated_title || offer.description;
                        const isUnlimited = offer.monthly_cap === null;
                        const slotsUsed = offer.slotsUsed || 0;
                        const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                        const isSaved = savedOffers.has(offer.id);
                        return (
                          <div
                            key={offer.id}
                            onClick={() => setExpandedOffer(offer.id)}
                            style={{
                              width: 'calc(50vw - 24px)', flexShrink: 0,
                              cursor: 'pointer', position: 'relative',
                            }}
                          >
                            <div style={{ position: 'relative', height: 180, borderRadius: 12, overflow: 'hidden' }}>
                              {offer.offer_photo_url ? (
                                <img src={offer.offer_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', background: getCategoryPastelBg(offer.businesses.category), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <CategoryIcon category={offer.businesses.category} className="w-[28px] h-[28px]" style={{ color: getCategoryPastelIcon(offer.businesses.category) }} />
                                </div>
                              )}
                              {!isUnlimited && (
                                waitlistedOffers[offer.id] ? (
                                  <span style={{
                                    position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                    background: 'var(--terra)', color: 'white',
                                  }}>
                                    On the list ✓
                                  </span>
                                ) : slotsLeft === 0 ? (
                                  <span style={{
                                    position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                    background: '#F5C4A0', color: 'var(--ink)',
                                  }}>
                                    Join the list
                                  </span>
                                ) : slotsLeft !== null ? (
                                  <span style={{
                                    position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                    background: '#F5C4A0', color: 'var(--ink)',
                                  }}>
                                    {slotsLeft <= 1 ? 'Last slot' : `${slotsLeft} left`}
                                  </span>
                                ) : null
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleSave(offer.id); }}
                                style={{
                                  position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%',
                                  background: 'rgba(246,243,238,0.88)', backdropFilter: 'blur(4px)', border: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? 'var(--terra)' : 'none'} stroke={isSaved ? 'var(--terra)' : 'var(--ink-60)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                              </button>
                            </div>
                            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--ink)', margin: '6px 0 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offerTitle}</p>
                            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'var(--ink-60)', margin: '2px 0 0', lineHeight: 1.3 }}>{offer.businesses.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Trending — horizontal scroll row sorted by claims ── */}
                {!offersLoading && (() => {
                  const trendingOffers = [...filteredOffers]
                    .filter(o => (o.slotsUsed || 0) > 0)
                    .sort((a, b) => (b.slotsUsed || 0) - (a.slotsUsed || 0))
                    .slice(0, 10);
                  if (trendingOffers.length === 0) return null;
                  return (
                    <div style={{ marginTop: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: 12 }}>
                        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--ink)' }}>Trending</span>
                      </div>
                      <div className="hide-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}>
                        {trendingOffers.map((offer) => {
                          const offerTitle = offer.generated_title || offer.description;
                          const isUnlimited = offer.monthly_cap === null;
                          const slotsUsed = offer.slotsUsed || 0;
                          const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                          const isSaved = savedOffers.has(offer.id);
                          return (
                            <div
                              key={offer.id}
                              onClick={() => setExpandedOffer(offer.id)}
                              style={{
                                width: 'calc(50vw - 24px)', flexShrink: 0,
                                cursor: 'pointer', position: 'relative',
                              }}
                            >
                              <div style={{ position: 'relative', height: 180, borderRadius: 12, overflow: 'hidden' }}>
                                {offer.offer_photo_url ? (
                                  <img src={offer.offer_photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', background: getCategoryPastelBg(offer.businesses.category), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CategoryIcon category={offer.businesses.category} className="w-[28px] h-[28px]" style={{ color: getCategoryPastelIcon(offer.businesses.category) }} />
                                  </div>
                                )}
                                {/* Slot badge top-left */}
                                {!isUnlimited && (
                                  waitlistedOffers[offer.id] ? (
                                    <span style={{
                                      position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                      fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                      background: 'var(--terra)', color: 'white',
                                    }}>
                                      On the list ✓
                                    </span>
                                  ) : slotsLeft === 0 ? (
                                    <span style={{
                                      position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                      fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                      background: '#F5C4A0', color: 'var(--ink)',
                                    }}>
                                      Join the list
                                    </span>
                                  ) : slotsLeft !== null ? (
                                    <span style={{
                                      position: 'absolute', top: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                      fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 10,
                                      background: '#F5C4A0', color: 'var(--ink)',
                                    }}>
                                      {slotsLeft <= 1 ? 'Last slot' : `${slotsLeft} left`}
                                    </span>
                                  ) : null
                                )}
                                {/* Heart button top-right */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleSave(offer.id); }}
                                  style={{
                                    position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%',
                                    background: 'rgba(246,243,238,0.88)', backdropFilter: 'blur(4px)', border: 'none',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? 'var(--terra)' : 'none'} stroke={isSaved ? 'var(--terra)' : 'var(--ink-60)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                  </svg>
                                </button>
                                {/* Claim count badge bottom-left */}
                                <span style={{
                                  position: 'absolute', bottom: 8, left: 8, borderRadius: 999, padding: '3px 8px',
                                  fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 11,
                                  background: 'rgba(34,34,34,0.72)', color: 'white',
                                }}>
                                  {slotsUsed} claimed
                                </span>
                              </div>
                              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--ink)', margin: '6px 0 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offerTitle}</p>
                              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'var(--ink-60)', margin: '2px 0 0', lineHeight: 1.3 }}>{offer.businesses.name}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Bottom spacer for nav clearance */}
                <div style={{ height: 24 }} />
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
                <div className="space-y-[12px]">
                  {matchedSaved.map(offer => {
                    const isUnlimited = offer.monthly_cap === null;
                    const slotsUsed = offer.slotsUsed || 0;
                    const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                    return (
                      <button
                        key={offer.id}
                        onClick={() => setExpandedOffer(offer.id)}
                        className="w-full text-left"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', border: '1px solid var(--ink-08)', borderRadius: 16, padding: '14px 16px' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offer.generated_title || offer.description}</p>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink-60)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offer.businesses.name}</p>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'var(--ink-60)', margin: 0 }}>
                            {isUnlimited ? 'Open availability' : getSlotsBadgeStyle(slotsLeft as number, offer.monthly_cap as number).text}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSaved(offer.id); }}
                          className="flex-shrink-0"
                          style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <Heart size={20} strokeWidth={1.5} className="text-[var(--terra)] fill-[var(--terra)]" />
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
                  <Zap size={48} strokeWidth={1.5} className="text-[var(--ink-35)] mb-4" />
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
                  {/* Header bar: "Active passes" + "X / Y" counter */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0 20px' }}>
                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>Active passes</span>
                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 14, color: 'var(--ink-60)' }}>
                      {(() => {
                        const filtered = activeClaims.filter(c => c.businesses && c.offers);
                        const currentIdx = filtered.findIndex(c => c.id === selectedClaim?.id);
                        return `${(currentIdx >= 0 ? currentIdx : 0) + 1} / ${filtered.length}`;
                      })()}
                    </span>
                  </div>

                  {/* Swipeable slider */}
                  <div
                    id="claims-slider"
                    className="flex overflow-x-auto"
                    style={{
                      scrollSnapType: 'x mandatory',
                      scrollbarWidth: 'none',
                      padding: '12px 0',
                    }}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const cardWidth = el.clientWidth;
                      const idx = Math.round(el.scrollLeft / cardWidth);
                      const filtered = activeClaims.filter(c => c.businesses && c.offers);
                      if (filtered[idx] && selectedClaim?.id !== filtered[idx].id) {
                        setSelectedClaim(filtered[idx]);
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

                      const isPassCard = false;
                      const cardBg = 'var(--shell)';

                      return (
                        <div
                          key={claim.id}
                          className="flex-shrink-0"
                          style={{ scrollSnapAlign: 'center', width: 'calc(100vw - 40px)', marginLeft: claimIdx === 0 ? 20 : 6, marginRight: claimIdx === activeClaims.filter(c => c.businesses && c.offers).length - 1 ? 20 : 6 }}
                        >
                          <div>
                            {/* Pass info card */}
                            <div className="rounded-[20px]" style={{ background: 'var(--card)', padding: '24px 24px 20px' }}>
                              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--ink)', margin: 0, letterSpacing: '-0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offerTitle}</p>
                              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--ink-60)', margin: '4px 0 14px' }}>{claim.businesses.name}</p>

                              {/* Breadcrumb stepper */}
                              <div className="flex items-center flex-nowrap">
                                {stageLabels.map((label, idx) => {
                                  const isDone = idx < stageIndex;
                                  const isCurrent = idx === stageIndex;
                                  const isFuture = idx > stageIndex;
                                  return (
                                    <span key={label} className="flex items-center">
                                      <span style={{
                                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                                        fontSize: 13,
                                        fontWeight: isCurrent ? 700 : isDone ? 500 : 400,
                                        color: isCurrent ? 'var(--ink)' : 'var(--ink-60)',
                                      }}>
                                        {label}
                                      </span>
                                      {idx < stageLabels.length - 1 && (
                                        <span style={{ fontSize: 11, margin: '0 6px', color: 'var(--ink-35)' }}>›</span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Content below terra card */}
                            <div style={{ padding: '24px 4px 20px' }}>

                              {/* CONFIRM VISIT — shown when status is "claimed" (active, not yet visited) */}
                              {claim.status === 'active' && !claim.redeemed_at && (
                                <div className="flex flex-col items-center text-center pt-4">
                                  <p className="text-[18px] font-extrabold tracking-tight text-[var(--ink)] mb-1">Ready to visit?</p>
                                  <p className="text-[13px] font-normal text-[var(--ink-60)] mb-6 max-w-[220px] leading-snug">
                                    Show this screen to staff and ask them to tap the button below
                                  </p>
                                  <button
                                    onClick={() => setConfirmVisitClaimId(claim.id)}
                                    disabled={loading}
                                    className="w-[180px] h-[180px] rounded-full bg-[var(--terra)] border-none cursor-pointer text-[28px] font-extrabold text-white tracking-tight leading-none"
                                    style={{ opacity: loading ? 0.6 : 1 }}
                                  >
                                    {loading ? 'Confirming…' : <>Confirm<br />visit</>}
                                  </button>
                                </div>
                              )}

                              {/* Confirm visit dialog */}
                              {confirmVisitClaimId === claim.id && (
                                <div
                                  style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,34,34,0.5)' }}
                                  onClick={() => setConfirmVisitClaimId(null)}
                                >
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ background: 'var(--shell)', borderRadius: 20, padding: '28px 24px', width: 'calc(100vw - 48px)', maxWidth: 340, textAlign: 'center', boxShadow: '0 8px 40px rgba(34,34,34,0.18)' }}
                                  >
                                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 18, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Confirm this visit?</p>
                                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 14, color: 'var(--ink-60)', margin: '0 0 24px', lineHeight: 1.5 }}>
                                      Only confirm if you are at {claim.businesses.name} and a staff member is present.
                                    </p>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                      <button
                                        onClick={() => setConfirmVisitClaimId(null)}
                                        style={{
                                          flex: 1, height: 48, borderRadius: 999, border: '1.5px solid var(--ink-08)', background: 'transparent',
                                          fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--ink)',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={async () => {
                                          try {
                                            setLoading(true);
                                            setConfirmVisitClaimId(null);
                                            const { error } = await supabase
                                              .from('claims')
                                              .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
                                              .eq('id', claim.id);
                                            if (error) throw error;
                                            setActiveClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: 'redeemed', redeemed_at: new Date().toISOString() } : c));
                                            setClaims(prev => prev.map(c => c.id === claim.id ? { ...c, status: 'redeemed', redeemed_at: new Date().toISOString() } : c));
                                            if (selectedClaim?.id === claim.id) setSelectedClaim({ ...claim, status: 'redeemed', redeemed_at: new Date().toISOString() } as any);
                                          } catch (err: any) {
                                            setClaimError('Something went wrong — please try again');
                                          } finally {
                                            setLoading(false);
                                          }
                                        }}
                                        disabled={loading}
                                        style={{
                                          flex: 1, height: 48, borderRadius: 999, border: 'none', background: 'var(--terra)',
                                          fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 15, color: 'white',
                                          cursor: 'pointer', opacity: loading ? 0.6 : 1,
                                        }}
                                      >
                                        Yes, confirm
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* POST-VISIT — shown when visited (redeemed) but reel not yet submitted */}
                              {claim.redeemed_at && !claim.reel_url && (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                                    <Check size={28} strokeWidth={1.5} color="var(--terra)" />
                                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>Visit confirmed!</span>
                                  </div>
                                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'var(--ink-60)', margin: '0 auto 16px', maxWidth: 280, lineHeight: 1.65 }}>
                                    Now post your Reel within 48 hours and submit the link below
                                  </p>
                                  {/* Reel deadline */}
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F5C4A0', borderRadius: 999, padding: '6px 14px', marginBottom: 20 }}>
                                    <Clock size={14} strokeWidth={1.5} color="var(--ink)" />
                                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                                      {isOverdue ? 'Overdue!' : `${timeLeft} remaining`}
                                    </span>
                                  </div>
                                  {/* Reel URL input */}
                                  <div style={{ textAlign: 'left' }}>
                                    <input
                                      type="url"
                                      value={reelUrl}
                                      onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
                                      placeholder="Paste your Instagram Reel link here"
                                      className="w-full focus:outline-none"
                                      style={{ background: 'var(--card)', border: '1.5px solid rgba(34,34,34,0.08)', borderRadius: 999, padding: '14px 16px', fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink)' }}
                                      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--ink)'; }}
                                      onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(34,34,34,0.08)'; }}
                                    />
                                    {reelError && <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: 'var(--ink-60)', marginTop: 8 }}>Please check the URL and try again.</p>}
                                    <button
                                      onClick={handleSubmitReel}
                                      disabled={loading || !reelUrl}
                                      style={{
                                        width: '100%', height: 52, borderRadius: 999, border: 'none', marginTop: 14,
                                        background: (reelUrl && reelUrl.startsWith('http') && reelUrl.length > 4) ? 'var(--terra)' : 'var(--terra-40)',
                                        fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, color: 'white', cursor: 'pointer',
                                      }}
                                    >
                                      Submit Reel
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Reel already submitted */}
                              {claim.reel_url && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
                                  <Check size={20} strokeWidth={1.5} color="var(--terra)" />
                                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>Reel submitted!</span>
                                </div>
                              )}

                              {/* Report / Release links */}
                              <div className="flex items-center justify-center !text-[11px] mt-5 pb-2.5 [&_button]:!text-[11px] [&_span]:!text-[11px]">
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
                                      <Flag size={11} strokeWidth={1.5} /> Report an issue
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
                                              <X size={11} strokeWidth={1.5} /> Release offer
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

                  {/* Pagination dots — hidden if more than 7 passes */}
                  {(() => {
                    const filtered = activeClaims.filter(c => c.businesses && c.offers);
                    if (filtered.length <= 1 || filtered.length > 7) return null;
                    const currentIdx = filtered.findIndex(c => c.id === selectedClaim?.id);
                    const activeIdx = currentIdx >= 0 ? currentIdx : 0;
                    return (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 8 }}>
                        {filtered.map((_, i) => (
                          <div
                            key={i}
                            style={{
                              width: i === activeIdx ? 8 : 6,
                              height: i === activeIdx ? 8 : 6,
                              borderRadius: '50%',
                              background: i === activeIdx ? 'var(--terra)' : 'rgba(34,34,34,0.18)',
                              transition: 'all 0.2s ease',
                            }}
                          />
                        ))}
                      </div>
                    );
                  })()}
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
                  <Zap size={48} strokeWidth={1.5} className="text-[var(--ink-35)] mx-auto mb-4" />
                  <p className="text-[18px] font-semibold text-[var(--ink)]">No claims yet</p>
                  <p className="text-[18px] text-[var(--ink-60)] mt-1">Claim an offer to get started</p>
                </div>
              ) : (
                <div className="space-y-[12px]">
                  {claims.filter(c => c.businesses && c.offers).map((claim) => (
                    <button
                      key={claim.id}
                      onClick={() => {
                        if (claim.status === 'active' || (claim.status === 'redeemed' && !claim.reel_url)) {
                          setSelectedClaim(claim);
                          setView('active');
                        }
                      }}
                      className="w-full text-left"
                      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'var(--card)', border: '1px solid var(--ink-08)', borderRadius: 16, padding: '14px 16px' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claim.offers.generated_title || claim.offers.description}</p>
                        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink-60)', margin: 0 }}>{claim.businesses.name}</p>
                        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'var(--ink-60)', margin: 0 }}>{formatDate(claim.claimed_at)}</p>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: 12 }}>
                        <StatusPill status={claim.status} />
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
              <p className="text-[13px] mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--ink-60)' }}>
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
                  <Clock size={28} strokeWidth={1.5} className="text-[var(--ink-60)] mx-auto mb-2.5" />
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
                          <Camera size={11} strokeWidth={1.5} className="text-white" />
                        </button>
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0 pt-[2px]">
                        <h2 className="text-[22px] text-[var(--ink)] leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>{userProfile.name}</h2>
                        <div className="flex items-center gap-[6px] mt-[4px] flex-wrap">
                          <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="sm" />
                          {userProfile.profile_complete && (
                            <span className="flex items-center gap-[3px] text-[13px] font-semibold text-[var(--terra)]">
                              <BadgeCheck size={13} strokeWidth={1.5} /> Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-[10px] mt-[6px]">
                          <button onClick={copyCode} className="flex items-center gap-1 text-[14px] font-semibold text-[var(--ink-35)]">
                            {userProfile.code}
                            {copiedCode ? (
                              <span className="text-[var(--ink)] text-[13px]">Copied!</span>
                            ) : (
                              <Copy size={12} strokeWidth={1.5} />
                            )}
                          </button>
                          {userProfile.instagram_handle && (
                            <span className="flex items-center gap-1 text-[14px] text-[var(--ink-35)]">
                              <AtSign size={12} strokeWidth={1.5} /> {userProfile.instagram_handle}
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
                        <p className="text-[11px] text-[var(--ink-60)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Claimed</p>
                      </div>
                      <div className="flex-1 text-center rounded-[14px] py-[10px]" style={{ background: 'var(--card)', border: '1px solid var(--ink-08)' }}>
                        <p className="text-[20px] text-[var(--terra)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>{collabsCompleted}</p>
                        <p className="text-[11px] text-[var(--ink-60)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Posted</p>
                      </div>
                      <div className="flex-1 text-center rounded-[14px] py-[10px]" style={{ background: 'var(--card)', border: '1px solid var(--ink-08)' }}>
                        <p className="text-[20px] text-[var(--terra)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>{userProfile.average_rating ? userProfile.average_rating.toFixed(1) : '—'}</p>
                        <p className="text-[11px] text-[var(--ink-60)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Rating</p>
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
                            <BadgeCheck size={18} strokeWidth={1.5} className="text-[var(--terra)]" />
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
                              <Plus size={16} strokeWidth={1.5} className="w-[10px] h-[10px]" /> {field.label}
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
                        <User size={20} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                        <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Edit profile</span>
                      </div>
                      <ChevronRight size={18} strokeWidth={1.5} className="text-[var(--ink-35)]" />
                    </button>
                    <button
                      onClick={() => setProfileSubView('alerts')}
                      className="w-full flex items-center justify-between py-[16px] border-b border-[var(--ink-08)] text-left"
                    >
                      <div className="flex items-center gap-[12px]">
                        <Bell size={20} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                        <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Notifications</span>
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--terra)] text-white text-[13px] font-bold flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={18} strokeWidth={1.5} className="text-[var(--ink-35)]" />
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-[12px] py-[16px] text-left"
                    >
                      <LogOut size={20} strokeWidth={1.5} className="text-[var(--terra)]" />
                      <span className="text-[15px] text-[var(--terra)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Sign out</span>
                    </button>
                  </div>
                </>
              ) : profileSubView === 'alerts' ? (
                /* Alerts/Notifications sub-view */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setProfileSubView('main')} className="p-2 -ml-2 hover:bg-[var(--shell)] rounded-[12px] transition-colors">
                      <ChevronLeft size={20} strokeWidth={1.5} className="text-[var(--ink)]" />
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
                      {notifications.map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => !notif.read && markNotificationRead(notif.id)}
                          className="w-full text-left transition-all"
                          style={{ background: 'var(--card)', border: '1px solid var(--ink-08)', borderRadius: 16, padding: '14px 16px' }}
                        >
                          <div className="flex items-start gap-3">
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: notif.read ? 'var(--ink-08)' : 'var(--terra)', flexShrink: 0, marginTop: 4 }} />
                            <div className="flex-1 min-w-0">
                              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 15, color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>{notif.message}</p>
                              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'var(--ink-60)', marginTop: 4, margin: '4px 0 0' }}>{formatDate(notif.created_at)}</p>
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
                      <ChevronLeft size={20} strokeWidth={1.5} className="text-[var(--ink)]" />
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
                          <Camera size={13} strokeWidth={1.5} className="text-white" />
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
          padding: '14px 0 28px',
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
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 12,
                  color: isActive ? 'var(--terra)' : 'var(--ink-35)',
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                <div className="relative flex items-center justify-center" style={{ width: 24, height: 24 }}>
                  {/* Explore — magnifying glass */}
                  {tab.icon === 'explore' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  )}
                  {/* Saved — heart */}
                  {tab.icon === 'saved' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  )}
                  {/* Active — lightning bolt */}
                  {tab.icon === 'active' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  )}
                  {/* Claims — document */}
                  {tab.icon === 'claims' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>
                  )}
                  {/* Profile — avatar circle or person icon */}
                  {tab.icon === 'profile' && (
                    avatarUrl ? (
                      <img src={avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: isActive ? '2px solid var(--terra)' : '2px solid transparent' }} />
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    )
                  )}
                  {/* Badge count for Active tab */}
                  {'badge' in tab && (tab as any).badge > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -8,
                      minWidth: 16, height: 16, borderRadius: '50%',
                      background: 'var(--terra)', border: '2px solid var(--shell)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 10, color: 'white',
                    }}>
                      {(tab as any).badge}
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
