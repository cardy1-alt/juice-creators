import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sendBusinessCampaignLiveEmail } from '../lib/notifications';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import ImageUpload from './ImageUpload';
import Select from './ui/Select';

interface Brand {
  id: string;
  name: string;
  category?: string;
  region?: string;
  address?: string | null;
}

interface CampaignWizardProps {
  brands: Brand[];
  /** If set, locks to this brand (brand portal mode) */
  fixedBrandId?: string;
  onSave: () => void;
  onClose: () => void;
}

const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-50)] font-['Instrument_Sans']";
const labelCls = "block text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-50)] mb-1.5";

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r.toISOString().slice(0, 10);
}

export default function CampaignWizard({ brands, fixedBrandId, onSave, onClose }: CampaignWizardProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // ─── State ─────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [brandId, setBrandId] = useState(fixedBrandId || '');
  const [perk, setPerk] = useState('');
  const [instructions, setInstructions] = useState('');
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // AI-generated fields
  const [gen, setGen] = useState({
    title: '', headline: '', about_brand: '', content_requirements: '',
    talking_points: ['', '', ''],
    inspiration: [{ title: '', description: '' }, { title: '', description: '' }],
    target_city: '', target_county: 'Suffolk',
    campaign_image: '',
    perk_value: '',
    creator_target: '5',
    brand_instructions: '',
    open_date: addDays(new Date(), 1),
    expression_deadline: addDays(new Date(), 15),
    content_deadline: addDays(new Date(), 29),
  });
  const setG = (k: string, v: any) => setGen(p => ({ ...p, [k]: v }));

  const brand = brands.find(b => b.id === brandId);
  const brandName = brand?.name || '';

  // ─── AI Generation ─────────────────────────────────────
  const handleGenerate = async () => {
    if (!brandId || !perk) return;
    setAiLoading(true);
    setAiError('');
    setStep(2); // Show skeleton immediately
    const county = brand?.region || 'Suffolk';
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are creating a campaign brief for Nayba, a hyperlocal creator marketing platform in the UK.

Brand: ${brandName}
Category: ${brand?.category || 'Local business'}
Region: ${county}
Perk offered: ${perk}
${instructions ? `Additional instructions: ${instructions}` : ''}

Generate a complete campaign as JSON with these exact keys:
- title: campaign title, 3-6 words, catchy and action-oriented (e.g. "Free Week Pass at Revamp Gym")
- headline: one-liner for creators, max 12 words, punchy
- about_brand: 2-3 sentences about the brand, 50-80 words, warm and inviting
- content_requirements: specific Reel instructions — what to show, tone, must-mention details, 40-60 words
- talking_points: array of exactly 3 strings, each a key message for creators, max 15 words each
- inspiration: array of 2 objects each with "title" (4-6 words) and "description" (one sentence, max 20 words)
- target_city: the city where this campaign should run, inferred from region. UK city name only.
- perk_value: estimated monetary value of the perk in GBP as a number

Return only valid JSON, no markdown, no code fences.`,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const { text } = await res.json();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('Invalid AI response'); }
      setGen(p => ({
        ...p,
        title: data.title || `${brandName} Campaign`,
        headline: data.headline || '',
        about_brand: data.about_brand || '',
        content_requirements: data.content_requirements || '',
        talking_points: data.talking_points?.slice(0, 3) || p.talking_points,
        inspiration: data.inspiration?.slice(0, 2)?.map((i: any) => ({ title: i.title || '', description: i.description || '' })) || p.inspiration,
        target_city: data.target_city || '',
        target_county: county,
        perk_value: data.perk_value?.toString() || '',
      }));
    } catch {
      setAiError('AI generation failed — try again or create manually');
      setStep(1); // Go back to inputs on failure
    }
    setAiLoading(false);
  };

  // ─── Save ──────────────────────────────────────────────
  const handleSave = async (status: string) => {
    setSaveError('');
    setSaving(true);
    const payload: any = {
      brand_id: brandId,
      title: gen.title,
      headline: gen.headline || null,
      about_brand: gen.about_brand || null,
      perk_description: perk || null,
      perk_value: gen.perk_value ? parseFloat(gen.perk_value) : null,
      perk_type: 'experience',
      target_city: gen.target_city || null,
      target_county: gen.target_county || null,
      creator_target: parseInt(gen.creator_target) || 5,
      min_level: 1,
      content_requirements: gen.content_requirements || null,
      brand_instructions: gen.brand_instructions || null,
      talking_points: gen.talking_points.filter(Boolean),
      inspiration: gen.inspiration.filter((i: any) => i.title),
      deliverables: { reel: true, story: false },
      campaign_type: 'brand',
      campaign_image: gen.campaign_image || null,
      open_date: gen.open_date ? new Date(gen.open_date).toISOString() : null,
      expression_deadline: gen.expression_deadline ? new Date(gen.expression_deadline).toISOString() : null,
      content_deadline: gen.content_deadline ? new Date(gen.content_deadline).toISOString() : null,
      status,
    };
    const { error } = await supabase.from('campaigns').insert(payload);
    setSaving(false);
    if (error) { setSaveError('Failed to save: ' + error.message); return; }
    // Send campaign live email to brand when publishing
    if (status === 'active' && brandId) {
      sendBusinessCampaignLiveEmail(brandId, {
        campaign_title: gen.title,
        headline: gen.headline || '',
        perk_description: perk || '',
        creator_target: parseInt(gen.creator_target) || 5,
        expression_deadline: gen.expression_deadline || '',
      }).catch(() => {});
    }
    onSave();
  };

  // ─── Render ────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(42,32,24,0.40)] animate-overlay" onClick={onClose} />
      <div className="relative bg-white rounded-[10px] w-full max-w-[640px] mx-4 flex flex-col overflow-hidden animate-slide-up" style={{ maxHeight: '88vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-5 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--ink)]">
              {step === 1 ? 'New Campaign' : gen.title || 'Campaign Preview'}
            </h2>
            {step === 1 && <p className="text-[13px] text-[var(--ink-50)] mt-0.5">{mode === 'ai' ? 'AI will generate the full brief from a few inputs' : 'Fill in campaign details manually'}</p>}
          </div>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-full bg-[rgba(42,32,24,0.02)] flex items-center justify-center text-[var(--ink-50)] hover:bg-[#EDE9E3]"><X size={15} /></button>
        </div>

        {/* Progress */}
        <div className="h-[3px] bg-[rgba(42,32,24,0.06)]">
          <div className="h-full bg-[var(--terra)] transition-all duration-300" style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
          {saveError && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] mb-4" style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626' }}>
              <span className="text-[14px] font-medium">{saveError}</span>
            </div>
          )}

          {/* ─── STEP 1 ─── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-1 border-b border-[rgba(42,32,24,0.08)]">
                <button type="button" onClick={() => setMode('ai')}
                  className={`px-4 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors ${mode === 'ai' ? 'border-[var(--terra)] text-[var(--terra)]' : 'border-transparent text-[var(--ink-35)]'}`}>
                  ✦ AI Assist
                </button>
                <button type="button" onClick={() => setMode('manual')}
                  className={`px-4 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors ${mode === 'manual' ? 'border-[var(--terra)] text-[var(--terra)]' : 'border-transparent text-[var(--ink-35)]'}`}>
                  Create manually
                </button>
              </div>

              {!fixedBrandId && (
                <div>
                  <label className={labelCls}>Brand *</label>
                  <Select value={brandId} onChange={setBrandId} placeholder="Select brand..." options={[{ value: '', label: 'Select brand...' }, ...brands.map(b => ({ value: b.id, label: b.name }))]} />
                </div>
              )}

              {mode === 'ai' ? (
                <>
                  <div>
                    <label className={labelCls}>What's the perk? *</label>
                    <textarea value={perk} onChange={e => setPerk(e.target.value)}
                      className={`${inputCls} min-h-[72px] resize-y`}
                      placeholder="e.g. Free week pass including unlimited classes + 1 PT session worth £45" />
                  </div>
                  <div>
                    <label className={labelCls}>Reel content notes for AI <span className="text-[var(--ink-35)]">(optional)</span></label>
                    <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                      className={`${inputCls} min-h-[60px] resize-y`}
                      placeholder="e.g. Film a Reel showing the gym, mention the free pass, tag @revampgym" />
                  </div>
                  <div>
                    <label className={labelCls}>Anything specific creators must do? <span className="text-[var(--ink-35)]">(optional)</span></label>
                    <textarea value={gen.brand_instructions} onChange={e => setG('brand_instructions', e.target.value)}
                      className={`${inputCls} min-h-[60px] resize-y`}
                      placeholder="e.g. Please book your visit at least 24h ahead by DMing us @yourhandle on Instagram. We'll meet you at reception." />
                    <p className="text-[12px] text-[var(--ink-35)] mt-1">Creators see this before applying, when they confirm, and in their confirmation email. Be specific and actionable.</p>
                  </div>
                  {aiError && <p className="text-[13px] text-[var(--terra)]">{aiError}</p>}
                </>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Title *</label>
                    <input value={gen.title} onChange={e => setG('title', e.target.value)} className={inputCls} placeholder="Campaign title" />
                  </div>
                  <div>
                    <label className={labelCls}>Headline</label>
                    <input value={gen.headline} onChange={e => setG('headline', e.target.value)} className={inputCls} placeholder="Short punchy description" />
                  </div>
                  <div>
                    <label className={labelCls}>Perk Description *</label>
                    <textarea value={perk} onChange={e => setPerk(e.target.value)}
                      className={`${inputCls} min-h-[72px] resize-y`}
                      placeholder="What the creator receives" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Perk Value (£)</label><input type="number" value={gen.perk_value} onChange={e => setG('perk_value', e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Creator Target</label><input type="number" value={gen.creator_target} onChange={e => setG('creator_target', e.target.value)} className={inputCls} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Target City</label><input value={gen.target_city} onChange={e => setG('target_city', e.target.value)} className={inputCls} placeholder="e.g. Bury St Edmunds" /></div>
                    <div><label className={labelCls}>County</label>
                      <Select value={gen.target_county} onChange={val => setG('target_county', val)} options={[{ value: 'Suffolk', label: 'Suffolk' }, { value: 'Norfolk', label: 'Norfolk' }, { value: 'Cambridgeshire', label: 'Cambridgeshire' }, { value: 'Essex', label: 'Essex' }]} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>About the Brand</label>
                    <textarea value={gen.about_brand} onChange={e => setG('about_brand', e.target.value)} className={`${inputCls} min-h-[72px] resize-y`} placeholder="2-3 sentences about the brand" />
                  </div>
                  <div>
                    <label className={labelCls}>Content Requirements</label>
                    <textarea value={gen.content_requirements} onChange={e => setG('content_requirements', e.target.value)} className={`${inputCls} min-h-[72px] resize-y`} placeholder="What should the Reel include?" />
                  </div>
                  <div>
                    <label className={labelCls}>Anything specific creators must do? <span className="text-[var(--ink-35)]">(optional)</span></label>
                    <textarea value={gen.brand_instructions} onChange={e => setG('brand_instructions', e.target.value)} className={`${inputCls} min-h-[60px] resize-y`} placeholder="e.g. Please book your visit at least 24h ahead by DMing us @yourhandle on Instagram." />
                    <p className="text-[12px] text-[var(--ink-35)] mt-1">Creators see this before applying, when they confirm, and in their confirmation email.</p>
                  </div>
                  <ImageUpload value={gen.campaign_image} onChange={url => setG('campaign_image', url)} folder="campaigns" label="Campaign Image" />
                </>
              )}
            </div>
          )}

          {/* ─── STEP 2: AI Preview ─── */}
          {step === 2 && aiLoading && (
            <div className="animate-fade-in">
              {/* Generating label */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <span className="w-4 h-4 border-2 border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
                <span className="text-[14px] font-medium text-[var(--terra)]">✦ Generating your campaign...</span>
              </div>
              {/* Skeleton preview card */}
              <div className="rounded-[12px] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.06)' }}>
                <div className="w-full h-[140px] skeleton-pulse rounded-t-[12px]" />
                <div className="p-4 space-y-3">
                  <div className="h-3 w-[80px] skeleton-pulse rounded-[4px]" />
                  <div className="h-5 w-[260px] skeleton-pulse rounded-[4px]" />
                  <div className="h-4 w-[200px] skeleton-pulse rounded-[4px]" />
                  <div className="h-3 w-[140px] skeleton-pulse rounded-[4px]" />
                </div>
              </div>
              {/* Skeleton details */}
              <div className="mt-5 space-y-3">
                <div className="h-3 w-[100px] skeleton-pulse rounded-[4px]" />
                <div className="h-[60px] w-full skeleton-pulse rounded-[10px]" />
                <div className="h-3 w-[120px] skeleton-pulse rounded-[4px]" />
                <div className="h-[60px] w-full skeleton-pulse rounded-[10px]" />
              </div>
            </div>
          )}

          {step === 2 && !aiLoading && (
            <div className="space-y-4 animate-fade-in">
              {/* Preview card */}
              <div className="rounded-[12px] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.06)' }}>
                <ImageUpload value={gen.campaign_image} onChange={url => setG('campaign_image', url)} folder="campaigns" label="" shape="square" />
                <div className="p-4">
                  <p className="text-[11px] font-medium text-[var(--ink-50)] mb-1">{brandName}</p>
                  <input value={gen.title} onChange={e => setG('title', e.target.value)}
                    className="w-full text-[18px] font-semibold text-[var(--ink)] bg-transparent border-none outline-none p-0 mb-1 placeholder:text-[var(--ink-35)]"
                    placeholder="Campaign title" />
                  <input value={gen.headline} onChange={e => setG('headline', e.target.value)}
                    className="w-full text-[14px] text-[var(--ink-60)] bg-transparent border-none outline-none p-0 mb-2 placeholder:text-[var(--ink-35)]"
                    placeholder="Headline" />
                  <p className="text-[13px] text-[var(--ink-50)]">{perk}{gen.perk_value ? ` · £${gen.perk_value}` : ''}</p>
                </div>
              </div>

              {/* Expandable details */}
              <button type="button" onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink-50)] hover:text-[var(--ink)]">
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showDetails ? 'Hide details' : 'Edit details'}
              </button>

              {showDetails && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className={labelCls}>About the Brand</label>
                    <textarea value={gen.about_brand} onChange={e => setG('about_brand', e.target.value)} className={`${inputCls} min-h-[72px] resize-y`} />
                  </div>
                  <div>
                    <label className={labelCls}>Content Requirements</label>
                    <textarea value={gen.content_requirements} onChange={e => setG('content_requirements', e.target.value)} className={`${inputCls} min-h-[72px] resize-y`} />
                  </div>
                  <div>
                    <label className={labelCls}>Talking Points</label>
                    {gen.talking_points.map((tp, i) => (
                      <input key={i} value={tp} onChange={e => { const n = [...gen.talking_points]; n[i] = e.target.value; setG('talking_points', n); }}
                        className={`${inputCls} mb-2`} placeholder={`Point ${i + 1}`} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Target City</label><input value={gen.target_city} onChange={e => setG('target_city', e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Creator Target</label><input type="number" value={gen.creator_target} onChange={e => setG('creator_target', e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Perk Value (£)</label><input type="number" value={gen.perk_value} onChange={e => setG('perk_value', e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>County</label>
                      <Select value={gen.target_county} onChange={val => setG('target_county', val)} options={[{ value: 'Suffolk', label: 'Suffolk' }, { value: 'Norfolk', label: 'Norfolk' }, { value: 'Cambridgeshire', label: 'Cambridgeshire' }, { value: 'Essex', label: 'Essex' }]} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={labelCls}>Open Date</label><input type="date" value={gen.open_date} onChange={e => setG('open_date', e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Apply By</label><input type="date" value={gen.expression_deadline} onChange={e => setG('expression_deadline', e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Content Due</label><input type="date" value={gen.content_deadline} onChange={e => setG('content_deadline', e.target.value)} className={inputCls} /></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-[rgba(42,32,24,0.08)] flex-shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="text-[14px] font-medium text-[var(--ink-50)] hover:text-[var(--ink)]">Cancel</button>
              {mode === 'ai' ? (
                <button onClick={handleGenerate} disabled={aiLoading || !brandId || !perk}
                  className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] font-semibold hover:opacity-[0.85] disabled:opacity-40 min-h-[40px]">
                  {aiLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span>✦</span>}
                  <span>{aiLoading ? 'Generating...' : 'Generate campaign'}</span>
                </button>
              ) : (
                <button onClick={() => setStep(2)} disabled={!brandId || !gen.title || !perk}
                  className="px-6 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] font-semibold hover:opacity-[0.85] disabled:opacity-40 min-h-[40px]">
                  Next →
                </button>
              )}
            </>
          ) : aiLoading ? (
            <>
              <button onClick={() => { setStep(1); setAiLoading(false); }} className="text-[14px] font-medium text-[var(--ink-50)] hover:text-[var(--ink)]">← Cancel</button>
              <span className="text-[13px] text-[var(--ink-35)]">Building your campaign...</span>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="text-[14px] font-medium text-[var(--ink-50)] hover:text-[var(--ink)]">← Back</button>
              <div className="flex gap-2">
                <button onClick={() => handleSave('draft')} disabled={saving}
                  className="px-4 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] font-medium hover:bg-[rgba(42,32,24,0.03)] disabled:opacity-40">
                  Save as Draft
                </button>
                <button onClick={() => handleSave('active')} disabled={saving}
                  className="px-5 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px] font-semibold hover:opacity-[0.85] disabled:opacity-40">
                  {saving ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
