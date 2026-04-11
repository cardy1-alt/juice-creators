import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendCreatorApprovedEmail, sendCreatorDeniedEmail } from '../../lib/notifications';
import { getAvatarColors } from '../../lib/avatarColors';
import { getLevelColour } from '../../lib/levels';
import { Check, X, Eye, EyeOff, AlertCircle, ChevronRight, ExternalLink, CheckCircle2, XCircle, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Creator {
  id: string; name: string; display_name: string | null; instagram_handle: string;
  email: string; approved: boolean; level: number; level_name: string;
  completion_rate: number; total_campaigns: number; completed_campaigns: number;
  instagram_connected: boolean; address: string | null; created_at: string;
  follower_count: string | null;
}

const LEVEL_NAMES: Record<number, string> = { 1: 'Newcomer', 2: 'Explorer', 3: 'Regular', 4: 'Local', 5: 'Trusted' };

const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-50)] font-['Instrument_Sans']";
const labelCls = "block text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1.5";
const thCls = "text-left text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] py-[10px] px-4 bg-[rgba(42,32,24,0.02)]";
const tdCls = "py-0 px-4 text-[14px] text-[var(--ink)] border-b border-[rgba(42,32,24,0.06)]";


function normalizeInstagram(raw: string): string {
  if (!raw) return '';
  return raw.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Create Creator Modal ───
function CreateCreatorModal({ onClose, onCreated, showToast }: { onClose: () => void; onCreated: () => void; showToast: (msg: string) => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const [form, setForm] = useState({ displayName: '', email: '', instagram: '', city: '', level: '1', followers: '' });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName || !form.email) return;
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) { setError('Please enter a valid email address'); return; }

    setCreating(true);

    // Invite user via edge function — sends "set your password" email
    const { data: inviteData, error: inviteErr } = await supabase.functions.invoke('invite-brand', {
      body: { email: form.email, role: 'creator' },
    });
    if (inviteErr) {
      setError('Failed to create account — ' + inviteErr.message);
      setCreating(false);
      return;
    }
    const userId = inviteData?.userId;
    if (!userId) { setError('Failed to create account — no user ID returned'); setCreating(false); return; }

    const level = parseInt(form.level) || 1;
    const handle = normalizeInstagram(form.instagram);

    const { error: insertErr } = await supabase.from('creators').insert({
      id: userId, name: form.displayName, display_name: form.displayName,
      email: form.email, instagram_handle: handle || '',
      address: form.city || null, level,
      level_name: LEVEL_NAMES[level] || 'Newcomer',
      follower_count: form.followers || null,
      approved: true, onboarding_complete: true, profile_complete: true,
    });
    if (insertErr) { setError('Account created but profile save failed — ' + insertErr.message); setCreating(false); return; }

    setCreated(true);
    setCreating(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(42,32,24,0.40)]" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] w-full max-w-[640px] mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>
        <div className="flex items-center justify-between px-4 md:px-6 py-5 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <h2 className="text-[20px] font-semibold text-[var(--ink)]">Create Creator</h2>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-full bg-[rgba(42,32,24,0.02)] flex items-center justify-center text-[var(--ink-50)] hover:bg-[#EDE9E3]"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          {created ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(45,122,79,0.08)] flex items-center justify-center mx-auto mb-3">
                <Check size={22} className="text-[#2D7A4F]" />
              </div>
              <p className="text-[16px] font-semibold text-[var(--ink)] mb-2">Account created</p>
              <p className="text-[14px] text-[var(--ink-60)] mb-1">{form.displayName} will receive an email to set their password.</p>
              <p className="text-[13px] text-[var(--ink-35)]">{form.email}</p>
              <div className="mt-5">
                <button onClick={onClose} className="px-5 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[14px] font-semibold">Done</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-[var(--ink-50)] mb-5 leading-[1.6]">
                The creator will receive an email to set their own password and sign in.
              </p>
              {error && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] mb-4" style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626' }}>
                  <AlertCircle size={14} />
                  <span className="text-[14px] font-medium">{error}</span>
                </div>
              )}
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Display Name *</label><input value={form.displayName} onChange={e => { setForm(p => ({ ...p, displayName: e.target.value })); setError(''); }} className={inputCls} required /></div>
                <div><label className={labelCls}>Email *</label><input type="email" value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setError(''); }} className={inputCls} required /></div>
                <div><label className={labelCls}>Instagram Handle</label><input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} className={inputCls} placeholder="@handle" /></div>
                <div><label className={labelCls}>County</label><select value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputCls}><option value="">Select county</option><option value="Suffolk">Suffolk</option><option value="Norfolk">Norfolk</option><option value="Cambridgeshire">Cambridgeshire</option><option value="Essex">Essex</option></select></div>
                <div>
                  <label className={labelCls}>Follower Count</label>
                  <select value={form.followers} onChange={e => setForm(p => ({ ...p, followers: e.target.value }))} className={inputCls}>
                    <option value="">Select range</option>
                    <option value="0-1k">0 – 1,000</option>
                    <option value="1k-5k">1,000 – 5,000</option>
                    <option value="5k-10k">5,000 – 10,000</option>
                    <option value="10k+">10,000+</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Starting Level</label>
                  <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))} className={inputCls}>
                    <option value="1">1 — Newcomer</option><option value="2">2 — Explorer</option>
                    <option value="3">3 — Regular</option><option value="4">4 — Local</option><option value="5">5 — Trusted</option>
                  </select>
                </div>
              </form>
            </>
          )}
        </div>
        {!created && (
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0">
            <button onClick={onClose} className="text-[14px] font-medium text-[var(--ink-60)] hover:text-[var(--ink)]">Cancel</button>
            <button onClick={handleCreate as any} disabled={creating}
              className="px-4 py-2 rounded-[10px] bg-[var(--terra)] text-white text-[14px] hover:opacity-[0.85] disabled:opacity-40"
              style={{ fontWeight: 700 }}>
              {creating ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Creator Peek Panel ───
function CreatorPeekPanel({ creator, onClose, onViewAs }: { creator: Creator; onClose: () => void; onViewAs: (creator: Creator) => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const initial = (creator.display_name || creator.name || '?')[0].toUpperCase();
  const colors = getAvatarColors(initial);
  const handle = creator.instagram_handle?.replace('@', '') || '';
  const peekLabel = "text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[380px] bg-white border-l border-[rgba(42,32,24,0.08)] flex flex-col" style={{ boxShadow: '-4px 0 24px rgba(42,32,24,0.10)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: colors.bg }}>
              <span className="text-[15px] font-semibold" style={{ color: colors.text }}>{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-[var(--ink)] truncate">{creator.display_name || creator.name}</p>
              {handle && <p className="text-[14px] text-[var(--ink-50)]">@{handle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[var(--ink-50)] hover:bg-[rgba(42,32,24,0.06)] transition-colors flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-5">
            <div>
              <p className={peekLabel}>Level</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-[12px] font-semibold" style={{ background: getLevelColour(creator.level).bg, color: getLevelColour(creator.level).text }}>
                L{creator.level} — {creator.level_name || LEVEL_NAMES[creator.level] || 'Newcomer'}
              </span>
            </div>
            <div>
              <p className={peekLabel}>Status</p>
              <span className="inline-flex items-center rounded-[999px] text-[12px] font-medium" style={{ padding: '3px 9px', background: creator.approved ? '#E1F5EE' : '#FAEEDA', color: creator.approved ? '#0F6E56' : '#854F0B' }}>
                {creator.approved ? 'Approved' : 'Pending'}
              </span>
            </div>
            <div>
              <p className={peekLabel}>County</p>
              <p className="text-[14px] text-[var(--ink)]">{creator.address || '—'}</p>
            </div>
            <div>
              <p className={peekLabel}>Joined</p>
              <p className="text-[14px] text-[var(--ink)]">{fmtDate(creator.created_at)}</p>
            </div>
          </div>

          <div className="mb-4">
            <p className={peekLabel}>Email</p>
            <p className="text-[14px] text-[var(--ink)]">{creator.email}</p>
          </div>

          {handle && (
            <div className="mb-4">
              <p className={peekLabel}>Instagram</p>
              <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[14px] text-[var(--terra)] font-medium hover:underline">
                @{handle} <ExternalLink size={12} />
              </a>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[14px] text-[var(--ink-50)]">
                  {creator.instagram_connected ? 'Connected' : 'Not connected'}
                </span>
                {creator.follower_count && (
                  <span className="text-[14px] text-[var(--ink-50)]">· {creator.follower_count} followers</span>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-[rgba(42,32,24,0.08)] pt-4 mb-4">
            <p className={`${peekLabel} mb-3`}>Performance</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[rgba(42,32,24,0.02)] rounded-[10px] px-3 py-2.5">
                <p className="text-[20px] font-semibold text-[var(--ink)]">{creator.completed_campaigns}/{creator.total_campaigns}</p>
                <p className="text-[12px] text-[var(--ink-50)] font-medium">Campaigns</p>
              </div>
              <div className="bg-[rgba(42,32,24,0.02)] rounded-[10px] px-3 py-2.5">
                <p className="text-[20px] font-semibold text-[var(--ink)]">{creator.total_campaigns > 0 ? `${creator.completion_rate}%` : '—'}</p>
                <p className="text-[12px] text-[var(--ink-50)] font-medium">Completion</p>
              </div>
            </div>
          </div>
        </div>

        {/* View as */}
        <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <button onClick={() => { onViewAs(creator); onClose(); }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[14px] font-semibold hover:bg-[rgba(42,32,24,0.02)] transition-colors">
            <Eye size={14} /> View as Creator
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main Export ───
export default function AdminCreatorsTab({ showModal, onCloseModal }: { showModal: boolean; onCloseModal: () => void }) {
  const authCtx = useAuth();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [peekCreator, setPeekCreator] = useState<Creator | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { fetchCreators(); }, []);

  const fetchCreators = async () => {
    const { data } = await supabase.from('creators').select('*').order('created_at', { ascending: false });
    if (data) setCreators(data as Creator[]);
  };

  const handleApprove = async (id: string, approved: boolean) => {
    if (!approved && !window.confirm('Deny this creator?')) return;
    const { error } = await supabase.from('creators').update({ approved }).eq('id', id);
    if (error) { showToast('Update failed — try again'); return; }
    if (approved) sendCreatorApprovedEmail(id).catch(() => {});
    else sendCreatorDeniedEmail(id).catch(() => {});
    showToast(`Creator ${approved ? 'approved' : 'denied'}`);
    fetchCreators();
  };

  const pendingCreators = creators.filter(c => !c.approved);
  const approvedCreators = creators.filter(c => c.approved);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [approvalSearch, setApprovalSearch] = useState('');

  const filteredCreators = approvedCreators.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.display_name || '').toLowerCase().includes(q) || c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) || (c.instagram_handle || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q);
  });

  const toggleSelectPending = (id: string) => {
    setSelectedPending(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPending = () => {
    if (selectedPending.size === pendingCreators.length) setSelectedPending(new Set());
    else setSelectedPending(new Set(pendingCreators.map(c => c.id)));
  };

  const bulkApprove = async (approved: boolean) => {
    if (!approved && !window.confirm(`Deny ${selectedPending.size} creator${selectedPending.size > 1 ? 's' : ''}?`)) return;
    for (const id of selectedPending) {
      await handleApprove(id, approved);
    }
    setSelectedPending(new Set());
  };

  return (
    <div>
      {toast && (
        <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[999px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>
          {toast}
        </div>
      )}

      {pendingCreators.length > 0 && (
        <button onClick={() => { setShowApprovalModal(true); setApprovalSearch(''); setSelectedPending(new Set()); }}
          className="w-full flex items-center gap-3 px-5 py-4 mb-5 rounded-[10px] transition-colors text-left" style={{ background: 'rgba(42,32,24,0.04)', border: '1px solid rgba(42,32,24,0.08)' }}>
          <AlertCircle size={18} className="text-[var(--terra)] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[var(--terra)]">{pendingCreators.length} creator{pendingCreators.length > 1 ? 's' : ''} awaiting approval</p>
            <p className="text-[14px] text-[var(--ink-60)]">Click to review and approve or deny</p>
          </div>
          <ChevronRight size={16} className="text-[var(--terra)] flex-shrink-0" />
        </button>
      )}

      {/* Approval peek panel */}
      {showApprovalModal && (() => {
        const filtered = pendingCreators.filter(c => {
          if (!approvalSearch) return true;
          const q = approvalSearch.toLowerCase();
          return (c.display_name || c.name || '').toLowerCase().includes(q)
            || (c.instagram_handle || '').toLowerCase().includes(q)
            || (c.email || '').toLowerCase().includes(q)
            || (c.address || '').toLowerCase().includes(q);
        });
        return (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setShowApprovalModal(false); setSelectedPending(new Set()); }} />
          <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-white border-l border-[rgba(42,32,24,0.08)] flex flex-col" style={{ boxShadow: '-4px 0 24px rgba(42,32,24,0.10)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--ink)]">Pending Approval</h2>
                <p className="text-[13px] text-[var(--ink-50)] mt-0.5">{pendingCreators.length} creator{pendingCreators.length > 1 ? 's' : ''} waiting</p>
              </div>
              <button onClick={() => { setShowApprovalModal(false); setSelectedPending(new Set()); }}
                className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[var(--ink-50)] hover:bg-[rgba(42,32,24,0.06)] transition-colors flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-35)]" />
                <input value={approvalSearch} onChange={e => setApprovalSearch(e.target.value)}
                  placeholder="Search creators..."
                  className="w-full pl-9 pr-3 py-2 rounded-[10px] border border-[rgba(42,32,24,0.12)] bg-white text-[14px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-35)]" />
              </div>
            </div>

            {/* Creator list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="text-center text-[14px] text-[var(--ink-50)] py-8">No creators match your search</p>
              )}
              {filtered.map(c => {
                const handle = c.instagram_handle?.replace('@', '') || '';
                const selected = selectedPending.has(c.id);
                const initial = (c.display_name || c.name || '?')[0].toUpperCase();
                const colors = getAvatarColors(initial);
                return (
                  <div key={c.id} className={`px-5 py-4 border-b border-[rgba(42,32,24,0.06)] transition-colors ${selected ? 'bg-[rgba(196,103,74,0.03)]' : 'hover:bg-[rgba(42,32,24,0.02)]'}`}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggleSelectPending(c.id)}
                        className={`w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-[var(--terra)] border-[var(--terra)]' : 'border-[rgba(42,32,24,0.20)] hover:border-[var(--terra)]'}`}>
                        {selected && <Check size={10} className="text-white" />}
                      </button>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: colors.bg }}>
                        <span className="text-[14px] font-semibold" style={{ color: colors.text }}>{initial}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-[var(--ink)]">{c.display_name || c.name}</p>
                        {handle && (
                          <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                            className="text-[13px] text-[var(--terra)] font-medium hover:underline" onClick={e => e.stopPropagation()}>
                            @{handle}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => handleApprove(c.id, true)}
                          className="w-9 h-9 rounded-full bg-[rgba(45,122,79,0.08)] flex items-center justify-center text-[#2D7A4F] hover:bg-[rgba(45,122,79,0.15)] transition-colors" title="Approve">
                          <Check size={16} />
                        </button>
                        <button onClick={() => handleApprove(c.id, false)}
                          className="w-9 h-9 rounded-full bg-[rgba(220,38,38,0.06)] flex items-center justify-center text-[#DC2626] hover:bg-[rgba(220,38,38,0.12)] transition-colors" title="Deny">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 ml-[62px] text-[12px] text-[var(--ink-50)]">
                      {c.address && <span>{c.address}</span>}
                      {c.address && <span>·</span>}
                      <span>Joined {fmtDate(c.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer — bulk actions */}
            {selectedPending.size > 0 && (
              <div className="px-5 py-3 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0 flex items-center gap-2">
                <button onClick={() => bulkApprove(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] bg-[#2D7A4F] text-white text-[14px] font-semibold hover:opacity-[0.85]">
                  <Check size={14} /> Approve {selectedPending.size}
                </button>
                <button onClick={() => bulkApprove(false)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.12)] text-[var(--ink)] text-[14px] font-medium hover:bg-[rgba(42,32,24,0.03)]">
                  <X size={14} /> Deny {selectedPending.size}
                </button>
              </div>
            )}
            {selectedPending.size === 0 && pendingCreators.length > 1 && (
              <div className="px-5 py-3 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0">
                <button onClick={selectAllPending}
                  className="w-full py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.12)] text-[var(--ink-60)] text-[14px] font-medium hover:bg-[rgba(42,32,24,0.03)]">
                  Select all to bulk approve
                </button>
              </div>
            )}
          </div>
        </>
        );
      })()}

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-50)]" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search creators by name, email, Instagram, or county..."
          className="w-full pl-9 pr-4 py-2.5 rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[14px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)]" />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filteredCreators.map(c => {
          const initial = (c.display_name || c.name || '?')[0].toUpperCase();
          const colors = getAvatarColors(initial);
          return (
            <div key={c.id} onClick={() => setPeekCreator(peekCreator?.id === c.id ? null : c)}
              className="bg-white rounded-[12px] p-4 active:bg-[rgba(42,32,24,0.02)]" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: colors.bg }}>
                    <span className="text-[12px] font-semibold" style={{ color: colors.text }}>{initial}</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--ink)]">{c.display_name || c.name}</p>
                    <p className="text-[12px] text-[var(--ink-60)]">{c.instagram_handle}</p>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-[999px] text-[12px] font-semibold" style={{ background: getLevelColour(c.level).bg, color: getLevelColour(c.level).text }}>L{c.level}</span>
              </div>
              <div className="flex items-center gap-3 text-[12px] text-[var(--ink-50)]">
                <span>{c.address || '—'}</span>
                <span>{c.completion_rate}% rate</span>
                <span>{c.completed_campaigns}/{c.total_campaigns} done</span>
              </div>
            </div>
          );
        })}
        {filteredCreators.length === 0 && <p className="py-12 text-center text-[14px] text-[var(--ink-60)]">{search ? 'No creators match your search' : 'No approved creators yet'}</p>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-[12px] overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr>
            <th className={thCls}>Creator</th><th className={thCls}>Instagram</th><th className={thCls}>County</th>
            <th className={thCls}>Level</th><th className={thCls}>Completion</th><th className={thCls}>Campaigns</th>
            <th className={thCls}>IG Status</th><th className={thCls}>Status</th><th className={thCls}>Joined</th>
          </tr></thead>
          <tbody>
            {filteredCreators.map(c => (
              <tr key={c.id} onClick={() => setPeekCreator(peekCreator?.id === c.id ? null : c)}
                className={`cursor-pointer transition-colors ${peekCreator?.id === c.id ? 'bg-[rgba(42,32,24,0.04)]' : 'hover:bg-[rgba(42,32,24,0.03)]'}`} style={{ height: 44 }}>
                <td className={tdCls}>
                  {(() => { const initial = (c.display_name || c.name || '?')[0].toUpperCase(); const colors = getAvatarColors(initial); return (
                  <div className="flex items-center gap-2.5" style={{ minWidth: 160 }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: colors.bg }}>
                      <span className="text-[12px] font-semibold" style={{ color: colors.text }}>{initial}</span>
                    </div>
                    <span className="font-medium" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.display_name || c.name}</span>
                  </div>
                  ); })()}
                </td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{c.instagram_handle}</td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{c.address || '—'}</td>
                <td className={tdCls}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-[12px] font-semibold" style={{ background: getLevelColour(c.level).bg, color: getLevelColour(c.level).text }}>
                    L{c.level}
                  </span>
                </td>
                <td className={tdCls}>
                  {c.total_campaigns > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[rgba(42,32,24,0.06)] rounded-full overflow-hidden" style={{ maxWidth: 80 }}>
                        <div className="h-full bg-[var(--terra)] rounded-full" style={{ width: `${c.completion_rate}%` }} />
                      </div>
                      <span className="text-[14px] text-[var(--ink-60)]">{c.completion_rate}%</span>
                    </div>
                  ) : (
                    <span className="text-[14px] text-[var(--ink-50)]">—</span>
                  )}
                </td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{c.completed_campaigns}/{c.total_campaigns}</td>
                <td className={tdCls}>
                  {c.instagram_connected
                    ? <span className="text-[12px] text-[#2D7A4F] font-medium">Connected</span>
                    : <span className="text-[12px] text-[rgba(42,32,24,0.20)]">—</span>
                  }
                </td>
                <td className={tdCls}>
                  <span className="inline-flex items-center rounded-[999px] text-[12px] font-medium" style={{ padding: '3px 9px', background: '#E1F5EE', color: '#0F6E56' }}>
                    Approved
                  </span>
                </td>
                <td className={`${tdCls} text-[var(--ink-50)]`}>{fmtDate(c.created_at)}</td>
              </tr>
            ))}
            {filteredCreators.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-[14px] text-[var(--ink-60)]">{search ? 'No creators match your search' : 'No approved creators yet'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {peekCreator && <CreatorPeekPanel creator={peekCreator} onClose={() => setPeekCreator(null)} onViewAs={(c) => {
        const { setViewAs } = authCtx;
        setViewAs('creator', { ...c, display_name: c.display_name || c.name });
      }} />}
      {showModal && <CreateCreatorModal onClose={onCloseModal} onCreated={() => { onCloseModal(); fetchCreators(); }} showToast={showToast} />}
    </div>
  );
}
