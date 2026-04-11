import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendCreatorSelectedEmail, sendCreatorCampaignCompleteEmail } from '../../lib/notifications';
import { getAvatarColors } from '../../lib/avatarColors';
import { X, UserPlus, Check, XCircle, ExternalLink, Film, Megaphone, Users, Eye } from 'lucide-react';
import CampaignDetail from '../CampaignDetail';
import ImageUpload from '../ImageUpload';

// ─── Types ───
interface Brand { id: string; name: string; }
interface Campaign {
  id: string; brand_id: string; title: string; headline: string | null; about_brand: string | null;
  perk_description: string | null; perk_value: number | null; perk_type: string | null;
  target_city: string | null; target_county: string | null; content_requirements: string | null;
  talking_points: string[] | null; inspiration: any[] | null; deliverables: any;
  creator_target: number; open_date: string | null; expression_deadline: string | null;
  content_deadline: string | null; campaign_type: 'brand' | 'community'; campaign_image: string | null;
  status: string; min_level: number; required_tags: string[] | null; created_at: string;
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

// ─── Shared styling (using CSS variables from theme.css) ───
const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-50)] font-['Instrument_Sans']";
const labelCls = "block text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1.5";
const thCls = "text-left text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] py-[10px] px-4 bg-[rgba(42,32,24,0.02)]";
const tdCls = "py-0 px-4 text-[14px] text-[var(--ink)] border-b border-[rgba(42,32,24,0.06)]";
const modalOverlay = "fixed inset-0 z-[60] flex items-center justify-center";
const modalBackdrop = "absolute inset-0 bg-[rgba(42,32,24,0.40)]";
const modalClose = "w-[30px] h-[30px] rounded-full bg-[rgba(42,32,24,0.02)] flex items-center justify-center text-[var(--ink-50)] hover:bg-[#EDE9E3] transition-colors";
const modalHeader = "flex items-center justify-between px-4 md:px-6 py-5 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0";
const modalBody = "flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6";
const modalFooterCls = "flex items-center justify-between px-4 md:px-6 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0";
const ghostBtn = "text-[14px] font-medium text-[var(--ink-60)] hover:text-[var(--ink)] transition-colors";
const primaryBtn = "px-4 py-2 rounded-[10px] bg-[var(--terra)] text-white text-[14px] hover:opacity-[0.85] disabled:opacity-40 transition-opacity";
const secondaryBtn = "px-5 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.08)] text-[var(--ink)] text-[14px] font-semibold hover:bg-[rgba(42,32,24,0.02)]";
// shadows removed — border alone;

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    draft: 'bg-[#F1EFE8] text-[#5F5E5A]',
    active: 'bg-[#E1F5EE] text-[#0F6E56]',
    selecting: 'bg-[rgba(59,130,246,0.08)] text-[#3B82F6]',
    live: 'bg-[#E1F5EE] text-[#0F6E56]',
    completed: 'bg-[#F1EFE8] text-[#5F5E5A]',
    interested: 'bg-[#FAEEDA] text-[#854F0B]',
    selected: 'bg-[#E1F5EE] text-[#0F6E56]',
    confirmed: 'bg-[#E1F5EE] text-[#0F6E56]',
    declined: 'bg-[#F1EFE8] text-[#5F5E5A]',
    content_submitted: 'bg-[rgba(59,130,246,0.08)] text-[#3B82F6]',
    overdue: 'bg-[#FCEBEB] text-[#A32D2D]',
  };
  return (
    <span className={`inline-flex items-center rounded-[999px] text-[12px] font-medium ${cls[status] || cls.draft}`} style={{ padding: '3px 9px' }}>
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

// ─── 3-Step Campaign Modal ───
function CampaignModal({ brands, campaign, onSave, onClose }: {
  brands: Brand[]; campaign: Campaign | null; onSave: () => void; onClose: () => void;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    brand_id: campaign?.brand_id || '', title: campaign?.title || '', headline: campaign?.headline || '',
    about_brand: campaign?.about_brand || '', perk_description: campaign?.perk_description || '',
    perk_value: campaign?.perk_value?.toString() || '', perk_type: campaign?.perk_type || 'experience',
    target_city: campaign?.target_city || '', target_county: campaign?.target_county || 'Suffolk',
    creator_target: campaign?.creator_target?.toString() || '10',
    campaign_type: campaign?.campaign_type || 'brand',
    campaign_image: campaign?.campaign_image || '',
    min_level: campaign?.min_level?.toString() || '1',
    content_requirements: campaign?.content_requirements || '',
    required_tags: campaign?.required_tags?.join(', ') || '',
    tp1: campaign?.talking_points?.[0] || '', tp2: campaign?.talking_points?.[1] || '', tp3: campaign?.talking_points?.[2] || '',
    insp: campaign?.inspiration || [{ title: '', description: '' }, { title: '', description: '' }],
    reel: campaign?.deliverables?.reel !== false, story: campaign?.deliverables?.story === true,
    open_date: campaign?.open_date?.slice(0, 10) || '', expression_deadline: campaign?.expression_deadline?.slice(0, 10) || '',
    content_deadline: campaign?.content_deadline?.slice(0, 10) || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [formError, setFormError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRan, setAiRan] = useState(!!campaign?.about_brand);
  const [aiError, setAiError] = useState('');
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const brandName = brands.find(b => b.id === form.brand_id)?.name || '';

  const handleAiGenerate = async () => {
    if (!brandName && !form.title) return;
    setAiLoading(true); setAiError('');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are creating a campaign brief for nayba, a hyperlocal creator marketing platform in the UK. Brand: ${brandName}. Brand region: ${form.target_county || 'Suffolk'}. Campaign title: ${form.title}. Headline: ${form.headline || 'not provided'}. Perk: ${form.perk_description || 'not provided'}. Generate a complete campaign brief as JSON with these exact keys: - headline: suggested headline, short and punchy, max 10 words. Only suggest if the provided headline is empty or 'not provided'. - target_city: the city where this campaign should run, inferred from brand region. UK city name only. - about_brand: 2-3 sentence description of the brand and what makes it special, 50-80 words. - content_requirements: specific Reel instructions including required tags, what to show, tone, must-mention details, 40-60 words. - talking_points: array of exactly 3 strings, each a key message for creators to weave in naturally, max 15 words each. - inspiration: array of exactly 2 objects each with title (4-6 words) and description (one sentence, max 20 words). Return only valid JSON, no markdown, no preamble.`,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const { text } = await res.json();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('Invalid AI response'); }
      setForm(p => ({
        ...p,
        headline: p.headline || data.headline || p.headline,
        target_city: p.target_city || data.target_city || p.target_city,
        about_brand: data.about_brand || p.about_brand,
        content_requirements: data.content_requirements || p.content_requirements,
        tp1: data.talking_points?.[0] || p.tp1,
        tp2: data.talking_points?.[1] || p.tp2,
        tp3: data.talking_points?.[2] || p.tp3,
        insp: data.inspiration ? data.inspiration.slice(0, 2).map((i: any) => ({ title: i.title || '', description: i.description || '' })) : p.insp,
      }));
      setAiRan(true);
    } catch {
      setAiError('AI generation failed — fill in manually');
      setTimeout(() => setAiError(''), 4000);
    }
    setAiLoading(false);
  };

  const handleSave = async (asStatus: string) => {
    if (!form.brand_id || !form.title) { setFormError('Brand and title are required'); return; }
    setFormError(''); setSaveError('');
    // Validate perk_value
    const perkVal = form.perk_value ? parseFloat(form.perk_value) : null;
    if (form.perk_value && (isNaN(perkVal!) || perkVal! < 0)) { setFormError('Perk value must be a positive number'); return; }
    // Validate creator_target
    const creatorTarget = parseInt(form.creator_target) || 10;
    if (creatorTarget < 1) { setFormError('Creator target must be at least 1'); return; }
    // Validate date ordering
    if (form.expression_deadline && form.content_deadline && form.expression_deadline > form.content_deadline) {
      setFormError('Expression deadline must be before content deadline'); return;
    }
    setSaving(true);
    const payload: any = {
      brand_id: form.brand_id, title: form.title, headline: form.headline || null,
      about_brand: form.about_brand || null, perk_description: form.perk_description || null,
      perk_value: perkVal, perk_type: form.perk_type,
      target_city: form.target_city || null, target_county: form.target_county || null,
      creator_target: creatorTarget, min_level: parseInt(form.min_level as any) || 1,
      content_requirements: form.content_requirements || null,
      required_tags: form.required_tags ? form.required_tags.split(',').map((t: string) => t.trim()).filter(Boolean) : null,
      talking_points: [form.tp1, form.tp2, form.tp3].filter(Boolean),
      inspiration: form.insp.filter((i: any) => i.title),
      deliverables: { reel: form.reel, story: form.story },
      campaign_type: form.campaign_type,
      campaign_image: form.campaign_image || null,
      open_date: form.open_date ? new Date(form.open_date).toISOString() : null,
      expression_deadline: form.expression_deadline ? new Date(form.expression_deadline).toISOString() : null,
      content_deadline: form.content_deadline ? new Date(form.content_deadline).toISOString() : null,
      status: asStatus,
    };
    const { error } = campaign
      ? await supabase.from('campaigns').update(payload).eq('id', campaign.id)
      : await supabase.from('campaigns').insert(payload);
    setSaving(false);
    if (error) { setSaveError('Failed to save campaign — ' + error.message); return; }
    onSave();
  };

  const taCls = `${inputCls} min-h-[72px] resize-y`;

  return (
    <div className={modalOverlay}>
      <div className={modalBackdrop} onClick={onClose} />
      <div className="relative bg-white rounded-[10px] w-full max-w-[720px] mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>
        {/* Header */}
        <div className={modalHeader}>
          <h2 className="text-[20px] font-semibold text-[var(--ink)]">{campaign ? 'Edit Campaign' : 'New Campaign'}</h2>
          <div className="flex items-center gap-4">
            <span className="text-[14px] text-[var(--ink-50)]">Step {step} of 3</span>
            <button onClick={onClose} className={modalClose}><X size={15} /></button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-[3px] bg-[rgba(42,32,24,0.06)]"><div className="h-full bg-[var(--terra)] transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} /></div>

        {/* Body */}
        <div className={modalBody}>
          {(formError || saveError) && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] mb-4" style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626' }}>
              <span className="text-[14px] font-medium">{formError || saveError}</span>
            </div>
          )}
          {/* STEP 1 — Basics */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelCls}>Brand *</label><select value={form.brand_id} onChange={e => set('brand_id', e.target.value)} className={inputCls}><option value="">Select brand...</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div><label className={labelCls}>Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} placeholder="Campaign title" /></div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls} style={{ marginBottom: 0 }}>Headline</label>
                  <button type="button" onClick={handleAiGenerate} disabled={aiLoading || (!form.brand_id && !form.title)}
                    className="inline-flex items-center gap-1 px-3.5 py-1 rounded-[10px] border border-[var(--terra)] text-[var(--terra)] bg-white text-[12px] font-semibold hover:bg-[rgba(196,103,74,0.04)] disabled:opacity-40 transition-colors">
                    {aiLoading ? <span className="w-3 h-3 border-[1.5px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" /> : '✦'}{' '}
                    {aiLoading ? 'Suggesting...' : 'Suggest ideas'}
                  </button>
                </div>
                <input value={form.headline} onChange={e => set('headline', e.target.value)} className={inputCls} placeholder="Short punchy description" />
                {aiError && <p className="text-[12px] text-[var(--terra)] mt-1">{aiError}</p>}
              </div>
              <div className="md:col-span-2"><label className={labelCls}>Perk Description</label><textarea value={form.perk_description} onChange={e => set('perk_description', e.target.value)} className={taCls} placeholder="What the creator receives" /></div>
              <div><label className={labelCls}>Perk Value (£)</label><input type="number" value={form.perk_value} onChange={e => set('perk_value', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Perk Type</label><select value={form.perk_type} onChange={e => set('perk_type', e.target.value)} className={inputCls}><option value="experience">Experience</option><option value="product">Product</option><option value="gift_card">Gift Card</option></select></div>
              <div><label className={labelCls}>Target City</label><input value={form.target_city} onChange={e => set('target_city', e.target.value)} className={inputCls} placeholder="e.g. Bury St Edmunds" /></div>
              <div><label className={labelCls}>Target County</label><select value={form.target_county} onChange={e => set('target_county', e.target.value)} className={inputCls}><option value="Suffolk">Suffolk</option><option value="Norfolk">Norfolk</option><option value="Cambridgeshire">Cambridgeshire</option><option value="Essex">Essex</option></select></div>
              <div><label className={labelCls}>Creator Target</label><input type="number" min="1" value={form.creator_target} onChange={e => set('creator_target', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Min Creator Level</label><select value={form.min_level} onChange={e => set('min_level', e.target.value)} className={inputCls}><option value="1">Any (Level 1+)</option><option value="3">Regular+ (Level 3+)</option><option value="5">Trusted+ (Level 5+)</option></select></div>
              <div><label className={labelCls}>Campaign Type</label><select value={form.campaign_type} onChange={e => set('campaign_type', e.target.value)} className={inputCls}><option value="brand">Brand Campaign</option><option value="community">Community Campaign</option></select></div>
              <div className="md:col-span-2"><ImageUpload value={form.campaign_image} onChange={url => set('campaign_image', url)} folder="campaigns" label="Campaign Image" /></div>
            </div>
          )}

          {/* STEP 2 — Brief */}
          {step === 2 && (
            <div>
              {aiRan ? (
                <>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] mb-5" style={{ background: 'rgba(196,103,74,0.06)', color: 'var(--terra)' }}>
                    <span className="text-[12px] font-medium">✦ These fields were generated by AI — review and edit before publishing.</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2"><label className={labelCls}>About the Brand</label><textarea value={form.about_brand} onChange={e => set('about_brand', e.target.value)} className={`${taCls} min-h-[80px]`} /></div>
                    <div className="md:col-span-2"><label className={labelCls}>Content Requirements</label><textarea value={form.content_requirements} onChange={e => set('content_requirements', e.target.value)} className={`${taCls} min-h-[80px]`} /></div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Required Tags / Hashtags</label>
                      <input value={form.required_tags} onChange={e => set('required_tags', e.target.value)}
                        className={inputCls} placeholder="#brandname, @brand, #campaign" />
                      <p className="text-[12px] text-[var(--ink-50)] mt-1">Comma-separated tags creators must include</p>
                    </div>
                    <div className="md:col-span-2 pt-3 pb-1 border-t border-[rgba(42,32,24,0.08)]">
                      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.6px', color: 'var(--ink-60)', textTransform: 'uppercase' as const }}>Talking Points</p>
                    </div>
                    {[form.tp1, form.tp2, form.tp3].map((tp, i) => (
                      <div key={i} className="md:col-span-2 flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0" style={{ background: 'rgba(196,103,74,0.08)', color: 'var(--terra)' }}>{i + 1}</span>
                        <input value={tp} onChange={e => set(`tp${i + 1}`, e.target.value)} className={`${inputCls} flex-1`} placeholder={`Key message ${i + 1}`} />
                      </div>
                    ))}
                    <div className="md:col-span-2 pt-3 pb-1 border-t border-[rgba(42,32,24,0.08)]">
                      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.6px', color: 'var(--ink-60)', textTransform: 'uppercase' as const }}>Inspiration</p>
                    </div>
                    {form.insp.map((item: any, i: number) => (
                      <div key={i} className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div><label className={labelCls}>Title</label><input value={item.title} onChange={e => { const n = [...form.insp]; n[i] = { ...n[i], title: e.target.value }; set('insp', n); }} className={inputCls} /></div>
                        <div className="md:col-span-2"><label className={labelCls}>Description</label><input value={item.description} onChange={e => { const n = [...form.insp]; n[i] = { ...n[i], description: e.target.value }; set('insp', n); }} className={inputCls} /></div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-[14px] text-[var(--ink-50)] mb-3">Fill in the fields above, or</p>
                  <button onClick={handleAiGenerate} disabled={aiLoading || (!form.brand_id && !form.title)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-[rgba(42,32,24,0.10)] text-[14px] text-[var(--ink-60)] hover:bg-[rgba(42,32,24,0.03)] disabled:opacity-40 transition-colors"
                    style={{ fontWeight: 600 }}>
                    {aiLoading ? <span className="w-3 h-3 border-[1.5px] border-[var(--ink-35)] border-t-transparent rounded-full animate-spin" /> : '✦'}{' '}
                    {aiLoading ? 'Suggesting...' : 'Suggest ideas from Step 1'}
                  </button>
                  {aiError && <p className="text-[12px] text-[var(--terra)] mt-2">{aiError}</p>}
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Dates & Publish */}
          {step === 3 && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div><label className={labelCls}>Open Date</label><input type="date" value={form.open_date} onChange={e => set('open_date', e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Expression Deadline</label><input type="date" value={form.expression_deadline} onChange={e => set('expression_deadline', e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Content Deadline</label><input type="date" value={form.content_deadline} onChange={e => set('content_deadline', e.target.value)} className={inputCls} /></div>
                <div>
                  <label className={labelCls}>Deliverables</label>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 text-[13.5px] text-[var(--ink)]"><input type="checkbox" checked={form.reel} onChange={e => set('reel', e.target.checked)} className="accent-[var(--terra)]" /> Reel</label>
                    <label className="flex items-center gap-2 text-[13.5px] text-[var(--ink)]"><input type="checkbox" checked={form.story} onChange={e => set('story', e.target.checked)} className="accent-[var(--terra)]" /> Story</label>
                  </div>
                </div>
              </div>
              {/* Summary card */}
              <div className="bg-[rgba(42,32,24,0.02)] border border-[rgba(42,32,24,0.08)] rounded-[10px] p-5">
                <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', color: 'var(--ink-60)', textTransform: 'uppercase' as const, marginBottom: 12 }}>Campaign Summary</p>
                <div className="space-y-2 text-[14px]">
                  <div className="flex gap-2"><span className="text-[var(--ink-60)] w-24 flex-shrink-0">Brand</span><span className="text-[var(--ink)] font-medium">{brandName || '—'}</span></div>
                  <div className="flex gap-2"><span className="text-[var(--ink-60)] w-24 flex-shrink-0">Title</span><span className="text-[var(--ink)] font-medium">{form.title || '—'}</span></div>
                  {form.perk_description && <div className="flex gap-2"><span className="text-[var(--ink-60)] w-24 flex-shrink-0">Perk</span><span className="text-[var(--ink)]">{form.perk_description.slice(0, 60)}{form.perk_description.length > 60 ? '...' : ''}</span></div>}
                  {form.target_city && <div className="flex gap-2"><span className="text-[var(--ink-60)] w-24 flex-shrink-0">City</span><span className="text-[var(--ink)]">{form.target_city}</span></div>}
                  <div className="flex gap-2"><span className="text-[var(--ink-60)] w-24 flex-shrink-0">Creators</span><span className="text-[var(--ink)]">{form.creator_target}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={modalFooterCls}>
          {step === 1 && (
            <>
              <button onClick={onClose} className={ghostBtn}>Cancel</button>
              <button onClick={() => setStep(2)} disabled={!form.brand_id || !form.title} className={primaryBtn} style={{ fontWeight: 700 }}>Next: Brief →</button>
            </>
          )}
          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} className={ghostBtn}>← Back</button>
              <button onClick={() => setStep(3)} className={primaryBtn} style={{ fontWeight: 700 }}>Next: Dates →</button>
            </>
          )}
          {step === 3 && (
            <>
              <button onClick={() => setStep(2)} className={ghostBtn}>← Back</button>
              <div className="flex gap-3">
                <button onClick={() => handleSave('draft')} disabled={saving} className={secondaryBtn}>Save as Draft</button>
                <button onClick={() => handleSave('active')} disabled={saving} className={primaryBtn} style={{ fontWeight: 700 }}>
                  {saving ? 'Publishing...' : 'Publish Campaign'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Participation Management Modal ───
function ParticipationModal({ campaign, onClose, onRefresh }: {
  campaign: Campaign; onClose: () => void; onRefresh: () => void;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const [parts, setParts] = useState<Participation[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { fetchParts(); }, [campaign.id]);

  const fetchParts = async () => {
    const { data } = await supabase.from('participations')
      .select('*, creators(name, display_name, instagram_handle)')
      .eq('campaign_id', campaign.id).order('created_at', { ascending: false });
    if (data) setParts(data as Participation[]);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const updateField = async (partId: string, field: string, value: any) => {
    // Optimistic update
    setParts(prev => prev.map(p => p.id === partId ? { ...p, [field]: value } : p));
    const { error } = await supabase.from('participations').update({ [field]: value }).eq('id', partId);
    if (error) {
      showToast('Update failed');
      fetchParts(); // revert
    }
  };

  const updatePerkSent = async (partId: string, sent: boolean) => {
    const updates: any = { perk_sent: sent };
    if (sent) updates.perk_sent_at = new Date().toISOString();
    else updates.perk_sent_at = null;
    setParts(prev => prev.map(p => p.id === partId ? { ...p, ...updates } : p));
    const { error } = await supabase.from('participations').update(updates).eq('id', partId);
    if (error) { showToast('Update failed'); fetchParts(); }
    else showToast(sent ? 'Perk marked as sent' : 'Perk unmarked');
  };

  const updateReelUrl = async (partId: string, url: string) => {
    const updates: any = { reel_url: url || null };
    if (url && !parts.find(p => p.id === partId)?.reel_submitted_at) {
      updates.reel_submitted_at = new Date().toISOString();
      updates.status = 'content_submitted';
    }
    setParts(prev => prev.map(p => p.id === partId ? { ...p, ...updates } : p));
    const { error } = await supabase.from('participations').update(updates).eq('id', partId);
    if (error) { showToast('Update failed'); fetchParts(); }
    else if (url) showToast('Reel URL saved');
  };

  const updateNumeric = async (partId: string, field: string, raw: string) => {
    const value = raw ? parseInt(raw) : null;
    setParts(prev => prev.map(p => p.id === partId ? { ...p, [field]: value } : p));
    const { error } = await supabase.from('participations').update({ [field]: value }).eq('id', partId);
    if (error) { showToast('Update failed'); fetchParts(); }
  };

  const markComplete = async (partId: string) => {
    const part = parts.find(p => p.id === partId);
    if (!part) return;

    // Update participation
    const updates = { status: 'completed', completed_at: new Date().toISOString() };
    setParts(prev => prev.map(p => p.id === partId ? { ...p, ...updates } : p));
    const { error } = await supabase.from('participations').update(updates).eq('id', partId);
    if (error) { showToast('Failed to mark complete'); fetchParts(); return; }

    // Update creator stats
    const { data: creator } = await supabase.from('creators')
      .select('total_campaigns, completed_campaigns')
      .eq('id', part.creator_id).single();
    if (creator) {
      const newCompleted = (creator.completed_campaigns || 0) + 1;
      const total = creator.total_campaigns || 1;
      const rate = Math.round((newCompleted / total) * 100);
      // Auto-promote level
      let newLevel = 1, newLevelName = 'Newcomer';
      if (newCompleted >= 21 && rate >= 95) { newLevel = 6; newLevelName = 'Nayba ✦'; }
      else if (newCompleted >= 11) { newLevel = 5; newLevelName = 'Trusted'; }
      else if (newCompleted >= 6) { newLevel = 4; newLevelName = 'Local'; }
      else if (newCompleted >= 3) { newLevel = 3; newLevelName = 'Regular'; }
      else if (newCompleted >= 1) { newLevel = 2; newLevelName = 'Explorer'; }
      const { error: levelErr } = await supabase.from('creators').update({
        completed_campaigns: newCompleted,
        completion_rate: rate,
        level: newLevel,
        level_name: newLevelName,
      }).eq('id', part.creator_id);
      if (levelErr) { showToast('Completed but failed to update creator stats'); onRefresh(); return; }
      // Send completion email
      const { data: campInfo } = await supabase.from('campaigns').select('title, businesses(name)').eq('id', part.campaign_id).single();
      if (campInfo) {
        sendCreatorCampaignCompleteEmail(part.creator_id, {
          campaign_title: campInfo.title,
          brand_name: (campInfo as any).businesses?.name || '',
          total_campaigns: total,
          completion_rate: rate,
        });
      }
    }

    showToast('Participation marked complete');
    onRefresh();
  };

  const pThCls = "text-left text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] py-2.5 px-3 bg-[rgba(42,32,24,0.02)] whitespace-nowrap";
  const pTdCls = "py-2 px-3 text-[14px] text-[var(--ink)] border-b border-[rgba(42,32,24,0.06)] align-middle";
  const numInput = "w-[72px] px-2 py-1.5 rounded-[10px] bg-[rgba(42,32,24,0.02)] border border-[rgba(42,32,24,0.08)] text-[14px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)]";

  return (
    <div className={modalOverlay}>
      <div className={modalBackdrop} onClick={onClose} />
      <div className="relative bg-white rounded-[10px] w-full max-w-[960px] mx-4 flex flex-col overflow-hidden" style={{ maxHeight: '88vh' }}>
        {/* Header */}
        <div className={modalHeader}>
          <h2 className="text-[20px] font-semibold text-[var(--ink)]">
            Manage Participation — {campaign.title}
          </h2>
          <button onClick={onClose} className={modalClose}><X size={15} /></button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[999px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>
            {toast}
          </div>
        )}

        {/* Body */}
        <div className={modalBody}>
          {parts.length > 0 ? (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full min-w-[860px]">
                <thead><tr>
                  <th className={pThCls}>Creator</th>
                  <th className={pThCls}>Status</th>
                  <th className={pThCls}>Perk Sent</th>
                  <th className={pThCls}>Reel URL</th>
                  <th className={pThCls}>Reach</th>
                  <th className={pThCls}>Likes</th>
                  <th className={pThCls}>Comments</th>
                  <th className={pThCls}>Views</th>
                  <th className={pThCls}>Actions</th>
                </tr></thead>
                <tbody>
                  {parts.map(p => (
                    <tr key={p.id} className="hover:bg-[rgba(42,32,24,0.03)]">
                      <td className={`${pTdCls} font-medium whitespace-nowrap`}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-[10px] bg-[var(--terra)] flex items-center justify-center flex-shrink-0">
                            <span className="text-[12px] font-semibold text-white">{(p.creators?.display_name || p.creators?.name || '?')[0].toUpperCase()}</span>
                          </div>
                          {p.creators?.display_name || p.creators?.name}
                        </div>
                      </td>
                      <td className={pTdCls}>
                        <select value={p.status}
                          onChange={e => updateField(p.id, 'status', e.target.value)}
                          className="text-[12px] px-2 py-1.5 rounded-[10px] border border-[rgba(42,32,24,0.08)] bg-[rgba(42,32,24,0.02)] focus:outline-none focus:border-[var(--terra)]">
                          <option value="confirmed">Confirmed</option>
                          <option value="visited">Visited</option>
                          <option value="content_submitted">Content Submitted</option>
                          <option value="completed">Completed</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </td>
                      <td className={pTdCls}>
                        <input type="checkbox" checked={p.perk_sent}
                          onChange={e => updatePerkSent(p.id, e.target.checked)}
                          className="accent-[var(--terra)] w-4 h-4" />
                      </td>
                      <td className={pTdCls}>
                        <div className="flex items-center gap-1.5">
                          <input
                            defaultValue={p.reel_url || ''}
                            onBlur={e => updateReelUrl(p.id, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            placeholder="Paste URL"
                            className="w-[140px] px-2 py-1.5 rounded-[10px] bg-[rgba(42,32,24,0.02)] border border-[rgba(42,32,24,0.08)] text-[12px] focus:outline-none focus:border-[var(--terra)]"
                          />
                          {p.reel_url && (
                            <a href={p.reel_url} target="_blank" rel="noopener noreferrer"
                              className="text-[12px] text-[var(--terra)] font-medium whitespace-nowrap hover:underline">
                              View →
                            </a>
                          )}
                        </div>
                      </td>
                      <td className={pTdCls}>
                        <input type="number" defaultValue={p.reach ?? ''}
                          onBlur={e => updateNumeric(p.id, 'reach', e.target.value)}
                          className={numInput} />
                      </td>
                      <td className={pTdCls}>
                        <input type="number" defaultValue={p.likes ?? ''}
                          onBlur={e => updateNumeric(p.id, 'likes', e.target.value)}
                          className={numInput} />
                      </td>
                      <td className={pTdCls}>
                        <input type="number" defaultValue={p.comments ?? ''}
                          onBlur={e => updateNumeric(p.id, 'comments', e.target.value)}
                          className={numInput} />
                      </td>
                      <td className={pTdCls}>
                        <input type="number" defaultValue={p.views ?? ''}
                          onBlur={e => updateNumeric(p.id, 'views', e.target.value)}
                          className={numInput} />
                      </td>
                      <td className={pTdCls}>
                        <button
                          onClick={() => markComplete(p.id)}
                          disabled={p.status === 'completed'}
                          className="px-3 py-1.5 rounded-[10px] text-[12px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{
                            background: p.status === 'completed' ? 'rgba(42,32,24,0.06)' : 'rgba(45,122,79,0.08)',
                            color: p.status === 'completed' ? 'var(--ink-35)' : '#2D7A4F',
                          }}
                        >
                          {p.status === 'completed' ? 'Completed' : 'Mark Complete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-[14px] text-[var(--ink-50)]">No confirmed participations yet</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={modalFooterCls}>
          <div />
          <button onClick={onClose} className={secondaryBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Peek Panel (right side) ───
function CampaignPeekPanel({ campaign, onClose, onViewParticipation, onEdit, onDelete }: {
  campaign: Campaign; onClose: () => void; onViewParticipation: () => void; onEdit: () => void; onDelete: () => void;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const [showAddApplicant, setShowAddApplicant] = useState(false);
  const [allCreators, setAllCreators] = useState<{id:string;name:string;display_name:string|null;instagram_handle:string}[]>([]);
  const [addingCreator, setAddingCreator] = useState<string | null>(null);

  const fetchCreatorsForAdd = async () => {
    const { data } = await supabase.from('creators').select('id, name, display_name, instagram_handle').eq('approved', true).order('name');
    if (data) setAllCreators(data);
    setShowAddApplicant(true);
  };

  const [deletingCampaign, setDeletingCampaign] = useState<string | null>(null);

  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleAddApplicant = async (creatorId: string) => {
    setAddingCreator(creatorId);
    const { error } = await supabase.from('applications').insert({
      campaign_id: campaign.id, creator_id: creatorId, status: 'interested',
    });
    setAddingCreator(null);
    if (error) { showToast(error.message.includes('duplicate') ? 'Creator already applied' : 'Failed to add applicant'); return; }
    setShowAddApplicant(false);
    showToast('Applicant added');
  };

  const handleSelectCreator = async (creatorId: string) => {
    const { error: appErr } = await supabase.from('applications').update({
      status: 'confirmed', selected_at: new Date().toISOString(), confirmed_at: new Date().toISOString(),
    }).eq('campaign_id', campaign.id).eq('creator_id', creatorId);
    if (appErr) { showToast('Failed to select creator'); return; }
    const { data: appData } = await supabase.from('applications').select('id')
      .eq('campaign_id', campaign.id).eq('creator_id', creatorId).single();
    if (appData) {
      await supabase.from('participations').insert({
        campaign_id: campaign.id, creator_id: creatorId,
        application_id: appData.id, status: 'confirmed', perk_sent: false,
      });
    }
    const { data: campData } = await supabase.from('campaigns').select('title, businesses(name)').eq('id', campaign.id).single();
    if (campData) {
      sendCreatorSelectedEmail(creatorId, {
        campaign_title: campData.title,
        brand_name: (campData as any).businesses?.name || '',
        campaign_id: campaign.id,
      });
    }
    showToast('Creator selected and confirmed');
  };

  const peekLabel = "text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-white border-l border-[rgba(42,32,24,0.08)] flex flex-col" style={{ boxShadow: '-4px 0 24px rgba(42,32,24,0.10)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-[var(--ink)] truncate">{campaign.title}</p>
            <p className="text-[14px] text-[var(--ink-50)] mt-0.5">{campaign.businesses?.name || '—'}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[var(--ink-50)] hover:bg-[rgba(42,32,24,0.06)] transition-colors flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        {toast && (
          <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[999px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>{toast}</div>
        )}

        {/* Scrollable body — reuses CampaignDetail from creator app */}
        <div className="flex-1 overflow-y-auto">
          <CampaignDetail campaignId={campaign.id} hideActions />

          {/* Admin controls */}
          <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)]">
          <div className="mb-4">
            <p className={peekLabel}>Status</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { value: 'draft', label: 'Draft', bg: 'rgba(42,32,24,0.06)', color: 'var(--ink-60)' },
                { value: 'active', label: 'Active', bg: 'rgba(45,122,79,0.10)', color: '#2D7A4F' },
                { value: 'selecting', label: 'Selecting', bg: 'rgba(59,130,246,0.10)', color: '#3B82F6' },
                { value: 'live', label: 'Live', bg: 'rgba(45,122,79,0.10)', color: '#2D7A4F' },
                { value: 'completed', label: 'Completed', bg: 'rgba(42,32,24,0.06)', color: 'var(--ink-60)' },
              ] as const).map(s => (
                <button key={s.value} onClick={async () => {
                  if (s.value === campaign.status) return;
                  if (s.value === 'completed' && !window.confirm('Mark this campaign as completed?')) return;
                  const { error } = await supabase.from('campaigns').update({ status: s.value }).eq('id', campaign.id);
                  if (error) showToast('Failed to update status');
                  else { showToast(`Status → ${s.value}`); onEdit(); }
                }}
                  className="px-3 py-1.5 rounded-[999px] text-[12px] transition-all"
                  style={{
                    fontWeight: campaign.status === s.value ? 700 : 500,
                    background: campaign.status === s.value ? s.bg : 'transparent',
                    color: campaign.status === s.value ? s.color : 'var(--ink-35)',
                    border: campaign.status === s.value ? 'none' : '1px solid rgba(42,32,24,0.08)',
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {showAddApplicant && (
            <div className="mb-4 pt-3 border-t border-[rgba(42,32,24,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <p className={peekLabel}>Add Creator as Applicant</p>
                <button onClick={() => setShowAddApplicant(false)} className="text-[var(--ink-50)] hover:text-[var(--ink)]"><X size={14} /></button>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {allCreators.map(cr => (
                  <div key={cr.id} className="flex items-center justify-between px-3 py-2 rounded-[10px] hover:bg-[rgba(42,32,24,0.02)]">
                    <div className="min-w-0">
                      <span className="text-[14px] font-medium text-[var(--ink)]">{cr.display_name || cr.name}</span>
                      <span className="text-[12px] text-[var(--ink-50)] ml-2">{cr.instagram_handle}</span>
                    </div>
                    <button onClick={() => handleAddApplicant(cr.id)} disabled={addingCreator === cr.id}
                      className="px-2.5 py-1 rounded-[10px] bg-[var(--terra)] text-white text-[12px] font-semibold disabled:opacity-40">
                      {addingCreator === cr.id ? '...' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <button onClick={onEdit} className="w-full px-4 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] hover:opacity-[0.85] mb-3" style={{ fontWeight: 700 }}>Edit Campaign</button>
          <div className="flex items-center justify-center gap-1 flex-wrap">
            <button onClick={onViewParticipation}
              className="text-[12px] font-medium text-[var(--ink-60)] hover:text-[var(--ink)] transition-colors px-1 py-0.5">
              Participation
            </button>
            <span className="text-[var(--ink-15)]">·</span>
            <button onClick={fetchCreatorsForAdd}
              className="text-[12px] font-medium text-[var(--ink-60)] hover:text-[var(--ink)] transition-colors px-1 py-0.5">
              Add Applicant
            </button>
            <span className="text-[var(--ink-15)]">·</span>
            <button onClick={async () => {
              const { brand_id, title, headline, about_brand, perk_description, perk_value, perk_type, target_city, target_county, creator_target, min_level, content_requirements, required_tags, talking_points, inspiration, deliverables, campaign_type, campaign_image } = campaign;
              const { error } = await supabase.from('campaigns').insert({
                brand_id, title: `Copy of ${title}`, headline, about_brand, perk_description, perk_value, perk_type,
                target_city, target_county, creator_target, min_level, content_requirements, required_tags,
                talking_points, inspiration, deliverables, campaign_type, campaign_image, status: 'draft',
              });
              if (error) showToast('Failed to duplicate');
              else { showToast('Campaign duplicated as draft'); onEdit(); }
            }} className="text-[12px] font-medium text-[var(--ink-60)] hover:text-[var(--ink)] transition-colors px-1 py-0.5">
              Duplicate
            </button>
          </div>
          <div className="flex justify-center mt-3">
            <button onClick={onDelete} className="text-[14px] text-[var(--destructive)] font-medium hover:underline">Delete campaign</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Export ───
export default function AdminCampaignsTab({ showModal, onCloseModal, onOpenModal }: {
  showModal: boolean; onCloseModal: () => void; onOpenModal: () => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [peekCampaign, setPeekCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [participationCampaign, setParticipationCampaign] = useState<Campaign | null>(null);
  const [appCounts, setAppCounts] = useState<Record<string, { applicants: number; selected: number; submitted: number; completed: number }>>({});
  const [totalStats, setTotalStats] = useState({ active: 0, applicants: 0, reels: 0, reach: 0 });
  const [deletingCampaign, setDeletingCampaign] = useState<string | null>(null);

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
    { label: 'Active Campaigns', value: totalStats.active, icon: Megaphone, tint: 'rgba(217,95,59,0.08)', color: 'var(--terra)' },
    { label: 'Applicants', value: totalStats.applicants, icon: Users, tint: 'rgba(122,160,184,0.12)', color: 'var(--baltic)' },
    { label: 'Reels Submitted', value: totalStats.reels, icon: Film, tint: 'rgba(140,122,170,0.12)', color: 'var(--violet)' },
    { label: 'Estimated Reach', value: totalStats.reach.toLocaleString(), icon: Eye, tint: 'rgba(122,148,120,0.12)', color: 'var(--sage)' },
  ];

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-[12px] p-3 md:p-4" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: s.tint }}>
                <s.icon size={15} style={{ color: s.color }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', color: 'var(--ink-60)', textTransform: 'uppercase' as const, marginBottom: 2 }}>{s.label}</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px' }}>{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Campaign table */}
      {campaigns.length > 0 ? (<>
        {/* Mobile card list */}
        <div className="md:hidden space-y-2">
          {campaigns.map(c => {
            const counts = appCounts[c.id] || { applicants: 0, selected: 0, submitted: 0, completed: 0 };
            return (
              <div key={c.id} onClick={() => setPeekCampaign(peekCampaign?.id === c.id ? null : c)}
                className="bg-white rounded-[12px] p-4 active:bg-[rgba(42,32,24,0.02)]" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--ink)]">{c.title}</p>
                    <p className="text-[12px] text-[var(--ink-60)]">{c.businesses?.name}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[var(--ink-50)]">
                  <span>{counts.applicants}/{c.creator_target} applicants</span>
                  <span>{counts.selected} selected</span>
                  <span>{counts.submitted} reels</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white rounded-[12px] overflow-hidden overflow-x-auto">
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
                const selected = peekCampaign?.id === c.id;
                return (
                    <tr key={c.id} onClick={() => setPeekCampaign(selected ? null : c)}
                      className={`cursor-pointer transition-colors ${selected ? 'bg-[rgba(42,32,24,0.04)]' : 'hover:bg-[rgba(42,32,24,0.03)]'}`} style={{ height: 44 }}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: getAvatarColors((c.businesses?.name || '?')[0]).bg }}>
                            <span className="text-[12px] font-semibold" style={{ color: getAvatarColors((c.businesses?.name || '?')[0]).text }}>{(c.businesses?.name || '?')[0]}</span>
                          </div>
                          <span className="font-medium text-[14px]">{c.businesses?.name || '—'}</span>
                        </div>
                      </td>
                      <td className={`${tdCls} font-medium`}>{c.title}</td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={c.status} />
                          {c.campaign_type === 'community' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-[12px] font-semibold bg-[rgba(59,130,246,0.08)] text-[#3B82F6]">Community</span>
                          )}
                        </div>
                      </td>
                      <td className={`${tdCls} text-[var(--ink-60)]`}>{c.target_city || '—'}</td>
                      <td className={tdCls}>{c.creator_target}</td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[rgba(42,32,24,0.06)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--terra)] rounded-full" style={{ width: `${Math.min((counts.applicants / Math.max(c.creator_target, 1)) * 100, 100)}%` }} />
                          </div>
                          <span className="text-[14px] text-[var(--ink-60)]">{counts.applicants}/{c.creator_target}</span>
                        </div>
                      </td>
                      <td className={tdCls}>{counts.selected}</td>
                      <td className={tdCls}>{counts.submitted}</td>
                      <td className={tdCls}>{counts.completed}</td>
                      <td className={`${tdCls} text-[var(--ink-50)]`}>{fmtShortDate(c.expression_deadline)}</td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>) : (
        /* Empty state */
        <div className="bg-white rounded-[12px] p-12 text-center">
          <div className="w-12 h-12 rounded-[10px] flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(196,103,74,0.08)' }}>
            <Megaphone size={22} className="text-[var(--terra)]" />
          </div>
          <p className="text-[17px] font-semibold text-[var(--ink)] mb-1">No campaigns yet</p>
          <p className="text-[14px] text-[var(--ink-60)] mb-5">Create your first campaign to get started</p>
          <button onClick={onOpenModal} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px]" style={{ fontWeight: 700 }}>
            + New Campaign
          </button>
        </div>
      )}

      {/* Campaign Peek Panel */}
      {peekCampaign && (
        <CampaignPeekPanel
          campaign={peekCampaign}
          onClose={() => setPeekCampaign(null)}
          onViewParticipation={() => { setParticipationCampaign(peekCampaign); setPeekCampaign(null); }}
          onEdit={() => { setEditingCampaign(peekCampaign); onOpenModal(); setPeekCampaign(null); }}
          onDelete={() => setDeletingCampaign(peekCampaign.id)}
        />
      )}

      {/* Campaign Modal */}
      {(showModal || editingCampaign) && (
        <CampaignModal
          brands={brands}
          campaign={editingCampaign}
          onSave={() => { onCloseModal(); setEditingCampaign(null); fetchCampaigns(); }}
          onClose={() => { onCloseModal(); setEditingCampaign(null); }}
        />
      )}

      {/* Participation Modal */}
      {participationCampaign && (
        <ParticipationModal
          campaign={participationCampaign}
          onClose={() => setParticipationCampaign(null)}
          onRefresh={fetchCampaigns}
        />
      )}
    </div>
  );
}
