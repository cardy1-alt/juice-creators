import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendBusinessApprovedEmail, sendBusinessDeniedEmail } from '../../lib/notifications';
import { Check, X, AlertCircle, ExternalLink } from 'lucide-react';

interface Brand {
  id: string; name: string; slug: string; owner_email: string; category: string;
  region: string; approved: boolean; instagram_handle: string | null;
  address: string | null; bio: string | null; created_at: string;
}

const CATEGORIES = ['Food & Drink', 'Beauty', 'Wellness', 'Experience', 'Retail'];
const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[8px] bg-white border-[0.5px] border-[rgba(0,0,0,0.18)] text-[#1C1917] text-[14px] focus:outline-none focus:border-[#C4674A] focus:shadow-[0_0_0_3px_rgba(196,103,74,0.12)] placeholder:text-[rgba(0,0,0,0.4)] font-['Instrument_Sans']";
const labelCls = "block text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-1.5";
const thCls = "text-left text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] py-[10px] px-4 bg-[#F7F6F3]";
const tdCls = "py-0 px-4 text-[14px] text-[#1C1917] border-b-[0.5px] border-[rgba(0,0,0,0.06)]";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CreateBrandModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', category: '', region: 'Suffolk', instagram: '', address: '', bio: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.category) return;
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) { setError('Please enter a valid email address'); return; }

    setCreating(true);
    const slug = slugify(form.name);
    const { data: existing } = await supabase.from('businesses').select('id').eq('slug', slug).limit(1);
    if (existing && existing.length > 0) { setError('A brand with this name already exists'); setCreating(false); return; }

    const { error: insertErr } = await supabase.from('businesses').insert({
      name: form.name, slug, owner_email: form.email, category: form.category, region: form.region,
      instagram_handle: form.instagram ? form.instagram.replace(/^@/, '') : null,
      address: form.address || null, bio: form.bio || null,
      approved: true, onboarding_complete: true,
    });
    if (insertErr) { setError('Failed to create brand — ' + insertErr.message); setCreating(false); return; }
    setCreating(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(34,34,34,0.4)]" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] w-full max-w-[640px] mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '88vh', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between px-6 py-5 border-b-[0.5px] border-[rgba(0,0,0,0.08)] flex-shrink-0">
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1C1917', letterSpacing: '-0.2px' }}>Create Brand</h2>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-full bg-[#F7F6F3] flex items-center justify-center text-[rgba(34,34,34,0.45)] hover:bg-[#EDE9E3]"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[8px] mb-4" style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626' }}>
              <AlertCircle size={14} />
              <span className="text-[13px] font-medium">{error}</span>
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Brand Name *</label><input value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setError(''); }} className={inputCls} required /></div>
            <div><label className={labelCls}>Owner Email *</label><input type="email" value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setError(''); }} className={inputCls} required /></div>
            <div><label className={labelCls}>Category *</label><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputCls} required><option value="">Select...</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={labelCls}>Region</label><select value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} className={inputCls}><option value="Suffolk">Suffolk</option><option value="Norfolk">Norfolk</option><option value="Cambridgeshire">Cambridgeshire</option><option value="Essex">Essex</option></select></div>
            <div><label className={labelCls}>Instagram Handle</label><input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} className={inputCls} placeholder="@handle" /></div>
            <div><label className={labelCls}>Address</label><input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputCls} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Bio</label><textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} className={`${inputCls} min-h-[72px] resize-y`} /></div>
          </form>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t-[0.5px] border-[rgba(0,0,0,0.08)] bg-[#F7F6F3] flex-shrink-0">
          <button onClick={onClose} className="text-[14px] font-medium text-[rgba(34,34,34,0.60)] hover:text-[#1C1917]">Cancel</button>
          <button onClick={handleCreate as any} disabled={creating} className="px-4 py-2 rounded-[6px] bg-[#C4674A] text-white text-[13px] font-semibold hover:opacity-[0.85] disabled:opacity-40">
            {creating ? 'Creating...' : 'Create Brand'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Brand Peek Panel ───
function BrandPeekPanel({ brand, campaignCount, onClose, onApprove }: {
  brand: Brand; campaignCount: number; onClose: () => void;
  onApprove: (id: string, approved: boolean) => void;
}) {
  const peekLabel = "text-[11px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-1";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-[380px] bg-white border-l border-[rgba(0,0,0,0.08)] flex flex-col" style={{ boxShadow: '-8px 0 30px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b-[0.5px] border-[rgba(0,0,0,0.08)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-[rgba(196,103,74,0.08)] flex items-center justify-center flex-shrink-0">
              <span className="text-[15px] font-semibold text-[#C4674A]">{brand.name[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-[#1C1917] truncate">{brand.name}</p>
              <p className="text-[13px] text-[rgba(0,0,0,0.45)]">{brand.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[rgba(0,0,0,0.35)] hover:bg-[rgba(0,0,0,0.06)] transition-colors flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-5">
            <div>
              <p className={peekLabel}>Status</p>
              {brand.approved
                ? <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] text-[11px] font-semibold" style={{ background: 'rgba(45,122,79,0.08)', color: '#2D7A4F' }}>Approved</span>
                : <span className="inline-flex items-center px-2 py-0.5 rounded-[8px] text-[11px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: '#C4674A' }}>Pending</span>
              }
            </div>
            <div>
              <p className={peekLabel}>Region</p>
              <p className="text-[14px] text-[#1C1917]">{brand.region}</p>
            </div>
            <div>
              <p className={peekLabel}>Campaigns</p>
              <p className="text-[14px] text-[#1C1917]">{campaignCount}</p>
            </div>
            <div>
              <p className={peekLabel}>Added</p>
              <p className="text-[14px] text-[#1C1917]">{fmtDate(brand.created_at)}</p>
            </div>
          </div>

          <div className="mb-4">
            <p className={peekLabel}>Owner Email</p>
            <p className="text-[14px] text-[#1C1917]">{brand.owner_email}</p>
          </div>

          {brand.instagram_handle && (
            <div className="mb-4">
              <p className={peekLabel}>Instagram</p>
              <a href={`https://instagram.com/${brand.instagram_handle}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[14px] text-[#C4674A] font-medium hover:underline">
                @{brand.instagram_handle} <ExternalLink size={12} />
              </a>
            </div>
          )}

          {brand.address && (
            <div className="mb-4">
              <p className={peekLabel}>Address</p>
              <p className="text-[14px] text-[#1C1917]">{brand.address}</p>
            </div>
          )}

          {brand.bio && (
            <div className="mb-4">
              <p className={peekLabel}>Bio</p>
              <p className="text-[14px] text-[#1C1917] leading-[1.6]">{brand.bio}</p>
            </div>
          )}
        </div>

        {!brand.approved && (
          <div className="px-5 py-4 border-t-[0.5px] border-[rgba(0,0,0,0.08)] flex-shrink-0 flex gap-2">
            <button onClick={() => { onApprove(brand.id, true); onClose(); }}
              className="flex-1 px-4 py-2.5 rounded-[6px] bg-[#2D7A4F] text-white text-[13px] font-semibold hover:opacity-[0.85]">
              Approve
            </button>
            <button onClick={() => { onApprove(brand.id, false); onClose(); }}
              className="flex-1 px-4 py-2.5 rounded-[6px] border-[0.5px] border-[rgba(0,0,0,0.08)] text-[#1C1917] text-[13px] font-semibold hover:bg-[#F7F6F3]">
              Deny
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminBrandsTab({ showModal, onCloseModal }: { showModal: boolean; onCloseModal: () => void }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaignCounts, setCampaignCounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [peekBrand, setPeekBrand] = useState<Brand | null>(null);

  useEffect(() => { fetchBrands(); }, []);

  const fetchBrands = async () => {
    const { data } = await supabase.from('businesses').select('*').order('created_at', { ascending: false });
    if (data) {
      setBrands(data as Brand[]);
      // Batch query instead of N+1
      const { data: campData } = await supabase.from('campaigns').select('brand_id');
      const counts: Record<string, number> = {};
      (campData || []).forEach((c: any) => { counts[c.brand_id] = (counts[c.brand_id] || 0) + 1; });
      setCampaignCounts(counts);
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    const { error } = await supabase.from('businesses').update({ approved }).eq('id', id);
    if (error) { setToast('Update failed'); setTimeout(() => setToast(null), 3000); return; }
    if (approved) sendBusinessApprovedEmail(id).catch(() => {});
    else sendBusinessDeniedEmail(id).catch(() => {});
    setToast(`Brand ${approved ? 'approved' : 'denied'}`);
    setTimeout(() => setToast(null), 3000);
    fetchBrands();
  };

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#1C1917] text-white px-4 py-2.5 rounded-[8px] text-[14px] font-medium" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>{toast}</div>
      )}

      <div className="bg-white border-[0.5px] border-[rgba(0,0,0,0.08)] rounded-[10px] overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr>
            <th className={thCls}>Brand</th><th className={thCls}>Category</th><th className={thCls}>Region</th>
            <th className={thCls}>Instagram</th><th className={thCls}>Campaigns</th><th className={thCls}>Status</th>
            <th className={thCls}>Actions</th>
          </tr></thead>
          <tbody>
            {brands.map(b => (
              <tr key={b.id} onClick={() => setPeekBrand(peekBrand?.id === b.id ? null : b)}
                className={`cursor-pointer transition-colors ${peekBrand?.id === b.id ? 'bg-[rgba(0,0,0,0.04)]' : 'hover:bg-[rgba(0,0,0,0.02)]'}`} style={{ height: 44 }}>
                <td className={tdCls}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[rgba(196,103,74,0.08)] flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-semibold text-[#C4674A]">{b.name[0]}</span>
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
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
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

      {peekBrand && (
        <BrandPeekPanel
          brand={peekBrand}
          campaignCount={campaignCounts[peekBrand.id] || 0}
          onClose={() => setPeekBrand(null)}
          onApprove={handleApprove}
        />
      )}
      {showModal && <CreateBrandModal onClose={onCloseModal} onCreated={() => { onCloseModal(); fetchBrands(); }} />}
    </div>
  );
}
