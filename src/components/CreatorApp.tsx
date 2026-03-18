import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, Heart, Zap, SlidersHorizontal, Home, Coffee, Sparkles, LayoutGrid, ChevronRight, ChevronLeft, FileText, Bell, Check, LogOut, ExternalLink, Flag, X, User, Users, Clock, Copy, Camera, Instagram, Video, AlertCircle, Lock, Plus, BadgeCheck } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';
import CreatorOnboarding from './CreatorOnboarding';
import DisputeModal from './DisputeModal';
import LevelBadge from './LevelBadge';
import { getCategoryGradient, getCategorySolidColor, CategoryIcon } from '../lib/categories';
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
  businesses: { name: string; category: string; logo_url?: string | null; latitude?: number; longitude?: number; address?: string };
}

// ─── Flame SVG for streaks (solid fill) ───────────────────────────────────
function FlameIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1C8 1 3 5.5 3 9.5C3 12 5.24 14 8 14C10.76 14 13 12 13 9.5C13 5.5 8 1 8 1Z"
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
    claimed: 'bg-[var(--terra)] text-white',
    redeemed: 'bg-[var(--bg)] text-[var(--near-black)]',
    visited: 'bg-[var(--bg)] text-[var(--near-black)]',
    reel_due: 'bg-[var(--terra)] text-white',
    submitted: 'bg-emerald-500 text-white',
    expired: 'bg-[var(--terra-10)] text-[var(--terra)] border border-[var(--terra-20)]',
    overdue: 'bg-orange-50 text-orange-600 border border-orange-100',
    completed: 'bg-[var(--bg)] text-[var(--mid)]',
    disputed: 'bg-[var(--terra-10)] text-[var(--terra)]',
  };
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-[6px] font-bold ${styles[status] || 'bg-[var(--bg)] text-[var(--near-black)]'}`}>
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
function getSlotsBadgeStyle(slotsLeft: number, totalSlots: number) {
  if (slotsLeft === 0) {
    return { background: 'rgba(34,34,34,0.07)', color: 'rgba(34,34,34,0.4)', text: 'Full' };
  }
  if (slotsLeft === 1) {
    return { background: 'rgba(196,103,74,0.15)', color: 'var(--terra)', text: 'Last slot' };
  }
  if (slotsLeft <= 2) {
    return { background: 'rgba(196,103,74,0.15)', color: 'var(--terra)', text: `${slotsLeft} left` };
  }
  return { background: 'var(--peach)', color: 'var(--near-black)', text: `${slotsLeft} left` };
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
      .select('*, businesses(name, category, latitude, longitude, address, logo_url)')
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
        const errorMessages: Record<string, string> = {
          'monthly_cap_reached': 'This offer has reached its monthly limit. Try again next month or join the waitlist.',
          'already_claimed': 'You already have an active claim for this offer.',
          'not_approved': 'Your account needs to be approved before claiming offers.',
          'offer_not_live': 'This offer is no longer available.',
        };
        setClaimError(errorMessages[data.error] || data.error);
        return;
      }

      setView('active');
      fetchOffers();
      fetchClaims();

      // Send transactional emails (non-blocking)
      const offerTitle = offer.generated_title || offer.description;
      const businessName = offer.businesses?.name || 'a local business';
      sendOfferClaimedCreatorEmail(userProfile.id, offerTitle, businessName).catch(() => {});
      sendNewClaimBusinessEmail(offer.business_id, userProfile.display_name || userProfile.name, offerTitle).catch(() => {});
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
  const activeBadgeColor = activeUrgency === 'overdue'
    ? 'bg-[var(--terra)]'
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
    return (
      <div
        className="rounded-full flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size, background: getCategorySolidColor(category) }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-[rgba(255,255,255,0.8)] font-extrabold" style={{ fontSize: size * 0.4 }}>{name.charAt(0)}</span>
        )}
      </div>
    );
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--near-black)] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full shadow-lg">
          {undoToast}
        </div>
      )}

      {redeemToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--terra)] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2">
          <Check className="w-4 h-4" />
          {redeemToast}
        </div>
      )}

      {/* Level Up Overlay */}
      {showLevelUpOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(26,26,26,0.85)' }}>
          <div className="bg-white rounded-[16px] p-[36px_28px] text-center max-w-[320px] mx-4">
            <div className="flex justify-center mb-5">
              <LevelBadge level={showLevelUpOverlay.level} levelName={showLevelUpOverlay.levelName} size="lg" />
            </div>
            <h2 className="text-[24px] font-extrabold text-[var(--near-black)] mb-2" style={{ letterSpacing: '-0.5px' }}>
              You're now a {showLevelUpOverlay.levelName === 'Nayba' ? '✦ Nayba' : showLevelUpOverlay.levelName}
            </h2>
            <p className="text-[14px] text-[var(--mid)] mb-6 leading-[1.5]">
              {showLevelUpOverlay.level === 2 && 'You posted your first reel. You can now access more offers.'}
              {showLevelUpOverlay.level === 3 && 'Businesses are starting to notice you. Keep it up.'}
              {showLevelUpOverlay.level === 4 && "You're a local favourite. Premium offers are unlocking."}
              {showLevelUpOverlay.level === 5 && 'Trusted creator status. The best offers are now available to you.'}
              {showLevelUpOverlay.level === 6 && 'The highest tier. You are a Nayba.'}
            </p>
            <button
              onClick={() => setShowLevelUpOverlay(null)}
              className="w-full py-[14px] rounded-[50px] font-bold text-[14px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
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
            className="fixed top-0 left-0 right-0 bottom-0 bg-white"
            style={{ zIndex: 9999, overflowY: 'auto' }}
          >
            {/* Back button — fixed so it stays visible when scrolling */}
            <button
              onClick={() => { setShowQrFullscreen(false); setReelError(null); setReelUrl(''); }}
              className="fixed top-[12px] left-[12px] flex items-center gap-1 text-[var(--near-black)] text-[15px] font-semibold min-w-[44px] min-h-[44px] px-[8px] bg-white"
              style={{ zIndex: 10000, borderRadius: 8 }}
            >
              ← Back
            </button>
            <div className="flex flex-col items-center w-full px-[20px]" style={{ paddingTop: 48, paddingBottom: 40 }}>
              {/* Offer name + business name */}
              <p className="text-[18px] font-semibold text-[var(--near-black)] text-center">{qrOfferTitle}</p>
              <p className="text-[14px] text-[var(--mid)] text-center mt-[4px]">{qrClaim.businesses.name}</p>

              {/* Segmented toggle — only for reel_due */}
              {isReelDue && (
                <div
                  className="relative flex items-center mt-[20px]"
                  style={{ width: 240, height: 42, background: 'var(--bg)', borderRadius: 50, padding: 3 }}
                >
                  {/* Sliding active indicator */}
                  <div
                    className="absolute"
                    style={{
                      width: 'calc(50% - 3px)',
                      height: 36,
                      borderRadius: 50,
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(34,34,34,0.12)',
                      left: activeTab === 'pass' ? 3 : 'calc(50%)',
                      transition: 'all 0.2s ease',
                    }}
                  />
                  <button
                    onClick={() => setQrScreenTab('pass')}
                    className="relative flex-1 text-center text-[14px] font-semibold"
                    style={{ height: 36, lineHeight: '36px', color: activeTab === 'pass' ? 'var(--near-black)' : 'var(--mid)', borderRadius: 50 }}
                  >
                    Show pass
                  </button>
                  <button
                    onClick={() => setQrScreenTab('reel')}
                    className="relative flex-1 text-center text-[14px] font-semibold"
                    style={{ height: 36, lineHeight: '36px', color: activeTab === 'reel' ? 'var(--near-black)' : 'var(--mid)', borderRadius: 50 }}
                  >
                    Submit reel
                  </button>
                </div>
              )}

              {/* === SHOW PASS STATE === */}
              {activeTab === 'pass' && (
                <div className="flex flex-col items-center w-full" style={{ marginTop: 24, minHeight: isReelDue ? undefined : 'calc(100vh - 200px)', justifyContent: isReelDue ? undefined : 'center' }}>
                  <QRCodeDisplay
                    token={qrClaim.qr_token}
                    claimId={qrClaim.id}
                    creatorCode={userProfile.code}
                    size={280}
                    hideExtras
                  />
                  {/* Ref code pill — single instance */}
                  <span
                    className="font-mono text-[15px] font-extrabold tracking-[1.5px] text-white inline-block rounded-full px-[20px] py-[8px] mt-[16px]"
                    style={{ background: 'var(--near-black)' }}
                  >
                    {userProfile.code}
                  </span>
                  {/* Refresh countdown */}
                  <p className="text-[13px] text-[var(--mid)] mt-[10px]">Auto-refreshes every 30s</p>
                  {/* Level badge */}
                  <div className="mt-[10px]">
                    <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="md" />
                  </div>
                </div>
              )}

              {/* === SUBMIT REEL STATE === */}
              {activeTab === 'reel' && isReelDue && (
                <div className="flex flex-col w-full" style={{ marginTop: 24 }}>
                  {/* Timer block */}
                  <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16 }}>
                    <div className="flex items-center gap-[8px]">
                      <Clock className="w-[16px] h-[16px] text-[var(--mid)]" />
                      <span className="text-[16px] font-semibold text-[var(--near-black)]">
                        {reelDueTimeLeft ? `${reelDueTimeLeft} remaining` : 'Post your reel now'}
                      </span>
                    </div>
                    <p className="text-[14px] text-[var(--mid)] mt-[8px]" style={{ lineHeight: 1.6 }}>
                      Post your reel within this window — it must genuinely feature the business.
                    </p>
                  </div>

                  {/* Reel URL input */}
                  <div style={{ marginTop: 20 }}>
                    <label className="text-[13px] font-semibold text-[var(--near-black)]" style={{ marginBottom: 8, display: 'block' }}>
                      Reel URL
                    </label>
                    <input
                      type="url"
                      value={reelUrl}
                      onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
                      placeholder="https://instagram.com/reel/"
                      className="w-full text-[15px] text-[var(--near-black)] placeholder:text-[var(--soft)] focus:outline-none"
                      style={{ background: 'white', border: '1.5px solid rgba(34,34,34,0.15)', borderRadius: 12, padding: '14px 16px', ...(reelUrl ? {} : {}), }}
                      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--terra)'; }}
                      onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(34,34,34,0.15)'; }}
                    />
                    {reelError ? (
                      <p className="text-[13px] text-[var(--terra)] mt-[8px]">Please check the URL and try again.</p>
                    ) : (
                      <p className="text-[12px] text-[var(--soft)] mt-[8px]">Paste the link from Instagram after you've posted.</p>
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
                    className="w-full text-white text-[16px] font-bold flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: isSubmitEnabled ? 'var(--terra)' : 'rgba(196,103,74,0.4)',
                      height: 52,
                      borderRadius: 50,
                      marginTop: 16,
                      cursor: isSubmitEnabled && !loading ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting…
                      </>
                    ) : 'Submit reel →'}
                  </button>

                  {/* Report link */}
                  <button
                    onClick={() => setDisputeClaimId(qrClaim.id)}
                    className="w-full text-center text-[13px] text-[var(--mid)] underline min-h-[44px]"
                    style={{ marginTop: 12 }}
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
        const confettiColors = ['#C4674A', '#F5C4A0', '#C8B8F0', '#F4A8C0'];
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
          <div className="fixed top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center" style={{ zIndex: 9999, background: 'var(--forest)' }}>
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
            <h2 className="text-[32px] font-extrabold text-white text-center mt-[24px]" style={{ letterSpacing: '-0.5px' }}>
              Reel submitted!
            </h2>
            <p className="text-[16px] text-white text-center mt-[8px]" style={{ opacity: 0.6 }}>
              {showReelCelebration.offerName}
            </p>
            <p className="text-[14px] text-white text-center mt-[2px]" style={{ opacity: 0.6 }}>
              {showReelCelebration.businessName}
            </p>
            <div className="mt-[16px]">
              <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="lg" />
            </div>
            <button
              onClick={() => { setShowReelCelebration(null); setView('offers'); }}
              className="mt-[32px] px-[32px] py-[14px] rounded-full text-white text-[15px] font-bold min-h-[48px]"
              style={{ background: 'var(--terra)' }}
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
          <div className="fixed inset-0 z-50 bg-white flex flex-col">
            {/* Hero */}
            <div className="relative h-[200px] flex items-center justify-center" style={{ background: getCategoryGradient(offer.businesses.category) }}>
              {offer.offer_photo_url ? (
                <img src={offer.offer_photo_url} alt={offer.businesses.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : offer.businesses.logo_url ? (
                <img src={offer.businesses.logo_url} alt={offer.businesses.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-[64px] h-[64px] rounded-[16px] bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                  <span className="text-[rgba(255,255,255,0.8)] text-[28px] font-extrabold">{offer.businesses.name.charAt(0)}</span>
                </div>
              )}
              <button
                onClick={() => setExpandedOffer(null)}
                className="absolute top-[16px] left-[16px] w-[36px] h-[36px] rounded-full bg-white flex items-center justify-center shadow-[0_2px_8px_rgba(34,34,34,0.1)]"
              >
                <ChevronLeft className="w-[18px] h-[18px] text-[var(--near-black)]" />
              </button>
              {/* Locked overlay on hero */}
              {detailIsLocked && (
                <div className="absolute inset-0" style={{ background: 'rgba(26,26,26,0.45)' }} />
              )}
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
                <h2 className="text-[22px] font-extrabold text-[var(--near-black)]" style={{ letterSpacing: '-0.5px' }}>{offer.businesses.name}</h2>
                <p className="text-[14px] text-[var(--mid)] mt-1">{offer.businesses.category}</p>

                {/* Level requirement banner */}
                {detailIsLocked && (
                  <div className="flex items-start gap-3 rounded-[12px] p-[12px_14px] mt-3" style={{ background: 'rgba(26,26,26,0.04)' }}>
                    <Lock className="w-[14px] h-[14px] text-[var(--mid)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--near-black)]">{detailLockedName} creators only</p>
                      <p className="text-[12px] text-[var(--mid)] mt-0.5">You're Level {detailCreatorLevel} · {detailReelsToUnlock} more reel{detailReelsToUnlock !== 1 ? 's' : ''} to unlock</p>
                    </div>
                  </div>
                )}

                {/* Offer headline */}
                <p className="text-[20px] font-extrabold text-[var(--near-black)] mt-3" style={{ letterSpacing: '-0.4px' }}>
                  {offer.generated_title || (offer.description.length > 50 ? offer.description.slice(0, 50) + '…' : offer.description)}
                </p>
                <div className="h-[1px] bg-[var(--faint)] my-[14px]" />

                {/* B) What you get */}
                <p className="text-[10px] font-bold text-[var(--soft)] uppercase tracking-[0.8px] mb-2">WHAT YOU GET</p>
                <p className="text-[16px] font-semibold text-[var(--near-black)] leading-[1.5] mb-5">
                  {offer.generated_title || offer.description}
                </p>

                {/* C) What to post */}
                <p className="text-[10px] font-bold text-[var(--soft)] uppercase tracking-[0.8px] mb-2">WHAT TO POST</p>
                <div className="flex items-center gap-2 mb-2">
                  <Video className="w-5 h-5 text-[var(--terra)]" />
                  <span className="text-[15px] font-bold text-[var(--near-black)]">One Instagram Reel</span>
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
                <div className="flex items-center justify-between rounded-[12px] bg-[var(--bg)] px-[16px] py-[12px]">
                  <div className="flex items-center gap-2">
                    <Users className="w-[14px] h-[14px] text-[var(--mid)]" />
                    <span className="text-[14px] font-semibold" style={{ color: !isUnlimited && slotsLeft !== null ? getSlotsBadgeStyle(slotsLeft, offer.monthly_cap as number).color : 'var(--near-black)' }}>
                      {isUnlimited ? 'Open availability' : full ? 'Sold out' : getSlotsBadgeStyle(slotsLeft as number, offer.monthly_cap as number).text}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-[14px] h-[14px] text-[var(--mid)]" />
                    <span className="text-[14px] font-semibold text-[var(--near-black)]">48hrs to post</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky bottom bar */}
            <div className="border-t border-[var(--faint)] bg-white px-[20px] py-[14px]">
              {detailIsLocked ? (
                <div
                  className="w-full py-[14px] rounded-[50px] text-center text-[12px] text-[var(--soft)]"
                  style={{ background: 'var(--bg)' }}
                >
                  Unlocks at {detailLockedName}
                </div>
              ) : (
              <div className="flex items-center justify-between">
                <div>
                  {full && waitlistedOffers[offer.id] ? (
                    <>
                      <p className="text-[14px] font-semibold text-[var(--near-black)]">You're on the waitlist</p>
                      {waitlistedOffers[offer.id].position && (
                        <p className="text-[12px] text-[var(--soft)]">You're #{waitlistedOffers[offer.id].position} on the waitlist</p>
                      )}
                    </>
                  ) : full ? (
                    <p className="text-[14px] text-[var(--mid)]">All slots taken</p>
                  ) : (
                    <>
                      <p className="text-[15px] font-extrabold text-[var(--near-black)]">Free visit</p>
                      <p className="text-[12px] text-[var(--mid)]">Post reel within 48hrs</p>
                    </>
                  )}
                </div>
                {full ? (
                  waitlistedOffers[offer.id] ? (
                    waitlistConfirmLeave === offer.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => leaveWaitlist(offer.id)}
                          disabled={waitlistLoading === offer.id}
                          className="px-[18px] py-[10px] rounded-full text-[13px] font-semibold border border-[rgba(34,34,34,0.15)] text-[var(--near-black)] min-h-[44px]"
                        >
                          {waitlistLoading === offer.id ? 'Leaving...' : 'Yes, leave'}
                        </button>
                        <button
                          onClick={() => setWaitlistConfirmLeave(null)}
                          className="px-[18px] py-[10px] rounded-full text-[13px] font-semibold text-[var(--mid)] min-h-[44px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setWaitlistConfirmLeave(offer.id)}
                        className="px-[22px] py-[12px] rounded-full text-[14px] font-semibold min-h-[48px] flex items-center gap-1"
                        style={{ border: '1.5px solid var(--terra)', color: 'var(--terra)', background: 'rgba(196,103,74,0.04)' }}
                      >
                        On waitlist <Check className="w-4 h-4" />
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => joinWaitlist(offer.id)}
                      disabled={waitlistLoading === offer.id}
                      className="px-[22px] py-[12px] rounded-full text-[14px] font-semibold text-[var(--near-black)] min-h-[48px] disabled:opacity-40"
                      style={{ border: '1.5px solid rgba(34,34,34,0.15)', background: 'transparent' }}
                    >
                      {waitlistLoading === offer.id ? 'Joining...' : 'Join waitlist'}
                    </button>
                  )
                ) : alreadyClaimed ? (
                  <button disabled className="px-[22px] py-[12px] rounded-full text-[14px] font-bold bg-[var(--bg)] text-[var(--soft)] cursor-not-allowed flex items-center gap-1 min-h-[48px]">
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
              )}
            </div>
          </div>
        );
      })()}

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-md mx-auto">

        {/* Content */}
        <div className="pb-6">

          {/* -- EXPLORE FEED -- */}
          {view === 'offers' && (
            <>
              {claimError && (
                <div className="mx-[20px] mt-3 p-3 rounded-[12px] bg-[var(--terra-10)] border border-[var(--terra-20)] flex items-center justify-between">
                  <p className="text-[13px] text-[var(--terra)]">{claimError}</p>
                  <button onClick={() => setClaimError(null)} className="text-[var(--soft)] hover:text-[var(--mid)] text-[13px] font-semibold ml-3">Dismiss</button>
                </div>
              )}

              {/* Search bar */}
              <div className="px-[20px] pt-[20px] pb-3">
                <div
                  className="w-full rounded-full bg-white flex items-center gap-3 px-[16px] py-[14px]"
                  style={{
                    border: '1px solid rgba(34,34,34,0.12)',
                    boxShadow: '0 2px 8px rgba(34,34,34,0.08)',
                  }}
                >
                  <Search className="w-[15px] h-[15px] text-[var(--soft)] flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Find local offers..."
                    className="w-full bg-transparent text-[15px] font-semibold text-[var(--near-black)] placeholder:text-[var(--near-black)] focus:outline-none"
                    style={{ minHeight: '24px' }}
                  />
                  <div
                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ border: '1px solid rgba(34,34,34,0.15)' }}
                  >
                    <SlidersHorizontal className="w-[12px] h-[12px] text-[var(--near-black)]" />
                  </div>
                </div>
              </div>

              {/* Category Tabs */}
              <div className="px-[20px] border-b border-[var(--faint)]">
                <div className="flex">
                  {categoryTabs.map(tab => {
                    const isActive = selectedCategory === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedCategory(tab.key)}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 relative transition-all min-h-[44px] ${
                          isActive ? 'text-[var(--near-black)]' : 'text-[var(--soft)]'
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

              {/* Your passes — JS-controlled slider */}
              {activeClaims.length > 0 && activeClaims.some(c => c.businesses && c.offers) && (() => {
                const giftCardClaims = activeClaims.filter(c => c.businesses && c.offers);

                const getGiftCardBg = (category: string): string => {
                  const lower = category.toLowerCase();
                  if (['restaurant', 'cafe', 'bakery', 'bar', 'food truck', 'food', 'coffee', 'juice bar', 'dessert', 'pizza', 'brunch'].some(c => lower.includes(c))) return '#3D2314';
                  if (['salon', 'spa', 'beauty', 'nails', 'hair', 'skincare', 'barbershop', 'wellness'].some(c => lower.includes(c))) return '#3D1A2A';
                  return 'var(--forest)';
                };

                const getGiftCardStatus = (claim: Claim): { dotColor: string; text: string } => {
                  if (claim.status === 'active') {
                    return { dotColor: 'var(--peach)', text: 'Show at the door' };
                  }
                  if (claim.redeemed_at && !claim.reel_url) {
                    if (claim.reel_due_at) {
                      const hoursLeft = Math.max(0, Math.floor((new Date(claim.reel_due_at).getTime() - Date.now()) / (1000 * 60 * 60)));
                      return { dotColor: 'var(--terra)', text: `Reel due · ${hoursLeft}h left` };
                    }
                    return { dotColor: 'var(--terra)', text: 'Post your reel' };
                  }
                  return { dotColor: 'var(--terra)', text: 'Post your reel' };
                };

                return (
                  <div style={{ marginBottom: 16 }}>
                    <div className="flex items-center justify-between px-[20px] mt-[12px] mb-[10px]">
                      <h2 className="text-[18px] font-extrabold text-[var(--near-black)] tracking-[-0.3px]">Your passes</h2>
                      {giftCardClaims.length >= 2 && (
                        <button onClick={() => setView('active')} className="text-[13px] font-semibold text-[var(--terra)]">
                          View all
                        </button>
                      )}
                    </div>
                    {/* Slider container */}
                    <div
                      style={{ overflow: 'hidden', position: 'relative', marginLeft: 16, marginRight: 16 }}
                      onTouchStart={(e) => {
                        passTouchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
                      }}
                      onTouchEnd={(e) => {
                        if (!passTouchRef.current) return;
                        const endX = e.changedTouches[0].clientX;
                        const endY = e.changedTouches[0].clientY;
                        const deltaX = passTouchRef.current.startX - endX;
                        const deltaY = passTouchRef.current.startY - endY;
                        const absDeltaX = Math.abs(deltaX);
                        const absDeltaY = Math.abs(deltaY);

                        // Tap detection: very small movement
                        if (absDeltaX < 10 && absDeltaY < 10) {
                          const claim = giftCardClaims[activePassIdx];
                          if (claim) {
                            setSelectedClaim(claim);
                            setQrOpenSource('home');
                            setQrScreenTab(claim.redeemed_at && !claim.reel_url ? 'reel' : 'pass');
                            setShowQrFullscreen(true);
                          }
                          passTouchRef.current = null;
                          return;
                        }

                        // Swipe detection: horizontal threshold > 50px
                        if (absDeltaX > 50 && absDeltaX > absDeltaY) {
                          if (deltaX > 0 && activePassIdx < giftCardClaims.length - 1) {
                            setActivePassIdx(activePassIdx + 1);
                          } else if (deltaX < 0 && activePassIdx > 0) {
                            setActivePassIdx(activePassIdx - 1);
                          }
                        }
                        passTouchRef.current = null;
                      }}
                    >
                      <div
                        className="flex"
                        style={{
                          transition: 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                          transform: `translateX(-${activePassIdx * 100}%)`,
                        }}
                      >
                        {giftCardClaims.map((claim) => {
                          const offerTitle = claim.snapshot_generated_title || claim.offers.generated_title || claim.offers.description || '';
                          const matchedOffer = offers.find(o => o.id === claim.offer_id);
                          const photoUrl = matchedOffer?.offer_photo_url || null;
                          const status = getGiftCardStatus(claim);

                          return (
                            <div
                              key={claim.id}
                              className="relative overflow-hidden text-left"
                              style={{
                                width: '100%',
                                flexShrink: 0,
                                height: 200,
                                borderRadius: 20,
                                boxShadow: '0 2px 12px rgba(34,34,34,0.10)',
                                background: photoUrl ? undefined : getGiftCardBg(claim.businesses.category),
                              }}
                            >
                              {photoUrl && (
                                <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-center" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              )}
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }} />

                              <span className="absolute top-[14px] left-[16px] text-[12px] font-semibold text-white" style={{ opacity: 0.8 }}>
                                {claim.businesses.name}
                              </span>

                              <p
                                className="absolute left-[16px] text-[22px] font-extrabold text-white"
                                style={{ top: '50%', transform: 'translateY(-50%)', right: 60, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}
                              >
                                {offerTitle}
                              </p>

                              <div className="absolute bottom-[14px] left-[16px] flex items-center gap-[6px]">
                                <span className="rounded-full flex-shrink-0" style={{ width: 7, height: 7, background: status.dotColor }} />
                                <span className="text-[12px] font-medium text-white" style={{ opacity: 0.8 }}>{status.text}</span>
                              </div>

                              <svg className="absolute bottom-[14px] right-[16px]" width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
                                <rect x="1" y="1" width="5" height="5" rx="0.5" stroke="white" strokeWidth="1.2" />
                                <rect x="10" y="1" width="5" height="5" rx="0.5" stroke="white" strokeWidth="1.2" />
                                <rect x="1" y="10" width="5" height="5" rx="0.5" stroke="white" strokeWidth="1.2" />
                                <rect x="3" y="3" width="1.5" height="1.5" fill="white" />
                                <rect x="12" y="3" width="1.5" height="1.5" fill="white" />
                                <rect x="3" y="12" width="1.5" height="1.5" fill="white" />
                                <rect x="10.5" y="10.5" width="2" height="2" stroke="white" strokeWidth="1" />
                                <rect x="13" y="13" width="1.5" height="1.5" fill="white" />
                              </svg>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Pagination dots */}
                    {giftCardClaims.length > 1 && (
                      <div className="flex items-center justify-center gap-[6px]" style={{ marginTop: 10 }}>
                        {giftCardClaims.map((_, idx) => (
                          <div
                            key={idx}
                            className="rounded-full"
                            style={{
                              width: 6,
                              height: 6,
                              background: idx === activePassIdx ? 'var(--terra)' : 'rgba(34,34,34,0.2)',
                              transition: 'background 0.2s',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Streak Warning Banner */}
              {!streakWarningDismissed && userProfile.current_streak > 0 && isStreakWarningPeriod(userProfile.last_reel_month) && (
                <div
                  className="mx-[20px] mt-[14px] flex items-center gap-[10px] rounded-[12px] p-[12px_16px]"
                  style={{ background: 'rgba(196,103,74,0.06)', border: '1px solid rgba(196,103,74,0.15)' }}
                >
                  <FlameIcon active size={16} />
                  <p className="flex-1 text-[13px] text-[var(--near-black)]">
                    Your streak ends in {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} days — claim an offer to keep it
                  </p>
                  <button
                    onClick={() => setView('offers')}
                    className="text-[12px] font-semibold text-[var(--terra)] whitespace-nowrap"
                  >
                    Browse →
                  </button>
                  <button onClick={dismissStreakWarning} className="ml-1 text-[var(--soft)]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Weekly Leaderboard */}
              {leaderboard.length >= 1 && (
                <div className="mx-[20px] mt-[14px] bg-white rounded-[16px] border border-[var(--faint)] p-[16px_18px]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[15px] font-extrabold text-[var(--near-black)]">This week's top creators</h3>
                    <span className="text-[11px] text-[var(--soft)]">
                      Resets in {(() => {
                        const now = new Date();
                        const nextMonday = new Date(now);
                        nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
                        nextMonday.setHours(0, 0, 0, 0);
                        const diff = nextMonday.getTime() - now.getTime();
                        const d = Math.floor(diff / 86400000);
                        const h = Math.floor((diff % 86400000) / 3600000);
                        return `${d}d ${h}h`;
                      })()}
                    </span>
                  </div>
                  {leaderboard.slice(0, 5).map((entry, idx) => {
                    const posColor = idx === 0 ? 'var(--terra)' : idx === 1 ? 'var(--near-black)' : idx === 2 ? 'var(--mid)' : 'var(--soft)';
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 py-[10px] ${idx < Math.min(leaderboard.length, 5) - 1 ? 'border-b border-[var(--faint)]' : ''}`}
                      >
                        <span className="text-[20px] font-extrabold w-6 text-center" style={{ color: posColor }}>{idx + 1}</span>
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: getLevelColour(entry.level) }}>
                            <span className="text-white text-[12px] font-bold">{getInitials(entry.display_name || entry.name)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[14px] font-bold text-[var(--near-black)] truncate">{entry.display_name || entry.name}</span>
                            <LevelBadge level={entry.level} levelName={entry.level_name} size="sm" />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[15px] font-extrabold text-[var(--near-black)]">{entry.reels_this_week}</p>
                          <p className="text-[11px] text-[var(--soft)]">reels</p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Your position if not in top 5 */}
                  {!leaderboard.slice(0, 5).some(e => e.id === userProfile.id) && (() => {
                    const myIdx = leaderboard.findIndex(e => e.id === userProfile.id);
                    const myEntry = myIdx >= 0 ? leaderboard[myIdx] : null;
                    if (myIdx < 0 && (userProfile.total_reels || 0) === 0) return null;
                    return (
                      <div className="pt-2 mt-1 border-t border-[var(--faint)]">
                        <p className="text-[13px] text-[var(--mid)] text-center">
                          You · {myIdx >= 0 ? `${myIdx + 1}${myIdx === 0 ? 'st' : myIdx === 1 ? 'nd' : myIdx === 2 ? 'rd' : 'th'} this week · ${myEntry!.reels_this_week} reels` : '0 reels this week'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Section Header */}
              <div className="flex items-center justify-between px-[20px] mt-[4px] mb-[10px]">
                <h2 className="text-[18px] font-extrabold text-[var(--near-black)] tracking-[-0.3px]">Near you</h2>
              </div>

              {offersLoading ? (
                /* Skeleton loader while offers are loading */
                <div className="px-[20px] space-y-[16px]">
                  {/* Skeleton category pills */}
                  <div className="flex gap-[8px] overflow-hidden">
                    {[80, 60, 90, 70, 85].map((w, i) => (
                      <div key={i} className="h-[32px] rounded-[50px] flex-shrink-0 skeleton-shimmer" style={{ width: w }} />
                    ))}
                  </div>
                  {/* Skeleton offer cards */}
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-[16px] border border-[var(--faint)] overflow-hidden">
                      <div className="h-[140px] skeleton-shimmer" />
                      <div className="p-[16px] space-y-[10px]">
                        <div className="h-[14px] rounded-[6px] skeleton-shimmer" style={{ width: '60%' }} />
                        <div className="h-[12px] rounded-[6px] skeleton-shimmer" style={{ width: '40%' }} />
                        <div className="flex justify-between">
                          <div className="h-[12px] rounded-[6px] skeleton-shimmer" style={{ width: '30%' }} />
                          <div className="h-[28px] w-[80px] rounded-[50px] skeleton-shimmer" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <style>{`
                    .skeleton-shimmer {
                      background: linear-gradient(90deg, var(--bg) 25%, rgba(34,34,34,0.06) 50%, var(--bg) 75%);
                      background-size: 200% 100%;
                      animation: shimmer 1.5s infinite;
                    }
                    @keyframes shimmer {
                      0% { background-position: 200% 0; }
                      100% { background-position: -200% 0; }
                    }
                  `}</style>
                </div>
              ) : offers.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <p className="text-[16px] font-bold text-[var(--near-black)] mb-1">No offers yet</p>
                  <p className="text-[var(--soft)] text-[13px]">New offers from local businesses will appear here. Check back soon!</p>
                </div>
              ) : (() => {
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
                      <Search className="w-8 h-8 text-[var(--soft)] mx-auto mb-3" />
                      <p className="text-[var(--soft)] text-[15px]">No offers found</p>
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
                  const creatorLevel = userProfile.level || 1;
                  const offerMinLevel = offer.min_level || 1;
                  const isLocked = creatorLevel < offerMinLevel;
                  const lockedLevelName = offerMinLevel === 2 ? 'Explorer' : offerMinLevel === 3 ? 'Regular' : offerMinLevel === 4 ? 'Local' : offerMinLevel === 5 ? 'Trusted' : offerMinLevel === 6 ? 'Nayba' : 'Newcomer';

                  // Change 5: Calculate reels away for locked cards
                  const reelsAway = (() => {
                    if (!isLocked) return null;
                    const thresholds = [0, 1, 3, 6, 11, 21];
                    const needed = thresholds[offerMinLevel - 1] || 0;
                    const current = userProfile.total_reels || 0;
                    return Math.max(0, needed - current);
                  })();

                  const offerTitle = offer.generated_title || offer.description.slice(0, 35);
                  const bizName = offer.businesses.name;

                  return (
                    <button
                      key={offer.id}
                      onClick={() => setExpandedOffer(offer.id)}
                      className="text-left rounded-[12px] overflow-hidden relative"
                      style={{ aspectRatio: '3/2', background: getCategoryGradient(offer.businesses.category) }}
                    >
                      {/* Full-bleed image */}
                      {offer.offer_photo_url ? (
                        <img src={offer.offer_photo_url} alt={bizName} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : offer.businesses.logo_url ? (
                        <img src={offer.businesses.logo_url} alt={bizName} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[rgba(255,255,255,0.8)] text-[32px] font-extrabold">{bizName.charAt(0)}</span>
                        </div>
                      )}

                      {/* Locked overlay */}
                      {isLocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(26,26,26,0.45)' }}>
                          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                            <Lock className="w-3.5 h-3.5 text-[var(--near-black)]" />
                          </div>
                          <p className="text-[12px] text-white font-semibold mt-2">Unlocks at {lockedLevelName}</p>
                          {reelsAway !== null && reelsAway <= 5 && (
                            <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              {reelsAway === 1 ? '1 reel away' : `${reelsAway} reels away`}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Slot badge — top-left */}
                      {!isLocked && !isUnlimited && slotsLeft !== null && (
                        <span
                          className="absolute top-[8px] left-[8px] text-[12px] font-semibold rounded-full px-[8px] py-[5px]"
                          style={{
                            background: slotsLeft <= 2 ? 'var(--terra)' : 'var(--peach)',
                            color: slotsLeft <= 2 ? 'white' : 'var(--near-black)',
                          }}
                        >
                          {slotsLeft === 1 ? 'Last slot!' : `${slotsLeft} left`}
                        </span>
                      )}

                      {/* Heart — top-right */}
                      {!isLocked && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSaved(offer.id); }}
                          className="absolute top-[8px] right-[8px] w-[44px] h-[44px] flex items-center justify-center"
                          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
                        >
                          <Heart
                            className={`w-[20px] h-[20px] ${savedOffers.has(offer.id) ? 'text-[var(--terra)] fill-[var(--terra)]' : 'text-white'}`}
                            strokeWidth={2}
                          />
                        </button>
                      )}

                      {/* Text overlay at bottom with gradient scrim */}
                      <div className="absolute bottom-0 left-0 right-0 px-[10px] pb-[8px] pt-[24px]" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }}>
                        <p className="text-[13px] font-bold text-white truncate leading-tight" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                          {offerTitle || bizName}
                        </p>
                        <p className="text-[11px] text-[rgba(255,255,255,0.8)] truncate mt-[1px]" style={{ fontWeight: 400 }}>
                          {bizName}
                        </p>
                      </div>
                    </button>
                  );
                };

                return (
                  <>
                    {/* Near you offer cards grid */}
                    <div className="px-[20px] pb-4">
                      <div className="grid grid-cols-2 gap-[12px]">
                        {filteredOffers.map(renderOfferCard)}
                      </div>
                    </div>

                    {/* Second section */}
                    <div className="flex items-center justify-between px-[20px] mt-2 mb-[14px]">
                      <h2 className="text-[18px] font-extrabold text-[var(--near-black)] tracking-[-0.3px]">New this week</h2>
                    </div>

                    <div className="px-[20px] pb-4">
                      <div className="grid grid-cols-2 gap-[12px]">
                        {filteredOffers.slice().reverse().map(renderOfferCard)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {/* -- SAVED TAB -- */}
          {view === 'saved' && (() => {
            const matchedSaved = offers.filter(o => savedOffers.has(o.id));
            return (
            <div className="px-[20px] pt-5">
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-[26px] font-extrabold text-[var(--near-black)]">Saved</h1>
                <span className="text-[13px] text-[var(--mid)]">{matchedSaved.length} saved</span>
              </div>

              {matchedSaved.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-[40px]">
                  {/* Heart with map pin SVG */}
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <path d="M40 68S14 48 14 32C14 22 22 14 32 14C36 14 39 16 40 18C41 16 44 14 48 14C58 14 66 22 66 32C66 48 40 68 40 68Z" stroke="var(--peach)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <circle cx="40" cy="36" r="6" stroke="var(--peach)" strokeWidth="2" fill="none" />
                    <circle cx="40" cy="36" r="2" fill="var(--peach)" />
                  </svg>
                  <p className="text-[18px] font-extrabold text-[var(--near-black)] mt-[16px]">Nothing saved yet</p>
                  <p className="text-[15px] text-[var(--mid)] text-center mt-[8px] max-w-[260px]" style={{ lineHeight: 1.65 }}>
                    Heart an offer on the explore feed to save it for later.
                  </p>
                  <button
                    onClick={() => setView('offers')}
                    className="mt-[20px] px-[28px] py-[12px] rounded-full text-white text-[14px] font-semibold min-h-[44px]"
                    style={{ background: 'var(--terra)' }}
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
                        className="w-full bg-white rounded-[16px] p-[16px] flex items-center gap-4 text-left shadow-[0_2px_12px_rgba(34,34,34,0.08)] border border-[var(--faint)]"
                      >
                        {/* Business image/gradient */}
                        <div
                          className="w-[56px] h-[56px] rounded-[10px] flex-shrink-0 flex items-center justify-center overflow-hidden"
                          style={{ background: getCategoryGradient(offer.businesses.category) }}
                        >
                          {offer.offer_photo_url ? (
                            <img src={offer.offer_photo_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : offer.businesses.logo_url ? (
                            <img src={offer.businesses.logo_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <span className="text-white text-[20px] font-extrabold">{offer.businesses.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-[var(--near-black)] truncate">{offer.businesses.name}</p>
                          <p className="text-[13px] text-[var(--mid)] truncate">{offer.businesses.category}</p>
                          <p className="text-[13px] font-semibold" style={{ color: !isUnlimited && slotsLeft !== null ? getSlotsBadgeStyle(slotsLeft, offer.monthly_cap as number).color : 'var(--terra)' }}>
                            {isUnlimited ? 'Open availability' : getSlotsBadgeStyle(slotsLeft as number, offer.monthly_cap as number).text}
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
            );
          })()}

          {/* -- ACTIVE PASSES -- */}
          {view === 'active' && (
            <>
              {activeClaims.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <Zap className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[18px] font-bold text-[var(--near-black)] mb-1">No active claims</p>
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
                          className={`whitespace-nowrap text-[12px] font-semibold rounded-[20px] px-[14px] flex-shrink-0 transition-all ${
                            isSelected
                              ? 'bg-[var(--near-black)] text-white'
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
                    {activeClaims.filter(c => c.businesses && c.offers).map(claim => {
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

                      return (
                        <div
                          key={claim.id}
                          className="flex-shrink-0 w-full"
                          style={{ scrollSnapAlign: 'start' }}
                        >
                          <div className="px-4 pt-3">
                            <div className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(34,34,34,0.08)] px-5 pt-4 pb-2">

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

                              {/* QR Code section — tap to go fullscreen */}
                              {claim.status === 'active' && (
                                <button
                                  onClick={() => { setQrOpenSource('active'); setQrScreenTab('pass'); setShowQrFullscreen(true); }}
                                  className="w-full text-left"
                                >
                                  <p className="text-[13px] font-semibold text-[#1A1A1A] text-center mb-[10px]">Tap to show pass</p>
                                  <QRCodeDisplay
                                    token={claim.qr_token}
                                    claimId={claim.id}
                                    creatorCode={userProfile.code}
                                  />
                                  <div className="flex items-center justify-center gap-2 mt-3">
                                    <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="md" />
                                    {userProfile.profile_complete && (
                                      <BadgeCheck className="w-[14px] h-[14px] text-[var(--forest)]" title="Verified creator" />
                                    )}
                                  </div>
                                </button>
                              )}

                              {/* Reel Countdown/Prompt */}
                              {claim.redeemed_at && !claim.reel_url && (
                                <div className={`p-4 rounded-[12px] border ${
                                  isOverdue
                                    ? 'bg-[var(--terra-10)] border-[var(--terra-20)]'
                                    : 'bg-amber-50/60 border-amber-200'
                                }`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Clock className={`w-4 h-4 ${isOverdue ? 'text-[var(--terra)]' : 'text-[var(--soft)]'}`} />
                                    <p className={`text-[14px] font-bold ${isOverdue ? 'text-[var(--terra)]' : 'text-[var(--near-black)]'}`}>
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
                                <div className="p-4 rounded-[12px] bg-white border border-[var(--faint)]">
                                  <label className="block text-[14px] font-semibold text-[var(--near-black)] mb-2">
                                    Submit Your Reel
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="url"
                                      value={reelUrl}
                                      onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
                                      placeholder="https://instagram.com/reel/..."
                                      className="flex-1 px-4 py-[14px] rounded-[12px] bg-[var(--bg)] border border-[var(--faint)] text-[15px] text-[var(--near-black)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)] min-h-[52px]"
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
                                    <p className="text-[13px] text-[var(--terra)] mt-2">{reelError}</p>
                                  )}
                                </div>
                              )}

                              {claim.reel_url && (
                                <div className="flex items-center gap-2 p-3 rounded-[12px] bg-white border border-[var(--faint)]">
                                  <Check className="w-4 h-4 text-[var(--terra)] flex-shrink-0" />
                                  <span className="text-[14px] text-[var(--near-black)] font-medium">Reel submitted!</span>
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
                                <p className="text-[13px] text-[var(--terra)] text-center pb-2">{releaseError}</p>
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
              <h1 className="text-[26px] font-extrabold text-[var(--near-black)] mb-5">Claims</h1>
              {claims.length === 0 ? (
                <div className="text-center py-20">
                  <Zap className="w-12 h-12 text-[var(--soft)] mx-auto mb-4" />
                  <p className="text-[16px] font-semibold text-[var(--near-black)]">No claims yet</p>
                  <p className="text-[14px] text-[var(--mid)] mt-1">Claim an offer to get started</p>
                </div>
              ) : (
                <div className="space-y-[14px]">
                  {claims.filter(c => c.businesses && c.offers).map((claim) => (
                    <button
                      key={claim.id}
                      onClick={() => {
                        if (claim.status === 'active' || (claim.status === 'redeemed' && !claim.reel_url)) {
                          setSelectedClaim(claim);
                          setView('active');
                        }
                      }}
                      className="w-full bg-white rounded-[16px] p-[16px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] text-left"
                    >
                      <div className="flex items-start gap-3">
                        {renderBusinessAvatar(claim.businesses.name, claim.businesses.category, claim.businesses.logo_url, 36)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-[15px] text-[var(--near-black)]">{claim.businesses.name}</h3>
                              <p className="text-[13px] text-[var(--mid)] mt-0.5">{claim.businesses.category}</p>
                              <p className="text-[13px] text-[var(--mid)] mt-0.5 leading-[1.4]" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                wordBreak: 'break-word'
                              }}>{claim.offers.description}</p>
                            </div>
                            <StatusPill status={claim.status} />
                          </div>
                          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[var(--faint)]">
                            <span className="text-[13px] text-[var(--soft)]">
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
              {isPendingApproval && (
                <div className="mb-6 rounded-[16px] p-5 text-center" style={{ background: 'linear-gradient(135deg, rgba(196,103,74,0.08), rgba(200,184,240,0.12))' }}>
                  <Clock className="w-7 h-7 text-[var(--terra)] mx-auto mb-2.5" />
                  <h3 className="text-[17px] font-bold text-[var(--near-black)] mb-1">Account Under Review</h3>
                  <p className="text-[13px] text-[var(--mid)] leading-[1.5]">We're reviewing your profile — you'll get an email once approved. In the meantime, make sure your profile is looking great!</p>
                </div>
              )}
              {profileSubView === 'main' ? (
                <>
                  {/* ═══ Profile card (Airbnb-style) ═══ */}
                  <div className="rounded-[16px] border border-[var(--faint)] p-[24px] mb-[24px]" style={{ boxShadow: '0 2px 12px rgba(34,34,34,0.08)' }}>
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
                          <div className="w-[72px] h-[72px] rounded-full bg-[var(--bg)] flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : avatarUrl ? (
                          <button onClick={() => avatarInputRef.current?.click()}>
                            <img src={avatarUrl} alt="Avatar" className="w-[72px] h-[72px] rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </button>
                        ) : (
                          <button
                            onClick={() => avatarInputRef.current?.click()}
                            className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                            style={{ background: getCategoryGradient(null) }}
                          >
                            <span className="text-white text-[26px] font-extrabold">{getInitials(userProfile.name)}</span>
                          </button>
                        )}
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 w-[24px] h-[24px] rounded-full bg-[var(--terra)] flex items-center justify-center border-2 border-white"
                        >
                          <Camera className="w-[11px] h-[11px] text-white" />
                        </button>
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0 pt-[2px]">
                        <h2 className="text-[22px] font-extrabold text-[var(--near-black)] leading-tight" style={{ letterSpacing: '-0.3px' }}>{userProfile.name}</h2>
                        <div className="flex items-center gap-[6px] mt-[4px] flex-wrap">
                          <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="sm" />
                          {userProfile.profile_complete && (
                            <span className="flex items-center gap-[3px] text-[11px] font-semibold text-[var(--forest)]">
                              <BadgeCheck className="w-[13px] h-[13px]" /> Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-[10px] mt-[6px]">
                          <button onClick={copyCode} className="flex items-center gap-1 text-[12px] font-semibold text-[var(--soft)]">
                            {userProfile.code}
                            {copiedCode ? (
                              <span className="text-[var(--terra)] text-[11px]">Copied!</span>
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          {userProfile.instagram_handle && (
                            <span className="flex items-center gap-1 text-[12px] text-[var(--soft)]">
                              <Instagram className="w-3 h-3" /> {userProfile.instagram_handle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {uploadError && <p className="text-[13px] text-[var(--terra)] mt-2">{uploadError}</p>}

                    {/* Stats row inside card */}
                    <div className="flex items-center mt-[20px] pt-[16px] border-t border-[var(--faint)]">
                      <div className="flex-1 text-center">
                        <p className="text-[22px] font-extrabold text-[var(--near-black)]">{claims.length}</p>
                        <p className="text-[11px] text-[var(--soft)] font-semibold">Claimed</p>
                      </div>
                      <div className="w-[1px] h-[32px] bg-[var(--faint)]" />
                      <div className="flex-1 text-center">
                        <p className="text-[22px] font-extrabold text-[var(--near-black)]">{collabsCompleted}</p>
                        <p className="text-[11px] text-[var(--soft)] font-semibold">Posted</p>
                      </div>
                      <div className="w-[1px] h-[32px] bg-[var(--faint)]" />
                      <div className="flex-1 text-center">
                        <p className="text-[22px] font-extrabold text-[var(--near-black)]">{userProfile.average_rating ? userProfile.average_rating.toFixed(1) : '—'}</p>
                        <p className="text-[11px] text-[var(--soft)] font-semibold">Rating</p>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Profile completeness ═══ */}
                  {(() => {
                    const completeness = getProfileCompleteness(userProfile);
                    if (completeness.score === 100) {
                      return (
                        <div className="flex items-center gap-[10px] rounded-[16px] border border-[var(--faint)] p-[14px_16px] mb-[16px]">
                          <div className="w-[36px] h-[36px] rounded-full bg-[rgba(26,60,52,0.06)] flex items-center justify-center flex-shrink-0">
                            <BadgeCheck className="w-[18px] h-[18px] text-[var(--forest)]" />
                          </div>
                          <div>
                            <p className="text-[14px] font-bold text-[var(--near-black)]">Profile complete</p>
                            <p className="text-[12px] text-[var(--mid)]">Your profile is ready for businesses</p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-[16px] border border-[var(--faint)] p-[16px] mb-[16px]">
                        <div className="flex items-center justify-between mb-[10px]">
                          <span className="text-[14px] font-bold text-[var(--near-black)]">Complete your profile</span>
                          <span className="text-[12px] font-semibold text-[var(--terra)]">{completeness.score}%</span>
                        </div>
                        <div className="h-[4px] rounded-[4px] mb-[12px]" style={{ background: 'var(--bg)' }}>
                          <div className="h-full rounded-[4px] transition-all" style={{ width: `${completeness.score}%`, background: 'var(--terra)' }} />
                        </div>
                        <div className="flex flex-wrap gap-[6px]">
                          {completeness.missing.map(field => (
                            <span key={field.key} className="flex items-center gap-1 px-[10px] py-[6px] rounded-[50px] text-[12px] font-semibold text-[var(--mid)] bg-[var(--bg)]">
                              <Plus className="w-[10px] h-[10px]" /> {field.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ═══ Level + streak section (Airbnb-style) ═══ */}
                  <div className="rounded-[16px] border border-[var(--faint)] bg-white p-[20px] mb-[16px]">
                    {(() => {
                      const progress = getLevelProgress(userProfile.total_reels || 0, userProfile.average_rating || 0, userProfile.level || 1);
                      const levelColours: Record<number, string> = {
                        1: '#9E9E9E',
                        2: '#8FAF8F',
                        3: '#4CAF7D',
                        4: '#1A3C34',
                        5: '#C4674A',
                        6: '#222222',
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
                                        background: isCompleted ? 'var(--forest)' : isCurrent ? '#F5E8E3' : '#FFFFFF',
                                        border: isLocked ? '1.5px solid var(--faint)' : 'none',
                                      }}
                                    >
                                      {isCompleted ? (
                                        /* Checkmark for completed levels — white tick on --forest */
                                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                          <path d="M4.5 9L7.5 12L13.5 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      ) : (
                                        /* Number for current + locked */
                                        <span
                                          style={{
                                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                                            fontWeight: isCurrent ? 700 : 500,
                                            fontSize: 16,
                                            color: isLocked ? 'var(--soft)' : isCurrent ? 'var(--terra)' : 'white',
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
                                          ? 'var(--forest)'
                                          : 'var(--faint)',
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
                                background: currentLvl === 6 ? '#222222' : levelColours[currentLvl],
                                color: 'white',
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                fontWeight: 600,
                                fontSize: 13,
                              }}
                            >
                              {currentLvl === 6 ? '✦ Nayba' : levelNames[currentLvl - 1]}
                            </span>
                            {!progress.isMaxLevel && (
                              <span
                                style={{
                                  color: 'var(--mid)',
                                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                                  fontWeight: 400,
                                  fontSize: 14,
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
                    <div className="mt-[20px] pt-[20px] border-t border-[var(--faint)]">
                      <div className="flex items-center">
                        <div className="flex items-center gap-[8px]">
                          <span
                            style={{
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                              fontWeight: 800,
                              fontSize: 28,
                              color: 'var(--near-black)',
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
                                    color={isCurrentMonthPending ? '#F5C4A0' : '#C4674A'}
                                    size={18}
                                  />
                                );
                              }
                              if (streak > 6) {
                                flames.push(
                                  <span key="more" className="text-[11px] font-semibold ml-[2px]" style={{ color: 'var(--soft)' }}>+{streak - 6}</span>
                                );
                              }
                              return flames;
                            })()}
                          </div>
                        </div>
                        <span
                          className="ml-auto"
                          style={{
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            fontWeight: 400,
                            fontSize: 14,
                            color: 'var(--soft)',
                          }}
                        >
                          {(userProfile.current_streak || 0) > 0 ? 'month streak' : 'No streak yet'}
                        </span>
                      </div>
                      {/* Motivational subline */}
                      <p
                        className="mt-[6px]"
                        style={{
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontWeight: 400,
                          fontSize: 13,
                          color: 'var(--soft)',
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
                      className="w-full flex items-center justify-between py-[16px] border-b border-[var(--faint)] text-left"
                    >
                      <div className="flex items-center gap-[12px]">
                        <User className="w-[20px] h-[20px] text-[var(--mid)]" />
                        <span className="text-[15px] font-semibold text-[var(--near-black)]">Edit profile</span>
                      </div>
                      <ChevronRight className="w-[18px] h-[18px] text-[var(--soft)]" />
                    </button>
                    <button
                      onClick={() => setProfileSubView('alerts')}
                      className="w-full flex items-center justify-between py-[16px] border-b border-[var(--faint)] text-left"
                    >
                      <div className="flex items-center gap-[12px]">
                        <Bell className="w-[20px] h-[20px] text-[var(--mid)]" />
                        <span className="text-[15px] font-semibold text-[var(--near-black)]">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--terra)] text-white text-[11px] font-bold flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-[18px] h-[18px] text-[var(--soft)]" />
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-[12px] py-[16px] text-left"
                    >
                      <LogOut className="w-[20px] h-[20px] text-[var(--terra)]" />
                      <span className="text-[15px] font-semibold text-[var(--terra)]">Sign out</span>
                    </button>
                  </div>
                </>
              ) : profileSubView === 'alerts' ? (
                /* Alerts/Notifications sub-view */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setProfileSubView('main')} className="p-2 -ml-2 hover:bg-[var(--bg)] rounded-[12px] transition-colors">
                      <ChevronLeft className="w-5 h-5 text-[var(--near-black)]" />
                    </button>
                    <h1 className="text-[26px] font-extrabold text-[var(--near-black)]">Notifications</h1>
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
                      <p className="text-[18px] font-extrabold text-[var(--near-black)] mt-[16px]">Nothing yet</p>
                      <p className="text-[15px] text-[var(--mid)] text-center mt-[8px] max-w-[260px]" style={{ lineHeight: 1.65 }}>
                        You'll see a notification when a business confirms your visit or when a new offer drops nearby.
                      </p>
                      <button
                        onClick={() => setView('offers')}
                        className="mt-[20px] px-[28px] py-[12px] rounded-full text-white text-[14px] font-semibold min-h-[44px]"
                        style={{ background: 'var(--terra)' }}
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
                          className={`w-full text-left bg-white rounded-[16px] p-4 border border-[var(--faint)] shadow-[0_2px_12px_rgba(34,34,34,0.08)] transition-all ${
                            notif.read ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-[rgba(34,34,34,0.1)]' : 'bg-[var(--terra)]'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] text-[var(--near-black)]">{notif.message}</p>
                              <p className="text-[13px] text-[var(--soft)] mt-1">
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
                    <button onClick={() => setProfileSubView('main')} className="p-2 -ml-2 hover:bg-[var(--bg)] rounded-[12px] transition-colors">
                      <ChevronLeft className="w-5 h-5 text-[var(--near-black)]" />
                    </button>
                    <h1 className="text-[26px] font-extrabold text-[var(--near-black)]">Edit profile</h1>
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
                          <div className="w-[80px] h-[80px] rounded-full bg-[var(--bg)] flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-[80px] h-[80px] rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div
                            className="w-[80px] h-[80px] rounded-full flex items-center justify-center"
                            style={{ background: getCategoryGradient(null) }}
                          >
                            <span className="text-white text-[28px] font-extrabold">{getInitials(userProfile.name)}</span>
                          </div>
                        )}
                        <div
                          className="absolute -bottom-1 -right-1 w-[28px] h-[28px] rounded-full bg-[var(--terra)] flex items-center justify-center border-2 border-white"
                        >
                          <Camera className="w-[13px] h-[13px] text-white" />
                        </div>
                      </button>
                      <p className="text-[12px] text-[var(--soft)] mt-[8px]">Tap to change photo</p>
                      {uploadError && <p className="text-[12px] text-[var(--terra)] mt-[4px]">{uploadError}</p>}
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-[var(--mid)] mb-[6px]">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-[14px] py-[12px] rounded-[12px] border border-[var(--faint)] text-[15px] text-[var(--near-black)] focus:outline-none focus:border-[var(--terra)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-[var(--mid)] mb-[6px]">Instagram handle</label>
                      <input
                        type="text"
                        value={editHandle}
                        onChange={(e) => setEditHandle(e.target.value)}
                        placeholder="@yourhandle"
                        className="w-full px-[14px] py-[12px] rounded-[12px] border border-[var(--faint)] text-[15px] text-[var(--near-black)] focus:outline-none focus:border-[var(--terra)]"
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
                      className="w-full py-[14px] rounded-[50px] bg-[var(--terra)] text-white text-[15px] font-semibold disabled:opacity-50"
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
      <div className="bg-white flex-shrink-0" style={{ borderTop: '1px solid rgba(34,34,34,0.1)' }}>
        <div className="max-w-md mx-auto flex pt-[10px]" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { if (isPendingApproval && tab.key !== 'profile') return; setView(tab.key); if (tab.key === 'profile') setProfileSubView('main'); }}
              className={`flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold transition-all relative min-h-[44px] ${
                isPendingApproval && tab.key !== 'profile' ? 'text-[rgba(34,34,34,0.15)] pointer-events-none' : view === tab.key ? 'text-[var(--terra)]' : 'text-[var(--soft)]'
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
                      view === tab.key ? 'bg-[var(--terra)] text-white' : 'bg-[rgba(34,34,34,0.1)] text-[var(--mid)]'
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
