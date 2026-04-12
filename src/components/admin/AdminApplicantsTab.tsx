import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendCreatorSelectedEmail } from '../../lib/notifications';
import { getAvatarColors } from '../../lib/avatarColors';
import { getLevelColour } from '../../lib/levels';
import { Check, X, Search, AtSign, ExternalLink, Inbox } from 'lucide-react';
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
    level: number;
    level_name: string | null;
    avatar_url: string | null;
  };
  campaigns?: {
    id: string;
    title: string;
    status: string;
    businesses?: { name: string };
  };
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
  const [toast, setToast] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => { fetchApplicants(); }, []);

  const fetchApplicants = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('*, creators(id, name, display_name, instagram_handle, level, level_name, avatar_url), campaigns(id, title, status, businesses(name))')
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
    // Fire selection email
    if (applicant.creators && applicant.campaigns) {
      sendCreatorSelectedEmail(applicant.creators.id, {
        campaign_title: applicant.campaigns.title,
        brand_name: applicant.campaigns.businesses?.name || '',
        campaign_id: applicant.campaigns.id,
      }).catch(() => {});
    }
    showToast('Creator selected — they need to confirm');
    setActingOn(null);
    fetchApplicants();
  };

  const handleDecline = async (applicant: Applicant) => {
    setActingOn(applicant.id);
    const { error } = await supabase.from('applications').update({
      status: 'declined',
    }).eq('id', applicant.id);
    if (error) { showToast('Failed to decline'); setActingOn(null); return; }
    showToast('Creator declined');
    setActingOn(null);
    fetchApplicants();
  };

  // Filter
  const filtered = applicants.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (a.creators?.display_name || a.creators?.name || '').toLowerCase();
      const insta = (a.creators?.instagram_handle || '').toLowerCase();
      const title = (a.campaigns?.title || '').toLowerCase();
      const brand = (a.campaigns?.businesses?.name || '').toLowerCase();
      if (!name.includes(q) && !insta.includes(q) && !title.includes(q) && !brand.includes(q)) return false;
    }
    return true;
  });

  // Group by campaign
  const grouped = filtered.reduce<Record<string, { campaign: Applicant['campaigns']; items: Applicant[] }>>((acc, a) => {
    const key = a.campaign_id;
    if (!acc[key]) acc[key] = { campaign: a.campaigns, items: [] };
    acc[key].items.push(a);
    return acc;
  }, {});

  const pendingCount = applicants.filter(a => a.status === 'interested').length;

  return (
    <div>
      {toast && (
        <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[999px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>{toast}</div>
      )}

      {/* Header row */}
      <div className="mb-4">
        <p className="text-[14px] text-[var(--ink-60)]">
          {pendingCount > 0 ? (
            <><span className="font-semibold text-[var(--terra)]">{pendingCount}</span> {pendingCount === 1 ? 'creator' : 'creators'} waiting for review</>
          ) : (
            'No pending reviews'
          )}
        </p>
      </div>

      {/* Toolbar */}
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

      {/* Empty state */}
      {loading ? (
        <div className="bg-white rounded-[12px] p-12 text-center">
          <p className="text-[14px] text-[var(--ink-50)]">Loading applicants...</p>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
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
        <div className="space-y-6">
          {Object.entries(grouped).map(([campaignId, group]) => {
            const brandName = group.campaign?.businesses?.name || '—';
            const brandInitial = (brandName[0] || '?').toUpperCase();
            const avatarColors = getAvatarColors(brandInitial);
            const groupPending = group.items.filter(i => i.status === 'interested').length;
            return (
              <div key={campaignId} className="bg-white rounded-[12px] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
                {/* Campaign header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.06)]">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: avatarColors.bg }}>
                      <span className="text-[13px] font-semibold" style={{ color: avatarColors.text }}>{brandInitial}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[var(--ink)] truncate">{group.campaign?.title || 'Untitled campaign'}</p>
                      <p className="text-[13px] text-[var(--ink-50)]">{brandName}</p>
                    </div>
                  </div>
                  {groupPending > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-[999px] text-[12px] font-semibold flex-shrink-0 ml-3" style={{ background: 'var(--terra-10)', color: 'var(--terra)' }}>
                      {groupPending} pending
                    </span>
                  )}
                </div>

                {/* Applicants */}
                <div>
                  {group.items.map((a, idx) => {
                    const name = a.creators?.display_name || a.creators?.name || 'Unknown';
                    const handle = (a.creators?.instagram_handle || '').replace('@', '');
                    const initial = (name[0] || '?').toUpperCase();
                    const colors = getAvatarColors(initial);
                    const levelColor = getLevelColour(a.creators?.level || 1);
                    const isPending = a.status === 'interested';
                    const isActing = actingOn === a.id;
                    return (
                      <div key={a.id} className={`px-5 py-4 ${idx > 0 ? 'border-t border-[rgba(42,32,24,0.06)]' : ''} ${!isPending ? 'opacity-70' : ''}`}>
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: colors.bg }}>
                            {a.creators?.avatar_url ? (
                              <img src={a.creators.avatar_url} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[14px] font-semibold" style={{ color: colors.text }}>{initial}</span>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[14px] font-semibold text-[var(--ink)]">{name}</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] text-[11px] font-semibold" style={{ background: levelColor.bg, color: levelColor.text }}>
                                L{a.creators?.level || 1} {a.creators?.level_name || LEVEL_NAMES[a.creators?.level || 1]}
                              </span>
                              {a.status === 'selected' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[11px] font-medium" style={{ background: 'rgba(122,148,120,0.12)', color: 'var(--sage)' }}>
                                  <Check size={11} /> Selected
                                </span>
                              )}
                              {a.status === 'confirmed' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[11px] font-medium" style={{ background: 'rgba(140,122,170,0.12)', color: 'var(--violet)' }}>
                                  <Check size={11} /> Confirmed
                                </span>
                              )}
                              {a.status === 'declined' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[11px] font-medium bg-[rgba(42,32,24,0.06)] text-[var(--ink-50)]">
                                  Declined
                                </span>
                              )}
                            </div>
                            {handle && (
                              <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[13px] text-[var(--ink-50)] hover:text-[var(--terra)] transition-colors mb-2">
                                <AtSign size={12} />{handle} <ExternalLink size={10} />
                              </a>
                            )}
                            {a.pitch && (
                              <div className="bg-[var(--stone)] rounded-[10px] px-3 py-2.5 mt-1 mb-2">
                                <p className="text-[13px] text-[var(--ink)] leading-[1.5] italic">"{a.pitch}"</p>
                              </div>
                            )}
                            <p className="text-[12px] text-[var(--ink-35)]">Applied {timeAgo(a.applied_at)}</p>
                          </div>

                          {/* Actions */}
                          {isPending && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleDecline(a)}
                                disabled={isActing}
                                className="px-3 py-2 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink-60)] text-[13px] font-medium hover:bg-[rgba(42,32,24,0.02)] disabled:opacity-40 transition-colors"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => handleSelect(a)}
                                disabled={isActing}
                                className="px-3 py-2 rounded-[10px] bg-[var(--terra)] text-white text-[13px] font-semibold hover:opacity-[0.85] disabled:opacity-40 transition-opacity"
                              >
                                {isActing ? '...' : 'Select'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
