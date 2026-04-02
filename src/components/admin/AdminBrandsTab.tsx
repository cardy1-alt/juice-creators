import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendBusinessApprovedEmail, sendBusinessDeniedEmail } from '../../lib/notifications';
import { Plus, Check, X } from 'lucide-react';

interface Brand {
  id: string; name: string; slug: string; owner_email: string; category: string;
  region: string; approved: boolean; is_live: boolean; instagram_handle: string | null;
  address: string | null; bio: string | null; created_at: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CATEGORIES = ['Food & Drink', 'Beauty', 'Wellness', 'Experience', 'Retail'];

export default function AdminBrandsTab() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaignCounts, setCampaignCounts] = useState<Record<string, number>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', category: '', region: 'Suffolk', instagram: '', address: '', bio: '' });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [brandCampaigns, setBrandCampaigns] = useState<any[]>([]);

  useEffect(() => { fetchBrands(); }, []);

  const fetchBrands = async () => {
    const { data } = await supabase.from('businesses').select('*').order('created_at', { ascending: false });
    if (data) {
      setBrands(data as Brand[]);
      // Fetch campaign counts
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

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.category) return;
    setCreating(true);

    const slug = slugify(form.name);
    const { data: existing } = await supabase.from('businesses').select('id').eq('slug', slug).limit(1);
    if (existing && existing.length > 0) {
      setToast('A brand with this name already exists');
      setCreating(false);
      return;
    }

    await supabase.from('businesses').insert({
      name: form.name,
      slug,
      owner_email: form.email,
      category: form.category,
      region: form.region,
      instagram_handle: form.instagram || null,
      address: form.address || null,
      bio: form.bio || null,
      approved: true,
      is_live: true,
      onboarding_complete: true,
      onboarding_step: 4,
    });

    setForm({ name: '', email: '', category: '', region: 'Suffolk', instagram: '', address: '', bio: '' });
    setShowCreate(false);
    setCreating(false);
    setToast('Brand created');
    setTimeout(() => setToast(null), 3000);
    fetchBrands();
  };

  const viewBrandCampaigns = async (brandId: string) => {
    if (selectedBrand === brandId) { setSelectedBrand(null); return; }
    const { data } = await supabase.from('campaigns').select('id, title, status, created_at').eq('brand_id', brandId).order('created_at', { ascending: false });
    setBrandCampaigns(data || []);
    setSelectedBrand(brandId);
  };

  const inputCls = 'w-full px-3 py-2 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)]';
  const labelCls = 'block text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1.5';
  const thCls = 'text-left text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] py-3 px-3 border-b border-[var(--ink-10)]';
  const tdCls = 'py-3 px-3 text-[14px] text-[var(--ink)] border-b border-[var(--ink-10)]';

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[var(--ink)] text-white px-4 py-2.5 rounded-[var(--r-sm)] text-[14px] font-medium shadow-lg">{toast}</div>
      )}

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[24px] font-bold text-[var(--ink)]" style={{ letterSpacing: '-0.4px' }}>Brands</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 transition-opacity"
          style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
          <Plus size={16} /> Create Brand
        </button>
      </div>

      {showCreate && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-semibold text-[var(--ink)]">Create Brand</h2>
            <button onClick={() => setShowCreate(false)} className="text-[var(--ink-35)] hover:text-[var(--ink)]"><X size={20} /></button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Brand name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Owner email *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Category *</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputCls} required>
                <option value="">Select...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Region</label>
              <select value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} className={inputCls}>
                <option value="Suffolk">Suffolk</option>
                <option value="Norfolk">Norfolk</option>
                <option value="Cambridgeshire">Cambridgeshire</option>
                <option value="Essex">Essex</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Instagram handle</label>
              <input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} className={inputCls} placeholder="@handle" />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Bio</label>
              <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} className={`${inputCls} h-16 resize-none`} />
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={creating}
                className="px-5 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 transition-opacity disabled:opacity-50">
                {creating ? 'Creating...' : 'Create Brand'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr>
            <th className={thCls}>Name</th><th className={thCls}>Category</th><th className={thCls}>Region</th>
            <th className={thCls}>Email</th><th className={thCls}>Instagram</th><th className={thCls}>Campaigns</th>
            <th className={thCls}>Status</th><th className={thCls}>Actions</th>
          </tr></thead>
          <tbody>
            {brands.map(b => (
              <>
                <tr key={b.id} onClick={() => viewBrandCampaigns(b.id)} className="hover:bg-[var(--shell)] cursor-pointer">
                  <td className={`${tdCls} font-medium`}>{b.name}</td>
                  <td className={`${tdCls} text-[var(--ink-60)]`}>{b.category}</td>
                  <td className={`${tdCls} text-[var(--ink-60)]`}>{b.region}</td>
                  <td className={`${tdCls} text-[var(--ink-60)]`}>{b.owner_email}</td>
                  <td className={`${tdCls} text-[var(--ink-60)]`}>{b.instagram_handle || '—'}</td>
                  <td className={tdCls}>{campaignCounts[b.id] || 0}</td>
                  <td className={tdCls}>
                    {b.approved
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-sm)] text-[12px] font-semibold bg-[rgba(45,122,79,0.1)] text-[var(--success)]">Approved</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-sm)] text-[12px] font-semibold bg-[var(--terra-light)] text-[var(--terra)]">Pending</span>
                    }
                  </td>
                  <td className={tdCls}>
                    {!b.approved && (
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleApprove(b.id, true); }} className="p-1.5 rounded hover:bg-[rgba(45,122,79,0.1)] text-[var(--success)]"><Check size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleApprove(b.id, false); }} className="p-1.5 rounded hover:bg-[rgba(220,38,38,0.1)] text-[#DC2626]"><X size={16} /></button>
                      </div>
                    )}
                  </td>
                </tr>
                {selectedBrand === b.id && (
                  <tr key={`${b.id}-campaigns`}>
                    <td colSpan={8} className="bg-[var(--shell)] px-6 py-4 border-b border-[var(--ink-10)]">
                      <p className="text-[13px] font-semibold text-[var(--ink-60)] mb-2">Campaigns for {b.name}</p>
                      {brandCampaigns.length > 0 ? (
                        <div className="space-y-1">
                          {brandCampaigns.map(c => (
                            <div key={c.id} className="flex items-center gap-3 text-[14px]">
                              <span className="font-medium text-[var(--ink)]">{c.title}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--r-sm)] text-[11px] font-semibold bg-[var(--terra-light)] text-[var(--terra)]">{c.status}</span>
                              <span className="text-[var(--ink-35)] text-[13px]">{fmtDate(c.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[13px] text-[var(--ink-35)]">No campaigns yet</p>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
            {brands.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-[14px] text-[var(--ink-35)]">No brands yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
