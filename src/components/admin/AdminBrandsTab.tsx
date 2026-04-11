import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendBusinessApprovedEmail, sendBusinessDeniedEmail } from '../../lib/notifications';
import { getAvatarColors } from '../../lib/avatarColors';
import { Check, X, AlertCircle, ExternalLink, Eye, Pencil, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ImageUpload from '../ImageUpload';
import Select from '../ui/Select';

interface Brand {
  id: string; name: string; slug: string; owner_email: string; category: string;
  region: string; approved: boolean; instagram_handle: string | null;
  address: string | null; bio: string | null; created_at: string;
  logo_url: string | null;
}

const CATEGORIES = ['Food & Drink', 'Beauty', 'Wellness', 'Experience', 'Retail'];
const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-50)] font-['Instrument_Sans']";
const labelCls = "block text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1.5";
const thCls = "text-left text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] py-[10px] px-4 bg-[rgba(42,32,24,0.02)]";
const tdCls = "py-0 px-4 text-[14px] text-[var(--ink)] border-b border-[rgba(42,32,24,0.06)]";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CreateBrandModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const [form, setForm] = useState({ name: '', email: '', category: '', region: 'Suffolk', instagram: '', address: '', bio: '', logo_url: '' });
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
      address: form.address || null, bio: form.bio || null, logo_url: form.logo_url || null,
      approved: true, onboarding_complete: true,
    });
    if (insertErr) { setError('Failed to create brand — ' + insertErr.message); setCreating(false); return; }

    // Invite brand owner — creates auth user and sends "set your password" email
    const { data: fnData, error: fnErr } = await supabase.functions.invoke('invite-brand', {
      body: { email: form.email, brandName: form.name },
    });
    if (fnErr) console.error('[CreateBrand] invite-brand failed:', fnErr.message);

    setCreating(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(42,32,24,0.40)] animate-overlay" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] w-full max-w-[640px] mx-4 flex flex-col overflow-hidden animate-slide-up" style={{ maxHeight: '88vh' }}>
        <div className="flex items-center justify-between px-4 md:px-6 py-5 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <h2 className="text-[20px] font-semibold text-[var(--ink)]">Create Brand</h2>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-full bg-[rgba(42,32,24,0.02)] flex items-center justify-center text-[var(--ink-50)] hover:bg-[#EDE9E3]"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] mb-4" style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626' }}>
              <AlertCircle size={14} />
              <span className="text-[14px] font-medium">{error}</span>
            </div>
          )}
          <div className="flex justify-center mb-5">
            <ImageUpload value={form.logo_url} onChange={url => setForm(p => ({ ...p, logo_url: url }))} folder="logos" label="Logo" shape="circle" />
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Brand Name *</label><input value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setError(''); }} className={inputCls} required /></div>
            <div><label className={labelCls}>Owner Email *</label><input type="email" value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setError(''); }} className={inputCls} required /></div>
            <div><label className={labelCls}>Category *</label><Select value={form.category} onChange={val => setForm(p => ({ ...p, category: val }))} placeholder="Select..." options={[{ value: '', label: 'Select...' }, ...CATEGORIES.map(c => ({ value: c, label: c }))]} /></div>
            <div><label className={labelCls}>Region</label><Select value={form.region} onChange={val => setForm(p => ({ ...p, region: val }))} options={[{ value: 'Suffolk', label: 'Suffolk' }, { value: 'Norfolk', label: 'Norfolk' }, { value: 'Cambridgeshire', label: 'Cambridgeshire' }, { value: 'Essex', label: 'Essex' }]} /></div>
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
function BrandPeekPanel({ brand, campaignCount, onClose, onApprove, onViewAs, onRefresh, onDelete }: {
  brand: Brand; campaignCount: number; onClose: () => void;
  onApprove: (id: string, approved: boolean) => void;
  onViewAs: (brand: Brand) => void; onRefresh: () => void;
  onDelete: () => void;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const peekLabel = "text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1";

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    name: brand.name,
    owner_email: brand.owner_email,
    category: brand.category,
    region: brand.region,
    instagram_handle: brand.instagram_handle || '',
    address: brand.address || '',
    bio: brand.bio || '',
    logo_url: brand.logo_url || '',
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('businesses').update({
      name: form.name,
      category: form.category,
      region: form.region,
      instagram_handle: form.instagram_handle || null,
      address: form.address || null,
      bio: form.bio || null,
      logo_url: form.logo_url || null,
    }).eq('id', brand.id);
    setSaving(false);
    if (error) { showToast('Failed to save'); return; }
    showToast('Brand updated');
    setEditing(false);
    onRefresh();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 animate-overlay" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[380px] bg-white border-l border-[rgba(42,32,24,0.08)] flex flex-col animate-slide-in-right" style={{ boxShadow: '-4px 0 24px rgba(42,32,24,0.10)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: getAvatarColors(brand.name[0]).bg }}>
              <span className="text-[15px] font-semibold" style={{ color: getAvatarColors(brand.name[0]).text }}>{brand.name[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-[var(--ink)] truncate">{brand.name}</p>
              <p className="text-[14px] text-[var(--ink-50)]">{brand.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-3">
            {!editing && (
              <button onClick={() => setEditing(true)} title="Edit brand"
                className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[var(--ink-35)] hover:text-[var(--ink-60)] hover:bg-[rgba(42,32,24,0.06)] transition-colors">
                <Pencil size={14} />
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[var(--ink-50)] hover:bg-[rgba(42,32,24,0.06)] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {toast && (
          <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[999px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>{toast}</div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {editing ? (
            /* ── Edit mode ── */
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Logo</label>
                <ImageUpload value={form.logo_url} onChange={url => setForm({ ...form, logo_url: url })} folder="logos" shape="circle" />
              </div>
              <div>
                <label className={labelCls}>Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Owner Email</label>
                <input value={form.owner_email} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
                <p className="text-[11px] text-[var(--ink-35)] mt-1">Email cannot be changed from here</p>
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <Select value={form.category} onChange={val => setForm({ ...form, category: val })} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
              </div>
              <div>
                <label className={labelCls}>Region</label>
                <Select value={form.region} onChange={val => setForm({ ...form, region: val })} options={['Suffolk', 'Norfolk', 'Cambridgeshire', 'Essex'].map(r => ({ value: r, label: r }))} />
              </div>
              <div>
                <label className={labelCls}>Instagram Handle</label>
                <input value={form.instagram_handle} onChange={e => setForm({ ...form, instagram_handle: e.target.value })} className={inputCls} placeholder="@handle" />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Full address" />
              </div>
              <div>
                <label className={labelCls}>Bio</label>
                <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} className={inputCls} rows={3} placeholder="Short description" />
              </div>
            </div>
          ) : (
            /* ── View mode ── */
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-5">
                <div>
                  <p className={peekLabel}>Status</p>
                  {brand.approved
                    ? <span className="inline-flex items-center rounded-[999px] text-[12px] font-medium" style={{ padding: '3px 9px', background: '#E1F5EE', color: '#0F6E56' }}>Approved</span>
                    : <span className="inline-flex items-center rounded-[999px] text-[12px] font-medium" style={{ padding: '3px 9px', background: '#FAEEDA', color: '#854F0B' }}>Pending</span>
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
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0 space-y-2">
          {editing ? (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[14px] font-semibold hover:bg-[rgba(42,32,24,0.02)]">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] font-semibold hover:opacity-[0.85] disabled:opacity-40">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <>
              {!brand.approved && (
                <div className="flex gap-2">
                  <button onClick={() => { onApprove(brand.id, true); onClose(); }}
                    className="flex-1 px-4 py-2.5 rounded-[10px] bg-[#2D7A4F] text-white text-[14px] font-semibold hover:opacity-[0.85]">
                    Approve
                  </button>
                  <button onClick={() => { onApprove(brand.id, false); onClose(); }}
                    className="flex-1 px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[14px] font-semibold hover:bg-[rgba(42,32,24,0.02)]">
                    Deny
                  </button>
                </div>
              )}
              <button onClick={() => { onViewAs(brand); onClose(); }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[14px] font-semibold hover:bg-[rgba(42,32,24,0.02)] transition-colors">
                <Eye size={14} /> View as Brand
              </button>
              <div className="flex justify-center mt-2">
                <button onClick={onDelete} className="text-[14px] text-[var(--destructive)] font-medium hover:underline">Delete brand</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminBrandsTab({ showModal, onCloseModal, initialPeekId, onPeekHandled }: { showModal: boolean; onCloseModal: () => void; initialPeekId?: string; onPeekHandled?: () => void }) {
  const authCtx = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaignCounts, setCampaignCounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [peekBrand, setPeekBrand] = useState<Brand | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'alphabetical'>('newest');

  useEffect(() => { fetchBrands(); }, []);

  // Cmd-K deep link
  useEffect(() => {
    if (initialPeekId && brands.length > 0) {
      const b = brands.find(x => x.id === initialPeekId);
      if (b) { setPeekBrand(b); onPeekHandled?.(); }
    }
  }, [initialPeekId, brands]);

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

  const filteredBrands = brands
    .filter(b => {
      if (statusFilter === 'approved' && !b.approved) return false;
      if (statusFilter === 'pending' && b.approved) return false;
      if (search) {
        const q = search.toLowerCase();
        return b.name.toLowerCase().includes(q) || b.owner_email.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'alphabetical') return a.name.localeCompare(b.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div>
      {toast && (
        <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[999px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>{toast}</div>
      )}

      {/* Search & filter toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-50)]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or category..."
            className="w-full pl-9 pr-4 py-2.5 rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[14px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)]" />
        </div>
        <Select value={statusFilter} onChange={setStatusFilter} options={[
          { value: 'all', label: 'All statuses' },
          { value: 'approved', label: 'Approved' },
          { value: 'pending', label: 'Pending' },
        ]} />
        <Select value={sortBy} onChange={val => setSortBy(val as any)} options={[
          { value: 'newest', label: 'Newest first' },
          { value: 'alphabetical', label: 'A — Z' },
        ]} />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filteredBrands.map(b => (
          <div key={b.id} onClick={() => setPeekBrand(peekBrand?.id === b.id ? null : b)}
            className="bg-white rounded-[12px] p-4 active:bg-[rgba(42,32,24,0.02)]" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: getAvatarColors(b.name[0]).bg }}>
                  <span className="text-[12px] font-semibold" style={{ color: getAvatarColors(b.name[0]).text }}>{b.name[0]}</span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[var(--ink)]">{b.name}</p>
                  <p className="text-[12px] text-[var(--ink-60)]">{b.category}</p>
                </div>
              </div>
              {b.approved
                ? <span className="inline-flex items-center px-2 py-0.5 rounded-[999px] text-[12px] font-semibold" style={{ background: 'rgba(45,122,79,0.08)', color: '#2D7A4F' }}>Approved</span>
                : <span className="inline-flex items-center px-2 py-0.5 rounded-[999px] text-[12px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: 'var(--terra)' }}>Pending</span>
              }
            </div>
            <div className="flex items-center gap-3 text-[12px] text-[var(--ink-50)]">
              <span>{b.region}</span>
              {b.instagram_handle && <span>@{b.instagram_handle.replace('@','')}</span>}
              <span>{campaignCounts[b.id] || 0} campaigns</span>
            </div>
          </div>
        ))}
        {brands.length === 0 && <p className="py-12 text-center text-[14px] text-[var(--ink-60)]">No brands yet</p>}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-[12px] overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead><tr>
            <th className={thCls}>Brand</th><th className={thCls}>Category</th><th className={thCls}>Region</th>
            <th className={thCls}>Instagram</th><th className={thCls}>Campaigns</th><th className={thCls}>Status</th>
            <th className={thCls}>Actions</th>
          </tr></thead>
          <tbody>
            {filteredBrands.map(b => (
              <tr key={b.id} onClick={() => setPeekBrand(peekBrand?.id === b.id ? null : b)}
                className={`cursor-pointer transition-colors ${peekBrand?.id === b.id ? 'bg-[rgba(42,32,24,0.04)]' : 'hover:bg-[rgba(42,32,24,0.03)]'}`} style={{ height: 44 }}>
                <td className={tdCls}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: getAvatarColors(b.name[0]).bg }}>
                      <span className="text-[12px] font-semibold" style={{ color: getAvatarColors(b.name[0]).text }}>{b.name[0]}</span>
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
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-[12px] font-semibold" style={{ background: 'rgba(45,122,79,0.08)', color: '#2D7A4F' }}>Approved</span>
                    : <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-[12px] font-semibold" style={{ background: 'rgba(196,103,74,0.08)', color: 'var(--terra)' }}>Pending</span>
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
              <tr><td colSpan={7} className="py-12 text-center text-[14px] text-[var(--ink-60)]">No brands yet</td></tr>
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
          onRefresh={() => fetchBrands()}
          onDelete={() => setDeletingBrand(peekBrand.id)}
        />
      )}
      {deletingBrand && (
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-50 flex items-center justify-center animate-overlay">
          <div className="bg-white rounded-[12px] max-w-[380px] w-full mx-4 p-6 text-center animate-slide-up">
            <h3 className="nayba-h3">Delete brand?</h3>
            <p className="text-[14px] text-[var(--ink-50)] mt-2 mb-5">This will permanently remove this brand and all its campaigns, applications, and participations. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingBrand(null)} className="flex-1 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink)] font-medium text-[14px]">Cancel</button>
              <button onClick={async () => {
                const { data: brandCampaigns } = await supabase.from('campaigns').select('id').eq('brand_id', deletingBrand);
                const campaignIds = (brandCampaigns || []).map((c: any) => c.id);
                if (campaignIds.length > 0) {
                  await supabase.from('participations').delete().in('campaign_id', campaignIds);
                  await supabase.from('applications').delete().in('campaign_id', campaignIds);
                }
                await supabase.from('campaigns').delete().eq('brand_id', deletingBrand);
                await supabase.from('businesses').delete().eq('id', deletingBrand);
                setDeletingBrand(null);
                setPeekBrand(null);
                fetchBrands();
              }} className="flex-1 py-2.5 rounded-[10px] bg-[var(--destructive)] text-white font-semibold text-[14px]">Delete</button>
            </div>
          </div>
        </div>
      )}
      {showModal && <CreateBrandModal onClose={onCloseModal} onCreated={() => { onCloseModal(); fetchBrands(); }} />}
    </div>
  );
}
