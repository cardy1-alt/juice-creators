import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, UserPlus, Check, XCircle, ExternalLink, Film, Megaphone, Users, ChevronDown, ChevronRight, Eye } from 'lucide-react';

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

// ─── Shared styling ───
const BORDER = '#E6E2DB';
const inputCls = "w-full px-3 py-2.5 rounded-[8px] bg-[#F7F7F5] border border-[#E6E2DB] text-[#222] text-[14px] focus:outline-none focus:border-[#C4674A] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)] placeholder:text-[rgba(34,34,34,0.35)]";
const labelCls = "block text-[11px] font-semibold uppercase tracking-[0.6px] text-[rgba(34,34,34,0.60)] mb-1.5";
const thCls = "text-left text-[11px] font-semibold uppercase tracking-[0.6px] text-[rgba(34,34,34,0.35)] py-3 px-4 bg-[#F7F7F5]";
const tdCls = "py-0 px-4 text-[14px] text-[#222] border-b border-[#E6E2DB]";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'rgba(34,34,34,0.06)', color: 'rgba(34,34,34,0.60)' },
    active: { bg: 'rgba(196,103,74,0.08)', color: '#C4674A' },
    selecting: { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6' },
    live: { bg: 'rgba(45,122,79,0.08)', color: '#2D7A4F' },
    completed: { bg: 'rgba(34,34,34,0.06)', color: 'rgba(34,34,34,0.60)' },
    interested: { bg: 'rgba(196,103,74,0.08)', color: '#C4674A' },
    selected: { bg: 'rgba(45,122,79,0.08)', color: '#2D7A4F' },
    confirmed: { bg: 'rgba(45,122,79,0.08)', color: '#2D7A4F' },
    declined: { bg: 'rgba(34,34,34,0.06)', color: 'rgba(34,34,34,0.60)' },
    content_submitted: { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6' },
    overdue: { bg: 'rgba(220,38,38,0.08)', color: '#DC2626' },
  };
  const s = styles[status] || styles.draft;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-[8px] text-[11px] font-semibold" style={{ background: s.bg, color: s.color }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShortDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Campaign Modal ───
function CampaignModal({ brands, campaign, onSave, onClose }: {
  brands: Brand[]; campaign: Campaign | null; onSave: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    brand_id: campaign?.brand_id || '', title: campaign?.title || '', headline: campaign?.headline || '',
    about_brand: campaign?.about_brand || '', perk_description: campaign?.perk_description || '',
    perk_value: campaign?.perk_value?.toString() || '', perk_type: campaign?.perk_type || 'experience',
    target_city: campaign?.target_city || '', target_county: campaign?.target_county || 'Suffolk',
    creator_target: campaign?.creator_target?.toString() || '10',
    content_requirements: campaign?.content_requirements || '',
    tp1: campaign?.talking_points?.[0] || '', tp2: campaign?.talking_points?.[1] || '', tp3: campaign?.talking_points?.[2] || '',
    insp: campaign?.inspiration || [{ title: '', description: '' }, { title: '', description: '' }],
    reel: campaign?.deliverables?.reel !== false, story: campaign?.deliverables?.story === true,
    open_date: campaign?.open_date?.slice(0, 10) || '', expression_deadline: campaign?.expression_deadline?.slice(0, 10) || '',
    content_deadline: campaign?.content_deadline?.slice(0, 10) || '',
  });
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [aiError, setAiError] = useState('');
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleAiGenerate = async () => {
    const brandName = brands.find(b => b.id === form.brand_id)?.name || '';
    if (!brandName && !form.title) return;
    setAiLoading(true); setAiError(''); setAiDone(false);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are helping create a campaign brief for a hyperlocal creator marketing platform called nayba, modelled on Hummingbirds. Brand: ${brandName}. Campaign: ${form.title}. Headline: ${form.headline}. Generate a campaign brief in JSON with these exact keys: about_brand (string), content_requirements (string), talking_points (array of 3 strings), inspiration (array of 2 objects with title and description keys). Return only valid JSON, no markdown, no preamble.`,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const { text } = await res.json();
      const data = JSON.parse(text);
      if (data.about_brand) set('about_brand', data.about_brand);
      if (data.content_requirements) set('content_requirements', data.content_requirements);
      if (data.talking_points?.[0]) setForm(p => ({ ...p, tp1: data.talking_points[0], tp2: data.talking_points[1] || '', tp3: data.talking_points[2] || '' }));
      if (data.inspiration) setForm(p => ({ ...p, insp: data.inspiration.slice(0, 2).map((i: any) => ({ title: i.title || '', description: i.description || '' })) }));
      setAiDone(true);
      setTimeout(() => setAiDone(false), 3000);
    } catch {
      setAiError('AI generation failed — fill in manually');
      setTimeout(() => setAiError(''), 4000);
    }
    setAiLoading(false);
  };

  const handleSave = async (asStatus: string) => {
    if (!form.brand_id || !form.title) return;
    setSaving(true);
    const payload: any = {
      brand_id: form.brand_id, title: form.title, headline: form.headline || null,
      about_brand: form.about_brand || null, perk_description: form.perk_description || null,
      perk_value: form.perk_value ? parseFloat(form.perk_value) : null, perk_type: form.perk_type,
      target_city: form.target_city || null, target_county: form.target_county || null,
      creator_target: parseInt(form.creator_target) || 10, min_level: 1,
      content_requirements: form.content_requirements || null,
      talking_points: [form.tp1, form.tp2, form.tp3].filter(Boolean),
      inspiration: form.insp.filter((i: any) => i.title),
      deliverables: { reel: form.reel, story: form.story },
      open_date: form.open_date ? new Date(form.open_date).toISOString() : null,
      expression_deadline: form.expression_deadline ? new Date(form.expression_deadline).toISOString() : null,
      content_deadline: form.content_deadline ? new Date(form.content_deadline).toISOString() : null,
      status: asStatus,
    };
    if (campaign) { await supabase.from('campaigns').update(payload).eq('id', campaign.id); }
    else { await supabase.from('campaigns').insert(payload); }
    setSaving(false);
    onSave();
  };

  const sectionDivider = (title: string) => (
    <div className="col-span-1 md:col-span-2 pt-4 pb-1 border-t border-[#E6E2DB]">
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', color: 'rgba(34,34,34,0.35)', textTransform: 'uppercase' as const }}>{title}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(34,34,34,0.4)]" onClick={onClose} />
      <div className="relative bg-white rounded-[12px] w-full max-w-[680px] mx-4 flex flex-col" style={{ maxHeight: '88vh', boxShadow: '0 8px 40px rgba(34,34,34,0.12)' }}>
        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E2DB] flex-shrink-0">
          <h2 className="text-[17px] font-bold text-[#222]">{campaign ? 'Edit Campaign' : 'New Campaign'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-[#E6E2DB] flex items-center justify-center text-[rgba(34,34,34,0.35)] hover:text-[#222] hover:border-[#222] transition-colors">
            <X size={16} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelCls}>Brand *</label><select value={form.brand_id} onChange={e => set('brand_id', e.target.value)} className={inputCls}><option value="">Select brand...</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className={labelCls}>Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="Campaign title" /></div>
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.6px] text-[rgba(34,34,34,0.60)]">Headline</label>
                <button type="button" onClick={handleAiGenerate} disabled={aiLoading || (!form.brand_id && !form.title)}
                  className="inline-flex items-center gap-1 px-3.5 py-1 rounded-[999px] border border-[#C4674A] text-[#C4674A] bg-white text-[12px] font-semibold hover:bg-[rgba(196,103,74,0.04)] disabled:opacity-40 transition-colors">
                  {aiLoading ? <span className="w-3 h-3 border-[1.5px] border-[#C4674A] border-t-transparent rounded-full animate-spin" /> : '✦'}
                  {aiLoading ? 'Generating...' : aiDone ? '✓ Brief generated' : 'Generate brief with AI'}
                </button>
              </div>
              <input value={form.headline} onChange={e => set('headline', e.target.value)} className={inputCls} placeholder="Short punchy description" />
              {aiError && <p className="text-[12px] text-[#C4674A] mt-1">{aiError}</p>}
            </div>
            <div className="md:col-span-2"><label className={labelCls}>About the Brand</label><textarea value={form.about_brand} onChange={e => set('about_brand', e.target.value)} className={`${inputCls} h-20 resize-none`} /></div>
            <div className="md:col-span-2"><label className={labelCls}>Perk Description</label><textarea value={form.perk_description} onChange={e => set('perk_description', e.target.value)} className={`${inputCls} h-16 resize-none`} placeholder="What the creator receives" /></div>
            <div><label className={labelCls}>Perk Value (£)</label><input type="number" value={form.perk_value} onChange={e => set('perk_value', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Perk Type</label><select value={form.perk_type} onChange={e => set('perk_type', e.target.value)} className={inputCls}><option value="experience">Experience</option><option value="product">Product</option><option value="gift_card">Gift Card</option></select></div>
            <div><label className={labelCls}>Target City</label><input value={form.target_city} onChange={e => set('target_city', e.target.value)} className={inputCls} placeholder="e.g. Bury St Edmunds" /></div>
            <div><label className={labelCls}>Target County</label><select value={form.target_county} onChange={e => set('target_county', e.target.value)} className={inputCls}><option value="Suffolk">Suffolk</option><option value="Norfolk">Norfolk</option><option value="Cambridgeshire">Cambridgeshire</option><option value="Essex">Essex</option></select></div>
            <div><label className={labelCls}>Creator Target</label><input type="number" value={form.creator_target} onChange={e => set('creator_target', e.target.value)} className={inputCls} /></div>
            <div />  {/* spacer for grid alignment */}
            <div className="md:col-span-2"><label className={labelCls}>Content Requirements</label><textarea value={form.content_requirements} onChange={e => set('content_requirements', e.target.value)} className={`${inputCls} h-20 resize-none`} /></div>

            {sectionDivider('Talking Points')}
            {[form.tp1, form.tp2, form.tp3].map((tp, i) => (
              <div key={i} className="md:col-span-2 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: 'rgba(196,103,74,0.08)', color: '#C4674A' }}>{i + 1}</span>
                <input value={tp} onChange={e => set(`tp${i + 1}`, e.target.value)} className={`${inputCls} flex-1`} placeholder={`Key message ${i + 1}`} />
              </div>
            ))}

            {sectionDivider('Inspiration')}
            {form.insp.map((item: any, i: number) => (
              <div key={i} className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className={labelCls}>Title</label><input value={item.title} onChange={e => { const n = [...form.insp]; n[i] = { ...n[i], title: e.target.value }; set('insp', n); }} className={inputCls} /></div>
                <div className="md:col-span-2"><label className={labelCls}>Description</label><input value={item.description} onChange={e => { const n = [...form.insp]; n[i] = { ...n[i], description: e.target.value }; set('insp', n); }} className={inputCls} /></div>
              </div>
            ))}

            {sectionDivider('Campaign Dates')}
            <div><label className={labelCls}>Open Date</label><input type="date" value={form.open_date} onChange={e => set('open_date', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Expression Deadline</label><input type="date" value={form.expression_deadline} onChange={e => set('expression_deadline', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Content Deadline</label><input type="date" value={form.content_deadline} onChange={e => set('content_deadline', e.target.value)} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Deliverables</label>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-[14px] text-[#222]"><input type="checkbox" checked={form.reel} onChange={e => set('reel', e.target.checked)} className="accent-[#C4674A]" /> Reel</label>
                <label className="flex items-center gap-2 text-[14px] text-[#222]"><input type="checkbox" checked={form.story} onChange={e => set('story', e.target.checked)} className="accent-[#C4674A]" /> Story</label>
              </div>
            </div>
          </div>
        </div>
        {/* Sticky footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E6E2DB] flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-[14px] font-semibold text-[rgba(34,34,34,0.60)] hover:text-[#222]">Cancel</button>
          <div className="flex gap-3">
            <button onClick={() => handleSave('draft')} disabled={saving} className="px-5 py-2.5 rounded-[999px] border border-[#E6E2DB] text-[#222] text-[13px] font-semibold hover:bg-[#F7F7F5]">Save as Draft</button>
            <button onClick={() => handleSave('active')} disabled={saving} className="px-5 py-2.5 rounded-[999px] bg-[#C4674A] text-white text-[13px] font-semibold hover:opacity-90" style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
              {saving ? 'Publishing...' : 'Publish Campaign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Campaign Detail Panel ───
function CampaignInlineDetail({ campaign, onManageApplicants, onViewParticipation, onEdit }: {
  campaign: Campaign; onManageApplicants: () => void; onViewParticipation: () => void; onEdit: () => void;
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<{ creator_id: string; name: string; reason: string; score: number }[] | null>(null);
  const [aiError, setAiError] = useState('');

  const handleAiRecommend = async () => {
    setAiLoading(true); setAiError(''); setRecommendations(null);
    try {
      const { data: apps } = await supabase.from('applications')
        .select('creator_id, creators(id, name, display_name, instagram_handle, level, completion_rate, total_campaigns, address)')
        .eq('campaign_id', campaign.id).eq('status', 'interested');
      if (!apps || apps.length === 0) { setAiError('No applicants to recommend from'); setAiLoading(false); return; }
      const applicants = apps.map((a: any) => ({
        creator_id: a.creator_id, name: a.creators?.display_name || a.creators?.name,
        instagram: a.creators?.instagram_handle, level: a.creators?.level,
        completion_rate: a.creators?.completion_rate, campaigns: a.creators?.total_campaigns, city: a.creators?.address,
      }));
      const res = await fetch('/api/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are helping select creators for a hyperlocal marketing campaign. Campaign: ${campaign.title}. Brand: ${campaign.businesses?.name}. City: ${campaign.target_city}. Perk: ${campaign.perk_description}. Here are the applicants: ${JSON.stringify(applicants)}. Rank the top applicants by fit. Consider: location match to target city, completion rate (higher is better), level (higher is better), campaign experience. Return a JSON array of the top applicants ordered by recommendation score, each with fields: creator_id, name, reason (one sentence explaining why they're a good fit), score (1-10). Return only valid JSON.`,
          max_tokens: 1000,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const { text } = await res.json();
      setRecommendations(JSON.parse(text));
    } catch {
      setAiError('AI recommendation failed');
      setTimeout(() => setAiError(''), 4000);
    }
    setAiLoading(false);
  };

  const handleSelectCreator = async (creatorId: string) => {
    await supabase.from('applications').update({ status: 'selected', selected_at: new Date().toISOString() })
      .eq('campaign_id', campaign.id).eq('creator_id', creatorId);
    setRecommendations(prev => prev ? prev.filter(r => r.creator_id !== creatorId) : null);
  };

  return (
    <tr>
      <td colSpan={10} className="p-0">
        <div className="bg-[#FAFAF8] border-t border-[#E6E2DB] px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {campaign.perk_description && (
              <div>
                <p className={labelCls}>Perk</p>
                <p className="text-[14px] text-[#222]">{campaign.perk_description}</p>
                {campaign.perk_value && <p className="text-[13px] text-[rgba(34,34,34,0.60)] mt-1">£{campaign.perk_value} · {campaign.perk_type?.replace('_', ' ')}</p>}
              </div>
            )}
            {campaign.content_requirements && (
              <div>
                <p className={labelCls}>Content Required</p>
                <p className="text-[14px] text-[#222] leading-[1.6]">{campaign.content_requirements.slice(0, 150)}{campaign.content_requirements.length > 150 ? '...' : ''}</p>
              </div>
            )}
            {campaign.talking_points && campaign.talking_points.length > 0 && (
              <div>
                <p className={labelCls}>Talking Points</p>
                <ol className="text-[14px] text-[#222] space-y-1 list-decimal list-inside">
                  {campaign.talking_points.map((tp, i) => <li key={i}>{tp}</li>)}
                </ol>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-[#E6E2DB] flex-wrap">
            <button onClick={onManageApplicants} className="px-4 py-2 rounded-[999px] bg-[#C4674A] text-white text-[13px] font-semibold hover:opacity-90">Manage Applicants</button>
            <button onClick={handleAiRecommend} disabled={aiLoading}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-[999px] border border-[#C4674A] text-[#C4674A] bg-white text-[12px] font-semibold hover:bg-[rgba(196,103,74,0.04)] disabled:opacity-40">
              {aiLoading ? <span className="w-3 h-3 border-[1.5px] border-[#C4674A] border-t-transparent rounded-full animate-spin" /> : '✦'}
              {aiLoading ? 'Analysing...' : 'AI Recommend'}
            </button>
            <button onClick={onViewParticipation} className="px-4 py-2 rounded-[999px] border border-[#E6E2DB] text-[#222] text-[13px] font-semibold hover:bg-[#F7F7F5]">View Participation</button>
            <button onClick={onEdit} className="px-4 py-2 rounded-[999px] border border-[#E6E2DB] text-[#222] text-[13px] font-semibold hover:bg-[#F7F7F5]">Edit Campaign</button>
          </div>
          {aiError && <p className="text-[12px] text-[#C4674A] mt-2">{aiError}</p>}

          {/* AI Recommendations panel */}
          {recommendations && recommendations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#E6E2DB]">
              <p className="text-[12px] font-bold uppercase tracking-[0.6px] text-[rgba(34,34,34,0.35)] mb-3">AI Recommendations</p>
              <div className="space-y-2">
                {recommendations.map(r => (
                  <div key={r.creator_id} className="flex items-center gap-3 bg-white rounded-[8px] border border-[#E6E2DB] px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-[#C4674A] flex items-center justify-center flex-shrink-0">
                      <span className="text-[12px] font-bold text-white">{r.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#222]">{r.name}</p>
                      <p className="text-[13px] text-[rgba(34,34,34,0.60)] truncate">{r.reason}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[14px] font-bold text-[#C4674A]">{r.score}/10</span>
                      <button onClick={() => handleSelectCreator(r.creator_id)}
                        className="px-3 py-1.5 rounded-[999px] bg-[#C4674A] text-white text-[12px] font-semibold hover:opacity-90">
                        Select
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Export ───
export default function AdminCampaignsTab({ showModal, onCloseModal, onOpenModal }: {
  showModal: boolean; onCloseModal: () => void; onOpenModal: () => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [appCounts, setAppCounts] = useState<Record<string, { applicants: number; selected: number; submitted: number; completed: number }>>({});
  const [totalStats, setTotalStats] = useState({ active: 0, applicants: 0, reels: 0, reach: 0 });

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    const [campRes, brandRes] = await Promise.all([
      supabase.from('campaigns').select('*, businesses(name)').order('created_at', { ascending: false }),
      supabase.from('businesses').select('id, name').eq('approved', true).order('name'),
    ]);
    if (campRes.data) {
      setCampaigns(campRes.data as Campaign[]);
      const counts: Record<string, any> = {};
      let totalApplicants = 0, totalReels = 0, totalReach = 0;
      for (const c of campRes.data) {
        const [appRes, partRes] = await Promise.all([
          supabase.from('applications').select('status').eq('campaign_id', c.id),
          supabase.from('participations').select('status, reach, reel_url').eq('campaign_id', c.id),
        ]);
        const a = appRes.data?.length || 0;
        const r = partRes.data?.filter((p: any) => p.reel_url).length || 0;
        const reach = partRes.data?.reduce((s: number, p: any) => s + (p.reach || 0), 0) || 0;
        counts[c.id] = {
          applicants: a,
          selected: appRes.data?.filter((x: any) => x.status === 'selected' || x.status === 'confirmed').length || 0,
          submitted: partRes.data?.filter((p: any) => p.status === 'content_submitted' || p.status === 'completed').length || 0,
          completed: partRes.data?.filter((p: any) => p.status === 'completed').length || 0,
        };
        totalApplicants += a;
        totalReels += r;
        totalReach += reach;
      }
      setAppCounts(counts);
      setTotalStats({
        active: campRes.data.filter((c: any) => c.status === 'active' || c.status === 'live').length,
        applicants: totalApplicants, reels: totalReels, reach: totalReach,
      });
    }
    if (brandRes.data) setBrands(brandRes.data);
  };

  const statCards = [
    { label: 'Active Campaigns', value: totalStats.active, icon: Megaphone },
    { label: 'Applicants', value: totalStats.applicants, icon: Users },
    { label: 'Reels Submitted', value: totalStats.reels, icon: Film },
    { label: 'Estimated Reach', value: totalStats.reach.toLocaleString(), icon: Eye },
  ];

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-[#E6E2DB] rounded-[12px] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-[8px] flex items-center justify-center" style={{ background: 'rgba(196,103,74,0.08)' }}>
                <s.icon size={18} className="text-[#C4674A]" />
              </div>
            </div>
            <p className="text-[28px] font-bold text-[#222]" style={{ letterSpacing: '-0.4px' }}>{s.value}</p>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', color: 'rgba(34,34,34,0.35)', textTransform: 'uppercase' as const, marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Campaign table */}
      {campaigns.length > 0 ? (
        <div className="bg-white border border-[#E6E2DB] rounded-[12px] overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr>
              <th className={thCls}>Brand</th><th className={thCls}>Campaign</th><th className={thCls}>Status</th>
              <th className={thCls}>City</th><th className={thCls}>Target</th><th className={thCls}>Applicants</th>
              <th className={thCls}>Selected</th><th className={thCls}>Submitted</th><th className={thCls}>Completed</th>
              <th className={thCls}>Deadline</th>
            </tr></thead>
            <tbody>
              {campaigns.map(c => {
                const counts = appCounts[c.id] || { applicants: 0, selected: 0, submitted: 0, completed: 0 };
                const expanded = expandedId === c.id;
                return (
                  <>
                    <tr key={c.id} onClick={() => setExpandedId(expanded ? null : c.id)}
                      className="hover:bg-[#F7F7F5] cursor-pointer transition-colors" style={{ height: 52 }}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[rgba(196,103,74,0.08)] flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-[#C4674A]">{(c.businesses?.name || '?')[0]}</span>
                          </div>
                          <span className="font-medium text-[14px]">{c.businesses?.name || '—'}</span>
                        </div>
                      </td>
                      <td className={`${tdCls} font-medium`}>{c.title}</td>
                      <td className={tdCls}><StatusBadge status={c.status} /></td>
                      <td className={`${tdCls} text-[rgba(34,34,34,0.60)]`}>{c.target_city || '—'}</td>
                      <td className={tdCls}>{c.creator_target}</td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[rgba(34,34,34,0.06)] rounded-full overflow-hidden">
                            <div className="h-full bg-[#C4674A] rounded-full" style={{ width: `${Math.min((counts.applicants / Math.max(c.creator_target, 1)) * 100, 100)}%` }} />
                          </div>
                          <span className="text-[13px] text-[rgba(34,34,34,0.60)]">{counts.applicants}/{c.creator_target}</span>
                        </div>
                      </td>
                      <td className={tdCls}>{counts.selected}</td>
                      <td className={tdCls}>{counts.submitted}</td>
                      <td className={tdCls}>{counts.completed}</td>
                      <td className={`${tdCls} text-[rgba(34,34,34,0.35)]`}>
                        <div className="flex items-center gap-2">
                          {fmtShortDate(c.expression_deadline)}
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <CampaignInlineDetail
                        campaign={c}
                        onManageApplicants={() => {}}
                        onViewParticipation={() => {}}
                        onEdit={() => { setEditingCampaign(c); onOpenModal(); }}
                      />
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Empty state */
        <div className="bg-white border border-[#E6E2DB] rounded-[12px] p-12 text-center">
          <div className="w-12 h-12 rounded-[8px] flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(196,103,74,0.08)' }}>
            <Megaphone size={22} className="text-[#C4674A]" />
          </div>
          <p className="text-[17px] font-bold text-[#222] mb-1">No campaigns yet</p>
          <p className="text-[14px] text-[rgba(34,34,34,0.60)] mb-5">Create your first campaign to get started</p>
          <button onClick={onOpenModal} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[999px] bg-[#C4674A] text-white text-[13px] font-semibold" style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}>
            + New Campaign
          </button>
        </div>
      )}

      {/* Modal */}
      {(showModal || editingCampaign) && (
        <CampaignModal
          brands={brands}
          campaign={editingCampaign}
          onSave={() => { onCloseModal(); setEditingCampaign(null); fetchCampaigns(); }}
          onClose={() => { onCloseModal(); setEditingCampaign(null); }}
        />
      )}
    </div>
  );
}
