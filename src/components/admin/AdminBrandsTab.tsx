import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendBusinessApprovedEmail, sendBusinessDeniedEmail } from '../../lib/notifications';
import { Check, X, AlertCircle, ExternalLink, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Brand {
  id: string; name: string; slug: string; owner_email: string; category: string;
  region: string; approved: boolean; instagram_handle: string | null;
  address: string | null; bio: string | null; created_at: string;
}

const CATEGORIES = ['Food & Drink', 'Beauty', 'Wellness', 'Experience', 'Retail'];
const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-35)] font-['Instrument_Sans']";
const labelCls = "block text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-35)] mb-1.5";
const thCls = "text-left text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-35)] py-[10px] px-4 bg-[rgba(42,32,24,0.02)]";
const tdCls = "py-0 px-4 text-[14px] text-[var(--ink)] border-b border-[rgba(42,32,24,0.06)]";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CreateBrandModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
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
      <div className="absolute inset-0 bg-[rgba(42,32,24,0.40)]" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] w-full max-w-[640px] mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>
        <div className="flex items-center justify-between px-4 md:px-6 py-5 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <h2 className="nayba-h2 text-[var(--ink)]">Create Brand</h2>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-full bg-[rgba(42,32,24,0.02)] flex items-center justify-center text-[var(--ink-35)] hover:bg-[#EDE9E3]"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] mb-4" style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626' }}>
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
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <button onClick={onClose} className="text-[14px] font-medium text-[var(--ink-60)] hover:text-[var(--ink)]">Cancel</button>
          <button onClick={handleCreate as any} disabled={creating} className="px-4 py-2 rounded-[10px] bg-[var(--terra)] text-white text-[14px] hover:opacity-[0.85] disabled:opacity-40" style={{ fontWeight: 700 }}>
            {creating ? 'Creating...' : 'Create Brand'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Brand Peek Panel ───
function BrandPeekPanel({ brand, campaignCount, onClose, onApprove, onViewAs }: {
  brand: Brand; campaignCount: number; onClose: () => void;
  onApprove: (id: string, approved: boolean) => void;
  onViewAs: (brand: Brand) => void;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const peekLabel = "text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-35)] mb-1";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[380px] bg-white border-l border-[rgba(42,32,24,0.08)] flex flex-col" style={{ boxShadow: '-4px 0 24px rgba(42,32,24,0.10)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-[rgba(196,103,74,0.08)] flex items-center justify-center flex-shrink-0">
              <span className="text-[15px] font-semibold text-[var(--terra)]">{brand.name[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-[var(--ink)] truncate">{brand.name}</p>
              <p className="text-[13px] text-[var(--ink-35)]">{brand.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[var(--ink-35)] hover:bg-[rgba(42,32,24,0.06)] transition-colors flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-5">
            <div>
              <p className={peekLabel}>Status</p>
              {brand.approved
                ? <span className="inline-flex items-center rounded-[999px] text-[11px] font-medium" style={{ padding: '3px 9px', background: '#E1F5EE', color: '#0F6E56' }}>Approved</span>
                : <span className="inline-flex items-center rounded-[999px] text-[11px] font-medium" style={{ padding: '3px 9px', background: '#FAEEDA', color: '#854F0B' }}>Pending</span>
              }
            </div>
            <div>
              <p className={peekLabel}>Region</p>
              <p className="text-[14px] text-[var(--ink)]">{brand.region}</p>
            </div>
            <div>
              <p className={peekLabel}>Campaigns</p>
              <p className="text-[14px] text-[var(--ink)]">{campaignCount}</p>
            </div>
            <div>
              <p className={peekLabel}>Added</p>
              <p className="text-[14px] text-[var(--ink)]">{fmtDate(brand.created_at)}</p>
            </div>
          </div>

          <div className="mb-4">
            <p className={peekLabel}>Owner Email</p>
            <p className="text-[14px] text-[var(--ink)]">{brand.owner_email}</p>
          </div>

          {brand.instagram_handle && (
            <div className="mb-4">
              <p className={peekLabel}>Instagram</p>
              <a href={`https://instagram.com/${brand.instagram_handle}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[14px] text-[var(--terra)] font-medium hover:underline">
                @{brand.instagram_handle} <ExternalLink size={12} />
              </a>
            </div>
          )}

          {brand.address && (
            <div className="mb-4">
              <p className={peekLabel}>Address</p>
              <p className="text-[14px] text-[var(--ink)]">{brand.address}</p>
            </div>
          )}

          {brand.bio && (
            <div className="mb-4">
              <p className={peekLabel}>Bio</p>
              <p className="text-[14px] text-[var(--ink)] leading-[1.6]">{brand.bio}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0 space-y-2">
          {!brand.approved && (
            <div className="flex gap-2">
              <button onClick={() => { onApprove(brand.id, true); onClose(); }}
                className="flex-1 px-4 py-2.5 rounded-[10px] bg-[#2D7A4F] text-white text-[13px] font-semibold hover:opacity-[0.85]">
                Approve
              </button>
              <button onClick={() => { onApprove(brand.id, false); onClose(); }}
                className="flex-1 px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[13px] font-semibold hover:bg-[rgba(42,32,24,0.02)]">
                Deny
              </button>
            </div>
          )}
          <button onClick={() => { onViewAs(brand); onClose(); }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[13px] font-semibold hover:bg-[rgba(42,32,24,0.02)] transition-colors">
            <Eye size={14} /> View as Brand
          </button>
        </div>
      </div>
    </>
  );
}

export default function AdminBrandsTab({ showModal, onCloseModal }: { showModal: boolean; onCloseModal: () => void }) {
  const authCtx = useAuth();
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
    if (!approved && !window.confirm('Deny this brand?')) return;
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
        <div className="fixed top-4 right-4 z-50 bg-[var(--ink)] text-white px-4 py-2.5 rounded-[10px] text-[14px] font-medium">{toast}</div>
      )}

      <div className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[10px] overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr>
            <th className={thCls}>Brand</th><th className={thCls}>Category</th><th className={thCls}>Region</th>
            <th className={thCls}>Instagram</th><th className={thCls}>Campaigns</th><th className={thCls}>Status</th>
            <th className={thCls}>Actions</th>
          </tr></thead>
          <tbody>
            {brands.map(b => (
              <tr key={b.id} onClick={() => setPeekBrand(peekBrand?.id === b.id ? null : b)}
                className={`cursor-pointer transition-colors ${peekBrand?.id === b.id ? 'bg-[rgba(42,32,24,0.04)]' : 'hover:bg-[rgba(42,32,24,0.03)]'}`} style={{ height: 44 }}>
                <td className={tdCls}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[rgba(196,103,74,0.08)] flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-semibold text-[var(--terra)]">{b.name[0]}</span>
                    </div>
                    <span className="font-medium">{b.name}</span>
                  </div>
                </td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{b.category}</td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{b.region}</td>
                <td className={`${tdCls} text-[var(--ink-60)]`}>{b.instagram_handle || '—'}</td>
                <td className={tdCls}>{campaignCounts[b.id] || 0}</td>
                <td className={tdCls}>
                  {b.approved
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-[11px] font-semibold" style={{ background: 'rgba(45,122,79,0.08)', color: '#2D7A4F' }}>Approved</span>
                    : <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-[11px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: 'var(--terra)' }}>Pending</span>
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
              <tr><td colSpan={7} className="py-12 text-center text-[14px] text-[var(--ink-35)]">No brands yet</td></tr>
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
          onViewAs={(b) => authCtx.setViewAs('business', b)}
        />
      )}
      {showModal && <CreateBrandModal onClose={onCloseModal} onCreated={() => { onCloseModal(); fetchBrands(); }} />}
    </div>
  );
}
