import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendCreatorSelectedEmail } from '../../lib/notifications';
import { getAvatarColors } from '../../lib/avatarColors';
import { getLevelColour } from '../../lib/levels';
import { Check, X, Search, AtSign, ExternalLink, Inbox, LayoutGrid, LayoutList, ChevronRight, Mail, MapPin, Award, Film } from 'lucide-react';
import Select from '../ui/Select';

interface Applicant {
  id: string;
  campaign_id: string;
  creator_id: string;
  pitch: string | null;
  status: string;
  applied_at: string;
  selected_at: string | null;
  creators?: {
    id: string;
    name: string;
    display_name: string | null;
    instagram_handle: string;
    email: string;
    level: number;
    level_name: string | null;
    avatar_url: string | null;
    follower_count: string | null;
    address: string | null;
    total_campaigns: number;
    completed_campaigns: number;
    completion_rate: number;
    instagram_connected: boolean;
  };
  campaigns?: {
    id: string;
    title: string;
    status: string;
    creator_target: number;
    businesses?: { name: string; category?: string };
  };
}

interface CampaignHistoryItem {
  campaign_id: string;
  status: string;
  applied_at: string;
  campaigns?: { title: string; businesses?: { name: string } };
}

const LEVEL_NAMES: Record<number, string> = { 1: 'Newcomer', 2: 'Explorer', 3: 'Regular', 4: 'Local', 5: 'Trusted' };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function AdminApplicantsTab() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('interested');
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [toast, setToast] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [peekApplicant, setPeekApplicant] = useState<Applicant | null>(null);
  const [peekHistory, setPeekHistory] = useState<CampaignHistoryItem[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => { fetchApplicants(); }, []);

  const fetchApplicants = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('*, creators(id, name, display_name, instagram_handle, email, level, level_name, avatar_url, follower_count, address, total_campaigns, completed_campaigns, completion_rate, instagram_connected), campaigns(id, title, status, creator_target, businesses(name, category))')
      .order('applied_at', { ascending: false });
    if (data) setApplicants(data as Applicant[]);
    setLoading(false);
  };

  const handleSelect = async (applicant: Applicant) => {
    setActingOn(applicant.id);
    const { error } = await supabase.from('applications').update({
      status: 'selected',
      selected_at: new Date().toISOString(),
    }).eq('id', applicant.id);
    if (error) { showToast('Failed to select'); setActingOn(null); return; }
    if (applicant.creators && applicant.campaigns) {
      sendCreatorSelectedEmail(applicant.creators.id, {
        campaign_title: applicant.campaigns.title,
        brand_name: applicant.campaigns.businesses?.name || '',
        campaign_id: applicant.campaigns.id,
      }).catch(() => {});
    }
    showToast('Creator selected — they need to confirm');
    setActingOn(null);
    if (peekApplicant?.id === applicant.id) setPeekApplicant(null);
    fetchApplicants();
  };

  const handleDecline = async (applicant: Applicant) => {
    setActingOn(applicant.id);
    const { error } = await supabase.from('applications').update({ status: 'declined' }).eq('id', applicant.id);
    if (error) { showToast('Failed to decline'); setActingOn(null); return; }
    showToast('Creator declined');
    setActingOn(null);
    if (peekApplicant?.id === applicant.id) setPeekApplicant(null);
    fetchApplicants();
  };

  const openPeek = async (a: Applicant) => {
    setPeekApplicant(a);
    setPeekHistory([]);
    if (a.creators?.id) {
      const { data } = await supabase
        .from('applications')
        .select('campaign_id, status, applied_at, campaigns(title, businesses(name))')
        .eq('creator_id', a.creators.id)
        .neq('id', a.id)
        .order('applied_at', { ascending: false })
        .limit(5);
      if (data) setPeekHistory(data as any);
    }
  };

  // Apply search across all applicants
  const searched = applicants.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (a.creators?.display_name || a.creators?.name || '').toLowerCase();
    const insta = (a.creators?.instagram_handle || '').toLowerCase();
    const title = (a.campaigns?.title || '').toLowerCase();
    const brand = (a.campaigns?.businesses?.name || '').toLowerCase();
    return name.includes(q) || insta.includes(q) || title.includes(q) || brand.includes(q);
  });

  // Apply status filter
  const filtered = searched.filter(a => statusFilter === 'all' || a.status === statusFilter);

  // Group by campaign
  const grouped = filtered.reduce<Record<string, { campaign: Applicant['campaigns']; items: Applicant[]; pending: number }>>((acc, a) => {
    const key = a.campaign_id;
    if (!acc[key]) acc[key] = { campaign: a.campaigns, items: [], pending: 0 };
    acc[key].items.push(a);
    if (a.status === 'interested') acc[key].pending += 1;
    return acc;
  }, {});

  const campaignList = Object.entries(grouped).sort((a, b) => b[1].pending - a[1].pending);
  const activeCampaign = activeCampaignId ? grouped[activeCampaignId] : (campaignList[0]?.[1] || null);
  const currentCampaignId = activeCampaignId || campaignList[0]?.[0] || null;

  const totalPending = applicants.filter(a => a.status === 'interested').length;

  // Card component used in both grid and list views
  const ApplicantCard = ({ a, variant }: { a: Applicant; variant: 'grid' | 'list' }) => {
    const name = a.creators?.display_name || a.creators?.name || 'Unknown';
    const handle = (a.creators?.instagram_handle || '').replace('@', '');
    const initial = (name[0] || '?').toUpperCase();
    const colors = getAvatarColors(initial);
    const levelColor = getLevelColour(a.creators?.level || 1);
    const isPending = a.status === 'interested';
    const isActing = actingOn === a.id;
    const isSelected = peekApplicant?.id === a.id;

    const statusPill = a.status === 'selected' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[11px] font-medium" style={{ background: 'rgba(122,148,120,0.12)', color: 'var(--sage)' }}>
        <Check size={11} /> Selected
      </span>
    ) : a.status === 'confirmed' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[11px] font-medium" style={{ background: 'rgba(140,122,170,0.12)', color: 'var(--violet)' }}>
        <Check size={11} /> Confirmed
      </span>
    ) : a.status === 'declined' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[11px] font-medium bg-[rgba(42,32,24,0.06)] text-[var(--ink-50)]">
        Declined
      </span>
    ) : null;

    if (variant === 'grid') {
      return (
        <button
          onClick={() => openPeek(a)}
          className={`group text-left bg-white rounded-[12px] p-4 transition-all hover:shadow-[0_4px_12px_rgba(42,32,24,0.08)] ${isSelected ? 'ring-2 ring-[var(--terra)]' : ''} ${!isPending ? 'opacity-70' : ''}`}
          style={{ boxShadow: isSelected ? undefined : '0 1px 4px rgba(42,32,24,0.04)' }}
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: colors.bg }}>
              {a.creators?.avatar_url ? (
                <img src={a.creators.avatar_url} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[15px] font-semibold" style={{ color: colors.text }}>{initial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{name}</p>
              <p className="text-[12px] text-[var(--ink-50)] truncate">@{handle || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] text-[11px] font-semibold" style={{ background: levelColor.bg, color: levelColor.text }}>
              L{a.creators?.level || 1} {a.creators?.level_name || LEVEL_NAMES[a.creators?.level || 1]}
            </span>
            {statusPill}
          </div>
          {a.pitch ? (
            <p className="text-[12px] text-[var(--ink-60)] italic leading-[1.5] line-clamp-3 mb-3 min-h-[54px]">"{a.pitch}"</p>
          ) : (
            <p className="text-[12px] text-[var(--ink-35)] italic mb-3 min-h-[54px]">No pitch provided</p>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-[rgba(42,32,24,0.06)]">
            <span className="text-[11px] text-[var(--ink-35)]">{timeAgo(a.applied_at)}</span>
            {isPending ? (
              <div className="flex items-center gap-1.5">
                <span onClick={(e) => { e.stopPropagation(); handleDecline(a); }} role="button" aria-disabled={isActing}
                  className={`px-2.5 py-1 rounded-[8px] border border-[rgba(42,32,24,0.15)] text-[var(--ink-60)] text-[12px] font-medium hover:bg-[rgba(42,32,24,0.02)] ${isActing ? 'opacity-40 pointer-events-none' : ''}`}>
                  Decline
                </span>
                <span onClick={(e) => { e.stopPropagation(); handleSelect(a); }} role="button" aria-disabled={isActing}
                  className={`px-2.5 py-1 rounded-[8px] bg-[var(--terra)] text-white text-[12px] font-semibold hover:opacity-[0.85] ${isActing ? 'opacity-40 pointer-events-none' : ''}`}>
                  Select
                </span>
              </div>
            ) : (
              <ChevronRight size={14} className="text-[var(--ink-35)]" />
            )}
          </div>
        </button>
      );
    }

    // List variant
    return (
      <button
        onClick={() => openPeek(a)}
        className={`w-full text-left bg-white transition-colors hover:bg-[rgba(42,32,24,0.02)] ${isSelected ? 'bg-[rgba(196,103,74,0.04)]' : ''} ${!isPending ? 'opacity-70' : ''}`}
      >
        <div className="px-4 py-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: colors.bg }}>
              {a.creators?.avatar_url ? (
                <img src={a.creators.avatar_url} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[14px] font-semibold" style={{ color: colors.text }}>{initial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[14px] font-semibold text-[var(--ink)]">{name}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] text-[11px] font-semibold" style={{ background: levelColor.bg, color: levelColor.text }}>
                  L{a.creators?.level || 1} {a.creators?.level_name || LEVEL_NAMES[a.creators?.level || 1]}
                </span>
                {statusPill}
              </div>
              {handle && (
                <span className="inline-flex items-center gap-1 text-[13px] text-[var(--ink-50)] mb-2">
                  <AtSign size={12} />{handle}
                </span>
              )}
              {a.pitch && (
                <div className="bg-[var(--stone)] rounded-[10px] px-3 py-2.5 mt-1 mb-2">
                  <p className="text-[13px] text-[var(--ink)] leading-[1.5] italic">"{a.pitch}"</p>
                </div>
              )}
              <p className="text-[12px] text-[var(--ink-35)]">Applied {timeAgo(a.applied_at)}</p>
            </div>
            {isPending && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span onClick={(e) => { e.stopPropagation(); handleDecline(a); }} role="button" aria-disabled={isActing}
                  className={`px-3 py-2 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink-60)] text-[13px] font-medium hover:bg-[rgba(42,32,24,0.02)] ${isActing ? 'opacity-40 pointer-events-none' : ''}`}>
                  Decline
                </span>
                <span onClick={(e) => { e.stopPropagation(); handleSelect(a); }} role="button" aria-disabled={isActing}
                  className={`px-3 py-2 rounded-[10px] bg-[var(--terra)] text-white text-[13px] font-semibold hover:opacity-[0.85] ${isActing ? 'opacity-40 pointer-events-none' : ''}`}>
                  {isActing ? '...' : 'Select'}
                </span>
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div>
      {toast && (
        <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[999px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>{toast}</div>
      )}

      {/* Header: pending summary + search + filter */}
      <div className="mb-4">
        <p className="text-[14px] text-[var(--ink-60)]">
          {totalPending > 0 ? (
            <><span className="font-semibold text-[var(--terra)]">{totalPending}</span> {totalPending === 1 ? 'creator' : 'creators'} waiting for review</>
          ) : (
            'No pending reviews'
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-50)]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by creator, Instagram, or campaign..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[14px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)]" />
        </div>
        <div className="w-[180px]">
          <Select value={statusFilter} onChange={setStatusFilter} options={[
            { value: 'interested', label: 'Pending review' },
            { value: 'selected', label: 'Selected' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'declined', label: 'Declined' },
            { value: 'all', label: 'All applicants' },
          ]} />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-[12px] p-12 text-center">
          <p className="text-[14px] text-[var(--ink-50)]">Loading applicants...</p>
        </div>
      ) : campaignList.length === 0 ? (
        <div className="bg-white rounded-[12px] p-12 text-center">
          <div className="w-12 h-12 rounded-[12px] flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(42,32,24,0.04)' }}>
            <Inbox size={22} className="text-[var(--ink-35)]" />
          </div>
          <p className="text-[17px] font-semibold text-[var(--ink)] mb-1">
            {statusFilter === 'interested' ? 'No pending applicants' : 'No applicants match'}
          </p>
          <p className="text-[14px] text-[var(--ink-60)]">
            {statusFilter === 'interested' ? "You're all caught up — check back later" : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
          {/* Campaign sidebar */}
          <aside className="bg-white rounded-[12px] overflow-hidden self-start" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
            <div className="px-3 py-2.5 border-b border-[rgba(42,32,24,0.06)]">
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', color: 'var(--ink-60)', textTransform: 'uppercase' }}>Campaigns</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {campaignList.map(([campaignId, group]) => {
                const brandName = group.campaign?.businesses?.name || '—';
                const isActive = campaignId === currentCampaignId;
                return (
                  <button
                    key={campaignId}
                    onClick={() => setActiveCampaignId(campaignId)}
                    className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${isActive ? 'bg-[rgba(196,103,74,0.06)] border-l-[var(--terra)]' : 'border-l-transparent hover:bg-[rgba(42,32,24,0.02)]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] truncate ${isActive ? 'font-semibold text-[var(--ink)]' : 'font-medium text-[var(--ink-60)]'}`}>{group.campaign?.title || 'Untitled'}</p>
                        <p className="text-[11px] text-[var(--ink-50)] truncate">{brandName}</p>
                      </div>
                      {group.pending > 0 && (
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[999px] text-[11px] font-bold flex-shrink-0" style={{ background: 'var(--terra-10)', color: 'var(--terra)', minWidth: 20 }}>
                          {group.pending}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main pane: active campaign's applicants */}
          <section className="min-w-0">
            {activeCampaign && currentCampaignId && (
              <div>
                {/* Campaign header */}
                <div className="bg-white rounded-[12px] px-5 py-4 mb-3 flex items-center justify-between" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[18px] font-semibold text-[var(--ink)] truncate">{activeCampaign.campaign?.title}</h2>
                    <p className="text-[13px] text-[var(--ink-50)] mt-0.5">
                      {activeCampaign.campaign?.businesses?.name} · Target: {activeCampaign.campaign?.creator_target || 0} creators
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    {activeCampaign.pending > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-[999px] text-[12px] font-semibold" style={{ background: 'var(--terra-10)', color: 'var(--terra)' }}>
                        {activeCampaign.pending} pending
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewMode('grid')}
                        title="Grid view"
                        className="flex items-center justify-center w-8 h-8 rounded-[8px] transition-colors"
                        style={{ background: viewMode === 'grid' ? 'rgba(42,32,24,0.06)' : 'transparent', color: viewMode === 'grid' ? 'var(--ink)' : 'var(--ink-35)' }}>
                        <LayoutGrid size={14} />
                      </button>
                      <button onClick={() => setViewMode('list')}
                        title="List view"
                        className="flex items-center justify-center w-8 h-8 rounded-[8px] transition-colors"
                        style={{ background: viewMode === 'list' ? 'rgba(42,32,24,0.06)' : 'transparent', color: viewMode === 'list' ? 'var(--ink)' : 'var(--ink-35)' }}>
                        <LayoutList size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Applicants */}
                {activeCampaign.items.length === 0 ? (
                  <div className="bg-white rounded-[12px] p-8 text-center">
                    <p className="text-[14px] text-[var(--ink-50)]">No applicants match the current filter</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeCampaign.items.map(a => <ApplicantCard key={a.id} a={a} variant="grid" />)}
                  </div>
                ) : (
                  <div className="bg-white rounded-[12px] overflow-hidden divide-y divide-[rgba(42,32,24,0.06)]" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
                    {activeCampaign.items.map(a => <ApplicantCard key={a.id} a={a} variant="list" />)}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Peek panel */}
      {peekApplicant && <ApplicantPeekPanel
        applicant={peekApplicant}
        history={peekHistory}
        onClose={() => setPeekApplicant(null)}
        onSelect={() => handleSelect(peekApplicant)}
        onDecline={() => handleDecline(peekApplicant)}
        acting={actingOn === peekApplicant.id}
      />}
    </div>
  );
}

// ─── Applicant Peek Panel ─────────────────────────────────────────────────

function ApplicantPeekPanel({ applicant, history, onClose, onSelect, onDecline, acting }: {
  applicant: Applicant;
  history: CampaignHistoryItem[];
  onClose: () => void;
  onSelect: () => void;
  onDecline: () => void;
  acting: boolean;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);

  const c = applicant.creators;
  const name = c?.display_name || c?.name || 'Unknown';
  const handle = (c?.instagram_handle || '').replace('@', '');
  const initial = (name[0] || '?').toUpperCase();
  const colors = getAvatarColors(initial);
  const levelColor = getLevelColour(c?.level || 1);
  const label = "text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1";
  const isPending = applicant.status === 'interested';

  return (
    <>
      <div className="fixed inset-0 z-40 animate-overlay" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-white border-l border-[rgba(42,32,24,0.08)] flex flex-col animate-slide-in-right" style={{ boxShadow: '-4px 0 24px rgba(42,32,24,0.10)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: colors.bg }}>
              {c?.avatar_url ? (
                <img src={c.avatar_url} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[15px] font-semibold" style={{ color: colors.text }}>{initial}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-[var(--ink)] truncate">{name}</p>
              {handle && <p className="text-[13px] text-[var(--ink-50)]">@{handle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[var(--ink-50)] hover:bg-[rgba(42,32,24,0.06)] transition-colors flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Level + status */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-[12px] font-semibold" style={{ background: levelColor.bg, color: levelColor.text }}>
              L{c?.level || 1} — {c?.level_name || LEVEL_NAMES[c?.level || 1]}
            </span>
            {applicant.status === 'selected' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[12px] font-medium" style={{ background: 'rgba(122,148,120,0.12)', color: 'var(--sage)' }}>
                <Check size={12} /> Selected
              </span>
            )}
            {applicant.status === 'confirmed' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[12px] font-medium" style={{ background: 'rgba(140,122,170,0.12)', color: 'var(--violet)' }}>
                <Check size={12} /> Confirmed
              </span>
            )}
            {applicant.status === 'declined' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-[999px] text-[12px] font-medium bg-[rgba(42,32,24,0.06)] text-[var(--ink-50)]">
                Declined
              </span>
            )}
          </div>

          {/* Applying to */}
          <div className="bg-[var(--stone)] rounded-[10px] p-3 mb-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-50)] mb-1">Applying to</p>
            <p className="text-[14px] font-semibold text-[var(--ink)]">{applicant.campaigns?.title}</p>
            <p className="text-[13px] text-[var(--ink-60)]">{applicant.campaigns?.businesses?.name}</p>
          </div>

          {/* Pitch */}
          <div className="mb-5">
            <p className={label}>Pitch</p>
            {applicant.pitch ? (
              <p className="text-[14px] text-[var(--ink)] italic leading-[1.6]">"{applicant.pitch}"</p>
            ) : (
              <p className="text-[14px] text-[var(--ink-35)] italic">No pitch provided</p>
            )}
            <p className="text-[12px] text-[var(--ink-35)] mt-2">Applied {timeAgo(applicant.applied_at)}</p>
          </div>

          {/* Performance stats */}
          <div className="border-t border-[rgba(42,32,24,0.08)] pt-4 mb-5">
            <p className={`${label} mb-3`}>Performance</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[rgba(42,32,24,0.02)] rounded-[10px] px-3 py-2.5">
                <p className="text-[20px] font-semibold text-[var(--ink)]">{c?.completed_campaigns || 0}/{c?.total_campaigns || 0}</p>
                <p className="text-[12px] text-[var(--ink-50)] font-medium">Campaigns</p>
              </div>
              <div className="bg-[rgba(42,32,24,0.02)] rounded-[10px] px-3 py-2.5">
                <p className="text-[20px] font-semibold text-[var(--ink)]">{(c?.total_campaigns || 0) > 0 ? `${c?.completion_rate || 0}%` : '—'}</p>
                <p className="text-[12px] text-[var(--ink-50)] font-medium">Completion</p>
              </div>
            </div>
          </div>

          {/* Contact + location */}
          <div className="border-t border-[rgba(42,32,24,0.08)] pt-4 mb-5 space-y-3">
            {c?.email && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[var(--ink-35)] flex-shrink-0" />
                <a href={`mailto:${c.email}`} className="text-[13px] text-[var(--ink-60)] hover:text-[var(--terra)] truncate">{c.email}</a>
              </div>
            )}
            {handle && (
              <div className="flex items-center gap-2">
                <AtSign size={14} className="text-[var(--ink-35)] flex-shrink-0" />
                <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] text-[var(--terra)] font-medium hover:underline">
                  {handle} <ExternalLink size={11} />
                </a>
                {c?.follower_count && (
                  <span className="text-[13px] text-[var(--ink-50)]">· {c.follower_count} followers</span>
                )}
              </div>
            )}
            {c?.address && (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-[var(--ink-35)] flex-shrink-0" />
                <span className="text-[13px] text-[var(--ink-60)]">{c.address}</span>
              </div>
            )}
            {c?.instagram_connected && (
              <div className="flex items-center gap-2">
                <Award size={14} className="text-[var(--sage)] flex-shrink-0" />
                <span className="text-[13px] text-[var(--ink-60)]">Instagram connected</span>
              </div>
            )}
          </div>

          {/* Campaign history */}
          {history.length > 0 && (
            <div className="border-t border-[rgba(42,32,24,0.08)] pt-4">
              <p className={`${label} mb-3`}>Recent campaigns</p>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.campaign_id} className="flex items-start gap-2">
                    <Film size={12} className="text-[var(--ink-35)] flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--ink)] truncate">{h.campaigns?.title || 'Untitled'}</p>
                      <p className="text-[11px] text-[var(--ink-50)]">
                        {h.campaigns?.businesses?.name} · <span className="capitalize">{h.status}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {isPending && (
          <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0 flex gap-2">
            <button onClick={onDecline} disabled={acting}
              className="flex-1 px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] font-semibold hover:bg-[rgba(42,32,24,0.02)] disabled:opacity-40">
              Decline
            </button>
            <button onClick={onSelect} disabled={acting}
              className="flex-1 px-4 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] font-semibold hover:opacity-[0.85] disabled:opacity-40">
              {acting ? 'Saving...' : 'Select creator'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
