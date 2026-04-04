import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendCreatorApprovedEmail, sendCreatorDeniedEmail } from '../../lib/notifications';
import { Check, X, Eye, EyeOff, AlertCircle, ChevronRight, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

interface Creator {
  id: string; name: string; display_name: string | null; instagram_handle: string;
  email: string; code: string; approved: boolean; level: number; level_name: string;
  completion_rate: number; total_campaigns: number; completed_campaigns: number;
  instagram_connected: boolean; address: string | null; created_at: string;
  follower_count: string | null;
}

const BORDER = '#E6E2DB';
const inputCls = "w-full px-3 py-2.5 rounded-[8px] bg-[#F7F7F5] border border-[#E6E2DB] text-[#222] text-[13.5px] focus:outline-none focus:border-[#C4674A] focus:shadow-[0_0_0_3px_rgba(196,103,74,0.12)] placeholder:text-[rgba(34,34,34,0.35)] font-['Instrument_Sans']";
const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.5px] text-[rgba(34,34,34,0.60)] mb-1.5";
const thCls = "text-left text-[11px] font-semibold uppercase tracking-[0.6px] text-[rgba(34,34,34,0.35)] py-3 px-4 bg-[#F7F7F5]";
const tdCls = "py-0 px-4 text-[14px] text-[#222] border-b border-[#E6E2DB]";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Create Creator Modal ───
function CreateCreatorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ displayName: '', email: '', instagram: '', city: '', level: '1' });
  const [creating, setCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName || !form.email) return;
    setCreating(true);
    const tempPassword = 'nayba-' + Math.random().toString(36).slice(2, 10);
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: form.email, password: tempPassword });
    if (authError || !authData.user) { setCreating(false); return; }
    const code = form.displayName.replace(/\s+/g, '').toUpperCase().slice(0, 6) + Math.floor(Math.random() * 100);
    await supabase.from('creators').insert({
      id: authData.user.id, name: form.displayName, display_name: form.displayName,
      email: form.email, instagram_handle: form.instagram || '@' + form.displayName.toLowerCase().replace(/\s+/g, ''),
      code, address: form.city || null, level: parseInt(form.level) || 1,
      level_name: parseInt(form.level) === 1 ? 'Newcomer' : parseInt(form.level) === 3 ? 'Regular' : 'Trusted',
      approved: true, onboarding_complete: true, profile_complete: true,
    });
    await supabase.from('notifications').insert({
      user_id: authData.user.id, user_type: 'creator',
      message: `Welcome to nayba! Your temporary password is: ${tempPassword}`,
      email_type: 'creator_welcome', email_meta: { temp_password: tempPassword },
    });
    setCreatedPassword(tempPassword);
    setCreating(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(34,34,34,0.4)]" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] w-full max-w-[640px] mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '88vh', boxShadow: '0 20px 60px rgba(28,28,26,0.15)' }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E6E2DB] flex-shrink-0">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#222', letterSpacing: '-0.2px' }}>Create Creator</h2>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-full bg-[#F7F7F5] flex items-center justify-center text-[rgba(34,34,34,0.45)] hover:bg-[#EDE9E3]"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {createdPassword ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(45,122,79,0.08)] flex items-center justify-center mx-auto mb-3">
                <Check size={22} className="text-[#2D7A4F]" />
              </div>
              <p className="text-[16px] font-bold text-[#222] mb-2">Account created</p>
              <p className="text-[14px] text-[rgba(34,34,34,0.60)] mb-3">A welcome email has been sent. Temporary password:</p>
              <div className="inline-flex items-center gap-2 bg-[#F7F7F5] border border-[#E6E2DB] rounded-[8px] px-4 py-2.5">
                <code className="text-[15px] font-mono text-[#C4674A]">{showPassword ? createdPassword : '••••••••••'}</code>
                <button onClick={() => setShowPassword(!showPassword)} className="text-[rgba(34,34,34,0.35)]">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-5">
                <button onClick={onClose} className="px-5 py-2.5 rounded-[999px] border border-[#E6E2DB] text-[#222] text-[13px] font-semibold">Done</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[12px] text-[rgba(34,34,34,0.60)] mb-5 leading-[1.6]">
                A Supabase auth account will be created automatically. Login credentials will be emailed to the creator.
              </p>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelCls}>Display Name *</label><input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} className={inputCls} required /></div>
                <div><label className={labelCls}>Email *</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} required /></div>
                <div><label className={labelCls}>Instagram Handle</label><input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} className={inputCls} placeholder="@handle" /></div>
                <div><label className={labelCls}>City</label><input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputCls} placeholder="e.g. Bury St Edmunds" /></div>
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#E6E2DB] bg-[#F7F7F5] flex-shrink-0">
            <button onClick={onClose} className="text-[14px] font-semibold text-[rgba(34,34,34,0.60)] hover:text-[#222]">Cancel</button>
            <button onClick={handleCreate as any} disabled={creating}
              className="px-5 py-2.5 rounded-[999px] bg-[#C4674A] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-40"
              style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
              {creating ? 'Creating...' : 'Create Account & Send Email'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Export ───
export default function AdminCreatorsTab({ showModal, onCloseModal }: { showModal: boolean; onCloseModal: () => void }) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { fetchCreators(); }, []);

  const fetchCreators = async () => {
    const { data } = await supabase.from('creators').select('*').order('created_at', { ascending: false });
    if (data) setCreators(data as Creator[]);
  };

  const handleApprove = async (id: string, approved: boolean) => {
    await supabase.from('creators').update({ approved }).eq('id', id);
    if (approved) sendCreatorApprovedEmail(id).catch(() => {});
    else sendCreatorDeniedEmail(id).catch(() => {});
    setToast(`Creator ${approved ? 'approved' : 'denied'}`);
    setTimeout(() => setToast(null), 3000);
    fetchCreators();
  };

  const pendingCreators = creators.filter(c => !c.approved);
  const approvedCreators = creators.filter(c => c.approved);
  const [showApprovalPane, setShowApprovalPane] = useState(false);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());

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
    for (const id of selectedPending) {
      await handleApprove(id, approved);
    }
    setSelectedPending(new Set());
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#222] text-white px-4 py-2.5 rounded-[8px] text-[14px] font-medium" style={{ boxShadow: '0 4px 20px rgba(34,34,34,0.15)' }}>
          {toast}
        </div>
      )}

      {/* Pending approvals banner — opens pane */}
      {pendingCreators.length > 0 && !showApprovalPane && (
        <button onClick={() => setShowApprovalPane(true)}
          className="w-full flex items-center gap-3 px-5 py-4 mb-5 rounded-[12px] border border-[rgba(196,103,74,0.2)] hover:border-[#C4674A] transition-colors text-left" style={{ background: 'rgba(196,103,74,0.04)' }}>
          <AlertCircle size={18} className="text-[#C4674A] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-[#C4674A]">{pendingCreators.length} creator{pendingCreators.length > 1 ? 's' : ''} awaiting approval</p>
            <p className="text-[13px] text-[rgba(34,34,34,0.60)]">Click to review and approve or deny</p>
          </div>
          <ChevronRight size={16} className="text-[#C4674A] flex-shrink-0" />
        </button>
      )}

      {/* Approval pane — scrollable list with bulk actions */}
      {showApprovalPane && pendingCreators.length > 0 && (
        <div className="bg-white border border-[#E6E2DB] rounded-[12px] mb-5 overflow-hidden">
          {/* Pane header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E6E2DB] bg-[#F7F7F5]">
            <div className="flex items-center gap-3">
              <h3 className="text-[14px] font-bold text-[#222]">Pending Approvals</h3>
              <span className="text-[12px] text-[rgba(34,34,34,0.45)]">{pendingCreators.length} creator{pendingCreators.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={selectAllPending}
                className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold text-[rgba(34,34,34,0.60)] hover:bg-[rgba(34,34,34,0.06)]">
                {selectedPending.size === pendingCreators.length ? 'Deselect all' : 'Select all'}
              </button>
              {selectedPending.size > 0 && (
                <>
                  <button onClick={() => bulkApprove(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[999px] bg-[rgba(45,122,79,0.08)] text-[#2D7A4F] text-[12px] font-semibold hover:bg-[rgba(45,122,79,0.15)]">
                    <CheckCircle2 size={13} /> Approve {selectedPending.size}
                  </button>
                  <button onClick={() => bulkApprove(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[999px] bg-[rgba(220,38,38,0.06)] text-[#DC2626] text-[12px] font-semibold hover:bg-[rgba(220,38,38,0.12)]">
                    <XCircle size={13} /> Deny {selectedPending.size}
                  </button>
                </>
              )}
              <button onClick={() => { setShowApprovalPane(false); setSelectedPending(new Set()); }}
                className="ml-2 w-7 h-7 rounded-full bg-[rgba(34,34,34,0.06)] flex items-center justify-center text-[rgba(34,34,34,0.45)] hover:bg-[rgba(34,34,34,0.1)]">
                <X size={14} />
              </button>
            </div>
          </div>
          {/* Scrollable creator list */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-[#E6E2DB]">
            {pendingCreators.map(c => {
              const handle = c.instagram_handle?.replace('@', '') || '';
              const selected = selectedPending.has(c.id);
              return (
                <div key={c.id} className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${selected ? 'bg-[rgba(196,103,74,0.04)]' : 'hover:bg-[#FAFAF8]'}`}>
                  {/* Checkbox */}
                  <button onClick={() => toggleSelectPending(c.id)}
                    className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? 'bg-[#C4674A] border-[#C4674A]' : 'border-[rgba(34,34,34,0.20)] hover:border-[#C4674A]'}`}>
                    {selected && <Check size={12} className="text-white" />}
                  </button>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-[#C4674A] flex items-center justify-center flex-shrink-0">
                    <span className="text-[13px] font-bold text-white">{(c.display_name || c.name || '?')[0].toUpperCase()}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-[#222]">{c.display_name || c.name}</p>
                      <span className="text-[12px] text-[rgba(34,34,34,0.35)]">{c.email}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {handle && (
                        <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[13px] text-[#C4674A] font-medium hover:underline">
                          @{handle} <ExternalLink size={11} />
                        </a>
                      )}
                      {c.address && <span className="text-[12px] text-[rgba(34,34,34,0.45)]">{c.address}</span>}
                      <span className="text-[12px] text-[rgba(34,34,34,0.35)]">Joined {fmtDate(c.created_at)}</span>
                    </div>
                  </div>

                  {/* Individual actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleApprove(c.id, true)}
                      className="w-8 h-8 rounded-full bg-[rgba(45,122,79,0.08)] flex items-center justify-center text-[#2D7A4F] hover:bg-[rgba(45,122,79,0.15)] transition-colors"
                      title="Approve">
                      <Check size={15} />
                    </button>
                    <button onClick={() => handleApprove(c.id, false)}
                      className="w-8 h-8 rounded-full bg-[rgba(220,38,38,0.06)] flex items-center justify-center text-[#DC2626] hover:bg-[rgba(220,38,38,0.12)] transition-colors"
                      title="Deny">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Creators table */}
      <div className="bg-white border border-[#E6E2DB] rounded-[12px] overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr>
            <th className={thCls}>Creator</th><th className={thCls}>Instagram</th><th className={thCls}>City</th>
            <th className={thCls}>Level</th><th className={thCls}>Completion</th><th className={thCls}>Campaigns</th>
            <th className={thCls}>Instagram</th><th className={thCls}>Status</th><th className={thCls}>Joined</th>
          </tr></thead>
          <tbody>
            {approvedCreators.map(c => (
              <tr key={c.id} className="hover:bg-[#F7F7F5] transition-colors" style={{ height: 52 }}>
                <td className={tdCls}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#C4674A] flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-white">{(c.display_name || c.name || '?')[0].toUpperCase()}</span>
                    </div>
                    <span className="font-medium">{c.display_name || c.name}</span>
                  </div>
                </td>
                <td className={`${tdCls} text-[rgba(34,34,34,0.60)]`}>{c.instagram_handle}</td>
                <td className={`${tdCls} text-[rgba(34,34,34,0.60)]`}>{c.address || '—'}</td>
                <td className={tdCls}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] text-[11px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: '#C4674A' }}>
                    L{c.level}
                  </span>
                </td>
                <td className={tdCls}>
                  {c.total_campaigns > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[rgba(34,34,34,0.06)] rounded-full overflow-hidden" style={{ maxWidth: 80 }}>
                        <div className="h-full bg-[#C4674A] rounded-full" style={{ width: `${c.completion_rate}%` }} />
                      </div>
                      <span className="text-[13px] text-[rgba(34,34,34,0.60)]">{c.completion_rate}%</span>
                    </div>
                  ) : (
                    <span className="text-[13px] text-[rgba(34,34,34,0.35)]">—</span>
                  )}
                </td>
                <td className={`${tdCls} text-[rgba(34,34,34,0.60)]`}>{c.completed_campaigns}/{c.total_campaigns}</td>
                <td className={tdCls}>
                  {c.instagram_connected
                    ? <span className="text-[12px] text-[#2D7A4F] font-medium">Connected</span>
                    : <span className="text-[12px] text-[rgba(34,34,34,0.35)]">Not connected</span>
                  }
                </td>
                <td className={tdCls}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] text-[11px] font-semibold" style={{ background: 'rgba(45,122,79,0.08)', color: '#2D7A4F' }}>
                    Approved
                  </span>
                </td>
                <td className={`${tdCls} text-[rgba(34,34,34,0.35)]`}>{fmtDate(c.created_at)}</td>
              </tr>
            ))}
            {approvedCreators.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-[14px] text-[rgba(34,34,34,0.35)]">No approved creators yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && <CreateCreatorModal onClose={onCloseModal} onCreated={() => { onCloseModal(); fetchCreators(); }} />}
    </div>
  );
}
