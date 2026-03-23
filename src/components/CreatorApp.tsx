import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DoodleIcon } from '../lib/doodle-icons';
import QRCodeDisplay from './QRCodeDisplay';
import CreatorOnboarding from './CreatorOnboarding';
import DisputeModal from './DisputeModal';
import LevelBadge from './LevelBadge';
import { getCategoryGradient, getCategorySolidColor, getCategoryPastelBg, getCategoryPastelIcon, CategoryIcon } from '../lib/categories';
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
    active: 'bg-[#D4470C] text-white',
    claimed: 'bg-[#D4470C] text-white',
    redeemed: 'bg-[#EDE8DC] text-[rgba(44,36,32,0.55)]',
    visited: 'bg-[var(--bg)] text-[var(--near-black)]',
    reel_due: 'bg-[#D4470C] text-white',
    submitted: 'bg-[var(--forest)] text-white',
    expired: 'bg-[rgba(44,36,32,0.06)] text-[var(--soft)] border border-[rgba(44,36,32,0.1)]',
    overdue: 'bg-[var(--peach)] text-[var(--terra)] border border-[rgba(212,71,12,0.15)]',
    completed: 'bg-[#EDE8DC] text-[rgba(44,36,32,0.55)]',
    disputed: 'bg-[rgba(44,36,32,0.06)] text-[var(--soft)]',
  };
  return (
    <span className={`text-[13px] px-2.5 py-1 rounded-[50px] font-semibold ${styles[status] || 'bg-[var(--bg)] text-[var(--near-black)]'}`}>
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
    return { background: 'rgba(44,36,32,0.06)', color: 'rgba(44,36,32,0.4)', text: 'Full' };
  }
  if (slotsLeft === 1) {
    return { background: 'rgba(44,36,32,0.08)', color: 'var(--near-black)', text: 'Last slot' };
  }
  if (slotsLeft <= 2) {
    return { background: 'rgba(44,36,32,0.08)', color: 'var(--near-black)', text: `${slotsLeft} left` };
  }
  return { background: 'rgba(44,36,32,0.06)', color: 'var(--mid)', text: `${slotsLeft} left` };
}

const cardPalette = ['#EDE8DC', '#E8EEE7', '#E4EAED', '#F2E8E0', '#EDE8D0'];
const getCardColor = (index: number) => cardPalette[index % cardPalette.length];

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
  const activeBadgeColor = 'bg-[#D4470C]';

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
    { key: 'offers' as const, label: 'Explore', icon: 'search' as const },
    { key: 'saved' as const, label: 'Saved', icon: 'heart' as const },
    { key: 'active' as const, label: 'Active', icon: 'zap' as const, badge: activeClaims.length || undefined, badgeColor: activeBadgeColor },
    { key: 'claims' as const, label: 'Claims', icon: 'doc' as const },
    { key: 'profile' as const, label: 'Profile', icon: null as any },
  ];

  // Helper to render business avatar
  const renderBusinessAvatar = (name: string, category: string, logoUrl?: string | null, size = 46) => {
    return (
      <div
        className="rounded-[12px] flex items-center justify-center"
        style={{ width: size, height: size, background: '#EDE8DC' }}
      >
        <CategoryIcon category={category} className="w-[20px] h-[20px]" style={{ color: 'rgba(44,36,32,0.5)' }} />
      </div>
    );
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[#F7F6F3]">
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--near-black)] text-white text-[15px] font-semibold px-5 py-2.5 rounded-full shadow-lg">
          {undoToast}
        </div>
      )}

      {redeemToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--near-black)] text-white text-[15px] font-semibold px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2">
          <DoodleIcon name="check" size={16} />
          {redeemToast}
        </div>
      )}

      {/* Level Up Overlay */}
      {showLevelUpOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(44,36,32,0.85)' }}>
          <div className="bg-[#EDE8DC] rounded-[18px] p-[36px_28px] text-center max-w-[320px] mx-4">
            <div className="flex justify-center mb-5">
              <LevelBadge level={showLevelUpOverlay.level} levelName={showLevelUpOverlay.levelName} size="lg" />
            </div>
            <h2 className="text-[26px] font-display text-[var(--near-black)] mb-2" style={{ letterSpacing: '-0.025em' }}>
              You're now a {showLevelUpOverlay.levelName === 'Nayba' ? '✦ Nayba' : showLevelUpOverlay.levelName}
            </h2>
            <p className="text-[18px] text-[var(--mid)] mb-6 leading-[1.5]">
              {showLevelUpOverlay.level === 2 && 'You posted your first reel. You can now access more offers.'}
              {showLevelUpOverlay.level === 3 && 'Businesses are starting to notice you. Keep it up.'}
              {showLevelUpOverlay.level === 4 && "You're a local favourite. Premium offers are unlocking."}
              {showLevelUpOverlay.level === 5 && 'Trusted creator status. The best offers are now available to you.'}
              {showLevelUpOverlay.level === 6 && 'The highest tier. You are a Nayba.'}
            </p>
            <button
              onClick={() => setShowLevelUpOverlay(null)}
              className="w-full py-[14px] rounded-[50px] font-bold text-[18px] bg-[#D4470C] text-white hover:bg-[#B93D0A] transition-all min-h-[48px]"
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
            className="fixed top-0 left-0 right-0 bottom-0 bg-[#F7F6F3]"
            style={{ zIndex: 9999, overflowY: 'auto' }}
          >
            {/* Back button — fixed so it stays visible when scrolling */}
            <button
              onClick={() => { setShowQrFullscreen(false); setReelError(null); setReelUrl(''); }}
              className="fixed top-[12px] left-[12px] flex items-center gap-1 text-[var(--near-black)] text-[17px] font-semibold min-w-[44px] min-h-[44px] px-[8px] bg-[#F7F6F3]"
              style={{ zIndex: 10000, borderRadius: 8 }}
            >
              ← Back
            </button>
            <div className="flex flex-col items-center w-full px-[20px]" style={{ paddingTop: 48, paddingBottom: 40 }}>
              {/* Offer name + business name */}
              <p style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 24, color: '#2C2420', letterSpacing: '-0.025em', textAlign: 'center', margin: 0 }}>{qrOfferTitle}</p>
              <p className="text-[18px] text-[var(--mid)] text-center mt-[4px]">{qrClaim.businesses.name}</p>

              {/* Segmented toggle — only for reel_due */}
              {isReelDue && (
                <div
                  className="relative flex items-center mt-[20px]"
                  style={{ width: 240, height: 42, background: '#EDE8DC', borderRadius: 50, padding: 3 }}
                >
                  {/* Sliding active indicator */}
                  <div
                    className="absolute"
                    style={{
                      width: 'calc(50% - 3px)',
                      height: 36,
                      borderRadius: 50,
                      background: '#2C2420',
                      left: activeTab === 'pass' ? 3 : 'calc(50%)',
                      transition: 'all 0.2s ease',
                    }}
                  />
                  <button
                    onClick={() => setQrScreenTab('pass')}
                    className="relative flex-1 text-center text-[18px] font-semibold"
                    style={{ height: 36, lineHeight: '36px', color: activeTab === 'pass' ? '#FFFFFF' : 'rgba(44,36,32,0.88)', borderRadius: 50 }}
                  >
                    Show pass
                  </button>
                  <button
                    onClick={() => setQrScreenTab('reel')}
                    className="relative flex-1 text-center text-[18px] font-semibold"
                    style={{ height: 36, lineHeight: '36px', color: activeTab === 'reel' ? '#FFFFFF' : 'rgba(44,36,32,0.88)', borderRadius: 50 }}
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
                    size={240}
                    hideExtras
                  />
                  {/* Ref code pill — single instance */}
                  <span
                    className="font-mono text-[17px] font-extrabold tracking-[1.5px] text-[#2C2420] inline-block rounded-full mt-[20px]"
                    style={{ background: '#EDE8DC', padding: '10px 20px' }}
                  >
                    {userProfile.code}
                  </span>
                  {/* Refresh countdown */}
                  <p className="text-[15px] mt-[12px]" style={{ color: 'rgba(44,36,32,0.5)' }}>Auto-refreshes every 30s</p>
                  {/* Level badge */}
                  <div className="mt-[20px]">
                    <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="md" />
                  </div>
                </div>
              )}

              {/* === SUBMIT REEL STATE === */}
              {activeTab === 'reel' && isReelDue && (
                <div className="flex flex-col w-full" style={{ marginTop: 24, minHeight: '75vh' }}>
                  {/* Timer block */}
                  <div style={{ background: 'rgba(245,196,160,0.12)', border: '1.5px solid #F5C4A0', borderRadius: 12, padding: 16 }}>
                    <div className="flex items-center gap-[8px]">
                      <DoodleIcon name="clock" size={16} className="text-[var(--mid)]" />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 18, color: '#2C2420' }}>
                        {reelDueTimeLeft ? `${reelDueTimeLeft} remaining` : 'Post your reel now'}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 16, color: 'rgba(44,36,32,0.68)', marginTop: 8, lineHeight: 1.6 }}>
                      Post your reel within this window — it must clearly feature the business.
                    </p>
                  </div>

                  {/* Reel URL input */}
                  <div style={{ marginTop: 20 }}>
                    <label className="text-[15px] font-semibold text-[var(--near-black)]" style={{ marginBottom: 8, display: 'block' }}>
                      Reel URL
                    </label>
                    <input
                      type="url"
                      value={reelUrl}
                      onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
                      placeholder="https://instagram.com/reel/"
                      className="w-full text-[17px] text-[var(--near-black)] placeholder:text-[#2C2420]/40 focus:outline-none"
                      style={{ background: '#EDE8DC', border: '1.5px solid rgba(44,36,32,0.08)', borderRadius: 50, padding: '14px 16px', fontSize: '16px' }}
                      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--near-black)'; }}
                      onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(44,36,32,0.15)'; }}
                    />
                    {reelError ? (
                      <p className="text-[15px] text-[var(--mid)] mt-[8px]">Please check the URL and try again.</p>
                    ) : (
                      <p className="text-[14px] text-[var(--soft)] mt-[8px]">Paste the link from Instagram after you've posted.</p>
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
                      background: isSubmitEnabled ? '#D4470C' : 'rgba(212,71,12,0.3)',
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
                    ) : 'Submit'}
                  </button>

                  {/* Spacer + report link */}
                  <div style={{ flexGrow: 1 }} />
                  <button
                    onClick={() => setDisputeClaimId(qrClaim.id)}
                    className="w-full text-center text-[14px] text-[var(--soft)] min-h-[44px]"
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
            <h2 className="text-[36px] font-display font-extrabold text-white text-center mt-[24px]" style={{ letterSpacing: '-0.025em' }}>
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
              className="mt-[32px] px-[32px] py-[14px] rounded-full text-white text-[17px] font-bold min-h-[48px]"
              style={{ background: '#D4470C' }}
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
          <div className="fixed inset-0 z-50 bg-[#F7F6F3] flex flex-col">
            {/* Hero */}
            <div className="relative h-[200px] flex items-center justify-center" style={{ background: getCategoryGradient(offer.businesses.category) }}>
              {offer.offer_photo_url ? (
                <img src={offer.offer_photo_url} alt={offer.businesses.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : offer.businesses.logo_url ? (
                <img src={offer.businesses.logo_url} alt={offer.businesses.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-[64px] h-[64px] rounded-[18px] bg-[rgba(255,255,255,0.15)] flex items-center justify-center">
                  <span className="text-[rgba(255,255,255,0.8)] text-[32px] font-extrabold">{offer.businesses.name.charAt(0)}</span>
                </div>
              )}
              <button
                onClick={() => setExpandedOffer(null)}
                className="absolute top-[16px] left-[16px] w-[36px] h-[36px] rounded-full bg-[#EDE8DC] flex items-center justify-center shadow-[0_2px_8px_rgba(44,36,32,0.1)]"
              >
                <DoodleIcon name="chevron-left" size={18} className="text-[var(--near-black)]" />
              </button>
              {/* Locked overlay on hero */}
              {detailIsLocked && (
                <div className="absolute inset-0" style={{ background: 'rgba(44,36,32,0.45)' }} />
              )}
              <button
                onClick={() => toggleSaved(offer.id)}
                className="absolute top-[16px] right-[16px] w-[36px] h-[36px] rounded-full bg-[rgba(255,255,255,0.15)] flex items-center justify-center"
              >
                <DoodleIcon name="heart" size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto bg-[#F7F6F3]">
              <div className="p-[20px]">
                {/* A) Business name + category */}
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 16, color: 'rgba(44,36,32,0.68)', margin: 0 }}>{offer.businesses.name}</p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 15, color: 'rgba(44,36,32,0.45)', marginTop: 4 }}>{offer.businesses.category}</p>

                {/* Level requirement banner */}
                {detailIsLocked && (
                  <div className="flex items-start gap-3 rounded-[12px] p-[12px_14px] mt-3" style={{ background: 'rgba(44,36,32,0.04)' }}>
                    <DoodleIcon name="lock" size={14} className="text-[var(--mid)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[15px] font-semibold text-[var(--near-black)]">{detailLockedName} creators only</p>
                      <p className="text-[14px] text-[var(--mid)] mt-0.5">You're Level {detailCreatorLevel} · {detailReelsToUnlock} more reel{detailReelsToUnlock !== 1 ? 's' : ''} to unlock</p>
                    </div>
                  </div>
                )}

                {/* Offer headline */}
                <p style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 32, color: '#2C2420', letterSpacing: '-0.025em', marginTop: 8, marginBottom: 8 }}>
                  {offer.generated_title || (offer.description.length > 50 ? offer.description.slice(0, 50) + '…' : offer.description)}
                </p>

                {/* B) What you get — hidden when identical to offer title */}
                {(() => {
                  const offerHeadline = offer.generated_title || (offer.description.length > 50 ? offer.description.slice(0, 50) + '…' : offer.description);
                  const whatYouGet = offer.generated_title || offer.description;
                  if (offerHeadline === whatYouGet) return null;
                  return (
                    <>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'rgba(44,36,32,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 8 }}>WHAT YOU GET</p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 17, color: '#2C2420', lineHeight: 1.5, marginBottom: 20 }}>
                        {whatYouGet}
                      </p>
                    </>
                  );
                })()}

                {/* C) What to post */}
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'rgba(44,36,32,0.45)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>WHAT TO POST</p>
                <div className="flex items-center gap-2 mb-2">
                  <DoodleIcon name="video" size={20} className="text-[var(--near-black)]" />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 17, color: '#2C2420' }}>One Instagram Reel</span>
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 16, color: 'rgba(44,36,32,0.68)', marginBottom: 12 }}>Post within 48 hours of your visit</p>
                <div className="flex flex-col gap-2.5 mb-5">
                  {[
                    'Post within 48 hours of your visit',
                    'Tag the business in your reel',
                    'Submit your reel link in the app',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <DoodleIcon name="check" size={13} className="text-[var(--mid)] mt-[2px] flex-shrink-0" />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 16, color: 'rgba(44,36,32,0.68)' }}>{item}</span>
                    </div>
                  ))}
                </div>

                {/* D) They'd love if you… (only if specific_ask exists) */}
                {offer.specific_ask && (
                  <div className="mb-5">
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: 'rgba(44,36,32,0.45)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>THEY'D LOVE IF YOU…</p>
                    <div className="rounded-[12px] p-[14px]" style={{ background: 'rgba(44,36,32,0.04)' }}>
                      <p className="text-[18px] text-[rgba(44,36,32,0.75)]" style={{ lineHeight: '1.6' }}>{offer.specific_ask}</p>
                    </div>
                  </div>
                )}

                {/* D) Availability row */}
                <div className="flex items-center justify-between rounded-[12px] bg-[var(--bg)] px-[16px] py-[12px]">
                  <div className="flex items-center gap-2">
                    <DoodleIcon name="users" size={14} className="text-[var(--mid)]" />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 16, color: !isUnlimited && slotsLeft !== null ? getSlotsBadgeStyle(slotsLeft, offer.monthly_cap as number).color : '#2C2420' }}>
                      {isUnlimited ? 'Open availability' : full ? 'Sold out' : getSlotsBadgeStyle(slotsLeft as number, offer.monthly_cap as number).text}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DoodleIcon name="clock" size={14} className="text-[var(--mid)]" />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 16, color: '#2C2420' }}>48hrs to post</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky bottom bar */}
            <div className="border-t border-[var(--faint)] bg-[#EDE8DC] px-[20px] py-[14px]">
              {detailIsLocked ? (
                <div
                  className="w-full py-[14px] rounded-[50px] text-center text-[14px] text-[var(--soft)]"
                  style={{ background: 'var(--bg)' }}
                >
                  Unlocks at {detailLockedName}
                </div>
              ) : (
              <div className="flex items-center justify-between">
                <div>
                  {full && waitlistedOffers[offer.id] ? (
                    <>
                      <p className="text-[18px] font-semibold text-[var(--near-black)]">You're on the waitlist</p>
                      {waitlistedOffers[offer.id].position && (
                        <p className="text-[14px] text-[var(--soft)]">You're #{waitlistedOffers[offer.id].position} on the waitlist</p>
                      )}
                    </>
                  ) : full ? (
                    <p className="text-[18px] text-[var(--mid)]">All slots taken</p>
                  ) : (
                    <>
                      <p className="text-[17px] font-extrabold text-[var(--near-black)]">Free visit</p>
                      <p className="text-[14px] text-[var(--mid)]">Post reel within 48hrs</p>
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
                          className="px-[18px] py-[10px] rounded-full text-[15px] font-semibold border border-[rgba(44,36,32,0.15)] text-[var(--near-black)] min-h-[44px]"
                        >
                          {waitlistLoading === offer.id ? 'Leaving...' : 'Yes, leave'}
                        </button>
                        <button
                          onClick={() => setWaitlistConfirmLeave(null)}
                          className="px-[18px] py-[10px] rounded-full text-[15px] font-semibold text-[var(--mid)] min-h-[44px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setWaitlistConfirmLeave(offer.id)}
                        className="px-[22px] py-[12px] rounded-full text-[18px] font-semibold min-h-[48px] flex items-center gap-1"
                        style={{ border: '1.5px solid var(--near-black)', color: 'var(--near-black)', background: 'rgba(44,36,32,0.03)' }}
                      >
                        On waitlist <DoodleIcon name="check" size={16} />
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => joinWaitlist(offer.id)}
                      disabled={waitlistLoading === offer.id}
                      className="px-[22px] py-[12px] rounded-full text-[18px] font-semibold text-[var(--near-black)] min-h-[48px] disabled:opacity-40"
                      style={{ border: '1.5px solid rgba(44,36,32,0.15)', background: 'transparent' }}
                    >
                      {waitlistLoading === offer.id ? 'Joining...' : 'Join waitlist'}
                    </button>
                  )
                ) : alreadyClaimed ? (
                  <button disabled className="px-[22px] py-[12px] rounded-full text-[18px] font-bold bg-[var(--bg)] text-[var(--soft)] cursor-not-allowed flex items-center gap-1 min-h-[48px]">
                    <DoodleIcon name="check" size={16} /> Claimed
                  </button>
                ) : hasActiveBusiness ? (
                  <button disabled className="px-[22px] py-[12px] rounded-full text-[18px] font-bold bg-[var(--peach)] text-[var(--terra)] border border-[rgba(212,71,12,0.15)] cursor-not-allowed min-h-[48px]">
                    Active
                  </button>
                ) : (
                  <button
                    onClick={() => { handleClaim(offer); setExpandedOffer(null); }}
                    disabled={loading}
                    className="px-[22px] py-[12px] rounded-full text-[18px] font-bold bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] disabled:opacity-40 transition-all min-h-[48px]"
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
                <div className="mx-[20px] mt-3 p-3 rounded-[12px] bg-[rgba(44,36,32,0.05)] border border-[rgba(44,36,32,0.1)] flex items-center justify-between">
                  <p className="text-[15px] text-[var(--near-black)]">{claimError}</p>
                  <button onClick={() => setClaimError(null)} className="text-[var(--soft)] hover:text-[var(--mid)] text-[15px] font-semibold ml-3">Dismiss</button>
                </div>
              )}

              {/* Greeting header + search icon */}
              <div className="px-[20px] pt-[24px] pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 26, color: '#2C2420', letterSpacing: '-0.025em', lineHeight: 1.2, margin: 0 }}>
                      {(() => {
                        const hour = new Date().getHours();
                        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
                        const firstName = (userProfile?.display_name || userProfile?.name || '').split(' ')[0];
                        return `${greeting}, ${firstName}`;
                      })()}
                    </h1>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 13, color: 'rgba(44, 36, 32, 0.5)', margin: 0, marginTop: 4 }}>
                      Your area · {offers.length} offer{offers.length !== 1 ? 's' : ''} near you today
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSearchBar(!showSearchBar)}
                    className="flex items-center justify-center mt-[4px]"
                  >
                    <DoodleIcon name="search" size={22} className="flex-shrink-0" style={{ color: 'rgba(44, 36, 32, 0.5)' }} />
                  </button>
                </div>

                {/* Collapsible search bar */}
                {showSearchBar && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search offers..."
                      autoFocus
                      className="w-full bg-transparent text-[16px] font-medium text-[var(--near-black)] placeholder:text-[#2C2420]/40 focus:outline-none"
                      style={{
                        background: '#EDE8DC',
                        border: '1.5px solid rgba(44, 36, 32, 0.08)',
                        borderRadius: 50,
                        padding: '10px 16px',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Category Tabs */}
              <div className="px-[20px]">
                <div className="flex">
                  {categoryTabs.map(tab => {
                    const isActive = selectedCategory === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedCategory(tab.key)}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all min-h-[44px] rounded-full ${
                          isActive ? 'bg-[var(--peach)] text-[var(--terra)]' : 'text-[var(--soft)]'
                        }`}
                      >
                        <DoodleIcon name={tab.icon} size={20} />
                        <span className="text-[13px] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Your passes — JS-controlled slider */}
              {activeClaims.length > 0 && activeClaims.some(c => c.businesses && c.offers) && (() => {
                const giftCardClaims = activeClaims.filter(c => c.businesses && c.offers);

                const getGiftCardBg = (_category: string): string => {
                  return '#D4470C';
                };

                const getGiftCardStatus = (claim: Claim): { dotColor: string; text: string; timerLabel?: string } => {
                  if (claim.status === 'active') {
                    return { dotColor: 'var(--near-black)', text: 'Show at the door' };
                  }
                  if (claim.redeemed_at && !claim.reel_url) {
                    if (claim.reel_due_at) {
                      const hoursLeft = Math.max(0, Math.floor((new Date(claim.reel_due_at).getTime() - Date.now()) / (1000 * 60 * 60)));
                      return { dotColor: 'var(--near-black)', text: 'Reel due', timerLabel: `${hoursLeft}h left` };
                    }
                    return { dotColor: 'var(--near-black)', text: 'Post your reel' };
                  }
                  return { dotColor: 'var(--near-black)', text: 'Post your reel' };
                };

                return (
                  <div style={{ marginBottom: 8 }}>
                    <div className="flex items-center justify-between px-[20px] mt-[12px] mb-[12px]">
                      <h2 style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 20, color: '#2C2420', letterSpacing: '-0.025em', margin: 0 }}>Your passes</h2>
                      {giftCardClaims.length >= 2 && (
                        <button onClick={() => setView('active')} style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15, color: '#D4470C' }}>
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
                                height: 220,
                                borderRadius: 20,
                                background: '#D4470C',
                              }}
                            >
                              {/* Decorative wavy watermark */}
                              <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 400 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M-20 130 Q 60 90, 120 130 T 260 130 T 400 130 T 540 130" stroke="rgba(255,255,255,0.15)" strokeWidth="40" fill="none" strokeLinecap="round" />
                              </svg>
                              {/* Solid branded card — no photo */}
                              <div className="relative flex flex-col justify-between h-full" style={{ padding: '20px 20px 18px' }}>
                                <div>
                                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: '0 0 8px' }}>
                                    {claim.businesses.name}
                                  </p>
                                  <p style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 26, color: '#FFFFFF', margin: 0, lineHeight: 1.2, letterSpacing: '-0.025em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                                    {offerTitle}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center" style={{ gap: 6 }}>
                                    <span className="rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 50, padding: '5px 14px', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, color: '#FFFFFF', lineHeight: 1 }}>
                                      {status.text}
                                    </span>
                                    {status.timerLabel && (
                                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 13, color: '#FFFFFF', background: 'rgba(255,255,255,0.2)', borderRadius: 50, padding: '4px 12px', lineHeight: 1 }}>
                                        {status.timerLabel}
                                      </span>
                                    )}
                                  </div>
                                  {/* QR icon */}
                                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: 34, height: 34, borderRadius: 50, background: 'rgba(255,255,255,0.18)' }}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Pagination dots — outside the card */}
                    {giftCardClaims.length > 1 && (
                      <div className="flex items-center justify-center gap-[6px]" style={{ marginTop: 10 }}>
                        {giftCardClaims.map((_, idx) => (
                          <div
                            key={idx}
                            className="rounded-full"
                            style={{
                              width: 6,
                              height: 6,
                              background: idx === activePassIdx ? 'var(--near-black)' : 'rgba(44,36,32,0.2)',
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
                  style={{ background: 'rgba(44,36,32,0.04)', border: '1px solid rgba(44,36,32,0.08)' }}
                >
                  <FlameIcon color="var(--terra)" size={16} />
                  <p className="flex-1 text-[15px] text-[var(--near-black)]">
                    Your streak ends in {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} days — claim an offer to keep it
                  </p>
                  <button
                    onClick={() => setView('offers')}
                    className="text-[14px] font-semibold text-[var(--near-black)] whitespace-nowrap"
                  >
                    Browse →
                  </button>
                  <button onClick={dismissStreakWarning} className="ml-1 text-[var(--soft)]">
                    <DoodleIcon name="x" size={14} />
                  </button>
                </div>
              )}

              {/* Weekly Leaderboard */}
              {leaderboard.length >= 1 && (
                <div className="mx-[20px] mt-[14px] bg-[var(--sage)] rounded-[18px] border border-[var(--faint)] p-[16px_18px]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 17, color: '#2C2420', letterSpacing: '-0.025em', margin: 0 }}>This week's top creators</h3>
                    <span className="text-[13px] text-[var(--soft)]">
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
                    const posColor = idx === 0 ? 'var(--near-black)' : idx === 1 ? 'var(--mid)' : idx === 2 ? 'var(--soft)' : 'var(--soft)';
                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 py-[10px] ${idx < Math.min(leaderboard.length, 5) - 1 ? 'border-b border-[var(--faint)]' : ''}`}
                      >
                        <span className="text-[22px] font-display font-extrabold w-6 text-center" style={{ color: posColor }}>{idx + 1}</span>
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: getLevelColour(entry.level) }}>
                            <span className="text-white text-[14px] font-bold">{getInitials(entry.display_name || entry.name)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[18px] font-bold text-[var(--near-black)] truncate">{entry.display_name || entry.name}</span>
                            <LevelBadge level={entry.level} levelName={entry.level_name} size="sm" />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[17px] font-extrabold text-[var(--near-black)]">{entry.reels_this_week}</p>
                          <p className="text-[13px] text-[var(--soft)]">reels</p>
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
                        <p className="text-[15px] text-[var(--mid)] text-center">
                          You · {myIdx >= 0 ? `${myIdx + 1}${myIdx === 0 ? 'st' : myIdx === 1 ? 'nd' : myIdx === 2 ? 'rd' : 'th'} this week · ${myEntry!.reels_this_week} reels` : '0 reels this week'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Section Header */}
              <div className="flex items-center justify-between px-[20px] mt-[28px] mb-[12px]">
                <h2 style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 20, color: '#2C2420', letterSpacing: '-0.025em', margin: 0 }}>Near you</h2>
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
                    <div key={i} className="rounded-[18px] border border-[var(--faint)] overflow-hidden">
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
                      background: linear-gradient(90deg, var(--bg) 25%, rgba(44,36,32,0.06) 50%, var(--bg) 75%);
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
                  <p className="text-[18px] font-bold text-[var(--near-black)] mb-1">No offers yet</p>
                  <p className="text-[var(--soft)] text-[15px]">New offers from local businesses will appear here. Check back soon!</p>
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
                      <DoodleIcon name="search" size={32} className="text-[var(--soft)] mx-auto mb-3" />
                      <p className="text-[var(--soft)] text-[17px]">No offers found</p>
                      <button
                        onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                        className="mt-2 text-[var(--mid)] text-[15px] font-semibold hover:underline"
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

                  const pastelBg = getCategoryPastelBg(offer.businesses.category);
                  const pastelIcon = getCategoryPastelIcon(offer.businesses.category);

                  return (
                    <button
                      key={offer.id}
                      onClick={() => setExpandedOffer(offer.id)}
                      className="text-left rounded-[18px] overflow-hidden flex flex-col justify-between"
                      style={{ width: 160, minHeight: 200, flexShrink: 0, background: pastelBg }}
                    >
                      {/* Top: icon + title */}
                      <div>
                        <div className="relative" style={{ padding: '14px 12px 0' }}>
                          <div className="flex items-center justify-between">
                            <CategoryIcon category={offer.businesses.category} className="w-[18px] h-[18px]" style={{ color: pastelIcon }} />
                            {!isLocked && (() => {
                              const isSaved = savedOffers.has(offer.id);
                              return (
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleSaved(offer.id); }}
                                  className="w-[24px] h-[24px] flex items-center justify-center"
                                  style={isSaved ? { color: '#D4470C' } : { opacity: 0.35 }}
                                >
                                  <DoodleIcon name="heart" size={11} />
                                </button>
                              );
                            })()}
                          </div>

                          {/* Locked overlay */}
                          {isLocked && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <DoodleIcon name="lock" size={12} className="text-[var(--soft)]" />
                              <span className="text-[13px] font-medium text-[var(--soft)]">Unlocks at {lockedLevelName}</span>
                            </div>
                          )}
                        </div>

                        {/* Headline — Corben 18px, max 2 lines with ellipsis */}
                        <div style={{ padding: '8px 12px 6px' }}>
                          <p style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 18, color: '#2C2420', lineHeight: 1.35, letterSpacing: '-0.025em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', margin: 0 }}>
                            {offerTitle || bizName}
                          </p>
                        </div>
                      </div>

                      {/* Footer — pushed to bottom via space-between */}
                      <div style={{ padding: '0 12px 12px' }}>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 450, fontSize: 13, color: 'rgba(44,36,32,0.5)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bizName}
                        </p>
                        {!isLocked && !isUnlimited && slotsLeft !== null && (
                          <span
                            className="text-[12px] font-semibold rounded-full px-[8px] py-[3px]"
                            style={{ background: 'rgba(44,36,32,0.07)', color: 'var(--mid)' }}
                          >
                            {slotsLeft === 0 ? 'Full' : slotsLeft === 1 ? 'Last slot' : `${slotsLeft} left`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                };

                return (
                  <>
                    {/* Near you offer cards — horizontal scroll */}
                    <div className="pb-4 hide-scrollbar" style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                      <div className="flex gap-[12px]" style={{ paddingLeft: 20, paddingRight: 8 }}>
                        {filteredOffers.map(renderOfferCard)}
                      </div>
                    </div>

                    {/* Second section */}
                    <div className="flex items-center justify-between px-[20px] mt-[24px] mb-[12px]">
                      <h2 style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 20, color: '#2C2420', letterSpacing: '-0.025em', margin: 0 }}>New this week</h2>
                    </div>

                    <div className="pb-4 hide-scrollbar" style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                      <div className="flex gap-[12px]" style={{ paddingLeft: 20, paddingRight: 8 }}>
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
                <h1 className="text-[28px] font-display text-[var(--near-black)]" style={{ letterSpacing: '-0.025em' }}>Saved</h1>
                <span className="text-[15px] text-[var(--mid)]">{matchedSaved.length} saved</span>
              </div>

              {matchedSaved.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-[40px]">
                  {/* Heart with map pin SVG */}
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <path d="M40 68S14 48 14 32C14 22 22 14 32 14C36 14 39 16 40 18C41 16 44 14 48 14C58 14 66 22 66 32C66 48 40 68 40 68Z" stroke="var(--peach)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <circle cx="40" cy="36" r="6" stroke="var(--peach)" strokeWidth="2" fill="none" />
                    <circle cx="40" cy="36" r="2" fill="var(--peach)" />
                  </svg>
                  <p className="text-[20px] font-display text-[var(--near-black)] mt-[16px]" style={{ letterSpacing: '-0.025em' }}>Nothing saved yet</p>
                  <p className="text-[17px] text-[var(--mid)] text-center mt-[8px] max-w-[260px]" style={{ lineHeight: 1.65 }}>
                    Heart an offer on the explore feed to save it for later.
                  </p>
                  <button
                    onClick={() => setView('offers')}
                    className="mt-[20px] px-[28px] py-[12px] rounded-full text-white text-[18px] font-semibold min-h-[44px]"
                    style={{ background: '#D4470C' }}
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
                        className="w-full bg-[#EDE8DC] rounded-[18px] p-[16px] flex items-center gap-4 text-left border-[1.5px] border-[rgba(44,36,32,0.08)]"
                      >
                        {/* Category icon square */}
                        <div
                          className="rounded-[12px] flex-shrink-0 flex items-center justify-center"
                          style={{ width: 46, height: 46, background: '#EDE8DC' }}
                        >
                          <CategoryIcon category={offer.businesses.category} className="w-[20px] h-[20px]" style={{ color: 'rgba(44,36,32,0.5)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[17px] font-bold text-[var(--near-black)] truncate" style={{ fontFamily: "'Corben', serif", letterSpacing: '-0.025em' }}>{offer.businesses.name}</p>
                          <p className="text-[15px] text-[var(--mid)] truncate">{offer.businesses.category}</p>
                          <p className="text-[15px] font-semibold" style={{ color: !isUnlimited && slotsLeft !== null ? getSlotsBadgeStyle(slotsLeft, offer.monthly_cap as number).color : 'var(--mid)' }}>
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
                  <DoodleIcon name="zap" size={48} className="text-[var(--soft)] mb-4" />
                  <p className="text-[20px] font-bold text-[var(--near-black)] mb-1">No active claims</p>
                  <p className="text-[18px] text-[var(--mid)] mb-5">Claim an offer to get started</p>
                  <button
                    onClick={() => setView('offers')}
                    className="bg-[#D4470C] text-white text-[18px] font-semibold rounded-[50px] px-[28px] py-[12px] hover:opacity-90 transition-all"
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
                              ? 'bg-[#2C2420] text-[#FFFFFF]'
                              : 'text-[rgba(44,36,32,0.68)]'
                          }`}
                          style={!isSelected ? { background: '#EDE8DC', height: '32px' } : { height: '32px' }}
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

                      return (
                        <div
                          key={claim.id}
                          className="flex-shrink-0 w-full"
                          style={{ scrollSnapAlign: 'start' }}
                        >
                          <div className="px-4 pt-3">
                            <div className="rounded-[18px] border-[1.5px] border-[rgba(44,36,32,0.08)] px-5 pt-4 pb-2" style={{ minHeight: '75vh', background: getCardColor(claimIdx) }}>

                              {/* Offer title — one line */}
                              <p className="truncate mb-[10px]" style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 18, color: '#2C2420' }}>{offerTitle}</p>

                              {/* Breadcrumb stepper — one line */}
                              <div className="flex items-center flex-nowrap mb-4">
                                {stageLabels.map((label, idx) => {
                                  const isDone = idx < stageIndex;
                                  const isCurrent = idx === stageIndex;
                                  const isFuture = idx > stageIndex;
                                  return (
                                    <span key={label} className="flex items-center">
                                      {idx === 0 && (
                                        <span className="inline-block w-[7px] h-[7px] rounded-full bg-[#D4470C] mr-1.5" />
                                      )}
                                      <span className={`text-[15px] ${
                                        isCurrent ? 'font-bold text-[#2C2420]'
                                        : isDone ? 'font-bold text-[#2C2420]'
                                        : 'font-medium'
                                      }`} style={isFuture ? { color: 'rgba(44,36,32,0.3)' } : undefined}>
                                        {label}
                                      </span>
                                      {idx < stageLabels.length - 1 && (
                                        <span className="text-[15px] mx-1" style={{ color: 'rgba(44,36,32,0.25)' }}>→</span>
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
                                  <p className="text-[15px] font-semibold text-center mb-[10px]" style={{ fontFamily: "'DM Sans', sans-serif", color: 'rgba(44,36,32,0.5)' }}>Tap to show pass</p>
                                  <QRCodeDisplay
                                    token={claim.qr_token}
                                    claimId={claim.id}
                                    creatorCode={userProfile.code}
                                  />
                                  <div className="flex items-center justify-center gap-2" style={{ marginTop: 20 }}>
                                    <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="md" />
                                    {userProfile.profile_complete && (
                                      <DoodleIcon name="badge-check" size={14} className="text-[var(--forest)]" />
                                    )}
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
                                    <DoodleIcon name="clock" size={16} />
                                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 18, color: isOverdue ? '#D97706' : '#2C2420', margin: 0 }}>
                                      {isOverdue ? 'Overdue!' : `${timeLeft} remaining`}
                                    </p>
                                  </div>
                                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 16, color: 'rgba(44,36,32,0.68)', margin: 0 }}>
                                    You have 48 hours to post your reel — it must clearly feature the business.
                                  </p>
                                </div>
                              )}

                              {/* Submit reel */}
                              {claim.status === 'redeemed' && !claim.reel_url && (
                                <div className="p-4 rounded-[12px] bg-[#EDE8DC] border border-[var(--faint)]">
                                  <label className="block mb-1" style={{ fontFamily: "'Corben', serif", fontWeight: 400, fontSize: 24, color: '#2C2420', letterSpacing: '-0.025em' }}>
                                    Submit Your Reel
                                  </label>
                                  <p className="text-[15px] text-[var(--soft)] mb-3" style={{ lineHeight: 1.4 }}>
                                    Show the space, tag the business, and post within 48 h.
                                  </p>
                                  <div className="flex gap-2">
                                    <input
                                      type="url"
                                      value={reelUrl}
                                      onChange={(e) => { setReelUrl(e.target.value); setReelError(null); }}
                                      placeholder="https://instagram.com/reel/..."
                                      className="flex-1 px-4 py-[14px] rounded-[50px] bg-[#EDE8DC] border-[1.5px] border-[rgba(44,36,32,0.08)] text-[16px] text-[var(--near-black)] placeholder:text-[#2C2420]/40 focus:outline-none focus:border-[var(--near-black)] min-h-[52px]"
                                    />
                                    <button
                                      onClick={handleSubmitReel}
                                      disabled={loading || !reelUrl}
                                      className="px-5 py-2 rounded-full text-white text-[18px] font-semibold disabled:opacity-40 transition-all min-h-[48px]"
                                      style={{ background: '#D4470C' }}
                                    >
                                      Submit
                                    </button>
                                  </div>
                                  {reelError && (
                                    <p className="text-[15px] text-[var(--mid)] mt-2">{reelError}</p>
                                  )}
                                </div>
                              )}

                              {claim.reel_url && (
                                <div className="flex items-center gap-2 p-3 rounded-[12px] bg-[#EDE8DC] border border-[var(--faint)]">
                                  <DoodleIcon name="check" size={16} className="text-[var(--forest)] flex-shrink-0" />
                                  <span className="text-[18px] text-[var(--near-black)] font-medium">Reel submitted!</span>
                                </div>
                              )}

                              {/* Report / Release links */}
                              <div className="flex items-center justify-center text-[14px]" style={{ marginTop: 16, paddingBottom: 10 }}>
                                {releaseConfirmId === claim.id ? (
                                  <div className="flex items-center gap-3">
                                    <span className="text-[var(--mid)]">Release this slot?</span>
                                    <button
                                      onClick={() => handleReleaseOffer(claim.id)}
                                      disabled={releasingClaim}
                                      className="font-bold text-[var(--near-black)]"
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
                                      style={{ color: 'rgba(44,36,32,0.35)' }}
                                    >
                                      <DoodleIcon name="flag" size={11} /> Report an issue
                                    </button>
                                    {(() => {
                                      const releaseStatus = canReleaseOffer(claim);
                                      if (releaseStatus.allowed) {
                                        return (
                                          <>
                                            <span className="mx-2" style={{ color: 'rgba(44,36,32,0.2)' }}>·</span>
                                            <button
                                              onClick={() => setReleaseConfirmId(claim.id)}
                                              className="flex items-center gap-1 font-medium transition-colors"
                                              style={{ color: 'rgba(44,36,32,0.45)' }}
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
                                <p className="text-[15px] text-[var(--mid)] text-center pb-2">{releaseError}</p>
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
              <h1 className="text-[28px] font-display text-[var(--near-black)] mb-5" style={{ letterSpacing: '-0.025em' }}>Claims</h1>
              {claims.length === 0 ? (
                <div className="text-center py-20">
                  <DoodleIcon name="zap" size={48} className="text-[var(--soft)] mx-auto mb-4" />
                  <p className="text-[18px] font-semibold text-[var(--near-black)]">No claims yet</p>
                  <p className="text-[18px] text-[var(--mid)] mt-1">Claim an offer to get started</p>
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
                      className="w-full rounded-[18px] p-[16px] border border-[rgba(44,36,32,0.08)] text-left"
                      style={{ background: getCardColor(claimCardIdx) }}
                    >
                      <div className="flex items-start gap-3">
                        {renderBusinessAvatar(claim.businesses.name, claim.businesses.category, claim.businesses.logo_url, 36)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-[17px] text-[var(--near-black)]" style={{ fontFamily: "'Corben', serif", letterSpacing: '-0.025em' }}>{claim.businesses.name}</h3>
                              <p className="text-[15px] text-[var(--mid)] mt-0.5">{claim.businesses.category}</p>
                              <p className="text-[15px] text-[var(--mid)] mt-0.5 leading-[1.4]" style={{
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
                            <span className="text-[15px] text-[var(--soft)]">
                              {formatDate(claim.claimed_at)}
                            </span>
                            {claim.reel_url && (
                              <a
                                href={claim.reel_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-[15px] font-semibold text-[var(--mid)] hover:underline"
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

          {/* -- PROFILE -- */}
          {view === 'profile' && (
            <div className="px-[20px] pt-8">
              {isPendingApproval && (
                <div className="mb-6 rounded-[18px] p-5 text-center" style={{ background: 'rgba(44,36,32,0.04)' }}>
                  <DoodleIcon name="clock" size={28} className="text-[var(--mid)] mx-auto mb-2.5" />
                  <h3 className="text-[19px] font-bold text-[var(--near-black)] mb-1">Account Under Review</h3>
                  <p className="text-[15px] text-[var(--mid)] leading-[1.5]">We're reviewing your profile — you'll get an email once approved. In the meantime, make sure your profile is looking great!</p>
                </div>
              )}
              {profileSubView === 'main' ? (
                <>
                  {/* ═══ Profile card (Airbnb-style) ═══ */}
                  <div className="rounded-[18px] border-[1.5px] border-[rgba(44,36,32,0.08)] p-[24px] mb-[24px]">
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
                            <div className="w-6 h-6 border-2 border-[var(--near-black)] border-t-transparent rounded-full animate-spin" />
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
                            <span className="text-white text-[28px] font-extrabold">{getInitials(userProfile.name)}</span>
                          </button>
                        )}
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 w-[24px] h-[24px] rounded-full bg-[#D4470C] flex items-center justify-center border-2 border-[#F7F6F3]"
                        >
                          <DoodleIcon name="camera" size={11} className="text-white" />
                        </button>
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0 pt-[2px]">
                        <h2 className="text-[24px] font-display font-extrabold text-[var(--near-black)] leading-tight" style={{ letterSpacing: '-0.025em' }}>{userProfile.name}</h2>
                        <div className="flex items-center gap-[6px] mt-[4px] flex-wrap">
                          <LevelBadge level={userProfile.level || 1} levelName={userProfile.level_name || 'Newcomer'} size="sm" />
                          {userProfile.profile_complete && (
                            <span className="flex items-center gap-[3px] text-[13px] font-semibold text-[var(--forest)]">
                              <DoodleIcon name="badge-check" size={13} /> Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-[10px] mt-[6px]">
                          <button onClick={copyCode} className="flex items-center gap-1 text-[14px] font-semibold text-[var(--soft)]">
                            {userProfile.code}
                            {copiedCode ? (
                              <span className="text-[var(--near-black)] text-[13px]">Copied!</span>
                            ) : (
                              <DoodleIcon name="copy" size={12} />
                            )}
                          </button>
                          {userProfile.instagram_handle && (
                            <span className="flex items-center gap-1 text-[14px] text-[var(--soft)]">
                              <DoodleIcon name="instagram" size={12} /> {userProfile.instagram_handle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {uploadError && <p className="text-[15px] text-[var(--mid)] mt-2">{uploadError}</p>}

                    {/* Stats row inside card */}
                    <div className="flex items-center mt-[20px] pt-[16px] border-t border-[var(--faint)]">
                      <div className="flex-1 text-center">
                        <p className="text-[24px] font-display font-extrabold text-[var(--near-black)]">{claims.length}</p>
                        <p className="text-[13px] text-[var(--soft)] font-semibold">Claimed</p>
                      </div>
                      <div className="w-[1px] h-[32px] bg-[var(--faint)]" />
                      <div className="flex-1 text-center">
                        <p className="text-[24px] font-display font-extrabold text-[var(--near-black)]">{collabsCompleted}</p>
                        <p className="text-[13px] text-[var(--soft)] font-semibold">Posted</p>
                      </div>
                      <div className="w-[1px] h-[32px] bg-[var(--faint)]" />
                      <div className="flex-1 text-center">
                        <p className="text-[24px] font-display font-extrabold text-[var(--near-black)]">{userProfile.average_rating ? userProfile.average_rating.toFixed(1) : '—'}</p>
                        <p className="text-[13px] text-[var(--soft)] font-semibold">Rating</p>
                      </div>
                    </div>
                  </div>

                  {/* ═══ Profile completeness ═══ */}
                  {(() => {
                    const completeness = getProfileCompleteness(userProfile);
                    if (completeness.score === 100) {
                      return (
                        <div className="flex items-center gap-[10px] rounded-[18px] border border-[var(--faint)] p-[14px_16px] mb-[16px]">
                          <div className="w-[36px] h-[36px] rounded-full bg-[rgba(26,60,52,0.06)] flex items-center justify-center flex-shrink-0">
                            <DoodleIcon name="badge-check" size={18} className="text-[var(--forest)]" />
                          </div>
                          <div>
                            <p className="text-[18px] font-bold text-[var(--near-black)]">Profile complete</p>
                            <p className="text-[14px] text-[var(--mid)]">Your profile is ready for businesses</p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-[18px] p-[16px] mb-[16px]" style={{ border: '1.5px solid rgba(44,36,32,0.08)' }}>
                        <div className="flex items-center justify-between mb-[10px]">
                          <span className="text-[18px] font-bold text-[var(--near-black)]">Complete your profile</span>
                          <span className="text-[14px] font-semibold text-[var(--near-black)]">{completeness.score}%</span>
                        </div>
                        <div className="h-[4px] rounded-[4px] mb-[12px]" style={{ background: '#EDE8DC' }}>
                          <div className="h-full rounded-[4px] transition-all" style={{ width: `${completeness.score}%`, background: '#D4470C' }} />
                        </div>
                        <div className="flex flex-wrap gap-[6px]">
                          {completeness.missing.map(field => (
                            <span key={field.key} className="flex items-center gap-1 px-[10px] py-[6px] rounded-[50px] text-[14px] font-semibold text-[var(--mid)] bg-[var(--bg)]">
                              <DoodleIcon name="plus" size={16} className="w-[10px] h-[10px]" /> {field.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ═══ Level + streak section (Airbnb-style) ═══ */}
                  <div className="rounded-[18px] border border-[var(--faint)] bg-[var(--dusty-blue)] p-[20px] mb-[16px]">
                    {(() => {
                      const progress = getLevelProgress(userProfile.total_reels || 0, userProfile.average_rating || 0, userProfile.level || 1);
                      const levelColours: Record<number, string> = {
                        1: '#9E9E9E',
                        2: '#8FAF8F',
                        3: '#4CAF7D',
                        4: '#1A4A2E',
                        5: '#D4470C',
                        6: '#2C2420',
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
                                          border: '3px solid #D4470C',
                                        }}
                                      />
                                    )}
                                    <div
                                      className="rounded-full flex items-center justify-center"
                                      style={{
                                        width: 40,
                                        height: 40,
                                        background: isCompleted ? 'var(--forest)' : isCurrent ? 'rgba(212,71,12,0.1)' : '#EDE8DC',
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
                                            fontWeight: isCurrent ? 700 : 500,
                                            fontSize: 18,
                                            color: isLocked ? 'var(--soft)' : isCurrent ? '#D4470C' : 'white',
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
                                background: currentLvl === 6 ? '#2C2420' : '#D4470C',
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
                                  color: 'var(--mid)',
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
                    <div className="mt-[20px] pt-[20px] border-t border-[var(--faint)]">
                      <div className="flex items-center">
                        <div className="flex items-center gap-[8px]">
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 32,
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
                                    color={isCurrentMonthPending ? '#F5C4A0' : '#D4470C'}
                                    size={18}
                                  />
                                );
                              }
                              if (streak > 6) {
                                flames.push(
                                  <span key="more" className="text-[13px] font-semibold ml-[2px]" style={{ color: 'var(--soft)' }}>+{streak - 6}</span>
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
                          fontWeight: 400,
                          fontSize: 15,
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
                        <DoodleIcon name="user" size={20} className="text-[var(--mid)]" />
                        <span className="text-[17px] font-semibold text-[var(--near-black)]">Edit profile</span>
                      </div>
                      <DoodleIcon name="chevron-right" size={18} className="text-[var(--soft)]" />
                    </button>
                    <button
                      onClick={() => setProfileSubView('alerts')}
                      className="w-full flex items-center justify-between py-[16px] border-b border-[var(--faint)] text-left"
                    >
                      <div className="flex items-center gap-[12px]">
                        <DoodleIcon name="bell" size={20} className="text-[var(--mid)]" />
                        <span className="text-[17px] font-semibold text-[var(--near-black)]">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#D4470C] text-white text-[13px] font-bold flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <DoodleIcon name="chevron-right" size={18} className="text-[var(--soft)]" />
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-[12px] py-[16px] text-left"
                    >
                      <DoodleIcon name="logout" size={20} className="text-[var(--soft)]" />
                      <span className="text-[17px] font-semibold text-[var(--soft)]">Sign out</span>
                    </button>
                  </div>
                </>
              ) : profileSubView === 'alerts' ? (
                /* Alerts/Notifications sub-view */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setProfileSubView('main')} className="p-2 -ml-2 hover:bg-[var(--bg)] rounded-[12px] transition-colors">
                      <DoodleIcon name="chevron-left" size={20} className="text-[var(--near-black)]" />
                    </button>
                    <h1 className="text-[28px] font-display text-[var(--near-black)]" style={{ letterSpacing: '-0.025em' }}>Notifications</h1>
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
                      <p className="text-[20px] font-display text-[var(--near-black)] mt-[16px]" style={{ letterSpacing: '-0.025em' }}>Nothing yet</p>
                      <p className="text-[17px] text-[var(--mid)] text-center mt-[8px] max-w-[260px]" style={{ lineHeight: 1.65 }}>
                        You'll see a notification when a business confirms your visit or when a new offer drops nearby.
                      </p>
                      <button
                        onClick={() => setView('offers')}
                        className="mt-[20px] px-[28px] py-[12px] rounded-full text-white text-[18px] font-semibold min-h-[44px]"
                        style={{ background: '#D4470C' }}
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
                          className={`w-full text-left rounded-[18px] p-4 border-[1.5px] border-[rgba(44,36,32,0.08)] transition-all ${
                            notif.read ? 'opacity-50' : ''
                          }`}
                          style={{ background: getCardColor(notifIdx) }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-[rgba(44,36,32,0.1)]' : 'bg-[#D4470C]'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[17px] text-[var(--near-black)]">{notif.message}</p>
                              <p className="text-[15px] text-[var(--soft)] mt-1">
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
                      <DoodleIcon name="chevron-left" size={20} className="text-[var(--near-black)]" />
                    </button>
                    <h1 className="text-[28px] font-display text-[var(--near-black)]" style={{ letterSpacing: '-0.025em' }}>Edit profile</h1>
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
                            <div className="w-6 h-6 border-2 border-[var(--near-black)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-[80px] h-[80px] rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div
                            className="w-[80px] h-[80px] rounded-full flex items-center justify-center"
                            style={{ background: getCategoryGradient(null) }}
                          >
                            <span className="text-white text-[32px] font-extrabold">{getInitials(userProfile.name)}</span>
                          </div>
                        )}
                        <div
                          className="absolute -bottom-1 -right-1 w-[28px] h-[28px] rounded-full bg-[#D4470C] flex items-center justify-center border-2 border-[#F7F6F3]"
                        >
                          <DoodleIcon name="camera" size={13} className="text-white" />
                        </div>
                      </button>
                      <p className="text-[14px] text-[var(--soft)] mt-[8px]">Tap to change photo</p>
                      {uploadError && <p className="text-[14px] text-[var(--mid)] mt-[4px]">{uploadError}</p>}
                    </div>
                    <div>
                      <label className="block text-[15px] font-semibold text-[var(--mid)] mb-[6px]">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-[16px] py-[12px] rounded-[50px] bg-[#EDE8DC] border-[1.5px] border-[rgba(44,36,32,0.08)] text-[16px] text-[var(--near-black)] placeholder:text-[#2C2420]/40 focus:outline-none focus:border-[var(--near-black)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[15px] font-semibold text-[var(--mid)] mb-[6px]">Instagram handle</label>
                      <input
                        type="text"
                        value={editHandle}
                        onChange={(e) => setEditHandle(e.target.value)}
                        placeholder="@yourhandle"
                        className="w-full px-[16px] py-[12px] rounded-[50px] bg-[#EDE8DC] border-[1.5px] border-[rgba(44,36,32,0.08)] text-[16px] text-[var(--near-black)] placeholder:text-[#2C2420]/40 focus:outline-none focus:border-[var(--near-black)]"
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
                      className="w-full py-[14px] rounded-[50px] bg-[#D4470C] text-white text-[17px] font-semibold disabled:opacity-50"
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
      <div className="bg-[#F7F6F3] flex-shrink-0" style={{ borderTop: '1px solid rgba(44,36,32,0.08)' }}>
        <div className="max-w-md mx-auto flex pt-[8px]" style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          {tabs.map(tab => {
            const isActive = view === tab.key;
            const isDisabled = isPendingApproval && tab.key !== 'profile';
            return (
            <button
              key={tab.key}
              onClick={() => { if (isDisabled) return; setView(tab.key); if (tab.key === 'profile') setProfileSubView('main'); }}
              className={`flex-1 flex flex-col items-center gap-[2px] text-[12px] font-semibold transition-all relative min-h-[44px] ${
                isDisabled ? 'text-[rgba(44,36,32,0.15)] pointer-events-none' : isActive ? 'text-[var(--terra)]' : 'text-[rgba(44,36,32,0.40)]'
              }`}
            >
              <div className={`relative flex items-center justify-center rounded-full transition-all ${isActive ? 'bg-[var(--peach)]' : ''}`} style={{ width: 36, height: 28 }}>
                {tab.icon ? (
                  <DoodleIcon name={tab.icon} size={20} />
                ) : (
                  avatarUrl ? (
                    <img src={avatarUrl} alt="" className={`w-[22px] h-[22px] rounded-full object-cover ${isActive ? 'ring-2 ring-[var(--terra)]' : ''}`} />
                  ) : (
                    <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[12px] font-bold ${
                      isActive ? 'bg-[var(--terra)] text-white' : 'bg-[rgba(44,36,32,0.08)] text-[var(--mid)]'
                    }`}>
                      {userProfile.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )
                )}
                {tab.badge ? (
                  <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-white text-[11px] font-bold flex items-center justify-center ${
                    tab.badgeColor || 'bg-[var(--terra)]'
                  }`}>
                    {tab.badge}
                  </span>
                ) : null}
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
