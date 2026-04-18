import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendCreatorSelectedEmail } from '../../lib/notifications';
import { getAvatarColors } from '../../lib/avatarColors';
import { getLevelColour } from '../../lib/levels';
import { Check, X, Search, AtSign, ExternalLink, Inbox, LayoutGrid, LayoutList, ChevronRight, Mail, MapPin, Award, Film, Clock } from 'lucide-react';
import Select from '../ui/Select';
import InstagramEmbed from '../InstagramEmbed';
import { deadlineUrgency, fmtCountdown, type DeadlineUrgency } from '../../lib/dates';

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
    expression_deadline: string | null;
    campaign_type?: 'brand' | 'community' | null;
    businesses?: { name: string; category?: string } | null;
  };
}

interface CampaignHistoryItem {
  campaign_id: string;
  status: string;
  applied_at: string;
  campaigns?: { title: string; campaign_type?: 'brand' | 'community' | null; businesses?: { name: string } | null };
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);
  // Per-creator list of active commitments: every application where they're
  // currently selected or confirmed on a campaign that isn't completed.
  // Used to surface "already picked elsewhere" signals so admins can spread
  // opportunity fairly across the creator pool during selection.
  const [commitmentsByCreator, setCommitmentsByCreator] = useState<Record<string, { application_id: string; campaign_id: string; campaign_title: string; brand_name: string }[]>>({});
  const [sortMode, setSortMode] = useState<'applied' | 'unpicked'>('applied');

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => { fetchApplicants(); }, []);

  const fetchApplicants = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('*, creators(id, name, display_name, instagram_handle, email, level, level_name, avatar_url, follower_count, address, total_campaigns, completed_campaigns, completion_rate, instagram_connected), campaigns(id, title, status, creator_target, expression_deadline, campaign_type, businesses(name, category))')
      .order('applied_at', { ascending: false });
    if (data) setApplicants(data as Applicant[]);

    // Also fetch active commitments across the full applications table so
    // each card can show how many other live campaigns a creator is already
    // picked on. Filter to non-completed campaigns client-side so a single
    // creator isn't counted for campaigns that have already wrapped.
    const creatorIds = Array.from(new Set((data || []).map((a: any) => a.creator_id).filter(Boolean)));
    if (creatorIds.length > 0) {
      const { data: cData } = await supabase
        .from('applications')
        .select('id, creator_id, status, campaigns(id, title, status, campaign_type, businesses(name))')
        .in('creator_id', creatorIds)
        .in('status', ['selected', 'confirmed']);
      const next: Record<string, { application_id: string; campaign_id: string; campaign_title: string; brand_name: string }[]> = {};
      ((cData || []) as any[]).forEach(row => {
        if (row.campaigns?.status === 'completed') return;
        if (!next[row.creator_id]) next[row.creator_id] = [];
        next[row.creator_id].push({
          application_id: row.id,
          campaign_id: row.campaigns?.id,
          campaign_title: row.campaigns?.title || 'Untitled',
          brand_name: row.campaigns?.campaign_type === 'community'
            ? 'Nayba Community'
            : (row.campaigns?.businesses?.name || '—'),
        });
      });
      setCommitmentsByCreator(next);
    } else {
      setCommitmentsByCreator({});
    }
    setLoading(false);
  };

  // Active commitments on OTHER campaigns (exclude the current application so
  // a creator who's pending here doesn't count against themselves).
  const getOtherCommitments = (a: Applicant) => {
    const all = commitmentsByCreator[a.creator_id] || [];
    return all.filter(c => c.application_id !== a.id);
  };

  const handleSelect = async (applicant: Applicant) => {
    setActingOn(applicant.id);
    const { error } = await supabase.from('applications').update({
      status: 'selected',
      selected_at: new Date().toISOString(),
    }).eq('id', applicant.id);
    if (error) { showToast('Failed to select'); setActingOn(null); return; }
    // Community campaigns auto-confirm at apply time and don't have a brand
    // selecting/perk to promise — skip the brand-flavoured selection email.
    if (applicant.creators && applicant.campaigns && applicant.campaigns.campaign_type !== 'community') {
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

  const handleBulkSelect = async () => {
    const ids = Array.from(selectedIds);
    const targets = applicants.filter(a => ids.includes(a.id) && a.status === 'interested');
    if (targets.length === 0) return;
    setBulkActing(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('applications')
      .update({ status: 'selected', selected_at: now })
      .in('id', targets.map(t => t.id));
    if (error) { showToast('Bulk select failed'); setBulkActing(false); return; }
    // Fire selection emails in parallel — skip for community campaigns.
    await Promise.all(targets.map(t => {
      if (t.creators && t.campaigns && t.campaigns.campaign_type !== 'community') {
        return sendCreatorSelectedEmail(t.creators.id, {
          campaign_title: t.campaigns.title,
          brand_name: t.campaigns.businesses?.name || '',
          campaign_id: t.campaigns.id,
        }).catch(() => {});
      }
      return Promise.resolve();
    }));
    showToast(`Selected ${targets.length} ${targets.length === 1 ? 'creator' : 'creators'}`);
    clearSelection();
    setBulkActing(false);
    fetchApplicants();
  };

  const handleBulkDecline = async () => {
    const ids = Array.from(selectedIds);
    const targets = applicants.filter(a => ids.includes(a.id) && a.status === 'interested');
    if (targets.length === 0) return;
    setBulkActing(true);
    const { error } = await supabase.from('applications')
      .update({ status: 'declined' })
      .in('id', targets.map(t => t.id));
    if (error) { showToast('Bulk decline failed'); setBulkActing(false); return; }
    showToast(`Declined ${targets.length} ${targets.length === 1 ? 'creator' : 'creators'}`);
    clearSelection();
    setBulkActing(false);
    fetchApplicants();
  };

  const openPeek = async (a: Applicant) => {
    setPeekApplicant(a);
    setPeekHistory([]);
    if (a.creators?.id) {
      const { data } = await supabase
        .from('applications')
        .select('campaign_id, status, applied_at, campaigns(title, campaign_type, businesses(name))')
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
    const brand = (a.campaigns?.campaign_type === 'community' ? 'nayba community' : (a.campaigns?.businesses?.name || '').toLowerCase());
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

  // Sort campaigns in the sidebar by selection urgency first, then pending
  // count. A campaign with one pending applicant at an overdue deadline
  // should surface above a campaign with ten pending but weeks to decide.
  const urgencyRank: Record<DeadlineUrgency, number> = { overdue: 0, today: 1, urgent: 2, soon: 3, none: 4 };
  const campaignList = Object.entries(grouped).sort((a, b) => {
    const ua = a[1].pending > 0 ? urgencyRank[deadlineUrgency(a[1].campaign?.expression_deadline || null)] : 5;
    const ub = b[1].pending > 0 ? urgencyRank[deadlineUrgency(b[1].campaign?.expression_deadline || null)] : 5;
    if (ua !== ub) return ua - ub;
    return b[1].pending - a[1].pending;
  });
  const activeCampaign = activeCampaignId ? grouped[activeCampaignId] : (campaignList[0]?.[1] || null);
  const currentCampaignId = activeCampaignId || campaignList[0]?.[0] || null;

  const totalPending = applicants.filter(a => a.status === 'interested').length;

  // First-timer slot — a soft nudge, not enforced selection. For each
  // campaign we surface one pending applicant who has never completed a
  // campaign so brands don't routinely overlook new creators. Applicants
  // are sorted applied_at DESC, so we take the first match (most recent
  // first-timer). If no pending first-timer exists, the campaign gets no
  // nudge.
  const firstTimerIdByCampaign: Record<string, string> = {};
  for (const a of filtered) {
    if (a.status !== 'interested') continue;
    if ((a.creators?.completed_campaigns || 0) > 0) continue;
    if (!firstTimerIdByCampaign[a.campaign_id]) {
      firstTimerIdByCampaign[a.campaign_id] = a.id;
    }
  }

  // Card component used in both grid and list views
  const ApplicantCard = ({ a, variant }: { a: Applicant; variant: 'grid' | 'list' }) => {
    const name = a.creators?.display_name || a.creators?.name || 'Unknown';
    const handle = (a.creators?.instagram_handle || '').replace('@', '');
    const initial = (name[0] || '?').toUpperCase();
    const colors = getAvatarColors(initial);
    const levelColor = getLevelColour(a.creators?.level || 1);
    const isCommunityEntry = a.campaigns?.campaign_type === 'community';
    const isPending = a.status === 'interested' && !isCommunityEntry;
    const isActing = actingOn === a.id;
    const isSelected = peekApplicant?.id === a.id;
    const isChecked = selectedIds.has(a.id);
    const isFirstTimerSlot = isPending && firstTimerIdByCampaign[a.campaign_id] === a.id;

    const firstTimerTag = isFirstTimerSlot ? (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[11px] font-semibold" style={{ background: 'var(--terra-light)', color: 'var(--terra)' }}
        title="No completed campaigns yet — reserving a slot for a first-timer helps the creator community grow">
        ✦ First-timer pick
      </span>
    ) : null;

    // Active-commitment tag: shows how many OTHER live campaigns the creator
    // is already on the hook for. Helps admins spread selections fairly.
    // Silent at 0 (nothing to flag). Subtle ink colour at 1-2. Terra at 3+
    // so it reads as "heavy load — consider someone else".
    const otherCommitments = getOtherCommitments(a);
    const commitCount = otherCommitments.length;
    const commitmentTag = commitCount > 0 ? (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[11px] font-semibold ${commitCount >= 3 ? '' : ''}`}
        style={commitCount >= 3
          ? { background: 'var(--terra-10)', color: 'var(--terra)' }
          : { background: 'rgba(42,32,24,0.06)', color: 'var(--ink-60)' }}
        title={`Currently selected or confirmed on ${commitCount} other live campaign${commitCount === 1 ? '' : 's'}`}>
        On {commitCount} active
      </span>
    ) : null;

    const Checkbox = isPending ? (
      <span
        onClick={(e) => { e.stopPropagation(); toggleSelected(a.id); }}
        role="checkbox"
        aria-checked={isChecked}
        className={`w-5 h-5 rounded-[5px] border flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${isChecked ? 'bg-[var(--terra)] border-[var(--terra)]' : 'bg-white border-[rgba(42,32,24,0.25)] hover:border-[var(--ink-50)]'}`}
      >
        {isChecked && <Check size={13} className="text-white" strokeWidth={3} />}
      </span>
    ) : null;

    const statusPill = isCommunityEntry ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[11px] font-medium bg-[var(--terra-light)] text-[var(--terra)]">
        <Check size={11} /> Entered
      </span>
    ) : a.status === 'selected' ? (
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
          className={`group relative text-left bg-white rounded-[12px] p-4 transition-all hover:shadow-[0_4px_12px_rgba(42,32,24,0.08)] ${isSelected ? 'ring-2 ring-[var(--terra)]' : isChecked ? 'ring-2 ring-[var(--terra)] ring-opacity-50' : ''} ${!isPending ? 'opacity-70' : ''}`}
          style={{
            boxShadow: isSelected || isChecked ? undefined : '0 1px 4px rgba(42,32,24,0.04)',
            borderLeft: isFirstTimerSlot ? '3px solid var(--terra)' : undefined,
          }}
        >
          {Checkbox && <div className="absolute top-3 right-3">{Checkbox}</div>}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: colors.bg }}>
              {a.creators?.avatar_url ? (
                <img src={a.creators.avatar_url} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[15px] font-semibold" style={{ color: colors.text }}>{initial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{name}</p>
              <p className="text-[12px] text-[var(--ink-50)] truncate">@{handle || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] text-[11px] font-semibold" style={{ background: levelColor.bg, color: levelColor.text }}>
              L{a.creators?.level || 1} {a.creators?.level_name || LEVEL_NAMES[a.creators?.level || 1]}
            </span>
            {firstTimerTag}
            {commitmentTag}
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
        className={`w-full text-left bg-white transition-colors hover:bg-[rgba(42,32,24,0.02)] ${isSelected ? 'bg-[rgba(196,103,74,0.04)]' : isChecked ? 'bg-[rgba(196,103,74,0.03)]' : ''} ${!isPending ? 'opacity-70' : ''}`}
        style={{ borderLeft: isFirstTimerSlot ? '3px solid var(--terra)' : undefined }}
      >
        <div className="px-4 py-4">
          <div className="flex items-start gap-3">
            {Checkbox && <div className="mt-1">{Checkbox}</div>}
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
                {firstTimerTag}
                {commitmentTag}
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
        <div className="w-[200px]">
          <Select value={sortMode} onChange={(v) => setSortMode(v as 'applied' | 'unpicked')} options={[
            { value: 'applied', label: 'Newest first' },
            { value: 'unpicked', label: 'Prioritize unpicked' },
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
                const brandName = group.campaign?.campaign_type === 'community'
                  ? 'Nayba Community'
                  : (group.campaign?.businesses?.name || '—');
                const isActive = campaignId === currentCampaignId;
                const u = group.pending > 0 ? deadlineUrgency(group.campaign?.expression_deadline || null) : 'none';
                const isLoud = u === 'overdue' || u === 'today';
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
                        {u !== 'none' && group.campaign?.expression_deadline && (
                          <p className="text-[11px] font-semibold mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--terra)' }}>
                            <Clock size={10} /> {fmtCountdown(group.campaign.expression_deadline)}
                          </p>
                        )}
                      </div>
                      {group.pending > 0 && (
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[999px] text-[11px] font-bold flex-shrink-0"
                          style={{ background: isLoud ? 'var(--terra)' : 'var(--terra-10)', color: isLoud ? 'white' : 'var(--terra)', minWidth: 20 }}>
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
            {activeCampaign && currentCampaignId && (() => {
              const pendingInCampaign = activeCampaign.items.filter(i => i.status === 'interested' && i.campaigns?.campaign_type !== 'community');
              const selectedInCampaign = pendingInCampaign.filter(i => selectedIds.has(i.id));
              const allPendingSelected = pendingInCampaign.length > 0 && selectedInCampaign.length === pendingInCampaign.length;
              const anySelected = selectedInCampaign.length > 0;
              const toggleSelectAll = () => {
                if (allPendingSelected) {
                  setSelectedIds(prev => { const n = new Set(prev); pendingInCampaign.forEach(p => n.delete(p.id)); return n; });
                } else {
                  setSelectedIds(prev => { const n = new Set(prev); pendingInCampaign.forEach(p => n.add(p.id)); return n; });
                }
              };
              return (
              <div>
                {/* Campaign header — surfaces slots-filled and deadline so
                    admins can see at a glance whether a campaign still
                    needs picks and how much runway is left. */}
                {(() => {
                  const target = activeCampaign.campaign?.creator_target || 0;
                  const selectedSoFar = activeCampaign.items.filter(i =>
                    i.status === 'selected' || i.status === 'confirmed'
                  ).length;
                  const deadline = activeCampaign.campaign?.expression_deadline || null;
                  const u = deadlineUrgency(deadline);
                  const isLoud = u === 'overdue' || u === 'today' || u === 'urgent';
                  return (
                  <div className="bg-white rounded-[12px] px-5 py-4 mb-3" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[18px] font-semibold text-[var(--ink)] truncate">{activeCampaign.campaign?.title}</h2>
                        <p className="text-[13px] text-[var(--ink-50)] mt-0.5">
                          {activeCampaign.campaign?.campaign_type === 'community' ? 'Nayba Community' : activeCampaign.campaign?.businesses?.name}
                          {target > 0 && <> · <span className="font-medium text-[var(--ink)]">{selectedSoFar}/{target}</span> slots filled</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4 flex-wrap justify-end">
                        {deadline && u !== 'none' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[999px] text-[12px] font-semibold"
                            style={{ background: isLoud ? 'var(--terra)' : 'var(--terra-10)', color: isLoud ? 'white' : 'var(--terra)' }}>
                            <Clock size={11} /> {fmtCountdown(deadline)}
                          </span>
                        )}
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
                  </div>
                  );
                })()}

                {/* Bulk action bar — appears when any pending applicant selected */}
                {anySelected && (
                  <div className="bg-[var(--ink)] rounded-[12px] px-4 py-3 mb-3 flex items-center justify-between flex-wrap gap-3 animate-slide-up">
                    <div className="flex items-center gap-3 text-white">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-[6px] bg-white/10 text-[13px] font-semibold">{selectedInCampaign.length}</span>
                      <span className="text-[14px] font-medium">selected</span>
                      <button onClick={toggleSelectAll}
                        className="text-[13px] text-white/70 hover:text-white transition-colors underline-offset-2 hover:underline">
                        {allPendingSelected ? 'Deselect all' : `Select all ${pendingInCampaign.length}`}
                      </button>
                      <button onClick={clearSelection}
                        className="text-[13px] text-white/70 hover:text-white transition-colors">
                        Clear
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleBulkDecline} disabled={bulkActing}
                        className="px-3 py-1.5 rounded-[8px] bg-white/10 text-white text-[13px] font-medium hover:bg-white/15 disabled:opacity-40 transition-colors">
                        Decline {selectedInCampaign.length}
                      </button>
                      <button onClick={handleBulkSelect} disabled={bulkActing}
                        className="px-3 py-1.5 rounded-[8px] bg-[var(--terra)] text-white text-[13px] font-semibold hover:opacity-[0.90] disabled:opacity-40 transition-opacity">
                        {bulkActing ? 'Saving...' : `Select ${selectedInCampaign.length}`}
                      </button>
                    </div>
                  </div>
                )}

                {/* Applicants — sorted either by applied time (default) or
                    by "least already picked" to help spread opportunities
                    across the creator pool. Sort is stable by applied_at
                    within equal commitment counts. */}
                {(() => {
                  const sorted = sortMode === 'unpicked'
                    ? activeCampaign.items.slice().sort((x, y) => {
                        const cx = getOtherCommitments(x).length;
                        const cy = getOtherCommitments(y).length;
                        if (cx !== cy) return cx - cy;
                        return new Date(y.applied_at).getTime() - new Date(x.applied_at).getTime();
                      })
                    : activeCampaign.items;
                  if (sorted.length === 0) return (
                    <div className="bg-white rounded-[12px] p-8 text-center">
                      <p className="text-[14px] text-[var(--ink-50)]">No applicants match the current filter</p>
                    </div>
                  );
                  return viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sorted.map(a => <ApplicantCard key={a.id} a={a} variant="grid" />)}
                    </div>
                  ) : (
                    <div className="bg-white rounded-[12px] overflow-hidden divide-y divide-[rgba(42,32,24,0.06)]" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
                      {sorted.map(a => <ApplicantCard key={a.id} a={a} variant="list" />)}
                    </div>
                  );
                })()}
              </div>
              );
            })()}
          </section>
        </div>
      )}

      {/* Peek panel */}
      {peekApplicant && <ApplicantPeekPanel
        applicant={peekApplicant}
        history={peekHistory}
        activeCommitments={getOtherCommitments(peekApplicant)}
        onClose={() => setPeekApplicant(null)}
        onSelect={() => handleSelect(peekApplicant)}
        onDecline={() => handleDecline(peekApplicant)}
        acting={actingOn === peekApplicant.id}
      />}
    </div>
  );
}

// ─── Applicant Peek Panel ─────────────────────────────────────────────────

function ApplicantPeekPanel({ applicant, history, activeCommitments, onClose, onSelect, onDecline, acting }: {
  applicant: Applicant;
  history: CampaignHistoryItem[];
  activeCommitments: { application_id: string; campaign_id: string; campaign_title: string; brand_name: string }[];
  onClose: () => void;
  onSelect: () => void;
  onDecline: () => void;
  acting: boolean;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);

  // Past reels — fetch lazily on peek open. Helps reviewers judge content
  // quality at a glance instead of clicking out to Instagram per candidate.
  const [pastReels, setPastReels] = useState<{ reel_url: string; campaign_title: string; brand_name: string }[]>([]);
  useEffect(() => {
    if (!applicant.creator_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('participations')
        .select('reel_url, reel_submitted_at, campaigns(title, campaign_type, businesses(name))')
        .eq('creator_id', applicant.creator_id)
        .not('reel_url', 'is', null)
        .order('reel_submitted_at', { ascending: false })
        .limit(3);
      if (cancelled) return;
      setPastReels(((data || []) as any[]).map(r => ({
        reel_url: r.reel_url,
        campaign_title: r.campaigns?.title || 'Untitled',
        brand_name: r.campaigns?.campaign_type === 'community'
          ? 'Nayba Community'
          : (r.campaigns?.businesses?.name || '—'),
      })));
    })();
    return () => { cancelled = true; };
  }, [applicant.creator_id]);

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
            <p className="text-[13px] text-[var(--ink-60)]">{applicant.campaigns?.campaign_type === 'community' ? 'Nayba Community' : applicant.campaigns?.businesses?.name}</p>
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

          {/* Active commitments — which live campaigns is this creator
              already on the hook for. Makes it easy to see whether they're
              getting picked across multiple campaigns at once. */}
          {activeCommitments.length > 0 && (
            <div className="border-t border-[rgba(42,32,24,0.08)] pt-4 mb-5">
              <p className={`${label} mb-2 flex items-center gap-2`}>
                Active on
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[999px] text-[10px] font-bold"
                  style={{ background: activeCommitments.length >= 3 ? 'var(--terra)' : 'var(--terra-10)', color: activeCommitments.length >= 3 ? 'white' : 'var(--terra)', minWidth: 18 }}>
                  {activeCommitments.length}
                </span>
              </p>
              <div className="space-y-1.5">
                {activeCommitments.map(c => (
                  <div key={c.application_id} className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-[var(--terra)] mt-[7px] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--ink)] truncate">{c.campaign_title}</p>
                      <p className="text-[11px] text-[var(--ink-50)]">{c.brand_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                        {h.campaigns?.campaign_type === 'community' ? 'Nayba Community' : h.campaigns?.businesses?.name} · <span className="capitalize">{h.status}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past reels — embedded so reviewers can judge content quality
              without leaving the panel. Hidden when there are none. */}
          {pastReels.length > 0 && (
            <div className="border-t border-[rgba(42,32,24,0.08)] pt-4 mt-4">
              <p className={`${label} mb-3`}>Past reels</p>
              <div className="space-y-3">
                {pastReels.map((r, i) => (
                  <div key={i}>
                    <p className="text-[12px] text-[var(--ink-50)] mb-1.5 truncate">
                      Submitted for <span className="text-[var(--ink-60)] font-medium">{r.campaign_title}</span> · {r.brand_name}
                    </p>
                    <InstagramEmbed url={r.reel_url} height={420} />
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
