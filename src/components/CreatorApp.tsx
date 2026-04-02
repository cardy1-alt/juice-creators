import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import CampaignDetail from './CampaignDetail';
import {
  Compass, Megaphone, Users, User, MoreHorizontal,
  Search, Clock, Gift, Film, Check, Lock, LogOut,
  ChevronRight, Settings, History, Link2, HelpCircle,
  AtSign, ExternalLink, X, Image
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
  status: string; businesses?: { name: string };
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

// ─── Bottom Nav ───
function BottomNav({ active, onNavigate }: { active: Tab; onNavigate: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: typeof Compass }[] = [
    { key: 'discover', label: 'Discover', icon: Compass },
    { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { key: 'naybahood', label: 'Naybahood', icon: Users },
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'more', label: 'More', icon: MoreHorizontal },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--card)] border-t border-[var(--border)] z-40 px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex max-w-[600px] mx-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => onNavigate(t.key)}
            className={`flex-1 flex flex-col items-center py-2 pt-2.5 text-[11px] font-medium transition-colors ${active === t.key ? 'text-[var(--terra)]' : 'text-[var(--ink-35)]'}`}>
            <t.icon size={20} strokeWidth={active === t.key ? 2 : 1.5} />
            <span className="mt-0.5">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

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
    <div className="max-w-[600px] mx-auto px-4 pb-24 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Logo size={24} variant="wordmark" />
      </div>

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
      <div className="space-y-3">
        {filtered.map(c => {
          const appStatus = applications[c.id];
          return (
            <button key={c.id} onClick={() => onOpenCampaign(c.id)}
              className="w-full text-left bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4 hover:shadow-[0_2px_8px_rgba(34,34,34,0.06)] transition-shadow">
              <p className="text-[13px] font-semibold text-[var(--ink-60)] mb-0.5">{c.businesses?.name}</p>
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
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[16px] font-semibold text-[var(--ink)] mb-1">No campaigns in your area yet</p>
            <p className="text-[14px] text-[var(--ink-35)]">New campaigns drop regularly — check back soon</p>
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
  const statusSteps = ['Selected', 'Confirmed', 'Perk Received', 'Content Due', 'Submitted', 'Complete'];

  const getStepIndex = (p: Participation) => {
    if (p.status === 'completed') return 5;
    if (p.status === 'content_submitted') return 4;
    if (p.reel_url) return 4;
    if (p.perk_sent) return 2;
    if (p.status === 'confirmed' || p.status === 'visited') return 1;
    return 0;
  };

  return (
    <div className="max-w-[600px] mx-auto px-4 pb-24 pt-4">
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
            const stepIdx = getStepIndex(p);
            const days = daysUntil(p.campaigns?.content_deadline || null);
            return (
              <div key={p.id} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4">
                <p className="text-[13px] font-semibold text-[var(--ink-60)]">{p.campaigns?.businesses?.name}</p>
                <p className="text-[16px] font-semibold text-[var(--ink)] mb-2">{p.campaigns?.headline || p.campaigns?.title}</p>
                {/* Status stepper */}
                <div className="flex items-center gap-0.5 mb-3">
                  {statusSteps.map((s, i) => (
                    <div key={s} className="flex-1">
                      <div className={`h-1.5 rounded-full ${i <= stepIdx ? 'bg-[var(--terra)]' : 'bg-[var(--ink-10)]'}`} />
                      <p className={`text-[10px] mt-1 ${i <= stepIdx ? 'text-[var(--terra)] font-semibold' : 'text-[var(--ink-35)]'}`}>{s}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-[12px] text-[var(--ink-35)]">
                    {p.perk_sent && <span className="flex items-center gap-1 text-[var(--success)]"><Check size={12} /> Perk received</span>}
                    {days !== null && days > 0 && <span className="flex items-center gap-1"><Clock size={12} /> {days} days left</span>}
                    {days !== null && days <= 0 && <span className="text-[var(--terra)]">Content overdue</span>}
                  </div>
                  {(p.status === 'confirmed' || p.status === 'visited') && !p.reel_url && (
                    <button onClick={() => setShowReelModal(p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white text-[13px] font-semibold">
                      <Film size={14} /> Submit Reel
                    </button>
                  )}
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
              <p className="text-[16px] font-semibold text-[var(--ink)] mb-1">No active campaigns</p>
              <p className="text-[14px] text-[var(--ink-35)]">Express interest in a campaign to get started</p>
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
              <h3 className="text-[18px] font-semibold text-[var(--ink)]">Submit your Reel</h3>
              <button onClick={() => { setShowReelModal(null); setReelUrl(''); }} className="text-[var(--ink-35)]"><X size={20} /></button>
            </div>
            <p className="text-[14px] text-[var(--ink-60)] mb-4">Paste the link to your Instagram Reel below</p>
            <input value={reelUrl} onChange={e => setReelUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              className="w-full px-4 py-3 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[15px] focus:outline-none focus:border-[var(--terra)] mb-4" />
            <button onClick={handleSubmitReel} disabled={!reelUrl || submittingReel}
              className="w-full py-3 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] disabled:opacity-50"
              style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
              {submittingReel ? 'Submitting...' : 'Submit Reel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Naybahood Tab ───
function NaybahoodTab({ profile }: { profile: CreatorProfile }) {
  const unlocked = profile.completed_campaigns >= 1;

  if (!unlocked) {
    return (
      <div className="max-w-[600px] mx-auto px-4 pb-24 pt-4">
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
    <div className="max-w-[600px] mx-auto px-4 pb-24 pt-4">
      <h1 className="text-[24px] font-bold text-[var(--ink)] mb-6" style={{ letterSpacing: '-0.4px' }}>The Naybahood</h1>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[rgba(45,122,79,0.1)] flex items-center justify-center mx-auto mb-4">
          <Users size={28} className="text-[var(--success)]" />
        </div>
        <p className="text-[20px] font-bold text-[var(--ink)] mb-2">Welcome to The Naybahood</p>
        <p className="text-[14px] text-[var(--ink-60)] leading-[1.65] max-w-sm mx-auto mb-6">
          You're part of the crew. Connect with other local creators, get early access to campaigns, and grow together.
        </p>
        <a href="#" onClick={e => { e.preventDefault(); alert('WhatsApp Community link coming soon'); }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px]"
          style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
          Join the WhatsApp Community
        </a>
      </div>
    </div>
  );
}

// ─── Profile Tab ───
function ProfileTab({ profile }: { profile: CreatorProfile }) {
  const initial = (profile.display_name || profile.name || '?')[0].toUpperCase();

  return (
    <div className="max-w-[600px] mx-auto px-4 pb-24 pt-4">
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
            <button onClick={() => alert('Instagram connection coming soon')}
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
function MoreTab({ onSignOut }: { onSignOut: () => void }) {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const items = [
    { icon: History, label: 'Campaign history', action: () => {} },
    { icon: Settings, label: 'Account settings', action: () => {} },
    { icon: Link2, label: 'Refer a friend', action: () => { navigator.clipboard.writeText('https://app.nayba.app').catch(() => {}); alert('Referral link copied!'); } },
    { icon: HelpCircle, label: 'Help', action: () => {} },
  ];

  return (
    <div className="max-w-[600px] mx-auto px-4 pb-24 pt-4">
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

// ─── Main CreatorApp ───
export default function CreatorApp() {
  const { user, userProfile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('discover');
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingCampaign, setViewingCampaign] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    // Query by email since creators.id may not match auth.uid()
    const { data } = await supabase.from('creators').select('*').eq('email', user!.email!).single();
    if (data) {
      setProfile(data as CreatorProfile);
    } else if (userProfile) {
      // Fallback to AuthContext profile (demo mode or if query fails)
      setProfile(userProfile as CreatorProfile);
    }
    setLoading(false);
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)]">
        <div className="w-10 h-10 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Campaign detail view
  if (viewingCampaign) {
    return <CampaignDetail campaignId={viewingCampaign} onBack={() => setViewingCampaign(null)} />;
  }

  return (
    <div className="min-h-screen bg-[var(--shell)]">
      {tab === 'discover' && <DiscoverTab profile={profile} onOpenCampaign={setViewingCampaign} onGoToCampaigns={() => setTab('campaigns')} />}
      {tab === 'campaigns' && <CampaignsTab profile={profile} />}
      {tab === 'naybahood' && <NaybahoodTab profile={profile} />}
      {tab === 'profile' && <ProfileTab profile={profile} />}
      {tab === 'more' && <MoreTab onSignOut={signOut} />}
      <BottomNav active={tab} onNavigate={setTab} />
    </div>
  );
}
