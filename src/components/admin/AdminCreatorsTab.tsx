import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendCreatorApprovedEmail, sendCreatorDeniedEmail } from '../../lib/notifications';
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

const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[12px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-35)] font-['Instrument_Sans']";
const labelCls = "block text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-35)] mb-1.5";
const thCls = "text-left text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-35)] py-[10px] px-4 bg-[var(--chalk)]";
const tdCls = "py-0 px-4 text-[14px] text-[var(--ink)] border-b border-[rgba(42,32,24,0.06)]";

function getAvatarColors(letter: string): { bg: string; text: string } {
  const ch = letter.toUpperCase();
  if ('AGMSY'.includes(ch)) return { bg: '#E8EDF2', text: '#3D5A7A' };
  if ('BHNTZ'.includes(ch)) return { bg: '#EDF2E8', text: '#3A6B3A' };
  if ('CIOU'.includes(ch))  return { bg: '#F2EDE8', text: '#7A5A3D' };
  if ('DJPV'.includes(ch))  return { bg: '#EDE8F2', text: '#5A3D7A' };
  if ('EKQW'.includes(ch))  return { bg: '#F2E8ED', text: '#7A3D5A' };
  if ('FLRX'.includes(ch))  return { bg: '#E8F2EF', text: '#2D6B5A' };
  return { bg: '#E8EDF2', text: '#3D5A7A' };
}

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
  const [form, setForm] = useState({ displayName: '', email: '', instagram: '', city: '', level: '1' });
  const [creating, setCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName || !form.email) return;
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) { setError('Please enter a valid email address'); return; }

    setCreating(true);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const { data: authData, error: authError } = await supabase.auth.signUp({ email: form.email, password: tempPassword });
    if (authError) {
      setError(authError.message === 'User already registered' ? 'This email is already registered' : authError.message);
      setCreating(false);
      return;
    }
    if (!authData.user) { setError('Failed to create account — try again'); setCreating(false); return; }

    const level = parseInt(form.level) || 1;
    const handle = normalizeInstagram(form.instagram);

    const { error: insertErr } = await supabase.from('creators').insert({
      id: authData.user.id, name: form.displayName, display_name: form.displayName,
      email: form.email, instagram_handle: handle || '',
      address: form.city || null, level,
      level_name: LEVEL_NAMES[level] || 'Newcomer',
      approved: true, onboarding_complete: true, profile_complete: true,
    });
    if (insertErr) { setError('Account created but profile save failed — contact support'); setCreating(false); return; }

    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: authData.user.id, user_type: 'creator',
      message: 'Welcome to nayba! Your account has been created. Check your email for login details.',
      email_type: 'creator_welcome', email_meta: {},
    });
    if (notifErr) showToast('Account created but welcome notification failed');

    setCreatedPassword(tempPassword);
    setCreating(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(42,32,24,0.40)]" onClick={onClose} />
      <div className="relative bg-white rounded-[12px] w-full max-w-[640px] mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>
        <div className="flex items-center justify-between px-4 md:px-6 py-5 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <h2 className="nayba-h2 text-[var(--ink)]">Create Creator</h2>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-full bg-[var(--chalk)] flex items-center justify-center text-[var(--ink-35)] hover:bg-[#EDE9E3]"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          {createdPassword ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(45,122,79,0.08)] flex items-center justify-center mx-auto mb-3">
                <Check size={22} className="text-[#2D7A4F]" />
              </div>
              <p className="text-[16px] font-semibold text-[var(--ink)] mb-2">Account created</p>
              <p className="text-[14px] text-[var(--ink-60)] mb-3">Share this temporary password with the creator:</p>
              <div className="inline-flex items-center gap-2 bg-[var(--chalk)] border border-[rgba(42,32,24,0.08)] rounded-[12px] px-4 py-2.5">
                <code className="text-[15px] font-mono text-[var(--terra)]">{showPassword ? createdPassword : '••••••••••••'}</code>
                <button onClick={() => setShowPassword(!showPassword)} className="text-[var(--ink-35)]">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-5">
                <button onClick={onClose} className="px-5 py-2.5 rounded-[6px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[13px] font-semibold">Done</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[12px] text-[var(--ink-60)] mb-5 leading-[1.6]">
                A Supabase auth account will be created automatically. Share the temporary password with the creator directly.
              </p>
              {error && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[12px] mb-4" style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626' }}>
                  <AlertCircle size={14} />
                  <span className="text-[13px] font-medium">{error}</span>
                </div>
              )}
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Display Name *</label><input value={form.displayName} onChange={e => { setForm(p => ({ ...p, displayName: e.target.value })); setError(''); }} className={inputCls} required /></div>
                <div><label className={labelCls}>Email *</label><input type="email" value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setError(''); }} className={inputCls} required /></div>
                <div><label className={labelCls}>Instagram Handle</label><input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} className={inputCls} placeholder="@handle" /></div>
                <div><label className={labelCls}>County</label><select value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputCls}><option value="">Select county</option><option value="Suffolk">Suffolk</option><option value="Norfolk">Norfolk</option><option value="Cambridgeshire">Cambridgeshire</option><option value="Essex">Essex</option></select></div>
                <div className="md:col-span-2">
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
        {!createdPassword && (
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0">
            <button onClick={onClose} className="text-[14px] font-medium text-[var(--ink-60)] hover:text-[var(--ink)]">Cancel</button>
            <button onClick={handleCreate as any} disabled={creating}
              className="px-4 py-2 rounded-full bg-[var(--terra)] text-white text-[14px] hover:opacity-[0.85] disabled:opacity-40"
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
  const peekLabel = "text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-35)] mb-1";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[380px] bg-white border-l border-[rgba(42,32,24,0.08)] flex flex-col" style={{ boxShadow: '-8px 0 30px rgba(42,32,24,0.06)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: colors.bg }}>
              <span className="text-[15px] font-semibold" style={{ color: colors.text }}>{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-[var(--ink)] truncate">{creator.display_name || creator.name}</p>
              {handle && <p className="text-[13px] text-[var(--ink-35)]">@{handle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[var(--ink-35)] hover:bg-[rgba(42,32,24,0.06)] transition-colors flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-5">
            <div>
              <p className={peekLabel}>Level</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-[12px] text-[11px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: 'var(--terra)' }}>
                L{creator.level} — {creator.level_name || LEVEL_NAMES[creator.level] || 'Newcomer'}
              </span>
            </div>
            <div>
              <p className={peekLabel}>Status</p>
              <span className="inline-flex items-center rounded-[999px] text-[11px] font-medium" style={{ padding: '3px 9px', background: creator.approved ? '#E1F5EE' : '#FAEEDA', color: creator.approved ? '#0F6E56' : '#854F0B' }}>
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
                <span className="text-[13px] text-[var(--ink-35)]">
                  {creator.instagram_connected ? 'Connected' : 'Not connected'}
                </span>
                {creator.follower_count && (
                  <span className="text-[13px] text-[var(--ink-35)]">· {creator.follower_count} followers</span>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-[rgba(42,32,24,0.08)] pt-4 mb-4">
            <p className={`${peekLabel} mb-3`}>Performance</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--chalk)] rounded-[12px] px-3 py-2.5">
                <p className="text-[20px] font-semibold text-[var(--ink)]">{creator.completed_campaigns}/{creator.total_campaigns}</p>
                <p className="text-[11px] text-[var(--ink-35)] font-medium">Campaigns</p>
              </div>
              <div className="bg-[var(--chalk)] rounded-[12px] px-3 py-2.5">
                <p className="text-[20px] font-semibold text-[var(--ink)]">{creator.total_campaigns > 0 ? `${creator.completion_rate}%` : '—'}</p>
                <p className="text-[11px] text-[var(--ink-35)] font-medium">Completion</p>
              </div>
            </div>
          </div>
        </div>

        {/* View as */}
        <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <button onClick={() => { onViewAs(creator); onClose(); }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[6px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[13px] font-semibold hover:bg-[var(--chalk)] transition-colors">
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
  const [showApprovalPane, setShowApprovalPane] = useState(false);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());

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
        <div className="fixed top-4 right-4 z-50 bg-[var(--ink)] text-white px-4 py-2.5 rounded-[12px] text-[14px] font-medium">
          {toast}
        </div>
      )}

      {pendingCreators.length > 0 && !showApprovalPane && (
        <button onClick={() => setShowApprovalPane(true)}
          className="w-full flex items-center gap-3 px-5 py-4 mb-5 rounded-[12px] transition-colors text-left" style={{ background: 'rgba(42,32,24,0.04)', border: '1px solid rgba(42,32,24,0.08)' }}>
          <AlertCircle size={18} className="text-[var(--terra)] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[var(--terra)]">{pendingCreators.length} creator{pendingCreators.length > 1 ? 's' : ''} awaiting approval</p>
            <p className="text-[13px] text-[var(--ink-60)]">Click to review and approve or deny</p>
          </div>
          <ChevronRight size={16} className="text-[var(--terra)] flex-shrink-0" />
        </button>
      )}

      {showApprovalPane && pendingCreators.length > 0 && (
        <div className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[12px] mb-5 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(42,32,24,0.08)] bg-[var(--chalk)]">
            <div className="flex items-center gap-3">
              <h3 className="text-[14px] font-semibold text-[var(--ink)]">Pending Approvals</h3>
              <span className="text-[12px] text-[var(--ink-35)]">{pendingCreators.length} creator{pendingCreators.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={selectAllPending}
                className="px-3 py-1.5 rounded-[12px] text-[12px] font-semibold text-[var(--ink-60)] hover:bg-[rgba(42,32,24,0.06)]">
                {selectedPending.size === pendingCreators.length ? 'Deselect all' : 'Select all'}
              </button>
              {selectedPending.size > 0 && (
                <>
                  <button onClick={() => bulkApprove(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[rgba(45,122,79,0.08)] text-[#2D7A4F] text-[12px] font-semibold hover:bg-[rgba(45,122,79,0.15)]">
                    <CheckCircle2 size={13} /> Approve {selectedPending.size}
                  </button>
                  <button onClick={() => bulkApprove(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[rgba(220,38,38,0.06)] text-[#DC2626] text-[12px] font-semibold hover:bg-[rgba(220,38,38,0.12)]">
                    <XCircle size={13} /> Deny {selectedPending.size}
                  </button>
                </>
              )}
              <button onClick={() => { setShowApprovalPane(false); setSelectedPending(new Set()); }}
                className="ml-2 w-7 h-7 rounded-full bg-[rgba(42,32,24,0.06)] flex items-center justify-center text-[var(--ink-35)] hover:bg-[rgba(42,32,24,0.10)]">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-[rgba(42,32,24,0.08)]">
            {pendingCreators.map(c => {
              const handle = c.instagram_handle?.replace('@', '') || '';
              const selected = selectedPending.has(c.id);
              return (
                <div key={c.id} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${selected ? 'bg-[rgba(196,103,74,0.04)]' : 'hover:bg-[rgba(42,32,24,0.03)]'}`}>
                  <button onClick={() => toggleSelectPending(c.id)}
                    className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-[var(--terra)] border-[var(--terra)]' : 'border-[rgba(42,32,24,0.15)] hover:border-[var(--terra)]'}`}>
                    {selected && <Check size={12} className="text-white" />}
                  </button>
                  {(() => { const initial = (c.display_name || c.name || '?')[0].toUpperCase(); const colors = getAvatarColors(initial); return (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: colors.bg }}>
                    <span className="text-[13px] font-semibold" style={{ color: colors.text }}>{initial}</span>
                  </div>
                  ); })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-[var(--ink)]">{c.display_name || c.name}</p>
                      <span className="text-[12px] text-[var(--ink-35)]">{c.email}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {handle && (
                        <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[13px] text-[var(--terra)] font-medium hover:underline">
                          @{handle} <ExternalLink size={11} />
                        </a>
                      )}
                      {c.address && <span className="text-[12px] text-[var(--ink-35)]">{c.address}</span>}
                      <span className="text-[12px] text-[var(--ink-35)]">Joined {fmtDate(c.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleApprove(c.id, true)}
                      className="w-8 h-8 rounded-full bg-[rgba(45,122,79,0.08)] flex items-center justify-center text-[#2D7A4F] hover:bg-[rgba(45,122,79,0.15)] transition-colors" title="Approve">
                      <Check size={15} />
                    </button>
                    <button onClick={() => handleApprove(c.id, false)}
                      className="w-8 h-8 rounded-full bg-[rgba(220,38,38,0.06)] flex items-center justify-center text-[#DC2626] hover:bg-[rgba(220,38,38,0.12)] transition-colors" title="Deny">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-35)]" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search creators by name, email, Instagram, or county..."
          className="w-full pl-9 pr-4 py-2.5 rounded-[12px] bg-white border border-[rgba(42,32,24,0.15)] text-[14px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)]" />
      </div>

      {/* Creators table */}
      <div className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[12px] overflow-hidden overflow-x-auto">
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
                      <span className="text-[11px] font-semibold" style={{ color: colors.text }}>{initial}</span>
                    </div>
                    <span className="font-medium" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.display_name || c.name}</span>
                  </div>
                  ); })()}
                </td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{c.instagram_handle}</td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{c.address || '—'}</td>
                <td className={tdCls}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[12px] text-[11px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: 'var(--terra)' }}>
                    L{c.level}
                  </span>
                </td>
                <td className={tdCls}>
                  {c.total_campaigns > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[rgba(42,32,24,0.06)] rounded-full overflow-hidden" style={{ maxWidth: 80 }}>
                        <div className="h-full bg-[var(--terra)] rounded-full" style={{ width: `${c.completion_rate}%` }} />
                      </div>
                      <span className="text-[13px] text-[var(--ink-60)]">{c.completion_rate}%</span>
                    </div>
                  ) : (
                    <span className="text-[13px] text-[var(--ink-35)]">—</span>
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
                  <span className="inline-flex items-center rounded-[999px] text-[11px] font-medium" style={{ padding: '3px 9px', background: '#E1F5EE', color: '#0F6E56' }}>
                    Approved
                  </span>
                </td>
                <td className={`${tdCls} text-[var(--ink-35)]`}>{fmtDate(c.created_at)}</td>
              </tr>
            ))}
            {filteredCreators.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-[14px] text-[var(--ink-35)]">{search ? 'No creators match your search' : 'No approved creators yet'}</td></tr>
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
