import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import {
  LayoutDashboard, Users, ClipboardList, Film, BarChart3,
  LogOut, ExternalLink, Mail, Check, Clock, Eye, Menu, X
} from 'lucide-react';

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
    draft: 'bg-[var(--ink-10)] text-[var(--ink-60)]',
    active: 'bg-[var(--terra-light)] text-[var(--terra)]',
    selecting: 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6]',
    live: 'bg-[rgba(45,122,79,0.1)] text-[var(--success)]',
    completed: 'bg-[var(--ink-10)] text-[var(--ink-60)]',
    interested: 'bg-[var(--terra-light)] text-[var(--terra)]',
    selected: 'bg-[rgba(45,122,79,0.1)] text-[var(--success)]',
    confirmed: 'bg-[rgba(45,122,79,0.1)] text-[var(--success)]',
    declined: 'bg-[var(--ink-10)] text-[var(--ink-60)]',
    content_submitted: 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6]',
    overdue: 'bg-[rgba(220,38,38,0.1)] text-[#DC2626]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[var(--r-sm)] text-[12px] font-semibold ${styles[status] || styles.draft}`}>
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
  const { user, signOut } = useAuth();
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)]">
        <div className="w-10 h-10 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)] px-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-8 max-w-md text-center">
          <p className="text-[18px] font-semibold text-[var(--ink)] mb-2">No brand account found</p>
          <p className="text-[14px] text-[var(--ink-60)] mb-4">Contact nayba to get set up.</p>
          <a href="mailto:jacob@nayba.app" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px]">
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

  const thCls = 'text-left text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] py-3 px-3 border-b border-[var(--ink-10)]';
  const tdCls = 'py-3 px-3 text-[14px] text-[var(--ink)] border-b border-[var(--ink-10)]';

  // Empty state
  if (campaigns.length === 0) {
    return (
      <div className="flex min-h-screen bg-[var(--shell)]">
        <aside className="hidden md:flex w-[240px] bg-[var(--card)] border-r border-[var(--border)] flex-col flex-shrink-0">
          <div className="px-5 py-5 border-b border-[var(--border)]">
            <Logo size={28} variant="wordmark" />
            <p className="text-[13px] font-medium text-[var(--ink-60)] mt-1">{brand.name}</p>
          </div>
          <div className="flex-1" />
          <div className="px-3 py-4 border-t border-[var(--border)]">
            <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-[14px] text-[var(--ink-35)] hover:bg-[var(--shell)]">
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="text-center max-w-md">
            <p className="text-[20px] font-semibold text-[var(--ink)] mb-2">Your campaigns will appear here</p>
            <p className="text-[14px] text-[var(--ink-60)] mb-4">Contact nayba to get started with your first campaign.</p>
            <a href="mailto:jacob@nayba.app" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px]">
              <Mail size={16} /> Contact nayba
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--shell)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-[rgba(34,34,34,0.4)] z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — hidden on mobile by default, overlay when open */}
      <aside className={`
        w-[240px] bg-[var(--card)] border-r border-[var(--border)] flex flex-col flex-shrink-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="px-5 py-5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <Logo size={28} variant="wordmark" />
            <p className="text-[13px] font-medium text-[var(--ink-60)] mt-1">{brand.name}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-[var(--ink-35)] hover:text-[var(--ink)]">
            <X size={20} />
          </button>
        </div>

        {/* Campaign selector */}
        {campaigns.length > 1 && (
          <div className="px-3 py-3 border-b border-[var(--border)]">
            <select value={selectedCampaignId || ''} onChange={e => setSelectedCampaignId(e.target.value)}
              className="w-full px-3 py-2 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[14px] text-[var(--ink)]">
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        )}

        <nav className="flex-1 py-3 px-3">
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => handleTabClick(tab.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-[14px] font-medium mb-0.5 transition-colors ${active ? 'bg-[var(--terra-light)] text-[var(--terra)]' : 'text-[var(--ink-60)] hover:bg-[var(--shell)]'}`}>
                <tab.icon size={18} strokeWidth={active ? 2 : 1.5} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-[var(--border)]">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-[14px] text-[var(--ink-35)] hover:bg-[var(--shell)]">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
          <button onClick={() => setSidebarOpen(true)} className="text-[var(--ink-60)] hover:text-[var(--ink)]">
            <Menu size={22} />
          </button>
          <Logo size={22} variant="wordmark" />
        </div>

        <main className="flex-1 p-4 md:p-8 overflow-auto" key={activeTab}>
        <div className="tab-fade-in">
        {/* Summary Tab */}
        {activeTab === 'summary' && campaign && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h1 className="text-[24px] font-bold text-[var(--ink)]" style={{ letterSpacing: '-0.4px' }}>{campaign.title}</h1>
              <StatusBadge status={campaign.status} />
            </div>

            {/* Dates */}
            <div className="flex gap-4 text-[13px] text-[var(--ink-35)] mb-6">
              <span>Opens: {fmtDate(campaign.open_date)}</span>
              <span>Deadline: {fmtDate(campaign.expression_deadline)}</span>
              <span>Content due: {fmtDate(campaign.content_deadline)}</span>
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
                <div key={s.label} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-4 text-center">
                  <p className="text-[24px] font-bold text-[var(--ink)]">{s.value}</p>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)]">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Campaign brief */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-6">
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-pill)] border border-[var(--border)] text-[var(--ink)] font-semibold text-[14px] hover:bg-[var(--shell)]">
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
          return (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-[24px] font-bold text-[var(--ink)]" style={{ letterSpacing: '-0.4px' }}>Selection</h1>
              <span className="text-[14px] text-[var(--ink-35)]">{filteredApps.length} applicant{filteredApps.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Filters + bulk actions */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
                className="px-3 py-2 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[13px] text-[var(--ink)]">
                <option value="all">All levels</option>
                {[1,2,3,4,5,6].map(l => <option key={l} value={l}>Level {l}+</option>)}
              </select>
              <button onClick={toggleAll}
                className="px-3 py-2 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[13px] text-[var(--ink-60)] hover:bg-[var(--shell)]">
                {selectedCreators.size === filteredApps.length && filteredApps.length > 0 ? 'Deselect all' : 'Select all'}
              </button>
              {selectedCreators.size > 0 && (
                <span className="text-[13px] text-[var(--terra)] font-medium">{selectedCreators.size} selected</span>
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
                  <div key={a.id} className={`bg-[var(--card)] border rounded-[var(--r-card)] p-5 hover:shadow-[0_2px_8px_rgba(34,34,34,0.06)] transition-shadow ${selectedCreators.has(a.id) ? 'border-[var(--terra)]' : 'border-[var(--border)]'}`}>
                    {/* Header: checkbox + avatar + name + status */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={selectedCreators.has(a.id)} onChange={() => toggleCreator(a.id)}
                          className="accent-[var(--terra)] w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="w-10 h-10 rounded-full bg-[var(--terra)] flex items-center justify-center flex-shrink-0">
                          <span className="text-[15px] font-bold text-white">{initial}</span>
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
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[11px] font-bold bg-[var(--terra-light)] text-[var(--terra)]">L{a.creators?.level}</span>
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

                    {/* Applied date */}
                    <p className="text-[12px] text-[var(--ink-35)]">Applied {fmtDate(a.applied_at)}</p>
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
              <h1 className="text-[24px] font-bold text-[var(--ink)]" style={{ letterSpacing: '-0.4px' }}>Creator Progress</h1>
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
                  <div key={p.id} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-[var(--terra)] flex items-center justify-center flex-shrink-0">
                        <span className="text-[16px] font-bold text-white">{initial}</span>
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
                        <div className="h-2 bg-[var(--ink-10)] rounded-full overflow-hidden mb-2.5 mt-2">
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
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${s.done ? 'bg-[var(--terra)]' : 'border border-[var(--ink-10)]'}`}>
                                {s.done && <Check size={10} className="text-white" />}
                              </div>
                              <span className={`text-[12px] ${s.done ? 'text-[var(--ink-60)] font-medium' : 'text-[var(--ink-35)]'}`}>{s.label}</span>
                            </div>
                          ))}
                        </div>

                        {/* Data row */}
                        {(p.reach != null || p.reel_url) && (
                          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--ink-10)]">
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
                        )}
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
            <h1 className="text-[24px] font-bold text-[var(--ink)] mb-5" style={{ letterSpacing: '-0.4px' }}>Content</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {participations.filter(p => p.reel_url).map(p => (
                <div key={p.id} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5">
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
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--ink-10)]">
                    <a href={p.reel_url!} target="_blank" rel="noopener noreferrer" download
                      className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--r-sm)] border border-[var(--border)] text-[12px] font-medium text-[var(--ink-60)] hover:bg-[var(--shell)]">
                      Download
                    </a>
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
            <h1 className="text-[24px] font-bold text-[var(--ink)] mb-5" style={{ letterSpacing: '-0.4px' }}>Analytics</h1>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1">Total Reach</p>
                <p className="text-[28px] font-bold text-[var(--ink)]">{totalReach.toLocaleString()}</p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1">Content Pieces</p>
                <p className="text-[28px] font-bold text-[var(--ink)]">{submittedCount}</p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1">Avg Engagement</p>
                <p className="text-[28px] font-bold text-[var(--ink)]">
                  {participations.filter(p => p.reach && p.reach > 0).length > 0
                    ? (participations.reduce((s, p) => s + ((p.likes || 0) + (p.comments || 0)), 0) / Math.max(totalReach, 1) * 100).toFixed(1) + '%'
                    : '—'
                  }
                </p>
                <p className="text-[12px] text-[var(--ink-35)] mt-1">Platform benchmark: 3-4%</p>
              </div>
            </div>

            {/* Reach by creator */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-4">Reach by Creator</p>
              {(() => {
                const withReach = participations.filter(p => p.reach && p.reach > 0);
                const maxReach = Math.max(...withReach.map(p => p.reach!), 1);
                return withReach.length > 0 ? (
                  <div className="space-y-3">
                    {withReach.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-[14px] text-[var(--ink)] w-32 truncate">{p.creators?.display_name || p.creators?.name}</span>
                        <div className="flex-1 h-6 bg-[var(--ink-10)] rounded-[var(--r-sm)] overflow-hidden">
                          <div className="h-full rounded-[var(--r-sm)] bg-[var(--terra)] flex items-center justify-end pr-2 chart-bar-enter"
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
    </div>
  );
}
