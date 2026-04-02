import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, ChevronLeft, X, Search, UserPlus, Check, XCircle, ExternalLink, Film } from 'lucide-react';

// ─── Types ───
interface Brand { id: string; name: string; }
interface Campaign {
  id: string; brand_id: string; title: string; headline: string | null; about_brand: string | null;
  perk_description: string | null; perk_value: number | null; perk_type: string | null;
  target_city: string | null; target_county: string | null; content_requirements: string | null;
  talking_points: string[] | null; inspiration: any[] | null; deliverables: any;
  creator_target: number; open_date: string | null; expression_deadline: string | null;
  content_deadline: string | null; status: string; min_level: number; created_at: string;
  businesses?: { name: string };
}
interface Application {
  id: string; campaign_id: string; creator_id: string; pitch: string | null;
  status: string; applied_at: string; selected_at: string | null; confirmed_at: string | null;
  creators?: { id: string; name: string; display_name: string | null; instagram_handle: string; follower_count: string | null; completion_rate: number; level: number; };
}
interface Participation {
  id: string; application_id: string; campaign_id: string; creator_id: string;
  perk_sent: boolean; perk_sent_at: string | null; reel_url: string | null;
  reel_submitted_at: string | null; reach: number | null; likes: number | null;
  comments: number | null; views: number | null; status: string; completed_at: string | null;
  creators?: { name: string; display_name: string | null; instagram_handle: string; };
}
interface Creator { id: string; name: string; display_name: string | null; instagram_handle: string; level: number; completion_rate: number; }

// ─── Status Badge ───
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-[var(--ink-10)] text-[var(--ink-60)]',
    active: 'bg-[var(--terra-light)] text-[var(--terra)]',
    selecting: 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6]',
    live: 'bg-[rgba(45,122,79,0.1)] text-[var(--success)]',
    completed: 'bg-[var(--ink-10)] text-[var(--ink-60)]',
    interested: 'bg-[var(--terra-light)] text-[var(--terra)]',
    selected: 'bg-[rgba(45,122,79,0.1)] text-[var(--success)]',
    confirmed: 'bg-[rgba(45,122,79,0.1)] text-[var(--success)]',
    declined: 'bg-[var(--ink-10)] text-[var(--ink-60)]',
    visited: 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6]',
    content_submitted: 'bg-[rgba(59,130,246,0.1)] text-[#3B82F6]',
    overdue: 'bg-[rgba(220,38,38,0.1)] text-[#DC2626]',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[var(--r-sm)] text-[12px] font-semibold ${styles[status] || styles.draft}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Campaign Form ───
function CampaignForm({ brands, campaign, onSave, onCancel }: {
  brands: Brand[]; campaign: Campaign | null; onSave: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    brand_id: campaign?.brand_id || '',
    title: campaign?.title || '',
    headline: campaign?.headline || '',
    about_brand: campaign?.about_brand || '',
    perk_description: campaign?.perk_description || '',
    perk_value: campaign?.perk_value?.toString() || '',
    perk_type: campaign?.perk_type || 'gift_card',
    target_city: campaign?.target_city || '',
    target_county: campaign?.target_county || 'Suffolk',
    creator_target: campaign?.creator_target?.toString() || '10',
    min_level: campaign?.min_level?.toString() || '1',
    content_requirements: campaign?.content_requirements || '',
    tp1: campaign?.talking_points?.[0] || '',
    tp2: campaign?.talking_points?.[1] || '',
    tp3: campaign?.talking_points?.[2] || '',
    insp: campaign?.inspiration || [{ title: '', description: '' }],
    reel: campaign?.deliverables?.reel !== false,
    story: campaign?.deliverables?.story === true,
    open_date: campaign?.open_date?.slice(0, 10) || '',
    expression_deadline: campaign?.expression_deadline?.slice(0, 10) || '',
    content_deadline: campaign?.content_deadline?.slice(0, 10) || '',
    status: campaign?.status || 'draft',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async (asStatus?: string) => {
    if (!form.brand_id || !form.title) return;
    setSaving(true);
    const payload: any = {
      brand_id: form.brand_id,
      title: form.title,
      headline: form.headline || null,
      about_brand: form.about_brand || null,
      perk_description: form.perk_description || null,
      perk_value: form.perk_value ? parseFloat(form.perk_value) : null,
      perk_type: form.perk_type,
      target_city: form.target_city || null,
      target_county: form.target_county || null,
      creator_target: parseInt(form.creator_target) || 10,
      min_level: parseInt(form.min_level) || 1,
      content_requirements: form.content_requirements || null,
      talking_points: [form.tp1, form.tp2, form.tp3].filter(Boolean),
      inspiration: form.insp.filter((i: any) => i.title),
      deliverables: { reel: form.reel, story: form.story },
      open_date: form.open_date ? new Date(form.open_date).toISOString() : null,
      expression_deadline: form.expression_deadline ? new Date(form.expression_deadline).toISOString() : null,
      content_deadline: form.content_deadline ? new Date(form.content_deadline).toISOString() : null,
      status: asStatus || form.status,
    };
    if (campaign) {
      await supabase.from('campaigns').update(payload).eq('id', campaign.id);
    } else {
      await supabase.from('campaigns').insert(payload);
    }
    setSaving(false);
    onSave();
  };

  const inputCls = 'w-full px-3 py-2 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[var(--ink)] text-[15px] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)]';
  const labelCls = 'block text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-1.5';

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--ink)]">{campaign ? 'Edit Campaign' : 'New Campaign'}</h2>
        <button onClick={onCancel} className="text-[var(--ink-35)] hover:text-[var(--ink)]"><X size={20} /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Brand */}
        <div>
          <label className={labelCls}>Brand *</label>
          <select value={form.brand_id} onChange={e => set('brand_id', e.target.value)} className={inputCls}>
            <option value="">Select brand...</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {/* Title */}
        <div>
          <label className={labelCls}>Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="Campaign title" />
        </div>
        {/* Headline */}
        <div className="col-span-2">
          <label className={labelCls}>Headline</label>
          <input value={form.headline} onChange={e => set('headline', e.target.value)} className={inputCls} placeholder="Short punchy description" />
        </div>
        {/* About brand */}
        <div className="col-span-2">
          <label className={labelCls}>About the brand</label>
          <textarea value={form.about_brand} onChange={e => set('about_brand', e.target.value)} className={`${inputCls} h-20 resize-none`} />
        </div>
        {/* Perk */}
        <div className="col-span-2">
          <label className={labelCls}>Perk description</label>
          <textarea value={form.perk_description} onChange={e => set('perk_description', e.target.value)} className={`${inputCls} h-16 resize-none`} placeholder="What the creator receives" />
        </div>
        <div>
          <label className={labelCls}>Perk value (£)</label>
          <input type="number" value={form.perk_value} onChange={e => set('perk_value', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Perk type</label>
          <select value={form.perk_type} onChange={e => set('perk_type', e.target.value)} className={inputCls}>
            <option value="gift_card">Gift Card</option>
            <option value="experience">Experience</option>
            <option value="product">Product</option>
          </select>
        </div>
        {/* Location */}
        <div>
          <label className={labelCls}>Target city</label>
          <input value={form.target_city} onChange={e => set('target_city', e.target.value)} className={inputCls} placeholder="e.g. Bury St Edmunds" />
        </div>
        <div>
          <label className={labelCls}>Target county</label>
          <select value={form.target_county} onChange={e => set('target_county', e.target.value)} className={inputCls}>
            <option value="Suffolk">Suffolk</option>
            <option value="Norfolk">Norfolk</option>
            <option value="Cambridgeshire">Cambridgeshire</option>
            <option value="Essex">Essex</option>
          </select>
        </div>
        {/* Creator target + min level */}
        <div>
          <label className={labelCls}>Creator target</label>
          <input type="number" value={form.creator_target} onChange={e => set('creator_target', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Min level</label>
          <select value={form.min_level} onChange={e => set('min_level', e.target.value)} className={inputCls}>
            <option value="1">1 — Newcomer</option>
            <option value="3">3 — Regular</option>
            <option value="5">5 — Trusted</option>
          </select>
        </div>
        {/* Content requirements */}
        <div className="col-span-2">
          <label className={labelCls}>Content requirements</label>
          <textarea value={form.content_requirements} onChange={e => set('content_requirements', e.target.value)} className={`${inputCls} h-20 resize-none`} />
        </div>
        {/* Talking points */}
        <div className="col-span-2">
          <label className={labelCls}>Talking points</label>
          <div className="space-y-2">
            <input value={form.tp1} onChange={e => set('tp1', e.target.value)} className={inputCls} placeholder="Key message 1" />
            <input value={form.tp2} onChange={e => set('tp2', e.target.value)} className={inputCls} placeholder="Key message 2" />
            <input value={form.tp3} onChange={e => set('tp3', e.target.value)} className={inputCls} placeholder="Key message 3" />
          </div>
        </div>
        {/* Inspiration */}
        <div className="col-span-2">
          <label className={labelCls}>Inspiration</label>
          {form.insp.map((item: any, i: number) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={item.title} onChange={e => { const n = [...form.insp]; n[i] = { ...n[i], title: e.target.value }; set('insp', n); }} className={`${inputCls} flex-1`} placeholder="Title" />
              <input value={item.description} onChange={e => { const n = [...form.insp]; n[i] = { ...n[i], description: e.target.value }; set('insp', n); }} className={`${inputCls} flex-[2]`} placeholder="Description" />
              {form.insp.length > 1 && <button onClick={() => set('insp', form.insp.filter((_: any, j: number) => j !== i))} className="text-[var(--ink-35)] hover:text-[var(--terra)]"><X size={16} /></button>}
            </div>
          ))}
          {form.insp.length < 4 && <button onClick={() => set('insp', [...form.insp, { title: '', description: '' }])} className="text-[13px] text-[var(--terra)] font-medium">+ Add inspiration</button>}
        </div>
        {/* Deliverables */}
        <div className="col-span-2">
          <label className={labelCls}>Deliverables</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-[14px] text-[var(--ink)]">
              <input type="checkbox" checked={form.reel} onChange={e => set('reel', e.target.checked)} className="accent-[var(--terra)]" /> Reel
            </label>
            <label className="flex items-center gap-2 text-[14px] text-[var(--ink)]">
              <input type="checkbox" checked={form.story} onChange={e => set('story', e.target.checked)} className="accent-[var(--terra)]" /> Story
            </label>
          </div>
        </div>
        {/* Dates */}
        <div>
          <label className={labelCls}>Open date</label>
          <input type="date" value={form.open_date} onChange={e => set('open_date', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Expression deadline</label>
          <input type="date" value={form.expression_deadline} onChange={e => set('expression_deadline', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Content deadline</label>
          <input type="date" value={form.content_deadline} onChange={e => set('content_deadline', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>
      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--ink-10)]">
        <button onClick={() => handleSave('draft')} disabled={saving} className="px-5 py-2.5 rounded-[var(--r-pill)] border border-[var(--border)] text-[var(--ink)] font-semibold text-[15px] hover:bg-[var(--shell)] transition-colors">
          Save as Draft
        </button>
        <button onClick={() => handleSave('active')} disabled={saving} className="px-5 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 transition-opacity" style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
          {saving ? 'Saving...' : 'Publish'}
        </button>
      </div>
    </div>
  );
}

// ─── Campaign Detail Panel ───
function CampaignDetailPanel({ campaign, onClose, onRefresh }: {
  campaign: Campaign; onClose: () => void; onRefresh: () => void;
}) {
  const [subTab, setSubTab] = useState<'applicants' | 'participations' | 'content'>('applicants');
  const [applications, setApplications] = useState<Application[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [allCreators, setAllCreators] = useState<Creator[]>([]);
  const [showAddCreator, setShowAddCreator] = useState(false);
  const [creatorSearch, setCreatorSearch] = useState('');

  useEffect(() => { fetchDetail(); }, [campaign.id]);

  const fetchDetail = async () => {
    const [appRes, partRes, crRes] = await Promise.all([
      supabase.from('applications').select('*, creators(id, name, display_name, instagram_handle, follower_count, completion_rate, level)').eq('campaign_id', campaign.id).order('applied_at', { ascending: false }),
      supabase.from('participations').select('*, creators(name, display_name, instagram_handle)').eq('campaign_id', campaign.id).order('created_at', { ascending: false }),
      supabase.from('creators').select('id, name, display_name, instagram_handle, level, completion_rate').eq('approved', true).order('name'),
    ]);
    if (appRes.data) setApplications(appRes.data as Application[]);
    if (partRes.data) setParticipations(partRes.data as Participation[]);
    if (crRes.data) setAllCreators(crRes.data);
  };

  const updateAppStatus = async (appId: string, status: string) => {
    const updates: any = { status };
    if (status === 'selected') updates.selected_at = new Date().toISOString();
    if (status === 'confirmed') {
      updates.confirmed_at = new Date().toISOString();
      // Also create participation
      const app = applications.find(a => a.id === appId);
      if (app) {
        await supabase.from('participations').insert({
          application_id: appId,
          campaign_id: campaign.id,
          creator_id: app.creator_id,
          completion_rate_snapshot: app.creators?.completion_rate || 0,
        });
      }
    }
    await supabase.from('applications').update(updates).eq('id', appId);
    fetchDetail();
    onRefresh();
  };

  const addCreatorManually = async (creatorId: string) => {
    await supabase.from('applications').insert({
      campaign_id: campaign.id,
      creator_id: creatorId,
      status: 'selected',
      selected_at: new Date().toISOString(),
    });
    setShowAddCreator(false);
    setCreatorSearch('');
    fetchDetail();
    onRefresh();
  };

  const updateParticipation = async (partId: string, updates: any) => {
    await supabase.from('participations').update(updates).eq('id', partId);
    fetchDetail();
    onRefresh();
  };

  const appliedCreatorIds = new Set(applications.map(a => a.creator_id));
  const filteredCreators = allCreators.filter(c => !appliedCreatorIds.has(c.id) && (c.name.toLowerCase().includes(creatorSearch.toLowerCase()) || c.instagram_handle.toLowerCase().includes(creatorSearch.toLowerCase())));

  const subTabs = [
    { key: 'applicants', label: 'Applicants', count: applications.length },
    { key: 'participations', label: 'Participations', count: participations.length },
    { key: 'content', label: 'Content', count: participations.filter(p => p.reel_url).length },
  ] as const;

  const thCls = 'text-left text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] py-3 px-3 border-b border-[var(--ink-10)]';
  const tdCls = 'py-3 px-3 text-[14px] text-[var(--ink)] border-b border-[var(--ink-10)]';

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <button onClick={onClose} className="flex items-center gap-1 text-[13px] text-[var(--ink-35)] hover:text-[var(--terra)] mb-2">
            <ChevronLeft size={14} /> Back to campaigns
          </button>
          <h2 className="text-[20px] font-bold text-[var(--ink)]">{campaign.title}</h2>
          <p className="text-[14px] text-[var(--ink-60)]">{campaign.businesses?.name} &middot; {campaign.target_city}</p>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--ink-10)]">
        {subTabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px ${subTab === t.key ? 'border-[var(--terra)] text-[var(--terra)]' : 'border-transparent text-[var(--ink-35)] hover:text-[var(--ink)]'}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Applicants */}
      {subTab === 'applicants' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAddCreator(!showAddCreator)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-sm)] text-[13px] font-semibold text-[var(--terra)] bg-[var(--terra-light)] hover:bg-[rgba(196,103,74,0.14)]">
              <UserPlus size={14} /> Add creator manually
            </button>
          </div>
          {showAddCreator && (
            <div className="mb-4 p-3 border border-[var(--border)] rounded-[var(--r-sm)] bg-[var(--shell)]">
              <input value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} placeholder="Search creators..." className="w-full px-3 py-2 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[14px] mb-2 focus:outline-none focus:border-[var(--terra)]" />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredCreators.slice(0, 10).map(c => (
                  <button key={c.id} onClick={() => addCreatorManually(c.id)} className="w-full text-left px-3 py-2 rounded-[var(--r-sm)] hover:bg-[var(--terra-light)] flex items-center justify-between text-[14px]">
                    <span>{c.display_name || c.name} <span className="text-[var(--ink-35)]">{c.instagram_handle}</span></span>
                    <span className="text-[12px] text-[var(--ink-35)]">L{c.level} &middot; {c.completion_rate}%</span>
                  </button>
                ))}
                {filteredCreators.length === 0 && <p className="text-[13px] text-[var(--ink-35)] px-3 py-2">No matching creators</p>}
              </div>
            </div>
          )}
          <div className="overflow-x-auto"><table className="w-full min-w-[800px]">
            <thead><tr>
              <th className={thCls}>Creator</th><th className={thCls}>Instagram</th><th className={thCls}>Level</th>
              <th className={thCls}>Completion</th><th className={thCls}>Pitch</th><th className={thCls}>Applied</th>
              <th className={thCls}>Status</th><th className={thCls}>Actions</th>
            </tr></thead>
            <tbody>
              {applications.map(app => (
                <tr key={app.id} className="hover:bg-[var(--shell)]">
                  <td className={tdCls}>{app.creators?.display_name || app.creators?.name}</td>
                  <td className={`${tdCls} text-[var(--ink-60)]`}>{app.creators?.instagram_handle}</td>
                  <td className={tdCls}>{app.creators?.level}</td>
                  <td className={tdCls}>{app.creators?.completion_rate}%</td>
                  <td className={`${tdCls} max-w-[200px] truncate text-[var(--ink-60)]`}>{app.pitch || '—'}</td>
                  <td className={`${tdCls} text-[var(--ink-35)]`}>{fmtDate(app.applied_at)}</td>
                  <td className={tdCls}><StatusBadge status={app.status} /></td>
                  <td className={tdCls}>
                    <div className="flex gap-1">
                      {(app.status === 'interested') && (
                        <>
                          <button onClick={() => updateAppStatus(app.id, 'selected')} className="p-1 rounded hover:bg-[rgba(45,122,79,0.1)] text-[var(--success)]" title="Select"><Check size={16} /></button>
                          <button onClick={() => updateAppStatus(app.id, 'declined')} className="p-1 rounded hover:bg-[rgba(220,38,38,0.1)] text-[#DC2626]" title="Decline"><XCircle size={16} /></button>
                        </>
                      )}
                      {app.status === 'selected' && (
                        <button onClick={() => updateAppStatus(app.id, 'confirmed')} className="text-[12px] px-2 py-1 rounded-[var(--r-sm)] bg-[rgba(45,122,79,0.1)] text-[var(--success)] font-medium">Confirm</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-[14px] text-[var(--ink-35)]">No applicants yet</td></tr>
              )}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Participations */}
      {subTab === 'participations' && (
        <div className="overflow-x-auto"><table className="w-full min-w-[900px]">
          <thead><tr>
            <th className={thCls}>Creator</th><th className={thCls}>Status</th><th className={thCls}>Perk Sent</th>
            <th className={thCls}>Reel URL</th><th className={thCls}>Reach</th><th className={thCls}>Likes</th>
            <th className={thCls}>Comments</th><th className={thCls}>Views</th><th className={thCls}>Actions</th>
          </tr></thead>
          <tbody>
            {participations.map(p => (
              <tr key={p.id} className="hover:bg-[var(--shell)]">
                <td className={tdCls}>{p.creators?.display_name || p.creators?.name}</td>
                <td className={tdCls}>
                  <select value={p.status} onChange={e => updateParticipation(p.id, { status: e.target.value })}
                    className="text-[13px] border border-[var(--ink-10)] rounded-[var(--r-sm)] px-2 py-1 bg-white">
                    <option value="confirmed">Confirmed</option>
                    <option value="visited">Visited</option>
                    <option value="content_submitted">Content Submitted</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </td>
                <td className={tdCls}>
                  <input type="checkbox" checked={p.perk_sent} onChange={e => updateParticipation(p.id, { perk_sent: e.target.checked, ...(e.target.checked ? { perk_sent_at: new Date().toISOString() } : { perk_sent_at: null }) })} className="accent-[var(--terra)]" />
                </td>
                <td className={tdCls}>
                  <input value={p.reel_url || ''} onChange={e => updateParticipation(p.id, { reel_url: e.target.value || null, ...(e.target.value ? { reel_submitted_at: p.reel_submitted_at || new Date().toISOString(), status: 'content_submitted' } : {}) })}
                    className="text-[13px] border border-[var(--ink-10)] rounded-[var(--r-sm)] px-2 py-1 w-40 bg-white" placeholder="Paste URL" />
                </td>
                <td className={tdCls}><input type="number" value={p.reach ?? ''} onChange={e => updateParticipation(p.id, { reach: e.target.value ? parseInt(e.target.value) : null })} className="text-[13px] border border-[var(--ink-10)] rounded-[var(--r-sm)] px-2 py-1 w-20 bg-white" /></td>
                <td className={tdCls}><input type="number" value={p.likes ?? ''} onChange={e => updateParticipation(p.id, { likes: e.target.value ? parseInt(e.target.value) : null })} className="text-[13px] border border-[var(--ink-10)] rounded-[var(--r-sm)] px-2 py-1 w-20 bg-white" /></td>
                <td className={tdCls}><input type="number" value={p.comments ?? ''} onChange={e => updateParticipation(p.id, { comments: e.target.value ? parseInt(e.target.value) : null })} className="text-[13px] border border-[var(--ink-10)] rounded-[var(--r-sm)] px-2 py-1 w-20 bg-white" /></td>
                <td className={tdCls}><input type="number" value={p.views ?? ''} onChange={e => updateParticipation(p.id, { views: e.target.value ? parseInt(e.target.value) : null })} className="text-[13px] border border-[var(--ink-10)] rounded-[var(--r-sm)] px-2 py-1 w-20 bg-white" /></td>
                <td className={tdCls}>
                  {p.status !== 'completed' && (
                    <button onClick={() => updateParticipation(p.id, { status: 'completed', completed_at: new Date().toISOString() })}
                      className="text-[12px] px-2 py-1 rounded-[var(--r-sm)] bg-[rgba(45,122,79,0.1)] text-[var(--success)] font-medium">Complete</button>
                  )}
                </td>
              </tr>
            ))}
            {participations.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-center text-[14px] text-[var(--ink-35)]">No participations yet</td></tr>
            )}
          </tbody>
        </table></div>
      )}

      {/* Content */}
      {subTab === 'content' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {participations.filter(p => p.reel_url).map(p => (
            <div key={p.id} className="border border-[var(--border)] rounded-[var(--r-card)] p-4 bg-white">
              <p className="text-[14px] font-semibold text-[var(--ink)] mb-1">{p.creators?.display_name || p.creators?.name}</p>
              <a href={p.reel_url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] text-[var(--terra)] hover:underline mb-2">
                <Film size={14} /> View Reel <ExternalLink size={12} />
              </a>
              <div className="flex gap-3 text-[12px] text-[var(--ink-35)]">
                {p.reach != null && <span>Reach: {p.reach.toLocaleString()}</span>}
                {p.likes != null && <span>Likes: {p.likes}</span>}
              </div>
            </div>
          ))}
          {participations.filter(p => p.reel_url).length === 0 && (
            <div className="col-span-3 py-8 text-center text-[14px] text-[var(--ink-35)]">No content submitted yet</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ───
export default function AdminCampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [appCounts, setAppCounts] = useState<Record<string, { applicants: number; selected: number; submitted: number; completed: number }>>({});

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    const [campRes, brandRes] = await Promise.all([
      supabase.from('campaigns').select('*, businesses(name)').order('created_at', { ascending: false }),
      supabase.from('businesses').select('id, name').eq('approved', true).order('name'),
    ]);
    if (campRes.data) {
      setCampaigns(campRes.data as Campaign[]);
      // Fetch counts for each campaign
      const counts: Record<string, any> = {};
      for (const c of campRes.data) {
        const [appRes, partRes] = await Promise.all([
          supabase.from('applications').select('status').eq('campaign_id', c.id),
          supabase.from('participations').select('status').eq('campaign_id', c.id),
        ]);
        counts[c.id] = {
          applicants: appRes.data?.length || 0,
          selected: appRes.data?.filter((a: any) => a.status === 'selected' || a.status === 'confirmed').length || 0,
          submitted: partRes.data?.filter((p: any) => p.status === 'content_submitted' || p.status === 'completed').length || 0,
          completed: partRes.data?.filter((p: any) => p.status === 'completed').length || 0,
        };
      }
      setAppCounts(counts);
    }
    if (brandRes.data) setBrands(brandRes.data);
  };

  const thCls = 'text-left text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] py-3 px-3 border-b border-[var(--ink-10)]';
  const tdCls = 'py-3 px-3 text-[14px] text-[var(--ink)] border-b border-[var(--ink-10)]';

  if (view === 'form') {
    return <CampaignForm brands={brands} campaign={editingCampaign} onSave={() => { setView('list'); setEditingCampaign(null); fetchCampaigns(); }} onCancel={() => { setView('list'); setEditingCampaign(null); }} />;
  }

  if (view === 'detail' && selectedCampaign) {
    return <CampaignDetailPanel campaign={selectedCampaign} onClose={() => { setView('list'); setSelectedCampaign(null); }} onRefresh={fetchCampaigns} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[24px] font-bold text-[var(--ink)]" style={{ letterSpacing: '-0.4px' }}>Campaigns</h1>
        <button onClick={() => { setEditingCampaign(null); setView('form'); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 transition-opacity"
          style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
          <Plus size={16} /> New Campaign
        </button>
      </div>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr>
            <th className={thCls}>Brand</th><th className={thCls}>Title</th><th className={thCls}>Status</th>
            <th className={thCls}>City</th><th className={thCls}>Target</th><th className={thCls}>Applicants</th>
            <th className={thCls}>Selected</th><th className={thCls}>Submitted</th><th className={thCls}>Completed</th>
            <th className={thCls}>Deadline</th>
          </tr></thead>
          <tbody>
            {campaigns.map(c => {
              const counts = appCounts[c.id] || { applicants: 0, selected: 0, submitted: 0, completed: 0 };
              return (
                <tr key={c.id} onClick={() => { setSelectedCampaign(c); setView('detail'); }} className="hover:bg-[var(--shell)] cursor-pointer">
                  <td className={`${tdCls} font-medium`}>{c.businesses?.name || '—'}</td>
                  <td className={`${tdCls} font-medium`}>{c.title}</td>
                  <td className={tdCls}><StatusBadge status={c.status} /></td>
                  <td className={`${tdCls} text-[var(--ink-60)]`}>{c.target_city || '—'}</td>
                  <td className={tdCls}>{c.creator_target}</td>
                  <td className={tdCls}>{counts.applicants}</td>
                  <td className={tdCls}>{counts.selected}</td>
                  <td className={tdCls}>{counts.submitted}</td>
                  <td className={tdCls}>{counts.completed}</td>
                  <td className={`${tdCls} text-[var(--ink-35)]`}>{fmtDate(c.expression_deadline)}</td>
                </tr>
              );
            })}
            {campaigns.length === 0 && (
              <tr><td colSpan={10} className="py-12 text-center text-[14px] text-[var(--ink-35)]">No campaigns yet. Create your first one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
