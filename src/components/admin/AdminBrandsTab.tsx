import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendBusinessApprovedEmail, sendBusinessDeniedEmail } from '../../lib/notifications';
import { Check, X } from 'lucide-react';

interface Brand {
  id: string; name: string; slug: string; owner_email: string; category: string;
  region: string; approved: boolean; is_live: boolean; instagram_handle: string | null;
  address: string | null; bio: string | null; created_at: string;
}

const CATEGORIES = ['Food & Drink', 'Beauty', 'Wellness', 'Experience', 'Retail'];
const inputCls = "w-full px-3 py-2.5 rounded-[8px] bg-[#F7F7F5] border border-[#E6E2DB] text-[#222] text-[13.5px] focus:outline-none focus:border-[#C4674A] focus:shadow-[0_0_0_3px_rgba(196,103,74,0.12)] placeholder:text-[rgba(34,34,34,0.35)] font-['Instrument_Sans']";
const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.5px] text-[rgba(34,34,34,0.60)] mb-1.5";
const thCls = "text-left text-[11px] font-semibold uppercase tracking-[0.6px] text-[rgba(34,34,34,0.35)] py-3 px-4 bg-[#F7F7F5]";
const tdCls = "py-0 px-4 text-[14px] text-[#222] border-b border-[#E6E2DB]";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CreateBrandModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', category: '', region: 'Suffolk', instagram: '', address: '', bio: '' });
  const [creating, setCreating] = useState(false);
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.category) return;
    setCreating(true);
    const slug = slugify(form.name);
    const { data: existing } = await supabase.from('businesses').select('id').eq('slug', slug).limit(1);
    if (existing && existing.length > 0) { setCreating(false); return; }
    await supabase.from('businesses').insert({
      name: form.name, slug, owner_email: form.email, category: form.category, region: form.region,
      instagram_handle: form.instagram || null, address: form.address || null, bio: form.bio || null,
      approved: true, is_live: true, onboarding_complete: true, onboarding_step: 4,
    });
    setCreating(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(34,34,34,0.4)]" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] w-full max-w-[640px] mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '88vh', boxShadow: '0 20px 60px rgba(28,28,26,0.15)' }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E6E2DB] flex-shrink-0">
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#222', letterSpacing: '-0.2px' }}>Create Brand</h2>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-full bg-[#F7F7F5] flex items-center justify-center text-[rgba(34,34,34,0.45)] hover:bg-[#EDE9E3]"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Brand Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} required /></div>
            <div><label className={labelCls}>Owner Email *</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} required /></div>
            <div><label className={labelCls}>Category *</label><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputCls} required><option value="">Select...</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={labelCls}>Region</label><select value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} className={inputCls}><option value="Suffolk">Suffolk</option><option value="Norfolk">Norfolk</option><option value="Cambridgeshire">Cambridgeshire</option><option value="Essex">Essex</option></select></div>
            <div><label className={labelCls}>Instagram Handle</label><input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} className={inputCls} placeholder="@handle" /></div>
            <div><label className={labelCls}>Address</label><input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputCls} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Bio</label><textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} className={`${inputCls} min-h-[72px] resize-y`} /></div>
          </form>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E6E2DB] bg-[#F7F7F5] flex-shrink-0">
          <button onClick={onClose} className="text-[14px] font-semibold text-[rgba(34,34,34,0.60)] hover:text-[#222]">Cancel</button>
          <button onClick={handleCreate as any} disabled={creating} className="px-5 py-2.5 rounded-[999px] bg-[#C4674A] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-40" style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
            {creating ? 'Creating...' : 'Create Brand'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBrandsTab({ showModal, onCloseModal }: { showModal: boolean; onCloseModal: () => void }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaignCounts, setCampaignCounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { fetchBrands(); }, []);

  const fetchBrands = async () => {
    const { data } = await supabase.from('businesses').select('*').order('created_at', { ascending: false });
    if (data) {
      setBrands(data as Brand[]);
      const counts: Record<string, number> = {};
      for (const b of data) {
        const { count } = await supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('brand_id', b.id);
        counts[b.id] = count || 0;
      }
      setCampaignCounts(counts);
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    await supabase.from('businesses').update({ approved }).eq('id', id);
    if (approved) sendBusinessApprovedEmail(id).catch(() => {});
    else sendBusinessDeniedEmail(id).catch(() => {});
    setToast(`Brand ${approved ? 'approved' : 'denied'}`);
    setTimeout(() => setToast(null), 3000);
    fetchBrands();
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#222] text-white px-4 py-2.5 rounded-[8px] text-[14px] font-medium" style={{ boxShadow: '0 4px 20px rgba(34,34,34,0.15)' }}>{toast}</div>
      )}

      <div className="bg-white border border-[#E6E2DB] rounded-[12px] overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr>
            <th className={thCls}>Brand</th><th className={thCls}>Category</th><th className={thCls}>Region</th>
            <th className={thCls}>Instagram</th><th className={thCls}>Campaigns</th><th className={thCls}>Status</th>
            <th className={thCls}>Actions</th>
          </tr></thead>
          <tbody>
            {brands.map(b => (
              <tr key={b.id} className="hover:bg-[#F7F7F5] transition-colors" style={{ height: 52 }}>
                <td className={tdCls}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[rgba(196,103,74,0.08)] flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-[#C4674A]">{b.name[0]}</span>
                    </div>
                    <span className="font-medium">{b.name}</span>
                  </div>
                </td>
                <td className={`${tdCls} text-[rgba(34,34,34,0.60)]`}>{b.category}</td>
                <td className={`${tdCls} text-[rgba(34,34,34,0.60)]`}>{b.region}</td>
                <td className={`${tdCls} text-[rgba(34,34,34,0.60)]`}>{b.instagram_handle || '—'}</td>
                <td className={tdCls}>{campaignCounts[b.id] || 0}</td>
                <td className={tdCls}>
                  {b.approved
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] text-[11px] font-semibold" style={{ background: 'rgba(45,122,79,0.08)', color: '#2D7A4F' }}>Approved</span>
                    : <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] text-[11px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: '#C4674A' }}>Pending</span>
                  }
                </td>
                <td className={tdCls}>
                  {!b.approved && (
                    <div className="flex gap-1">
                      <button onClick={() => handleApprove(b.id, true)} className="w-7 h-7 rounded-full bg-[rgba(45,122,79,0.08)] flex items-center justify-center text-[#2D7A4F] hover:bg-[rgba(45,122,79,0.15)]"><Check size={14} /></button>
                      <button onClick={() => handleApprove(b.id, false)} className="w-7 h-7 rounded-full bg-[rgba(220,38,38,0.08)] flex items-center justify-center text-[#DC2626] hover:bg-[rgba(220,38,38,0.15)]"><X size={14} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-[14px] text-[rgba(34,34,34,0.35)]">No brands yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && <CreateBrandModal onClose={onCloseModal} onCreated={() => { onCloseModal(); fetchBrands(); }} />}
    </div>
  );
}
