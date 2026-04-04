import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import CampaignDetail from './CampaignDetail';
import {
  Compass, Megaphone, Users, User, MoreHorizontal,
  Search, Clock, Gift, Film, Check, Lock, LogOut,
  ChevronRight, Settings, History, Link2, HelpCircle,
  AtSign, ExternalLink, X, Image, Menu
} from 'lucide-react';

// ─── Types ───
interface CreatorProfile {
  id: string; name: string; display_name: string | null; instagram_handle: string;
  email: string; level: number; level_name: string; avatar_url: string | null;
  address: string | null; completion_rate: number; total_campaigns: number;
  completed_campaigns: number; instagram_connected: boolean; total_reels: number;
  bio: string | null;
}
interface Campaign {
  id: string; title: string; headline: string | null; perk_description: string | null;
  perk_value: number | null; target_city: string | null; expression_deadline: string | null;
  status: string; campaign_type: 'brand' | 'community'; campaign_image: string | null;
  businesses?: { name: string };
}
interface Application {
  id: string; campaign_id: string; status: string; applied_at: string;
  campaigns?: Campaign & { businesses?: { name: string } };
}
interface Participation {
  id: string; campaign_id: string; application_id: string; perk_sent: boolean;
  reel_url: string | null; status: string; created_at: string;
  campaigns?: { title: string; headline: string | null; content_deadline: string | null; businesses?: { name: string } };
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

// ─── Discover Tab ───
function DiscoverTab({ profile, onOpenCampaign, onGoToCampaigns }: {
  profile: CreatorProfile; onOpenCampaign: (id: string) => void; onGoToCampaigns: () => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Record<string, string>>({});
  const [activeParticipations, setActiveParticipations] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => { fetchDiscover(); }, []);

  const fetchDiscover = async () => {
    const { data: camps } = await supabase.from('campaigns').select('*, businesses(name)')
      .in('status', ['active', 'live']).order('created_at', { ascending: false });
    if (camps) setCampaigns(camps as Campaign[]);

    const { data: apps } = await supabase.from('applications').select('campaign_id, status').eq('creator_id', profile.id);
    if (apps) {
      const map: Record<string, string> = {};
      apps.forEach((a: any) => { map[a.campaign_id] = a.status; });
      setApplications(map);
    }

    const { count } = await supabase.from('participations').select('id', { count: 'exact', head: true })
      .eq('creator_id', profile.id).in('status', ['confirmed', 'visited', 'content_submitted']);
    setActiveParticipations(count || 0);
  };

  const categories = ['All', 'Food & Drink', 'Beauty', 'Wellness', 'Experience', 'Retail'];

  const filtered = campaigns.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.businesses?.name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-[960px] mx-auto px-4 lg:px-8 pb-8 pt-4">
      {/* Active campaign banner */}
      {activeParticipations > 0 && (
        <button onClick={onGoToCampaigns}
          className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--r-card)] bg-[rgba(45,122,79,0.08)] border border-[rgba(45,122,79,0.15)] mb-4">
          <span className="text-[14px] font-medium text-[var(--success)]">You're in a campaign — view it</span>
          <ChevronRight size={16} className="text-[var(--success)]" />
        </button>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-35)]" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search campaigns..."
          className="w-full pl-9 pr-4 py-2.5 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)]" />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar">
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-[var(--r-pill)] text-[13px] font-medium transition-colors ${category === c ? 'bg-[var(--terra)] text-white' : 'bg-white border border-[var(--ink-10)] text-[var(--ink-60)]'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Campaign cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(c => {
          const appStatus = applications[c.id];
          return (
            <button key={c.id} onClick={() => onOpenCampaign(c.id)}
              className="w-full text-left bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] overflow-hidden hover:shadow-[0_2px_8px_rgba(34,34,34,0.06)] transition-shadow">
              {/* Hero image */}
              {c.campaign_image && (
                <div className="w-full aspect-video bg-[var(--shell)] overflow-hidden">
                  <img src={c.campaign_image} alt={c.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[13px] font-semibold text-[var(--ink-60)]">{c.businesses?.name}</p>
                  {c.campaign_type === 'community' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-sm)] text-[10px] font-semibold bg-[rgba(59,130,246,0.08)] text-[#3B82F6]">Community</span>
                  )}
                </div>
                <p className="text-[16px] font-semibold text-[var(--ink)] mb-2">{c.headline || c.title}</p>
                {/* Perk pill */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-pill)] bg-[var(--terra-light)] mb-2">
                  <Gift size={13} className="text-[var(--terra)]" />
                  <span className="text-[13px] font-medium text-[var(--terra)]">
                    {c.perk_description?.split('—')[0]?.split(',')[0]?.trim().slice(0, 40) || 'Perk included'}
                    {c.perk_value ? ` — worth £${c.perk_value}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[var(--ink-35)]">
                  {c.target_city && <span>{c.target_city}</span>}
                  {c.expression_deadline && <span className="flex items-center gap-1"><Clock size={12} /> Apply by {fmtDate(c.expression_deadline)}</span>}
                </div>
                {/* Applied state */}
                {appStatus && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[var(--r-sm)] text-[12px] font-semibold ${appStatus === 'interested' ? 'bg-[var(--terra-light)] text-[var(--terra)]' : appStatus === 'selected' || appStatus === 'confirmed' ? 'bg-[rgba(45,122,79,0.1)] text-[var(--success)]' : 'bg-[var(--ink-10)] text-[var(--ink-60)]'}`}>
                      {appStatus === 'interested' ? 'Applied' : appStatus === 'selected' ? 'Selected' : appStatus === 'confirmed' ? 'Confirmed' : appStatus}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[16px] font-semibold text-[var(--ink)] mb-1">Nothing here yet</p>
            <p className="text-[14px] text-[var(--ink-35)]">New campaigns drop every week — keep an eye out</p>
          </div>
        )}
      </div>
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
  const [submittingReel, setSubmittingReel] = useState(false);

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    const { data: parts } = await supabase.from('participations')
      .select('*, campaigns(title, headline, content_deadline, businesses(name))')
      .eq('creator_id', profile.id).order('created_at', { ascending: false });
    if (parts) setParticipations(parts as Participation[]);

    const { data: apps } = await supabase.from('applications')
      .select('*, campaigns(title, headline, businesses(name))')
      .eq('creator_id', profile.id).in('status', ['declined']).order('applied_at', { ascending: false });
    if (apps) setPastApps(apps as Application[]);
  };

  const handleSubmitReel = async () => {
    if (!showReelModal || !reelUrl) return;
    setSubmittingReel(true);
    await supabase.from('participations').update({
      reel_url: reelUrl,
      reel_submitted_at: new Date().toISOString(),
      status: 'content_submitted',
    }).eq('id', showReelModal);
    setShowReelModal(null);
    setReelUrl('');
    setSubmittingReel(false);
    fetchCampaigns();
  };

  const activeParts = participations.filter(p => p.status !== 'completed');
  const completedParts = participations.filter(p => p.status === 'completed');

  const getTodos = (p: Participation) => {
    const todos = [
      { label: 'Selected by brand', done: true },
      { label: 'Confirm your spot', done: p.status !== 'confirmed' || p.perk_sent || !!p.reel_url || p.status === 'visited' },
      { label: 'Receive your perk', done: p.perk_sent },
      { label: 'Share your experience', done: !!p.reel_url, action: !p.reel_url && p.perk_sent ? () => setShowReelModal(p.id) : undefined },
      { label: 'Done — nice work!', done: p.status === 'content_submitted' || p.status === 'completed' },
    ];
    return todos;
  };

  return (
    <div className="max-w-[960px] mx-auto px-4 lg:px-8 pb-8 pt-4">
      <h1 className="text-[24px] font-bold text-[var(--ink)] mb-4" style={{ letterSpacing: '-0.4px' }}>Campaigns</h1>
      {/* Sub tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--ink-10)]">
        {(['active', 'past'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            className={`px-4 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition-colors ${subTab === t ? 'border-[var(--terra)] text-[var(--terra)]' : 'border-transparent text-[var(--ink-35)]'}`}>
            {t === 'active' ? 'Active' : 'Past'}
          </button>
        ))}
      </div>

      {subTab === 'active' && (
        <div className="space-y-3">
          {activeParts.map(p => {
            const todos = getTodos(p);
            const days = daysUntil(p.campaigns?.content_deadline || null);
            return (
              <div key={p.id} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4">
                <p className="text-[13px] font-semibold text-[var(--ink-60)]">{p.campaigns?.businesses?.name}</p>
                <p className="text-[16px] font-semibold text-[var(--ink)] mb-3">{p.campaigns?.headline || p.campaigns?.title}</p>
                {/* To-do checklist */}
                <div className="space-y-2 mb-3">
                  {todos.map((t, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${t.done ? 'bg-[var(--terra)]' : 'border-2 border-[var(--ink-10)]'}`}>
                        {t.done && <Check size={12} className="text-white" />}
                      </div>
                      <span className={`text-[14px] ${t.done ? 'text-[var(--ink-35)] line-through' : 'text-[var(--ink)] font-medium'}`}>{t.label}</span>
                      {t.action && (
                        <button onClick={t.action}
                          className="ml-auto flex items-center gap-1 px-3 py-1 rounded-[var(--r-pill)] bg-[var(--terra)] text-white text-[12px] font-semibold">
                          <Film size={12} /> Share Reel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--ink-10)]">
                  <div className="flex gap-3 text-[12px] text-[var(--ink-35)]">
                    {days !== null && days > 0 && <span className="flex items-center gap-1"><Clock size={12} /> {days} days to share</span>}
                    {days !== null && days <= 0 && <span className="text-[var(--terra)]">Content overdue</span>}
                  </div>
                  {p.reel_url && (
                    <a href={p.reel_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[13px] text-[var(--terra)] font-medium">
                      <Film size={14} /> View Reel <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {activeParts.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-[16px] font-semibold text-[var(--ink)] mb-1">No active campaigns yet</p>
              <p className="text-[14px] text-[var(--ink-35)]">Browse the Discover tab and tap "I'm Interested" on a campaign you like</p>
            </div>
          )}
        </div>
      )}

      {subTab === 'past' && (
        <div className="space-y-2">
          {completedParts.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4">
              <div>
                <p className="text-[13px] text-[var(--ink-60)]">{p.campaigns?.businesses?.name}</p>
                <p className="text-[15px] font-medium text-[var(--ink)]">{p.campaigns?.title}</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-[var(--r-sm)] text-[12px] font-semibold bg-[rgba(45,122,79,0.1)] text-[var(--success)]">Completed</span>
            </div>
          ))}
          {pastApps.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4">
              <div>
                <p className="text-[13px] text-[var(--ink-60)]">{a.campaigns?.businesses?.name}</p>
                <p className="text-[15px] font-medium text-[var(--ink)]">{a.campaigns?.title}</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-[var(--r-sm)] text-[12px] font-semibold bg-[var(--ink-10)] text-[var(--ink-60)]">Declined</span>
            </div>
          ))}
          {completedParts.length === 0 && pastApps.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-[14px] text-[var(--ink-35)]">No past campaigns</p>
            </div>
          )}
        </div>
      )}

      {/* Reel submission modal */}
      {showReelModal && (
        <div className="fixed inset-0 bg-[rgba(34,34,34,0.4)] z-50 flex items-end sm:items-center justify-center">
          <div className="bg-[var(--card)] w-full max-w-[480px] rounded-t-[16px] sm:rounded-[var(--r-card)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-[var(--ink)]">Share your experience</h3>
              <button onClick={() => { setShowReelModal(null); setReelUrl(''); }} className="text-[var(--ink-35)]"><X size={20} /></button>
            </div>
            <p className="text-[14px] text-[var(--ink-60)] mb-4">Paste the link to your Instagram Reel below and we'll take it from there</p>
            <input value={reelUrl} onChange={e => setReelUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              className="w-full px-4 py-3 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[15px] focus:outline-none focus:border-[var(--terra)] mb-4" />
            <button onClick={handleSubmitReel} disabled={!reelUrl || submittingReel}
              className="w-full py-3 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] disabled:opacity-50"
              style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
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

  if (!unlocked) {
    return (
      <div className="max-w-[960px] mx-auto px-4 lg:px-8 pb-8 pt-4">
        <h1 className="text-[24px] font-bold text-[var(--ink)] mb-6" style={{ letterSpacing: '-0.4px' }}>The Naybahood</h1>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--ink-10)] flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-[var(--ink-35)]" />
          </div>
          <p className="text-[18px] font-semibold text-[var(--ink)] mb-2">Complete your first campaign to unlock</p>
          <p className="text-[14px] text-[var(--ink-60)] leading-[1.65] max-w-sm mx-auto">
            The Naybahood is our community of active local creators. Complete a campaign to gain access to exclusive events, brand connections, and the creator WhatsApp community.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto px-4 lg:px-8 pb-8 pt-4">
      <h1 className="text-[24px] font-bold text-[var(--ink)] mb-6" style={{ letterSpacing: '-0.4px' }}>The Naybahood</h1>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[rgba(45,122,79,0.1)] flex items-center justify-center mx-auto mb-4">
          <Users size={28} className="text-[var(--success)]" />
        </div>
        <p className="text-[20px] font-bold text-[var(--ink)] mb-2">Welcome to The Naybahood</p>
        <p className="text-[14px] text-[var(--ink-60)] leading-[1.65] max-w-sm mx-auto mb-6">
          You're part of the crew. Connect with other local creators, get early access to campaigns, and grow together.
        </p>
        <a href="https://chat.whatsapp.com/nayba-suffolk" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--r-pill)] bg-[#25D366] text-white font-semibold text-[15px]"
          style={{ boxShadow: '0 4px 16px rgba(37,211,102,0.28)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Join the WhatsApp Community
        </a>
        <p className="text-[13px] text-[var(--ink-35)] mt-3">Connect with other Suffolk creators, share tips, and hear about campaigns first</p>
      </div>
    </div>
  );
}

// ─── Profile Tab ───
function ProfileTab({ profile, showToast }: { profile: CreatorProfile; showToast: (msg: string) => void }) {
  const initial = (profile.display_name || profile.name || '?')[0].toUpperCase();

  return (
    <div className="max-w-[960px] mx-auto px-4 lg:px-8 pb-8 pt-4">
      <h1 className="text-[24px] font-bold text-[var(--ink)] mb-6" style={{ letterSpacing: '-0.4px' }}>Profile</h1>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-[var(--terra)] flex items-center justify-center flex-shrink-0">
          <span className="text-[24px] font-bold text-white">{initial}</span>
        </div>
        <div>
          <p className="text-[20px] font-bold text-[var(--ink)]">{profile.display_name || profile.name}</p>
          <a href={`https://instagram.com/${profile.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
            className="text-[14px] text-[var(--terra)] font-medium hover:underline">{profile.instagram_handle}</a>
        </div>
      </div>

      {/* Completion rate */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5 mb-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-2">Completion Rate</p>
        <div className="flex items-center gap-3">
          <p className="text-[28px] font-bold text-[var(--ink)]">{profile.completion_rate}%</p>
          <span className="text-[14px] text-[var(--ink-60)]">{profile.completed_campaigns} of {profile.total_campaigns} campaigns completed</span>
        </div>
        {profile.total_campaigns > 0 && (
          <div className="h-2 bg-[var(--ink-10)] rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-[var(--terra)] rounded-full" style={{ width: `${profile.completion_rate}%` }} />
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4 text-center">
          <p className="text-[22px] font-bold text-[var(--ink)]">{profile.total_campaigns}</p>
          <p className="text-[12px] text-[var(--ink-35)] font-medium">Campaigns</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4 text-center">
          <p className="text-[22px] font-bold text-[var(--ink)]">{profile.total_reels}</p>
          <p className="text-[12px] text-[var(--ink-35)] font-medium">Reels</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4 text-center">
          <p className="text-[22px] font-bold text-[var(--ink)]">L{profile.level}</p>
          <p className="text-[12px] text-[var(--ink-35)] font-medium">{profile.level_name}</p>
        </div>
      </div>

      {/* Instagram connection */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AtSign size={20} className="text-[var(--ink-60)]" />
            <div>
              <p className="text-[15px] font-medium text-[var(--ink)]">Instagram</p>
              <p className="text-[13px] text-[var(--ink-35)]">{profile.instagram_connected ? 'Connected' : 'Not connected'}</p>
            </div>
          </div>
          {!profile.instagram_connected && (
            <button onClick={() => showToast('Instagram connection coming soon')}
              className="px-3 py-1.5 rounded-[var(--r-pill)] border border-[var(--border)] text-[13px] font-semibold text-[var(--terra)]">
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── More Tab ───
function MoreTab({ onSignOut, showToast, creatorId }: { onSignOut: () => void; showToast: (msg: string) => void; creatorId?: string }) {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const referralLink = creatorId ? `https://app.nayba.app?ref=${creatorId}` : 'https://app.nayba.app';

  const items = [
    { icon: History, label: 'Campaign history', action: () => {} },
    { icon: Settings, label: 'Account settings', action: () => {} },
    { icon: Link2, label: 'Refer a friend', action: () => { navigator.clipboard.writeText(referralLink).catch(() => {}); showToast('Referral link copied — share it with friends!'); } },
    { icon: HelpCircle, label: 'Help', action: () => {} },
  ];

  return (
    <div className="max-w-[960px] mx-auto px-4 lg:px-8 pb-8 pt-4">
      <h1 className="text-[24px] font-bold text-[var(--ink)] mb-6" style={{ letterSpacing: '-0.4px' }}>More</h1>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] overflow-hidden">
        {items.map((item, i) => (
          <button key={i} onClick={item.action}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--shell)] transition-colors border-b border-[var(--ink-10)] last:border-0">
            <item.icon size={18} className="text-[var(--ink-35)]" />
            <span className="text-[15px] text-[var(--ink)] font-medium">{item.label}</span>
            <ChevronRight size={16} className="text-[var(--ink-35)] ml-auto" />
          </button>
        ))}
      </div>

      <button onClick={() => setShowSignOutConfirm(true)}
        className="w-full mt-4 flex items-center gap-3 px-4 py-3.5 bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] hover:bg-[var(--shell)]">
        <LogOut size={18} className="text-[var(--terra)]" />
        <span className="text-[15px] text-[var(--terra)] font-medium">Sign out</span>
      </button>

      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-[rgba(34,34,34,0.4)] z-50 flex items-center justify-center px-4">
          <div className="bg-[var(--card)] rounded-[var(--r-card)] p-6 max-w-sm w-full text-center">
            <p className="text-[18px] font-semibold text-[var(--ink)] mb-2">Sign out?</p>
            <p className="text-[14px] text-[var(--ink-60)] mb-5">You'll need to sign in again to access your campaigns.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 py-2.5 rounded-[var(--r-pill)] border border-[var(--border)] text-[var(--ink)] font-semibold text-[15px]">Cancel</button>
              <button onClick={onSignOut}
                className="flex-1 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px]">Sign out</button>
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
    <div className="fixed inset-0 bg-[rgba(34,34,34,0.5)] z-[60] flex items-center justify-center px-4">
      <div className="bg-[var(--card)] rounded-[16px] max-w-[400px] w-full p-6 text-center" style={{ boxShadow: '0 20px 60px rgba(28,28,26,0.15)' }}>
        <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#C4674A', letterSpacing: '-0.5px' }}>nayba</span>
        <h2 className="text-[20px] font-bold text-[var(--ink)] mt-3 mb-1" style={{ letterSpacing: '-0.4px' }}>How it works</h2>
        <p className="text-[14px] text-[var(--ink-60)] mb-5">Four simple steps — no follower minimums, ever</p>
        <div className="space-y-3 mb-6 text-left">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--terra-light)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <s.icon size={18} className="text-[var(--terra)]" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[var(--ink)]">{s.title}</p>
                <p className="text-[13px] text-[var(--ink-60)] leading-[1.5]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onDismiss}
          className="w-full py-3 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px]"
          style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
          Start exploring
        </button>
      </div>
    </div>
  );
}

// ─── Main CreatorApp ───
export default function CreatorApp() {
  const { user, userProfile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('discover');
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingCampaign, setViewingCampaign] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('creators').select('*').eq('email', user!.email!).single();
    if (data) {
      setProfile(data as CreatorProfile);
      // Show onboarding overlay for new creators who haven't seen it
      const onboardingKey = `nayba_onboarding_seen_${data.id}`;
      if (!localStorage.getItem(onboardingKey) && data.total_campaigns === 0) {
        setShowOnboarding(true);
      }
    } else if (userProfile) {
      setProfile(userProfile as CreatorProfile);
    }
    setLoading(false);
  };

  const handleNav = (t: Tab) => {
    setTab(t);
    setSidebarOpen(false);
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <div className="w-10 h-10 border-[3px] border-[#C4674A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Approval gate — unapproved creators see a pending screen
  if (!profile.approved) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center px-6 text-center">
        <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 28, fontWeight: 700, color: '#C4674A', letterSpacing: '-0.5px', marginBottom: 32 }}>nayba</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#222', marginBottom: 8 }}>You're on the list</h1>
        <p style={{ fontSize: 15, color: 'rgba(34,34,34,0.60)', lineHeight: 1.65, maxWidth: 360, marginBottom: 40 }}>
          We're reviewing your profile and will email you at {profile.email} once you're approved. Usually within 24 hours.
        </p>
        <button onClick={signOut} style={{ fontSize: 14, color: 'rgba(34,34,34,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    );
  }

  // On mobile (< lg), campaign detail is a full-page overlay
  // On desktop (>= lg), campaign detail slides in as a right pane
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  if (viewingCampaign && isMobile) {
    return <CampaignDetail campaignId={viewingCampaign} onBack={() => setViewingCampaign(null)} />;
  }

  const initial = (profile.display_name || profile.name || '?')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* Mobile/tablet overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-[rgba(28,28,26,0.4)] z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── Sidebar ─── */}
      <aside className={`
        w-[220px] bg-white border-r border-[#E6E2DB] flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-200
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Wordmark */}
        <div className="px-5 pt-6 pb-5 border-b border-[#E6E2DB] flex items-center justify-between">
          <span style={{ fontFamily: "'Instrument Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#C4674A', letterSpacing: '-0.5px' }}>nayba</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-[rgba(34,34,34,0.35)] hover:text-[#222]">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3">
          {NAV_ITEMS.map(item => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[8px] mb-0.5 transition-colors"
                style={{
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                  background: active ? 'rgba(196,103,74,0.08)' : 'transparent',
                  color: active ? '#C4674A' : 'rgba(34,34,34,0.60)',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget.style.background = 'rgba(34,34,34,0.04)'); }}
                onMouseLeave={e => { if (!active) (e.currentTarget.style.background = 'transparent'); }}
              >
                <item.icon size={18} strokeWidth={active ? 2 : 1.5} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Creator info */}
        <div className="px-3 py-4 border-t border-[#E6E2DB]">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-[30px] h-[30px] rounded-full bg-[#C4674A] flex items-center justify-center flex-shrink-0">
              <span className="text-[12px] font-bold text-white">{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#222] truncate">{profile.display_name || profile.name}</p>
              <p className="text-[11px] text-[rgba(34,34,34,0.35)] truncate">{profile.instagram_handle}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Hamburger button (mobile/tablet only) ─── */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-50 w-[44px] h-[44px] flex items-center justify-center rounded-[8px] lg:hidden"
          style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(34,34,34,0.08)' }}
        >
          <Menu size={22} className="text-[#222]" />
        </button>
      )}

      {/* ─── Main content ─── */}
      <div className="lg:ml-[220px] min-h-screen flex">
        {/* Left: main feed */}
        <div className={`flex-1 min-w-0 ${viewingCampaign && !isMobile ? 'max-w-[55%]' : ''} transition-all duration-200`}>
          <div className="p-4 lg:p-5">
            {tab === 'discover' && <DiscoverTab profile={profile} onOpenCampaign={setViewingCampaign} onGoToCampaigns={() => setTab('campaigns')} />}
            {tab === 'campaigns' && <CampaignsTab profile={profile} />}
            {tab === 'naybahood' && <NaybahoodTab profile={profile} showToast={showToast} />}
            {tab === 'profile' && <ProfileTab profile={profile} showToast={showToast} />}
            {tab === 'more' && <MoreTab onSignOut={signOut} showToast={showToast} creatorId={profile.id} />}
          </div>
        </div>

        {/* Right: campaign detail pane (desktop only) */}
        {viewingCampaign && !isMobile && (
          <div className="hidden lg:block w-[45%] border-l border-[var(--border)] bg-[var(--shell)] overflow-y-auto h-screen sticky top-0">
            <CampaignDetail campaignId={viewingCampaign} onBack={() => setViewingCampaign(null)} />
          </div>
        )}
      </div>

      {/* How It Works onboarding */}
      {showOnboarding && profile && (
        <HowItWorksOverlay onDismiss={() => {
          setShowOnboarding(false);
          localStorage.setItem(`nayba_onboarding_seen_${profile.id}`, 'true');
        }} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-[999px] bg-[#C4674A] text-white text-[14px] font-medium"
          style={{ boxShadow: '0 4px 20px rgba(196,103,74,0.3)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
