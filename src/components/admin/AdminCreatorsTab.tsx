import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendCreatorApprovedEmail, sendCreatorDeniedEmail } from '../../lib/notifications';
import { Plus, Check, X, Eye, EyeOff, UserPlus } from 'lucide-react';

interface Creator {
  id: string; name: string; display_name: string | null; instagram_handle: string;
  email: string; code: string; approved: boolean; level: number; level_name: string;
  completion_rate: number; total_campaigns: number; completed_campaigns: number;
  instagram_connected: boolean; address: string | null; created_at: string;
  follower_count: string | null;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminCreatorsTab() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ displayName: '', email: '', instagram: '', city: '', level: '1' });
  const [creating, setCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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

  const handleCreateCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName || !form.email) return;
    setCreating(true);

    // Generate a temporary password
    const tempPassword = 'nayba-' + Math.random().toString(36).slice(2, 10);

    // Create Supabase auth user via admin API (edge function would be needed for production)
    // For now, sign up the user directly
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: tempPassword,
    });

    if (authError || !authData.user) {
      setToast(authError?.message || 'Failed to create auth user');
      setCreating(false);
      return;
    }

    // Create creator profile
    const code = form.displayName.replace(/\s+/g, '').toUpperCase().slice(0, 6) + Math.floor(Math.random() * 100);
    const { error: profileError } = await supabase.from('creators').insert({
      id: authData.user.id,
      name: form.displayName,
      display_name: form.displayName,
      email: form.email,
      instagram_handle: form.instagram || '@' + form.displayName.toLowerCase().replace(/\s+/g, ''),
      code,
      address: form.city || null,
      level: parseInt(form.level) || 1,
      level_name: parseInt(form.level) === 1 ? 'Newcomer' : parseInt(form.level) === 3 ? 'Regular' : 'Trusted',
      approved: true,
      onboarding_complete: true,
      profile_complete: true,
    });

    if (profileError) {
      setToast('Auth user created but profile failed: ' + profileError.message);
      setCreating(false);
      return;
    }

    // Send welcome email via notification
    await supabase.from('notifications').insert({
      user_id: authData.user.id,
      user_type: 'creator',
      message: `Welcome to nayba! Your temporary password is: ${tempPassword}`,
      email_type: 'creator_welcome',
      email_meta: { temp_password: tempPassword },
    });

    setCreatedPassword(tempPassword);
    setCreating(false);
    fetchCreators();
  };

  const resetForm = () => {
    setForm({ displayName: '', email: '', instagram: '', city: '', level: '1' });
    setCreatedPassword(null);
    setShowCreate(false);
  };

  const inputCls = 'w-full px-3 py-2 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)]';
  const labelCls = 'block text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1.5';
  const thCls = 'text-left text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] py-3 px-3 border-b border-[var(--ink-10)]';
  const tdCls = 'py-3 px-3 text-[14px] text-[var(--ink)] border-b border-[var(--ink-10)]';

  const pendingCreators = creators.filter(c => !c.approved);
  const approvedCreators = creators.filter(c => c.approved);

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--ink)] text-white px-4 py-2.5 rounded-[var(--r-sm)] text-[14px] font-medium shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[24px] font-bold text-[var(--ink)]" style={{ letterSpacing: '-0.4px' }}>Creators</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 transition-opacity"
          style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
          <UserPlus size={16} /> Create Creator
        </button>
      </div>

      {/* Create Creator Form */}
      {showCreate && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-semibold text-[var(--ink)]">Create Creator</h2>
            <button onClick={resetForm} className="text-[var(--ink-35)] hover:text-[var(--ink)]"><X size={20} /></button>
          </div>

          {createdPassword ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[rgba(45,122,79,0.1)] mb-3">
                <Check size={24} className="text-[var(--success)]" />
              </div>
              <p className="text-[16px] font-semibold text-[var(--ink)] mb-2">Creator account created</p>
              <p className="text-[14px] text-[var(--ink-60)] mb-3">A welcome email has been sent. Temporary password:</p>
              <div className="inline-flex items-center gap-2 bg-[var(--shell)] border border-[var(--border)] rounded-[var(--r-sm)] px-4 py-2">
                <code className="text-[15px] font-mono text-[var(--terra)]">{showPassword ? createdPassword : '••••••••••'}</code>
                <button onClick={() => setShowPassword(!showPassword)} className="text-[var(--ink-35)] hover:text-[var(--ink)]">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-4">
                <button onClick={resetForm} className="px-4 py-2 rounded-[var(--r-pill)] border border-[var(--border)] text-[var(--ink)] font-semibold text-[14px]">Done</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateCreator} className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Display name *</label>
                <input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Instagram handle</label>
                <input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} className={inputCls} placeholder="@handle" />
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} className={inputCls} placeholder="e.g. Bury St Edmunds" />
              </div>
              <div>
                <label className={labelCls}>Level</label>
                <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))} className={inputCls}>
                  <option value="1">1 — Newcomer</option>
                  <option value="2">2 — Explorer</option>
                  <option value="3">3 — Regular</option>
                  <option value="4">4 — Local</option>
                  <option value="5">5 — Trusted</option>
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={creating}
                  className="px-5 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 transition-opacity disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Pending Approvals */}
      {pendingCreators.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-[var(--ink-10)]">
            <h3 className="text-[14px] font-semibold text-[var(--terra)]">Pending Approvals ({pendingCreators.length})</h3>
          </div>
          <table className="w-full">
            <thead><tr>
              <th className={thCls}>Name</th><th className={thCls}>Email</th><th className={thCls}>Instagram</th>
              <th className={thCls}>Joined</th><th className={thCls}>Actions</th>
            </tr></thead>
            <tbody>
              {pendingCreators.map(c => (
                <tr key={c.id} className="hover:bg-[var(--shell)]">
                  <td className={`${tdCls} font-medium`}>{c.display_name || c.name}</td>
                  <td className={`${tdCls} text-[var(--ink-60)]`}>{c.email}</td>
                  <td className={`${tdCls} text-[var(--ink-60)]`}>{c.instagram_handle}</td>
                  <td className={`${tdCls} text-[var(--ink-35)]`}>{fmtDate(c.created_at)}</td>
                  <td className={tdCls}>
                    <div className="flex gap-1">
                      <button onClick={() => handleApprove(c.id, true)} className="p-1.5 rounded hover:bg-[rgba(45,122,79,0.1)] text-[var(--success)]" title="Approve"><Check size={16} /></button>
                      <button onClick={() => handleApprove(c.id, false)} className="p-1.5 rounded hover:bg-[rgba(220,38,38,0.1)] text-[#DC2626]" title="Deny"><X size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* All Creators */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] overflow-hidden">
        <table className="w-full">
          <thead><tr>
            <th className={thCls}>Name</th><th className={thCls}>Instagram</th><th className={thCls}>City</th>
            <th className={thCls}>Level</th><th className={thCls}>Completion</th><th className={thCls}>Campaigns</th>
            <th className={thCls}>Instagram</th><th className={thCls}>Status</th><th className={thCls}>Joined</th>
          </tr></thead>
          <tbody>
            {approvedCreators.map(c => (
              <tr key={c.id} className="hover:bg-[var(--shell)]">
                <td className={`${tdCls} font-medium`}>{c.display_name || c.name}</td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{c.instagram_handle}</td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{c.address || '—'}</td>
                <td className={tdCls}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-sm)] text-[12px] font-semibold bg-[var(--terra-light)] text-[var(--terra)]">
                    L{c.level}
                  </span>
                </td>
                <td className={tdCls}>{c.completion_rate}%</td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{c.completed_campaigns}/{c.total_campaigns}</td>
                <td className={tdCls}>
                  {c.instagram_connected
                    ? <span className="text-[12px] text-[var(--success)] font-medium">Connected</span>
                    : <span className="text-[12px] text-[var(--ink-35)]">Not connected</span>
                  }
                </td>
                <td className={tdCls}>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-sm)] text-[12px] font-semibold bg-[rgba(45,122,79,0.1)] text-[var(--success)]">
                    Approved
                  </span>
                </td>
                <td className={`${tdCls} text-[var(--ink-35)]`}>{fmtDate(c.created_at)}</td>
              </tr>
            ))}
            {approvedCreators.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-center text-[14px] text-[var(--ink-35)]">No approved creators yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
