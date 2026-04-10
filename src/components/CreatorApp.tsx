import { useState, useEffect } from 'react';
import { useEffectiveAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { sendAdminContentSubmittedEmail } from '../lib/notifications';
import CampaignDetail from './CampaignDetail';
import LevelBadge from './LevelBadge';
import {
  Compass, Megaphone, Users, User, MoreHorizontal,
  Search, Clock, Gift, Film, Check, Lock, LogOut,
  ChevronRight, Settings, History, Link2, HelpCircle,
  AtSign, ExternalLink, X, ArrowLeft,
  Eye, EyeOff, Mail, MapPin, Save, Star, Award,
  AlertCircle, RefreshCw
} from 'lucide-react';
import NaybaLogo from '../assets/logomark.svg';
import { Logo } from './Logo';
import { getCategoryPalette, getFilterChipColor, CategoryIcon } from '../lib/categories';

// ─── Constants ───
const SUPPORT_EMAIL = 'jacob@nayba.app';
// TODO(jacob): Replace with real WhatsApp Community invite link before launch
const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/nayba-suffolk';

// ─── Skeleton Loader ───
function SkeletonCard() {
  return (
    <div className="rounded-[12px] bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
      <div className="skeleton w-full" style={{ height: 170 }} />
      <div className="p-3.5 space-y-2.5">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-3 w-28" />
      </div>
    </div>
  );
}
function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// ─── Types ───
interface CreatorProfile {
  id: string; name: string; display_name: string | null; instagram_handle: string;
  email: string; level: number; level_name: string; avatar_url: string | null;
  address: string | null; completion_rate: number; total_campaigns: number;
  completed_campaigns: number; instagram_connected: boolean; total_reels: number;
  bio: string | null; approved?: boolean;
}
interface Campaign {
  id: string; title: string; headline: string | null; perk_description: string | null;
  perk_value: number | null; target_city: string | null; expression_deadline: string | null;
  status: string; campaign_type: 'brand' | 'community'; campaign_image: string | null;
  about_brand: string | null; min_level: number;
  businesses?: { name: string; category: string; bio: string | null; instagram_handle: string | null; logo_url: string | null };
}
interface Application {
  id: string; campaign_id: string; status: string; applied_at: string;
  campaigns?: Campaign & { businesses?: { name: string } };
}
interface Participation {
  id: string; campaign_id: string; application_id: string; perk_sent: boolean;
  reel_url: string | null; status: string; created_at: string;
  campaigns?: { title: string; headline: string | null; content_deadline: string | null; perk_description?: string | null; perk_value?: number | null; businesses?: { name: string } };
}

type Tab = 'discover' | 'campaigns' | 'naybahood' | 'profile' | 'more';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function daysUntil(d: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

// ─── Nav Items ───
const NAV_ITEMS: { key: Tab; label: string; icon: typeof Compass }[] = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'naybahood', label: 'Naybahood', icon: Users },
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'more', label: 'More', icon: MoreHorizontal },
];

// ─── Brand Info Modal ───
function BrandInfoModal({ brand, onClose }: {
  brand: { name: string; category?: string; bio?: string | null; instagram_handle?: string | null; logo_url?: string | null };
  onClose: () => void;
}) {
  const handle = brand.instagram_handle?.replace('@', '') || '';
  return (
    <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-[12px] max-w-[400px] w-full p-6" style={{ boxShadow: '0 4px 16px rgba(42,32,24,0.12)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--terra-light)] flex items-center justify-center">
                <span className="text-[16px] font-semibold text-[var(--terra)]">{brand.name[0]}</span>
              </div>
            )}
            <h3 className="text-[18px] font-semibold text-[var(--ink)]">{brand.name}</h3>
          </div>
          <button onClick={onClose} className="text-[var(--ink-50)] hover:text-[var(--ink)]"><X size={20} /></button>
        </div>
        {brand.category && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-[999px] text-[14px] md:text-[12px] font-medium bg-[var(--terra-light)] text-[var(--terra)] mb-3">
            {brand.category}
          </span>
        )}
        {brand.bio && <p className="text-[15px] text-[var(--ink)] leading-[1.65] mb-4">{brand.bio}</p>}
        {!brand.bio && <p className="text-[14px] text-[var(--ink-50)] mb-4">No description available yet.</p>}
        {handle && (
          <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[14px] text-[var(--terra)] font-medium hover:underline">
            <AtSign size={14} /> @{handle} <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Discover Tab ───
function DiscoverTab({ profile, onOpenCampaign, onGoToCampaigns, refreshKey }: {
  profile: CreatorProfile; onOpenCampaign: (id: string) => void; onGoToCampaigns: () => void; refreshKey?: number;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Record<string, string>>({});
  const [activeParticipations, setActiveParticipations] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'closing' | 'value'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'applied'>('all');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [brandModal, setBrandModal] = useState<{ name: string; category?: string; bio?: string | null; instagram_handle?: string | null } | null>(null);

  useEffect(() => { fetchDiscover(); }, [refreshKey]);

  const fetchDiscover = async () => {
    setLoading(true);
    setFetchError(false);
    const { data: camps, error: campsErr } = await supabase.from('campaigns').select('*, businesses(name, category, bio, instagram_handle, logo_url)')
      .in('status', ['active', 'live']).order('created_at', { ascending: false });
    if (campsErr) { setFetchError(true); setLoading(false); return; }
    if (camps) setCampaigns((camps as Campaign[]).filter(c => !c.min_level || c.min_level <= profile.level));

    const { data: apps } = await supabase.from('applications').select('campaign_id, status').eq('creator_id', profile.id);
    if (apps) {
      const map: Record<string, string> = {};
      apps.forEach((a: any) => { map[a.campaign_id] = a.status; });
      setApplications(map);
    }

    const { count } = await supabase.from('participations').select('id', { count: 'exact', head: true })
      .eq('creator_id', profile.id).in('status', ['confirmed', 'visited', 'content_submitted']);
    setActiveParticipations(count || 0);
    setLoading(false);
  };

  const categories = ['All', 'Food & Drink', 'Beauty', 'Wellness', 'Experience', 'Retail'];

  // Map display categories to business categories for filtering
  const categoryMap: Record<string, string[]> = {
    'Food & Drink': ['Food & Drink', 'Cafe & Coffee'],
    'Beauty': ['Hair & Beauty'],
    'Wellness': ['Wellness & Spa', 'Health & Fitness'],
    'Experience': ['Arts & Entertainment', 'Education'],
    'Retail': ['Retail', 'Services'],
  };

  const filtered = campaigns.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.businesses?.name?.toLowerCase().includes(q)) return false;
    }
    if (category !== 'All') {
      const allowedCats = categoryMap[category] || [];
      if (!allowedCats.some(cat => c.businesses?.category?.includes(cat))) return false;
    }
    if (statusFilter === 'new' && applications[c.id]) return false;
    if (statusFilter === 'applied' && !applications[c.id]) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'closing') {
      if (!a.expression_deadline) return 1;
      if (!b.expression_deadline) return -1;
      return new Date(a.expression_deadline).getTime() - new Date(b.expression_deadline).getTime();
    }
    if (sortBy === 'value') {
      return (b.perk_value || 0) - (a.perk_value || 0);
    }
    return 0; // newest is already the default order from supabase
  });

  const firstName = (profile.display_name || profile.name || '').split(' ')[0];
  // County — the address field stores county directly (Suffolk, Norfolk, etc.)
  const county = profile.address || 'your area';

  return (
    <div className="px-4 md:px-6 lg:px-8 pb-8 pt-4">
      {/* Welcome + county context */}
      <div className="mb-5">
        <h1 className="nayba-h1 text-[var(--ink)]" style={{ fontSize: 28 }}>Hey {firstName}</h1>
        <p className="text-[14px] text-[var(--ink-60)] mt-1">Campaigns in {county}</p>
      </div>

      {/* Active campaign banner */}
      {activeParticipations > 0 && (
        <button onClick={onGoToCampaigns}
          className="w-full flex items-center justify-between px-4 py-3 rounded-[12px] bg-[rgba(45,122,79,0.08)] border border-[rgba(45,122,79,0.15)] mb-4 min-h-[44px]">
          <span className="text-[14px] font-medium text-[var(--success)]">You're in a campaign — view it</span>
          <ChevronRight size={16} className="text-[var(--success)]" />
        </button>
      )}

      {/* Search + sort row */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-50)]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full pl-10 pr-4 h-[40px] rounded-[10px] border border-[rgba(42,32,24,0.10)] bg-white text-[14px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-50)]" />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="h-[40px] px-3 rounded-[10px] border border-[rgba(42,32,24,0.10)] bg-white text-[14px] text-[var(--ink-60)] focus:outline-none focus:border-[var(--terra)]"
          style={{ fontWeight: 500 }}>
          <option value="newest">Newest</option>
          <option value="closing">Closing soon</option>
          <option value="value">Highest value</option>
        </select>
      </div>

      {/* Status + category filters */}
      <div className="flex items-center gap-4 mb-4">
        {/* Status tabs */}
        <div className="flex gap-0.5 bg-[rgba(42,32,24,0.04)] rounded-[8px] p-0.5">
          {([['all', 'All'], ['new', 'New'], ['applied', 'Applied']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className="px-3 py-1.5 rounded-[6px] text-[14px] md:text-[12px] transition-colors"
              style={{
                fontWeight: statusFilter === key ? 600 : 500,
                background: statusFilter === key ? 'white' : 'transparent',
                color: statusFilter === key ? 'var(--ink)' : 'var(--ink-35)',
                boxShadow: statusFilter === key ? '0 1px 2px rgba(42,32,24,0.06)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[rgba(42,32,24,0.08)]" />

        {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar flex-1">
        {categories.map(c => {
          const isActive = category === c;
          const chipColor = c === 'All' ? null : getFilterChipColor(c);
          return (
            <button key={c} onClick={() => setCategory(c)}
              className={`flex-shrink-0 px-[14px] py-[5px] rounded-[999px] text-[14px] md:text-[12px] transition-colors ${isActive ? 'text-white border border-transparent' : 'bg-white border border-[rgba(42,32,24,0.10)] text-[var(--ink-60)]'}`}
              style={{
                fontWeight: isActive ? 700 : 600,
                background: isActive ? (chipColor?.bg || 'var(--terra)') : undefined,
              }}>
              {c}
            </button>
          );
        })}
      </div>
      </div>

      {/* Campaign grid */}
      {loading && <SkeletonList count={6} />}
      {!loading && fetchError && (
        <div className="py-12 text-center">
          <AlertCircle size={48} className="text-[var(--ink-50)] mx-auto mb-3" />
          <p className="text-[15px] font-medium text-[var(--ink)] mb-1">Couldn't load campaigns</p>
          <p className="text-[14px] text-[var(--ink-50)] mb-4">Check your connection and try again</p>
          <button onClick={fetchDiscover} className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--terra)] text-white text-[14px] min-h-[48px]" style={{ fontWeight: 700 }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}
      {!loading && !fetchError && <>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(c => {
            const appStatus = applications[c.id];
            const catPalette = getCategoryPalette(c.businesses?.category);
            return (
              <button key={c.id} onClick={() => onOpenCampaign(c.id)}
                className={`w-full text-left rounded-[12px] flex flex-col bg-white overflow-hidden transition-all duration-200 hover:shadow-[0_4px_12px_rgba(42,32,24,0.10)] ${appStatus ? 'ring-1 ring-[rgba(42,32,24,0.06)]' : ''}`} style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
                <div className="w-full relative" style={{ height: 180, opacity: appStatus ? 0.75 : 1 }}>
                  {c.campaign_image ? (
                    <img src={c.campaign_image} alt={c.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: catPalette.tint }}>
                      <CategoryIcon category={c.businesses?.category} className="w-10 h-10" style={{ color: catPalette.color, opacity: 0.7 }} />
                    </div>
                  )}
                  {appStatus && (
                    <span className={`absolute top-2.5 left-2.5 inline-flex items-center px-2.5 py-1 md:px-2 md:py-0.5 rounded-[999px] text-[14px] md:text-[12px] font-medium backdrop-blur-sm ${appStatus === 'interested' ? 'bg-[#FAEEDA]/90 text-[#854F0B]' : appStatus === 'selected' || appStatus === 'confirmed' ? 'bg-[#E1F5EE]/90 text-[#0F6E56]' : 'bg-white/80 text-[#5F5E5A]'}`}>
                      {appStatus === 'interested' ? 'Applied' : appStatus === 'selected' ? 'Selected' : appStatus === 'confirmed' ? 'Confirmed' : appStatus}
                    </span>
                  )}
                  {c.campaign_type === 'community' && (
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center px-2.5 py-1 md:px-2 md:py-0.5 rounded-[999px] text-[14px] md:text-[12px] font-medium bg-white/80 backdrop-blur-sm text-[var(--ink-60)]">Community</span>
                  )}
                </div>
                <div className="flex-1 p-3.5 flex flex-col">
                  <span className="text-[14px] md:text-[12px] mb-1 truncate block" style={{ fontWeight: 600, color: catPalette.color }}>{c.businesses?.name}</span>
                  <p className="text-[14px] text-[var(--ink)] leading-[1.35] line-clamp-2" style={{ fontWeight: 600 }}>{c.headline || c.title}</p>
                  {c.expression_deadline && (
                    <p className="text-[14px] md:text-[12px] text-[var(--ink-60)] mt-auto pt-2">Apply by {fmtDate(c.expression_deadline)}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Compass size={48} className="text-[var(--ink-50)] mx-auto mb-3" />
            <p className="text-[15px] font-medium text-[var(--ink)] mb-1">Nothing here yet</p>
            <p className="text-[14px] text-[var(--ink-50)]">New campaigns drop every week — keep an eye out</p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="py-8 text-center">
            <Check size={20} className="text-[var(--ink-50)] mx-auto mb-2" />
            <p className="text-[14px] text-[var(--ink-50)]">You're all caught up — check back soon</p>
          </div>
        )}
      </>}

      {/* Brand info modal */}
      {brandModal && <BrandInfoModal brand={brandModal} onClose={() => setBrandModal(null)} />}
    </div>
  );
}

// ─── Campaigns Tab ───
function CampaignsTab({ profile }: { profile: CreatorProfile }) {
  const [subTab, setSubTab] = useState<'active' | 'past'>('active');
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [pastApps, setPastApps] = useState<Application[]>([]);
  const [showReelModal, setShowReelModal] = useState<string | null>(null);
  const [reelUrl, setReelUrl] = useState('');
  const [reelUrlError, setReelUrlError] = useState('');
  const [submittingReel, setSubmittingReel] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data: parts } = await supabase.from('participations')
      .select('*, campaigns(title, headline, content_deadline, perk_description, perk_value, businesses(name))')
      .eq('creator_id', profile.id).order('created_at', { ascending: false });
    if (parts) setParticipations(parts as Participation[]);

    const { data: apps } = await supabase.from('applications')
      .select('*, campaigns(title, headline, businesses(name))')
      .eq('creator_id', profile.id).in('status', ['declined']).order('applied_at', { ascending: false });
    if (apps) setPastApps(apps as Application[]);
    setLoading(false);
  };

  const handleSubmitReel = async () => {
    if (!showReelModal || !reelUrl) return;
    setSubmittingReel(true);
    setReelUrlError('');
    // Validate Instagram URL
    const isValidReelUrl = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(reel|p)\//.test(reelUrl);
    if (!isValidReelUrl) {
      setReelUrlError('Please enter a valid Instagram Reel or post URL');
      setSubmittingReel(false);
      return;
    }
    const { error: updateErr } = await supabase.from('participations').update({
      reel_url: reelUrl,
      reel_submitted_at: new Date().toISOString(),
      status: 'content_submitted',
    }).eq('id', showReelModal);
    if (updateErr) {
      setReelUrlError('Something went wrong — please try again');
      setSubmittingReel(false);
      return;
    }
    // Notify admin of content submission
    const { data: partData } = await supabase.from('participations')
      .select('campaigns(title, businesses(name))').eq('id', showReelModal).single();
    if (partData) {
      sendAdminContentSubmittedEmail({
        creator_name: profile.display_name || profile.name,
        campaign_title: (partData as any).campaigns?.title || '',
        brand_name: (partData as any).campaigns?.businesses?.name || '',
        reel_url: reelUrl,
      });
    }
    setShowReelModal(null);
    setReelUrl('');
    setReelUrlError('');
    setSubmittingReel(false);
    fetchCampaigns();
  };

  const activeParts = participations.filter(p => p.status !== 'completed');
  const completedParts = participations.filter(p => p.status === 'completed');

  const getTodos = (p: Participation) => {
    const todos = [
      { label: 'Selected by brand', done: true },
      { label: 'Confirm your spot', done: true },
      { label: 'Receive your perk', done: p.perk_sent },
      { label: 'Share your experience', done: !!p.reel_url, action: !p.reel_url && p.perk_sent ? () => setShowReelModal(p.id) : undefined },
      { label: 'Done — nice work!', done: p.status === 'content_submitted' || p.status === 'completed' },
    ];
    return todos;
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 pb-8 pt-4">
      <h1 className="text-[20px] font-semibold text-[var(--ink)] mb-4">Campaigns</h1>
      {/* Sub tabs */}
      <div className="flex gap-1 mb-4 border-b border border-[rgba(42,32,24,0.08)]">
        {(['active', 'past'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors min-h-[44px] ${subTab === t ? 'border-[var(--terra)] text-[var(--terra)]' : 'border-transparent text-[var(--ink-50)]'}`}>
            {t === 'active' ? 'Active' : 'Past'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-12 flex justify-center"><div className="w-8 h-8 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" /></div>
      )}

      {!loading && subTab === 'active' && (
        <div className="space-y-3">
          {activeParts.map(p => {
            const todos = getTodos(p);
            const days = daysUntil(p.campaigns?.content_deadline || null);
            const perkText = p.campaigns?.perk_description?.split('—')[0]?.split(',')[0]?.trim();
            return (
              <div key={p.id} className="bg-white rounded-[12px] p-4">
                <p className="text-[14px] md:text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--ink-60)]">{p.campaigns?.businesses?.name}</p>
                <p className="text-[15px] font-semibold text-[var(--ink)] leading-[1.3] mb-1">{p.campaigns?.headline || p.campaigns?.title}</p>
                {perkText && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[999px] bg-[var(--terra-light)] mb-3">
                    <Gift size={12} className="text-[var(--terra)]" />
                    <span className="text-[14px] md:text-[12px] font-medium text-[var(--terra)]">{perkText}{p.campaigns?.perk_value ? ` — £${p.campaigns.perk_value}` : ''}</span>
                  </div>
                )}
                {!perkText && <div className="mb-3" />}
                {/* Stepper */}
                <div className="flex items-center gap-0 mb-3">
                  {todos.map((t, i) => {
                    const isLast = i === todos.length - 1;
                    const isCurrent = !t.done && (i === 0 || todos[i - 1].done);
                    return (
                      <div key={i} className="flex items-center" style={{ flex: isLast ? '0 0 auto' : '1 1 0' }}>
                        <div className="flex flex-col items-center">
                          <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${t.done ? 'bg-[var(--status-active-text)]' : isCurrent ? 'bg-[var(--terra)]' : 'bg-[rgba(42,32,24,0.12)]'}`} />
                          <span className={`text-[14px] md:text-[12px] font-medium mt-1 text-center whitespace-nowrap ${t.done ? 'text-[var(--status-active-text)]' : isCurrent ? 'text-[var(--terra)]' : 'text-[var(--ink-50)]'}`}>{t.label.length > 12 ? t.label.slice(0, 12) + '…' : t.label}</span>
                        </div>
                        {!isLast && <div className={`flex-1 h-[1px] mx-1 mt-[-14px] ${todos[i + 1]?.done || (isCurrent && t.done) ? 'bg-[var(--status-active-text)]' : 'bg-[rgba(42,32,24,0.10)]'}`} />}
                      </div>
                    );
                  })}
                </div>
                {todos.find(t => t.action) && (
                  <button onClick={todos.find(t => t.action)!.action}
                    className="mb-3 flex items-center gap-1 px-4 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] min-h-[48px]" style={{ fontWeight: 700 }}>
                    <Film size={12} /> Share Reel
                  </button>
                )}
                <div className="flex items-center justify-between pt-2 border-t border border-[rgba(42,32,24,0.08)]">
                  <div className="flex gap-3 text-[14px] md:text-[12px] text-[var(--ink-50)]">
                    {days !== null && days > 0 && <span className="flex items-center gap-1"><Clock size={12} /> {days} days to share</span>}
                    {days !== null && days <= 0 && <span className="bg-[#FCEBEB] text-[#A32D2D] px-2.5 py-1 rounded-[999px] text-[14px] md:text-[12px] font-medium">Content overdue</span>}
                  </div>
                  {p.reel_url && (
                    <a href={p.reel_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[14px] text-[var(--terra)] font-medium">
                      <Film size={14} /> View Reel <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {activeParts.length === 0 && (
            <div className="py-12 text-center">
              <Megaphone size={48} className="text-[var(--ink-50)] mx-auto mb-3" />
              <p className="text-[15px] font-medium text-[var(--ink)] mb-1">No active campaigns yet</p>
              <p className="text-[14px] text-[var(--ink-50)]">Browse the Discover tab and tap "I'm Interested" on a campaign you like</p>
            </div>
          )}
        </div>
      )}

      {!loading && subTab === 'past' && (
        <div className="space-y-2">
          {completedParts.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-white rounded-[12px] p-4">
              <div>
                <p className="text-[14px] text-[var(--ink-60)]">{p.campaigns?.businesses?.name}</p>
                <p className="text-[15px] font-medium text-[var(--ink)]">{p.campaigns?.title}</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-[999px] text-[14px] md:text-[12px] font-medium bg-[#E1F5EE] text-[#0F6E56]">Completed</span>
            </div>
          ))}
          {pastApps.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-white rounded-[12px] p-4">
              <div>
                <p className="text-[14px] text-[var(--ink-60)]">{a.campaigns?.businesses?.name}</p>
                <p className="text-[15px] font-medium text-[var(--ink)]">{a.campaigns?.title}</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-[999px] text-[14px] md:text-[12px] font-medium bg-[#F1EFE8] text-[#5F5E5A]">Not selected</span>
            </div>
          ))}
          {completedParts.length === 0 && pastApps.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-[14px] text-[var(--ink-50)]">No past campaigns</p>
            </div>
          )}
        </div>
      )}

      {/* Reel submission modal */}
      {showReelModal && (
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-50 flex items-end sm:items-center justify-center" onClick={() => { setShowReelModal(null); setReelUrl(''); setReelUrlError(''); }}>
          <div className="bg-white w-full max-w-[480px] rounded-t-[12px] sm:rounded-[12px] p-6" style={{ boxShadow: '0 4px 16px rgba(42,32,24,0.12)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="nayba-h3 text-[var(--ink)]">Share your experience</h3>
              <button onClick={() => { setShowReelModal(null); setReelUrl(''); }} className="text-[var(--ink-35)]"><X size={20} /></button>
            </div>
            <p className="text-[14px] text-[var(--ink-60)] mb-4">Paste the link to your Instagram Reel below and we'll take it from there</p>
            <input value={reelUrl} onChange={e => { setReelUrl(e.target.value); setReelUrlError(''); }}
              placeholder="https://www.instagram.com/reel/..."
              className={`w-full px-4 py-3 min-h-[44px] rounded-[10px] border ${reelUrlError ? 'border-[var(--destructive)]' : 'border-[rgba(42,32,24,0.15)]'} bg-white text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-50)] focus:outline-none focus:border-[var(--terra)] mb-1`} />
            {reelUrlError && <p className="text-[14px] text-[var(--destructive)] mb-3">{reelUrlError}</p>}
            {!reelUrlError && <div className="mb-3" />}
            <button onClick={handleSubmitReel} disabled={!reelUrl || submittingReel}
              className="w-full py-3 rounded-[10px] bg-[var(--terra)] text-white text-[14px] disabled:opacity-50 min-h-[48px] hover:opacity-[0.90]" style={{ fontWeight: 700 }}>
              {submittingReel ? 'Sharing...' : 'Share Reel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Naybahood Tab ───
function NaybahoodTab({ profile, showToast }: { profile: CreatorProfile; showToast: (msg: string) => void }) {
  const unlocked = profile.completed_campaigns >= 1;
  const [showCelebration, setShowCelebration] = useState(() => {
    const key = `nayba_naybahood_celebrated_${profile.id}`;
    return !localStorage.getItem(key);
  });

  const dismissCelebration = () => {
    setShowCelebration(false);
    localStorage.setItem(`nayba_naybahood_celebrated_${profile.id}`, 'true');
  };

  if (!unlocked) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pb-8 pt-4">
        <h1 className="text-[20px] font-semibold text-[var(--ink)] mb-6">The Naybahood</h1>
        <div className="bg-white rounded-[12px] p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--shell)] flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-[rgba(42,32,24,0.08)]">
            <Lock size={28} className="text-[var(--ink-50)]" />
          </div>
          <p className="text-[18px] font-semibold text-[var(--ink)] mb-2">Almost there...</p>
          <p className="text-[14px] text-[var(--ink-60)] leading-[1.65] max-w-sm mx-auto mb-4">
            Complete your first campaign to unlock The Naybahood — our community of active local creators with exclusive events, brand connections, and the creator WhatsApp group.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-[999px] bg-[var(--terra-light)]">
            <Megaphone size={14} className="text-[var(--terra)]" />
            <span className="text-[14px] font-medium text-[var(--terra)]">Browse campaigns to get started</span>
          </div>
        </div>
      </div>
    );
  }

  if (unlocked && showCelebration) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pb-8 pt-4">
        <h1 className="text-[20px] font-semibold text-[var(--ink)] mb-6">The Naybahood</h1>
        {/* Celebration overlay */}
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.50)] z-[60] flex items-center justify-center px-4">
          <div className="bg-white rounded-[12px] max-w-[400px] w-full p-8 text-center relative overflow-hidden">
            {/* Confetti-like decorative dots */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="absolute rounded-full animate-ping" style={{
                  width: `${6 + (i % 4) * 3}px`,
                  height: `${6 + (i % 4) * 3}px`,
                  backgroundColor: ['var(--terra)', 'var(--success)', '#3B82F6', '#F59E0B', '#8B5CF6'][i % 5],
                  opacity: 0.4,
                  left: `${5 + (i * 17) % 90}%`,
                  top: `${5 + (i * 23) % 85}%`,
                  animationDuration: `${1.5 + (i % 3) * 0.5}s`,
                  animationDelay: `${(i % 5) * 0.2}s`,
                }} />
              ))}
            </div>
            <div className="relative z-10">
              <div className="celebrate-bounce w-24 h-24 rounded-[10px] bg-[var(--status-active-text)] flex items-center justify-center mx-auto mb-5">
                <Star size={40} className="text-white" />
              </div>
              <p className="text-[20px] font-semibold text-[var(--ink)] mb-2">You're in!</p>
              <p className="text-[16px] text-[var(--ink-60)] leading-[1.65] max-w-xs mx-auto mb-6">
                Welcome to The Naybahood — our community of active local creators. You've earned your place.
              </p>
              <button onClick={dismissCelebration}
                className="w-full py-3.5 rounded-[6px] bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-[0.85] transition-opacity min-h-[44px]">
                Let's go
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 pb-8 pt-4">
      <h1 className="text-[20px] font-semibold text-[var(--ink)] mb-6">The Naybahood</h1>
      <div className="bg-white rounded-[12px] p-8 text-center">
        <div className="w-20 h-20 rounded-[10px] bg-[var(--status-active-text)] flex items-center justify-center mx-auto mb-4">
          <Star size={32} className="text-white" />
        </div>
        <p className="text-[20px] font-semibold text-[var(--ink)] mb-2">Welcome to The Naybahood</p>
        <p className="text-[14px] text-[var(--ink-60)] leading-[1.65] max-w-sm mx-auto mb-6">
          You're part of the crew. Connect with other local creators, get early access to campaigns, and grow together.
        </p>
        <a href={WHATSAPP_COMMUNITY_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-[6px] bg-[#25D366] text-white font-semibold text-[14px] min-h-[44px] hover:opacity-[0.85]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Join the WhatsApp Community
        </a>
        <p className="text-[14px] text-[var(--ink-50)] mt-3">Connect with other Suffolk creators, share tips, and hear about campaigns first</p>
      </div>
    </div>
  );
}

// ─── Profile Tab ───
function ProfileTab({ profile, showToast }: { profile: CreatorProfile; showToast: (msg: string) => void }) {
  const initial = (profile.display_name || profile.name || '?')[0].toUpperCase();
  const completionPct = profile.completion_rate;
  // SVG ring progress
  const ringR = 38;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (completionPct / 100) * ringC;

  return (
    <div className="px-4 md:px-6 lg:px-8 pb-8 pt-4">
      <h1 className="text-[20px] font-semibold text-[var(--ink)] mb-4">Profile</h1>

      {/* Avatar centered */}
      <div className="flex flex-col items-center mb-4">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.display_name || profile.name} className="w-[60px] h-[60px] rounded-full object-cover mb-2" />
        ) : (
          <div className="w-[64px] h-[64px] rounded-full flex items-center justify-center mb-2" style={{ background: 'var(--terra)' }}>
            <span className="text-[22px] text-white" style={{ fontWeight: 700 }}>{initial}</span>
          </div>
        )}
        <p className="text-[18px] font-semibold text-[var(--ink)]">{profile.display_name || profile.name}</p>
        <a href={`https://instagram.com/${profile.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
          className="text-[14px] text-[var(--ink-50)] hover:underline">@{profile.instagram_handle.replace('@', '')}</a>
        <div className="flex items-center gap-2 mt-2">
          <LevelBadge level={profile.level} levelName={profile.level_name} size="sm" />
          {profile.address && (
            <span className="text-[14px] text-[var(--ink-60)] flex items-center gap-1"><MapPin size={12} />{profile.address}</span>
          )}
        </div>
      </div>

      {/* Completion rate */}
      <div className="bg-white rounded-[12px] p-5 mt-3 mb-3">
        <p className="text-[14px] md:text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-2">Completion Rate</p>
        <div className="flex items-center gap-3">
          <p className="text-[28px] font-semibold text-[var(--ink)]">{profile.completion_rate}%</p>
          <span className="text-[14px] text-[var(--ink-60)]">{profile.completed_campaigns} of {profile.total_campaigns} campaigns completed</span>
        </div>
        {profile.total_campaigns > 0 && (
          <div className="h-1 bg-[rgba(42,32,24,0.08)] rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-[var(--terra)] rounded-full transition-all duration-500" style={{ width: `${profile.completion_rate}%` }} />
          </div>
        )}
        {profile.total_campaigns > 0 && profile.completion_rate < 60 && (
          <p className="text-[14px] md:text-[12px] text-[var(--terra)] mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> Brands can see your completion rate — completing campaigns helps you get selected
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {[
          { label: 'Campaigns', value: profile.total_campaigns, icon: Megaphone, tint: 'rgba(217,95,59,0.08)', color: 'var(--terra)' },
          { label: 'Reels', value: profile.total_reels, icon: Film, tint: 'rgba(140,122,170,0.12)', color: 'var(--violet)' },
          { label: profile.level_name, value: `L${profile.level}`, icon: Star, tint: 'rgba(122,148,120,0.12)', color: 'var(--sage)' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-[12px] p-3" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: s.tint }}>
                <s.icon size={15} style={{ color: s.color }} />
              </div>
              <div className="text-center">
                <p className="text-[18px] font-semibold text-[var(--ink)]">{s.value}</p>
                <p className="text-[14px] md:text-[12px] text-[var(--ink-60)]">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Instagram connection */}
      <div className="bg-white rounded-[12px] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AtSign size={20} className={profile.instagram_connected ? 'text-[var(--success)]' : 'text-[var(--ink-60)]'} />
            <div>
              <p className="text-[15px] font-medium text-[var(--ink)]">Instagram</p>
              <p className="text-[14px] text-[var(--ink-50)]">{profile.instagram_connected ? 'Connected' : 'Manual at pilot — auto-connect coming soon'}</p>
            </div>
          </div>
          {profile.instagram_connected ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[999px] bg-[#E1F5EE] text-[14px] md:text-[12px] font-medium text-[#0F6E56]">
              <Check size={12} /> Connected
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-[999px] bg-[var(--shell)] text-[14px] md:text-[12px] font-medium text-[var(--ink-50)]">
              Coming soon
            </span>
          )}
        </div>
        {!profile.instagram_connected && (
          <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] mt-2 ml-8">Right now your IG handle is linked manually. We're working on auto-connecting via the Instagram API so your stats update automatically.</p>
        )}
      </div>

      {/* Profile completeness indicator */}
      {(() => {
        const completeness = [
          !!profile.display_name,
          !!profile.instagram_handle,
          !!profile.address,
          !!profile.bio,
          profile.total_campaigns > 0,
        ].filter(Boolean).length;
        const completePct = Math.round((completeness / 5) * 100);
        return completePct < 100 ? (
          <div className="bg-white rounded-[12px] p-4 mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[14px] font-medium text-[var(--ink)]">Profile completeness</p>
              <span className="text-[14px] font-semibold text-[var(--terra)]">{completePct}%</span>
            </div>
            <div className="h-1 bg-[rgba(42,32,24,0.08)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--terra)] rounded-full transition-all" style={{ width: `${completePct}%` }} />
            </div>
            <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] mt-1.5">Add your {!profile.address ? 'city' : !profile.bio ? 'bio' : 'details'} to complete your profile</p>
          </div>
        ) : null;
      })()}
    </div>
  );
}

// ─── Campaign History Sub-view ───
function CampaignHistoryView({ profile, onBack }: { profile: CreatorProfile; onBack: () => void }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [appRes, partRes] = await Promise.all([
        supabase.from('applications').select('*, campaigns(title, headline, businesses(name))').eq('creator_id', profile.id).order('applied_at', { ascending: false }),
        supabase.from('participations').select('*, campaigns(title, headline, content_deadline, businesses(name))').eq('creator_id', profile.id).order('created_at', { ascending: false }),
      ]);
      if (appRes.data) setApplications(appRes.data as Application[]);
      if (partRes.data) setParticipations(partRes.data as Participation[]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const partCampaignIds = new Set(participations.map(p => p.campaign_id));

  return (
    <div className="px-4 md:px-6 lg:px-8 pb-8 pt-4">
      <button onClick={onBack} className="flex items-center gap-1 text-[14px] text-[var(--ink-50)] hover:text-[var(--terra)] mb-3">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-[20px] font-semibold text-[var(--ink)] mb-4">Campaign History</h1>

      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-8 h-8 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {/* Participations (confirmed/completed campaigns) */}
          {participations.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-white rounded-[12px] p-4">
              <div>
                <p className="text-[14px] text-[var(--ink-60)]">{p.campaigns?.businesses?.name}</p>
                <p className="text-[15px] font-medium text-[var(--ink)]">{p.campaigns?.headline || p.campaigns?.title}</p>
                <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] mt-1">{fmtDate(p.created_at)}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[999px] text-[14px] md:text-[12px] font-medium ${
                p.status === 'completed' ? 'bg-[#E1F5EE] text-[#0F6E56]' :
                p.status === 'content_submitted' ? 'bg-[#FAEEDA] text-[#854F0B]' :
                p.status === 'overdue' ? 'bg-[#FCEBEB] text-[#A32D2D]' :
                'bg-[#E1F5EE] text-[#0F6E56]'
              }`}>
                {p.status === 'content_submitted' ? 'Submitted' : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
              </span>
            </div>
          ))}
          {/* Applications that didn't become participations */}
          {applications.filter(a => !partCampaignIds.has(a.campaign_id)).map(a => (
            <div key={a.id} className="flex items-center justify-between bg-white rounded-[12px] p-4">
              <div>
                <p className="text-[14px] text-[var(--ink-60)]">{a.campaigns?.businesses?.name}</p>
                <p className="text-[15px] font-medium text-[var(--ink)]">{a.campaigns?.headline || a.campaigns?.title}</p>
                <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] mt-1">{fmtDate(a.applied_at)}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[999px] text-[14px] md:text-[12px] font-medium ${
                a.status === 'interested' ? 'bg-[#FAEEDA] text-[#854F0B]' :
                a.status === 'selected' ? 'bg-[#E1F5EE] text-[#0F6E56]' :
                'bg-[#F1EFE8] text-[#5F5E5A]'
              }`}>
                {a.status === 'interested' ? 'Applied' : a.status.charAt(0).toUpperCase() + a.status.slice(1)}
              </span>
            </div>
          ))}
          {participations.length === 0 && applications.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-[14px] text-[var(--ink-50)]">No campaign history yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Account Settings Sub-view ───
function AccountSettingsView({ profile, onBack, showToast }: { profile: CreatorProfile; onBack: () => void; showToast: (msg: string) => void }) {
  const [displayName, setDisplayName] = useState(profile.display_name || profile.name || '');
  const [instagram, setInstagram] = useState(profile.instagram_handle || '');
  const [city, setCity] = useState(profile.address || '');
  const [saving, setSaving] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from('creators').update({
      display_name: displayName,
      instagram_handle: instagram,
      address: city,
    }).eq('id', profile.id);
    setSaving(false);
    showToast(error ? 'Failed to save — please try again' : 'Profile updated');
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordError(error.message === 'New password should be different from the old password.'
        ? 'New password must be different from your current password' : error.message);
    } else {
      showToast('Password updated');
      setShowPasswordChange(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    }
  };

  return (
    <div className="px-4 md:px-6 lg:px-8 pb-8 pt-4">
      <button onClick={onBack} className="flex items-center gap-1 text-[14px] text-[var(--ink-50)] hover:text-[var(--terra)] mb-3">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-[20px] font-semibold text-[var(--ink)] mb-6">Account Settings</h1>

      {/* Profile fields */}
      <div className="bg-white rounded-[12px] p-5 mb-4">
        <h2 className="nayba-h3 text-[var(--ink)] mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[14px] font-medium text-[var(--ink-60)] mb-1.5">Display name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] min-h-[44px]" />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-[var(--ink-60)] mb-1.5">Instagram handle</label>
            <input value={instagram} onChange={e => setInstagram(e.target.value)}
              className="w-full px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] min-h-[44px]" />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-[var(--ink-60)] mb-1.5">County</label>
            <select value={city} onChange={e => setCity(e.target.value)}
              className="w-full px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] min-h-[44px]">
              <option value="">Select county</option>
              <option value="Suffolk">Suffolk</option>
              <option value="Norfolk">Norfolk</option>
              <option value="Cambridgeshire">Cambridgeshire</option>
              <option value="Essex">Essex</option>
            </select>
          </div>
          <div>
            <label className="block text-[14px] font-medium text-[var(--ink-60)] mb-1.5">Email</label>
            <input value={profile.email} disabled
              className="w-full px-4 py-2.5 rounded-[12px] border border-[rgba(42,32,24,0.15)] bg-[var(--shell)] text-[15px] text-[var(--ink-50)] min-h-[44px]" />
            <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] mt-1">Email can't be changed — contact support if needed</p>
          </div>
        </div>
        <button onClick={handleSaveProfile} disabled={saving}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] disabled:opacity-50 min-h-[48px] hover:opacity-[0.90]" style={{ fontWeight: 700 }}>
          <Save size={15} /> {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      {/* Password */}
      <div className="bg-white rounded-[12px] p-5 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="nayba-h3 text-[var(--ink)]">Password</h2>
          {!showPasswordChange && (
            <button onClick={() => setShowPasswordChange(true)}
              className="text-[14px] text-[var(--terra)] font-medium hover:underline">Change password</button>
          )}
        </div>
        {showPasswordChange && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-[14px] font-medium text-[var(--ink-60)] mb-1.5">New password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-2.5 pr-10 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] min-h-[44px]" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-50)]">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[14px] font-medium text-[var(--ink-60)] mb-1.5">Confirm new password</label>
              <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] min-h-[44px]" />
            </div>
            {passwordError && <p className="text-[14px] text-[var(--destructive)]">{passwordError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowPasswordChange(false); setPasswordError(''); }}
                className="px-4 py-2 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink)] font-medium text-[14px] min-h-[48px]">Cancel</button>
              <button onClick={handleChangePassword} disabled={passwordSaving}
                className="px-4 py-2 rounded-[10px] bg-[var(--terra)] text-white text-[14px] disabled:opacity-50 min-h-[48px] hover:opacity-[0.90]" style={{ fontWeight: 700 }}>
                {passwordSaving ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-[12px] p-5">
        <h2 className="nayba-h3 text-[var(--ink)] mb-2">Need help?</h2>
        <p className="text-[14px] text-[var(--ink-60)] mb-3">If you need to delete your account or have any issues, get in touch.</p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 text-[14px] text-[var(--terra)] font-medium hover:underline">
          <Mail size={15} /> {SUPPORT_EMAIL}
        </a>
      </div>
    </div>
  );
}

// ─── More Tab ───
function MoreTab({ onSignOut, showToast, creatorId, profile }: { onSignOut: () => void; showToast: (msg: string) => void; creatorId?: string; profile: CreatorProfile }) {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [subView, setSubView] = useState<'menu' | 'history' | 'settings'>('menu');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.nayba.app';
  const referralLink = creatorId ? `${baseUrl}?ref=${creatorId}` : baseUrl;

  if (subView === 'history') {
    return <CampaignHistoryView profile={profile} onBack={() => setSubView('menu')} />;
  }

  if (subView === 'settings') {
    return <AccountSettingsView profile={profile} onBack={() => setSubView('menu')} showToast={showToast} />;
  }

  const items = [
    { icon: History, label: 'Campaign history', action: () => setSubView('history') },
    { icon: Settings, label: 'Account settings', action: () => setSubView('settings') },
    { icon: Link2, label: 'Refer a friend', action: () => { navigator.clipboard.writeText(referralLink).catch(() => {}); showToast('Referral link copied — share it with friends!'); } },
    { icon: HelpCircle, label: 'Help', action: () => { window.open(`mailto:${SUPPORT_EMAIL}?subject=nayba%20help`, '_blank'); } },
  ];

  return (
    <div className="px-4 md:px-6 lg:px-8 pb-8 pt-4">
      <h1 className="text-[20px] font-semibold text-[var(--ink)] mb-6">More</h1>
      <div className="bg-white rounded-[12px] overflow-hidden">
        {items.map((item, i) => (
          <button key={i} onClick={item.action}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--shell)] transition-colors border-b border border-[rgba(42,32,24,0.08)] last:border-0 min-h-[44px]">
            <item.icon size={18} className="text-[var(--ink-50)]" />
            <span className="text-[15px] text-[var(--ink)] font-medium">{item.label}</span>
            <ChevronRight size={16} className="text-[var(--ink-50)] ml-auto" />
          </button>
        ))}
      </div>

      <button onClick={() => setShowSignOutConfirm(true)}
        className="w-full mt-4 flex items-center gap-3 px-4 py-3.5 bg-white rounded-[12px] hover:bg-[var(--shell)] min-h-[44px]">
        <LogOut size={18} className="text-[var(--terra)]" />
        <span className="text-[15px] text-[var(--terra)] font-medium">Sign out</span>
      </button>

      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-[12px] p-6 max-w-sm w-full text-center">
            <p className="nayba-h3 text-[var(--ink)] mb-2">Sign out?</p>
            <p className="text-[14px] text-[var(--ink-60)] mb-5">You'll need to sign in again to access your campaigns.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink)] font-medium text-[14px] min-h-[48px]">Cancel</button>
              <button onClick={onSignOut}
                className="flex-1 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] min-h-[48px] hover:opacity-[0.90]" style={{ fontWeight: 700 }}>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── How It Works Overlay ───
function HowItWorksOverlay({ onDismiss }: { onDismiss: () => void }) {
  const steps = [
    { icon: Compass, title: 'Browse campaigns', desc: 'Discover local brands looking for creators like you' },
    { icon: Megaphone, title: "Tap I'm Interested", desc: "This won't commit you — the brand will review and select" },
    { icon: Gift, title: 'Get your perk', desc: 'Receive a free experience, product, or gift card' },
    { icon: Film, title: 'Share your experience', desc: 'Post an Instagram Reel and share the link here' },
  ];

  return (
    <div className="fixed inset-0 bg-[rgba(42,32,24,0.50)] z-[60] flex items-center justify-center px-4">
      <div className="bg-white rounded-[12px] max-w-[400px] w-full p-6 text-center" style={{ boxShadow: '0 4px 16px rgba(42,32,24,0.12)' }}>
        <Logo size={28} variant="wordmark" />
        <h2 className="text-[20px] font-semibold text-[var(--ink)] mt-4 mb-1">How it works</h2>
        <p className="text-[14px] text-[var(--ink-60)] mb-5">Four simple steps — no follower minimums, ever</p>
        <div className="space-y-3 mb-6 text-left">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--terra-light)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <s.icon size={18} className="text-[var(--terra)]" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[var(--ink)]">{s.title}</p>
                <p className="text-[14px] text-[var(--ink-60)] leading-[1.5]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onDismiss}
          className="w-full py-3 rounded-[10px] bg-[var(--terra)] text-white text-[14px] min-h-[48px] hover:opacity-[0.90]" style={{ fontWeight: 700 }}>
          Start exploring
        </button>
      </div>
    </div>
  );
}

// ─── Main CreatorApp ───
export default function CreatorApp() {
  const { user, userProfile, signOut } = useEffectiveAuth();
  const [tab, setTab] = useState<Tab>('discover');
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [viewingCampaign, setViewingCampaign] = useState<string | null>(null);
  const [discoverRefresh, setDiscoverRefresh] = useState(0);
  const closeCampaignDetail = () => { setViewingCampaign(null); setDiscoverRefresh(r => r + 1); };
  const [toast, setToast] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Close campaign detail on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && viewingCampaign) closeCampaignDetail(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [viewingCampaign]);

  // Reactive isMobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user?.email) {
      setProfileError(true);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('creators').select('*').eq('email', user.email).single();
    if (data) {
      setProfile(data as CreatorProfile);
      // Show onboarding overlay for new creators who haven't seen it
      const onboardingKey = `nayba_onboarding_seen_${data.id}`;
      if (!localStorage.getItem(onboardingKey) && data.total_campaigns === 0) {
        setShowOnboarding(true);
      }
    } else if (userProfile) {
      setProfile(userProfile as CreatorProfile);
    } else {
      setProfileError(true);
    }
    setLoading(false);
  };

  const handleNav = (t: Tab) => {
    setTab(t);
    if (t !== 'discover') closeCampaignDetail();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--chalk)]">
        <div className="w-10 h-10 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--chalk)] px-6 text-center">
        <AlertCircle size={48} className="text-[var(--ink-15)] mb-4" />
        <p className="text-[15px] font-medium text-[var(--ink)] mb-2">Something went wrong</p>
        <p className="text-[14px] text-[var(--ink-50)] mb-5 max-w-xs">We couldn't load your profile. Check your connection and try again.</p>
        <button onClick={() => { setProfileError(false); setLoading(true); fetchProfile(); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] min-h-[48px] hover:opacity-[0.90]" style={{ fontWeight: 700 }}>
          <RefreshCw size={14} /> Retry
        </button>
        <button onClick={signOut} className="mt-4 text-[14px] text-[var(--ink-50)]">Sign out</button>
      </div>
    );
  }

  // Approval gate — unapproved creators see a pending screen
  if (!profile.approved) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--chalk)' }}>
        <div style={{ marginBottom: 36 }}>
          <Logo size={28} variant="wordmark" />
        </div>
        <h1 className="nayba-h1" style={{ fontSize: 28, marginBottom: 10, color: 'var(--ink)' }}>You're on the list</h1>
        <p style={{ fontSize: 15, color: 'var(--ink-60)', lineHeight: 1.6, maxWidth: 360, marginBottom: 40 }}>
          We're reviewing your profile and will email you at {profile.email} once you're approved. Usually within 24 hours.
        </p>
        <button onClick={signOut} style={{ fontSize: 14, color: 'var(--ink-50)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    );
  }

  if (viewingCampaign && isMobile) {
    return <CampaignDetail campaignId={viewingCampaign} onBack={() => closeCampaignDetail()} />;
  }

  const initial = (profile.display_name || profile.name || '?')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--chalk)]">
      {/* ─── Sidebar (desktop only) ─── */}
      <aside className="w-[240px] flex-col flex-shrink-0 fixed inset-y-0 left-0 z-50 hidden md:flex" style={{ background: 'var(--stone)', borderRight: '1px solid rgba(42,32,24,0.08)' }}>
        {/* Wordmark */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(42,32,24,0.08)' }}>
          <Logo size={28} variant="wordmark" />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3">
          {NAV_ITEMS.map(item => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] mb-1 transition-colors"
                style={{
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  background: active ? 'var(--terra-10)' : 'transparent',
                  color: active ? 'var(--terra)' : 'var(--ink-60)',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget.style.background = 'rgba(42,32,24,0.04)'); }}
                onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'transparent'); }}
              >
                <item.icon size={18} strokeWidth={active ? 2 : 1.5} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Creator info */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(42,32,24,0.08)' }}>
          <div className="flex items-center gap-3 px-1">
            <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--terra-15)' }}>
              <span className="text-[14px] md:text-[12px] text-[var(--terra)]" style={{ fontWeight: 700 }}>{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-[var(--ink)] truncate">{profile.display_name || profile.name}</p>
              <p className="text-[14px] md:text-[12px] text-[var(--ink-50)] truncate">{profile.instagram_handle}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div className="md:ml-[240px] min-h-screen">
        <div className="p-4 lg:p-5 pb-20 md:pb-5" key={tab}>
          <div className="tab-fade-in">
            {tab === 'discover' && <DiscoverTab profile={profile} onOpenCampaign={setViewingCampaign} onGoToCampaigns={() => setTab('campaigns')} refreshKey={discoverRefresh} />}
            {tab === 'campaigns' && <CampaignsTab profile={profile} />}
            {tab === 'naybahood' && <NaybahoodTab profile={profile} showToast={showToast} />}
            {tab === 'profile' && <ProfileTab profile={profile} showToast={showToast} />}
            {tab === 'more' && <MoreTab onSignOut={signOut} showToast={showToast} creatorId={profile.id} profile={profile} />}
          </div>
        </div>
      </div>

      {/* ─── Campaign detail — centered modal (desktop) ─── */}
      {viewingCampaign && !isMobile && tab === 'discover' && (
        <>
          <div className="hidden md:block fixed inset-0 bg-[rgba(42,32,24,0.25)] z-30" onClick={() => closeCampaignDetail()} />
          <div className="hidden md:flex fixed inset-0 z-40 items-center justify-center pointer-events-none">
            <div className="pointer-events-auto bg-white rounded-[12px] w-full max-w-[680px] max-h-[90vh] overflow-y-auto"
              style={{ margin: '0 24px', scrollbarWidth: 'none', border: '1px solid rgba(42,32,24,0.10)', boxShadow: '0 4px 16px rgba(42,32,24,0.12)' }}>
              <CampaignDetail campaignId={viewingCampaign} onBack={() => closeCampaignDetail()} />
            </div>
          </div>
        </>
      )}

      {/* ─── Mobile bottom tab bar ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{ height: 'var(--nav-height)', background: 'var(--nav-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid rgba(42,32,24,0.08)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex h-full">
          {NAV_ITEMS.map(item => {
            const active = tab === item.key;
            return (
              <button key={item.key} onClick={() => handleNav(item.key)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px]">
                <item.icon size={22} strokeWidth={active ? 2 : 1.5}
                  style={{ color: active ? 'var(--terra)' : 'var(--ink-35)' }} />
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? 'var(--terra)' : 'var(--ink-35)' }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* How It Works onboarding */}
      {showOnboarding && profile && (
        <HowItWorksOverlay onDismiss={() => {
          setShowOnboarding(false);
          localStorage.setItem(`nayba_onboarding_seen_${profile.id}`, 'true');
        }} />
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-enter fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[999px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}
         >
          {toast}
        </div>
      )}
    </div>
  );
}
