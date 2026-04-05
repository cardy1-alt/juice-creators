import { useState, useEffect } from 'react';
import { useEffectiveAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import {
  LayoutDashboard, Users, ClipboardList, Film, BarChart3,
  LogOut, ExternalLink, Mail, Check, Clock, Eye, Menu, X
} from 'lucide-react';

// ─── Skeleton Loaders ───
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[rgba(0,0,0,0.06)] rounded-[8px] ${className || ''}`} />;
}

function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-4 mb-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border-[0.5px] border-[rgba(0,0,0,0.08)] rounded-[10px] p-4">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

// ─── Types ───
interface Brand {
  id: string; name: string; slug: string; owner_email: string; category: string;
  instagram_handle: string | null; bio: string | null;
}
interface Campaign {
  id: string; title: string; headline: string | null; status: string;
  perk_description: string | null; perk_value: number | null; perk_type: string | null;
  content_requirements: string | null; talking_points: string[] | null;
  inspiration: any[] | null; deliverables: any; creator_target: number;
  open_date: string | null; expression_deadline: string | null; content_deadline: string | null;
}
interface Application {
  id: string; campaign_id: string; creator_id: string; pitch: string | null;
  status: string; applied_at: string;
  creators?: { name: string; display_name: string | null; instagram_handle: string; completion_rate: number; level: number; follower_count: string | null; };
}
interface Participation {
  id: string; campaign_id: string; creator_id: string; perk_sent: boolean;
  reel_url: string | null; reel_submitted_at: string | null;
  reach: number | null; likes: number | null; comments: number | null; views: number | null;
  status: string; completed_at: string | null;
  creators?: { name: string; display_name: string | null; instagram_handle: string; };
}

type Tab = 'summary' | 'selection' | 'participation' | 'content' | 'analytics';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-[#F1EFE8] text-[#5F5E5A]',
    active: 'bg-[#E1F5EE] text-[#0F6E56]',
    selecting: 'bg-[rgba(59,130,246,0.08)] text-[#3B82F6]',
    live: 'bg-[#E1F5EE] text-[#0F6E56]',
    completed: 'bg-[#F1EFE8] text-[#5F5E5A]',
    interested: 'bg-[#FAEEDA] text-[#854F0B]',
    pending: 'bg-[#FAEEDA] text-[#854F0B]',
    selected: 'bg-[#E1F5EE] text-[#0F6E56]',
    confirmed: 'bg-[#E1F5EE] text-[#0F6E56]',
    declined: 'bg-[#F1EFE8] text-[#5F5E5A]',
    content_submitted: 'bg-[rgba(59,130,246,0.08)] text-[#3B82F6]',
    overdue: 'bg-[#FCEBEB] text-[#A32D2D]',
  };
  return (
    <span className={`inline-flex items-center rounded-[999px] text-[11px] font-medium ${styles[status] || styles.draft}`} style={{ padding: '3px 9px', fontWeight: 500 }}>
      {status.replace('_', ' ')}
    </span>
  );
}

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'summary', label: 'Summary', icon: LayoutDashboard },
  { key: 'selection', label: 'Selection', icon: Users },
  { key: 'participation', label: 'Participation', icon: ClipboardList },
  { key: 'content', label: 'Content', icon: Film },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export default function BusinessPortal() {
  const { user, signOut } = useEffectiveAuth();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(new Set());
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  useEffect(() => { if (user) fetchBrand(); }, [user]);

  const fetchBrand = async () => {
    const { data: bData } = await supabase.from('businesses').select('*').eq('owner_email', user!.email).single();
    if (bData) {
      setBrand(bData as Brand);
      const { data: cData } = await supabase.from('campaigns').select('*').eq('brand_id', bData.id).order('created_at', { ascending: false });
      if (cData && cData.length > 0) {
        setCampaigns(cData as Campaign[]);
        setSelectedCampaignId(cData[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedCampaignId) fetchCampaignData();
  }, [selectedCampaignId]);

  const fetchCampaignData = async () => {
    const [appRes, partRes] = await Promise.all([
      supabase.from('applications').select('*, creators(name, display_name, instagram_handle, completion_rate, level, follower_count)').eq('campaign_id', selectedCampaignId!).order('applied_at', { ascending: false }),
      supabase.from('participations').select('*, creators(name, display_name, instagram_handle)').eq('campaign_id', selectedCampaignId!).order('created_at', { ascending: false }),
    ]);
    if (appRes.data) setApplications(appRes.data as Application[]);
    if (partRes.data) setParticipations(partRes.data as Participation[]);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[var(--shell)]">
        <aside className="hidden md:flex w-[240px] bg-[#F7F6F3] flex-col flex-shrink-0" style={{ borderRight: '0.5px solid rgba(0,0,0,0.08)' }}>
          <div className="px-5 py-5" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
            <Skeleton className="h-7 w-20 mb-2" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex-1 py-3 px-3 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        </aside>
        <div className="flex-1 p-4 md:p-8">
          <StatCardsSkeleton count={4} />
          <Skeleton className="h-[300px] rounded-[10px]" />
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)] px-4">
        <div className="bg-white rounded-[10px] p-8 max-w-md text-center" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
          <p className="text-[15px] font-medium text-[var(--ink)] mb-2">No brand account found</p>
          <p className="text-[13px] text-[rgba(0,0,0,0.45)] mb-4">Contact nayba to get set up.</p>
          <a href="mailto:jacob@nayba.app" className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-[6px] bg-[#C4674A] text-white font-semibold text-[13px]">
            <Mail size={16} /> Contact nayba
          </a>
        </div>
      </div>
    );
  }

  const campaign = campaigns.find(c => c.id === selectedCampaignId) || null;
  const selectedCount = applications.filter(a => a.status === 'selected' || a.status === 'confirmed').length;
  const submittedCount = participations.filter(p => p.reel_url).length;
  const completedCount = participations.filter(p => p.status === 'completed').length;
  const totalReach = participations.reduce((s, p) => s + (p.reach || 0), 0);

  const thCls = 'text-left text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] py-[10px] px-4 bg-[#F7F6F3]';
  const tdCls = 'py-0 px-4 text-[14px] text-[#1C1917] border-b-[0.5px] border-[rgba(0,0,0,0.06)]';

  // Empty state
  if (campaigns.length === 0) {
    return (
      <div className="flex min-h-screen bg-[var(--shell)]">
        <aside className="hidden md:flex w-[240px] bg-[#F7F6F3] flex-col flex-shrink-0" style={{ borderRight: '0.5px solid rgba(0,0,0,0.08)' }}>
          <div className="px-5 py-5" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
            <Logo size={28} variant="wordmark" />
            <p className="text-[13px] font-medium text-[rgba(0,0,0,0.55)] mt-1">{brand.name}</p>
          </div>
          <div className="flex-1" />
          <div className="px-3 py-4" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
            <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-[14px] text-[rgba(0,0,0,0.55)] hover:bg-[rgba(0,0,0,0.02)]">
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="text-center max-w-md">
            <p className="text-[15px] font-medium text-[var(--ink)] mb-2">Your campaigns will appear here</p>
            <p className="text-[13px] text-[rgba(0,0,0,0.45)] mb-4">Contact nayba to get started with your first campaign.</p>
            <a href="mailto:jacob@nayba.app" className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-[6px] bg-[#C4674A] text-white font-semibold text-[13px]">
              <Mail size={16} /> Contact nayba
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--shell)]">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#1C1917] text-white px-4 py-2.5 rounded-[8px] text-[14px] font-medium">{toast}</div>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — hidden on mobile by default, overlay when open */}
      <aside className={`
        w-[240px] bg-[#F7F6F3] flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ borderRight: '0.5px solid rgba(0,0,0,0.08)' }}>
        <div className="px-5 py-5 flex items-center justify-between" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
          <div>
            <Logo size={28} variant="wordmark" />
            <p className="text-[13px] font-medium text-[rgba(0,0,0,0.55)] mt-1">{brand.name}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-[rgba(0,0,0,0.55)] hover:text-[var(--ink)]">
            <X size={20} />
          </button>
        </div>

        {/* Campaign selector */}
        {campaigns.length > 1 && (
          <div className="px-3 py-3" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
            <select value={selectedCampaignId || ''} onChange={e => setSelectedCampaignId(e.target.value)}
              className="w-full px-3 py-2 rounded-[6px] bg-white text-[14px] text-[var(--ink)]" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        )}

        <nav className="flex-1 py-3 px-3">
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => handleTabClick(tab.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-[14px] mb-0.5 transition-colors ${active ? 'bg-[rgba(0,0,0,0.06)] text-[#1C1917] font-semibold' : 'text-[rgba(0,0,0,0.55)] font-medium hover:bg-[rgba(0,0,0,0.02)]'}`}>
                <tab.icon size={18} strokeWidth={active ? 2 : 1.5} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-[14px] text-[rgba(0,0,0,0.55)] hover:bg-[rgba(0,0,0,0.02)]">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
          <button onClick={() => setSidebarOpen(true)} className="text-[var(--ink-60)] hover:text-[var(--ink)]">
            <Menu size={22} />
          </button>
          <Logo size={22} variant="wordmark" />
        </div>

        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-0 overflow-auto" key={activeTab}>
        <div className="tab-fade-in">
        {/* Summary Tab */}
        {activeTab === 'summary' && campaign && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-[16px] font-semibold text-[var(--ink)]">{campaign.title}</h1>
              <StatusBadge status={campaign.status} />
            </div>

            {/* Dates */}
            <div className="space-y-1.5 text-[13px] mb-6 max-w-[280px]">
              {campaign.open_date && <div className="flex justify-between"><span className="text-[rgba(0,0,0,0.45)]">Opens</span><span className="font-medium text-[#1C1917]">{fmtDate(campaign.open_date)}</span></div>}
              {campaign.expression_deadline && <div className="flex justify-between"><span className="text-[rgba(0,0,0,0.45)]">Apply by</span><span className="font-medium text-[#1C1917]">{fmtDate(campaign.expression_deadline)}</span></div>}
              {campaign.content_deadline && <div className="flex justify-between"><span className="text-[rgba(0,0,0,0.45)]">Content due</span><span className="font-medium text-[#1C1917]">{fmtDate(campaign.content_deadline)}</span></div>}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Applicants', value: applications.length },
                { label: 'Selected', value: selectedCount },
                { label: 'Content Submitted', value: submittedCount },
                { label: 'Completed', value: completedCount },
                { label: 'Total Reach', value: totalReach.toLocaleString() },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-[10px] p-[16px]" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-1">{s.label}</p>
                  <p className="text-[24px] font-semibold text-[#1C1917]">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Campaign brief */}
            <div className="bg-white rounded-[10px] p-5" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
              <h2 className="text-[18px] font-semibold text-[var(--ink)] mb-4">Campaign Brief</h2>
              {campaign.perk_description && (
                <div className="mb-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1">Perk</p>
                  <p className="text-[15px] text-[var(--ink)]">{campaign.perk_description}</p>
                  <p className="text-[13px] text-[var(--ink-35)] mt-1">£{campaign.perk_value} &middot; {campaign.perk_type?.replace('_', ' ')}</p>
                </div>
              )}
              {campaign.content_requirements && (
                <div className="mb-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1">Content Requirements</p>
                  <p className="text-[15px] text-[var(--ink)] leading-[1.65]">{campaign.content_requirements}</p>
                </div>
              )}
              {campaign.talking_points && campaign.talking_points.length > 0 && (
                <div className="mb-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1">Talking Points</p>
                  <ul className="space-y-1">
                    {campaign.talking_points.map((tp, i) => <li key={i} className="text-[15px] text-[var(--ink)]">{i + 1}. {tp}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-4">
              <a href="mailto:jacob@nayba.app"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[6px] text-[var(--ink)] font-medium text-[13px] hover:bg-[var(--shell)]" style={{ border: '0.5px solid rgba(0,0,0,0.18)' }}>
                <Mail size={15} /> Contact nayba
              </a>
            </div>
          </div>
        )}

        {/* Selection Tab */}
        {activeTab === 'selection' && (() => {
          const filteredApps = applications.filter(a => {
            if (filterLevel !== 'all' && a.creators?.level && a.creators.level < parseInt(filterLevel)) return false;
            return true;
          });
          const toggleCreator = (id: string) => {
            setSelectedCreators(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          };
          const toggleAll = () => {
            if (selectedCreators.size === filteredApps.length) setSelectedCreators(new Set());
            else setSelectedCreators(new Set(filteredApps.map(a => a.id)));
          };
          const handleSelect = async (appId: string) => {
            await supabase.from('applications').update({ status: 'selected', selected_at: new Date().toISOString() }).eq('id', appId);
            fetchCampaignData();
            showToast('Creator selected');
          };
          const handleDecline = async (appId: string) => {
            if (!window.confirm('Decline this creator?')) return;
            await supabase.from('applications').update({ status: 'declined' }).eq('id', appId);
            fetchCampaignData();
            showToast('Creator declined');
          };
          const handleBulkSelect = async () => {
            for (const id of selectedCreators) {
              await supabase.from('applications').update({ status: 'selected', selected_at: new Date().toISOString() }).eq('id', id);
            }
            setSelectedCreators(new Set());
            fetchCampaignData();
            showToast(`${selectedCreators.size} creator${selectedCreators.size !== 1 ? 's' : ''} selected`);
          };
          const handleBulkDecline = async () => {
            if (!window.confirm(`Decline ${selectedCreators.size} creator${selectedCreators.size > 1 ? 's' : ''}?`)) return;
            for (const id of selectedCreators) {
              await supabase.from('applications').update({ status: 'declined' }).eq('id', id);
            }
            setSelectedCreators(new Set());
            fetchCampaignData();
            showToast(`${selectedCreators.size} creator${selectedCreators.size !== 1 ? 's' : ''} declined`);
          };
          return (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-[16px] font-semibold text-[var(--ink)]">Selection</h1>
              <span className="text-[14px] text-[var(--ink-35)]">{filteredApps.length} applicant{filteredApps.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Filters + bulk actions */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
                className="px-3 py-2 rounded-[6px] bg-white text-[13px] text-[var(--ink)]" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                <option value="all">All levels</option>
                {[1,2,3,4,5,6].map(l => <option key={l} value={l}>Level {l}+</option>)}
              </select>
              <button onClick={toggleAll}
                className="px-3 py-2 rounded-[6px] bg-white text-[13px] text-[var(--ink-60)] hover:bg-[var(--shell)]" style={{ border: '0.5px solid rgba(0,0,0,0.18)' }}>
                {selectedCreators.size === filteredApps.length && filteredApps.length > 0 ? 'Deselect all' : 'Select all'}
              </button>
              {selectedCreators.size > 0 && (
                <>
                  <span className="text-[13px] text-[var(--ink-60)] font-medium">{selectedCreators.size} selected</span>
                  <button onClick={handleBulkSelect}
                    className="min-h-[44px] px-3 py-2 rounded-[6px] bg-[#C4674A] text-white text-[13px] font-semibold hover:opacity-[0.85]">
                    Select {selectedCreators.size}
                  </button>
                  <button onClick={handleBulkDecline}
                    className="min-h-[44px] px-3 py-2 rounded-[6px] text-[13px] font-medium text-[rgba(0,0,0,0.5)] hover:text-[#1C1917] hover:bg-[rgba(0,0,0,0.04)]">
                    Decline
                  </button>
                </>
              )}
            </div>

            {/* Creator cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {filteredApps.map(a => {
                const name = a.creators?.display_name || a.creators?.name || 'Creator';
                const initial = name[0].toUpperCase();
                const handle = a.creators?.instagram_handle?.replace('@', '') || '';
                const isLowCompletion = a.creators?.completion_rate !== undefined && a.creators.completion_rate < 60;
                return (
                  <div key={a.id} className={`bg-white rounded-[10px] p-5 transition-shadow ${selectedCreators.has(a.id) ? '' : ''}`} style={{ border: selectedCreators.has(a.id) ? '0.5px solid #C4674A' : '0.5px solid rgba(0,0,0,0.08)' }}>
                    {/* Header: checkbox + avatar + name + status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={selectedCreators.has(a.id)} onChange={() => toggleCreator(a.id)}
                          className="accent-[var(--terra)] w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="w-10 h-10 rounded-full bg-[var(--terra)] flex items-center justify-center flex-shrink-0">
                          <span className="text-[15px] font-semibold text-white">{initial}</span>
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold text-[var(--ink)]">{name}</p>
                          <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                            className="text-[13px] text-[var(--terra)] hover:underline flex items-center gap-1">
                            @{handle} <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-35)]">Level</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[var(--terra-light)] text-[var(--terra)]">L{a.creators?.level}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-35)]">Rate</span>
                        <span className={`text-[13px] font-semibold ${isLowCompletion ? 'text-[var(--terra)]' : 'text-[var(--ink)]'}`}>{a.creators?.completion_rate ?? 0}%</span>
                      </div>
                      {a.creators?.follower_count && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-35)]">Followers</span>
                          <span className="text-[13px] font-medium text-[var(--ink-60)]">{a.creators.follower_count}</span>
                        </div>
                      )}
                    </div>

                    {/* Pitch */}
                    {a.pitch && (
                      <div className="bg-[var(--shell)] rounded-[var(--r-sm)] px-3 py-2 mb-3">
                        <p className="text-[13px] text-[var(--ink-60)] leading-[1.5] line-clamp-2">{a.pitch}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                      <p className="text-[12px] text-[var(--ink-35)]">Applied {fmtDate(a.applied_at)}</p>
                      {a.status === 'interested' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleSelect(a.id)}
                            className="min-h-[44px] px-4 py-2 rounded-[6px] bg-[#C4674A] text-white text-[13px] font-semibold hover:opacity-[0.85]">
                            Select
                          </button>
                          <button onClick={() => handleDecline(a.id)}
                            className="min-h-[44px] flex items-center text-[12px] font-medium text-[rgba(0,0,0,0.4)] hover:text-[#1C1917]">
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredApps.length === 0 && (
                <div className="col-span-3 py-12 text-center">
                  <p className="text-[16px] font-semibold text-[var(--ink)] mb-1">No applicants yet</p>
                  <p className="text-[14px] text-[var(--ink-35)]">Creators will appear here once they express interest</p>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* Participation Tab — renamed to "Creator Progress" */}
        {activeTab === 'participation' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-[16px] font-semibold text-[var(--ink)]">Creator Progress</h1>
              <span className="text-[14px] text-[var(--ink-35)]">{participations.length} creator{participations.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-3">
              {participations.map(p => {
                const name = p.creators?.display_name || p.creators?.name || 'Creator';
                const initial = name[0].toUpperCase();
                const handle = p.creators?.instagram_handle?.replace('@', '') || '';
                // Progress steps
                const steps = [
                  { label: 'Confirmed', done: true },
                  { label: 'Perk sent', done: p.perk_sent },
                  { label: 'Reel shared', done: !!p.reel_url },
                  { label: 'Complete', done: p.status === 'completed' },
                ];
                const doneCount = steps.filter(s => s.done).length;
                const progressPct = (doneCount / steps.length) * 100;
                return (
                  <div key={p.id} className="bg-white rounded-[10px] p-5" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-[var(--terra)] flex items-center justify-center flex-shrink-0">
                        <span className="text-[16px] font-semibold text-white">{initial}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[16px] font-semibold text-[var(--ink)]">{name}</p>
                            <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                              className="text-[13px] text-[var(--terra)] hover:underline flex items-center gap-1">
                              @{handle} <ExternalLink size={11} />
                            </a>
                          </div>
                          <StatusBadge status={p.status} />
                        </div>

                        {/* Progress bar */}
                        <div className="h-[4px] bg-[rgba(0,0,0,0.08)] rounded-full overflow-hidden mb-2.5 mt-2">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progressPct}%`,
                              background: p.status === 'completed' ? 'var(--success)' : p.status === 'overdue' ? '#DC2626' : 'var(--terra)',
                            }} />
                        </div>

                        {/* Step indicators */}
                        <div className="flex items-center gap-4">
                          {steps.map((s, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${s.done ? 'bg-[var(--terra)]' : ''}`} style={s.done ? {} : { border: '0.5px solid rgba(0,0,0,0.08)' }}>
                                {s.done && <Check size={10} className="text-white" />}
                              </div>
                              <span className={`text-[12px] ${s.done ? 'text-[var(--ink-60)] font-medium' : 'text-[var(--ink-35)]'}`}>{s.label}</span>
                            </div>
                          ))}
                        </div>

                        {/* Actions + data */}
                        <div className="flex items-center gap-4 mt-3 pt-3 flex-wrap" style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                          {!p.perk_sent && (
                            <button onClick={async () => {
                              await supabase.from('participations').update({ perk_sent: true, perk_sent_at: new Date().toISOString() }).eq('id', p.id);
                              fetchCampaignData();
                              showToast('Perk marked as sent');
                            }} className="min-h-[44px] px-3 py-1.5 rounded-[6px] bg-[#C4674A] text-white text-[12px] font-semibold hover:opacity-[0.85]">
                              Mark perk sent
                            </button>
                          )}
                          {p.reel_url && (
                            <a href={p.reel_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[13px] text-[var(--terra)] font-medium hover:underline">
                              <Film size={14} /> View Reel <ExternalLink size={11} />
                            </a>
                          )}
                          {p.reach != null && <span className="text-[13px] text-[var(--ink-60)]"><Eye size={13} className="inline mr-1" />{p.reach.toLocaleString()} reach</span>}
                          {(p.likes != null || p.comments != null) && (
                            <span className="text-[13px] text-[var(--ink-60)]">{p.likes || 0} likes &middot; {p.comments || 0} comments</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {participations.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-[16px] font-semibold text-[var(--ink)] mb-1">No creators confirmed yet</p>
                  <p className="text-[14px] text-[var(--ink-35)]">Once creators confirm their spot, their progress will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div>
            <h1 className="text-[16px] font-semibold text-[var(--ink)] mb-5">Content</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {participations.filter(p => p.reel_url).map(p => (
                <div key={p.id} className="bg-white rounded-[10px] p-5" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                  <p className="text-[15px] font-semibold text-[var(--ink)] mb-1">{p.creators?.display_name || p.creators?.name}</p>
                  <a href={p.reel_url!} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[14px] text-[var(--terra)] hover:underline mb-3">
                    <Film size={15} /> View on Instagram <ExternalLink size={13} />
                  </a>
                  <div className="space-y-1 text-[13px] text-[var(--ink-60)]">
                    {p.reach != null && <p>Reach: {p.reach.toLocaleString()}</p>}
                    {p.likes != null && <p>Likes: {p.likes.toLocaleString()}</p>}
                    {p.reel_submitted_at && <p>Posted: {fmtDate(p.reel_submitted_at)}</p>}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                    {p.status !== 'completed' && (
                      <button onClick={async () => {
                        await supabase.from('participations').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', p.id);
                        fetchCampaignData();
                        showToast('Content approved');
                      }} className="min-h-[44px] px-3 py-1.5 rounded-[6px] bg-[#0F6E56] text-white text-[12px] font-semibold hover:opacity-[0.85]">
                        Approve
                      </button>
                    )}
                    {p.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F6E56]">
                        <Check size={13} /> Approved
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {participations.filter(p => p.reel_url).length === 0 && (
                <div className="col-span-3 py-12 text-center text-[14px] text-[var(--ink-35)]">No content submitted yet</div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div>
            <h1 className="text-[16px] font-semibold text-[var(--ink)] mb-5">Analytics</h1>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-[10px] p-[16px]" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-1">Total Reach</p>
                <p className="text-[24px] font-semibold text-[#1C1917]">{totalReach.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-[10px] p-[16px]" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-1">Content Pieces</p>
                <p className="text-[24px] font-semibold text-[#1C1917]">{submittedCount}</p>
              </div>
              <div className="bg-white rounded-[10px] p-[16px]" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-1">Avg Engagement</p>
                <p className="text-[24px] font-semibold text-[#1C1917]">
                  {participations.filter(p => p.reach && p.reach > 0).length > 0
                    ? (participations.reduce((s, p) => s + ((p.likes || 0) + (p.comments || 0)), 0) / Math.max(totalReach, 1) * 100).toFixed(1) + '%'
                    : '—'
                  }
                </p>
                <p className="text-[12px] text-[var(--ink-35)] mt-1">Platform benchmark: 3-4%</p>
              </div>
            </div>

            {/* Reach by creator */}
            <div className="bg-white rounded-[10px] p-5" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
              <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-4">Reach by Creator</p>
              {(() => {
                const withReach = participations.filter(p => p.reach && p.reach > 0);
                const maxReach = Math.max(...withReach.map(p => p.reach!), 1);
                return withReach.length > 0 ? (
                  <div className="space-y-3">
                    {withReach.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-[14px] text-[var(--ink)] w-32 truncate">{p.creators?.display_name || p.creators?.name}</span>
                        <div className="flex-1 h-6 bg-[rgba(0,0,0,0.08)] rounded-[6px] overflow-hidden">
                          <div className="h-full rounded-[6px] bg-[var(--terra)] flex items-center justify-end pr-2 chart-bar-enter"
                            style={{ width: `${(p.reach! / maxReach) * 100}%`, minWidth: 32, animationDelay: `${i * 0.08}s`, animationFillMode: 'both' }}>
                            <span className="text-[11px] font-semibold text-white">{p.reach!.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--ink-35)]">No reach data yet — admin will enter this after content is reviewed</p>
                );
              })()}
            </div>
          </div>
        )}
        </div>
      </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white z-30" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around py-2">
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] ${active ? 'text-[#C4674A]' : 'text-[rgba(0,0,0,0.35)]'}`}>
                <tab.icon size={20} strokeWidth={active ? 2 : 1.5} />
                <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
