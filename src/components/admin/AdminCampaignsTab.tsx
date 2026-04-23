import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendCreatorSelectedEmail, sendCreatorCampaignCompleteEmail, sendCreatorWonCommunityEmail, sendCreatorNotSelectedCommunityEmail, sendAdminCommunityWinnersPickedEmail, sendCreatorSelectionExpiredEmail } from '../../lib/notifications';
import { toStartOfDayISO, toEndOfDayISO, hoursUntilConfirmDeadline } from '../../lib/dates';
import { getAvatarColors } from '../../lib/avatarColors';
import { getCategoryPalette } from '../../lib/categories';
import { X, UserPlus, Check, XCircle, ExternalLink, Film, Megaphone, Users, Eye, LayoutList, Kanban, Calendar, Search, LayoutGrid, Trash2, Trophy } from 'lucide-react';
import CampaignDetail from '../CampaignDetail';
import CampaignWizard from '../CampaignWizard';
import ImageUpload from '../ImageUpload';
import Select from '../ui/Select';

// ─── Types ───
interface Brand { id: string; name: string; }
interface Campaign {
  id: string; brand_id: string | null; title: string; headline: string | null; about_brand: string | null;
  perk_description: string | null; perk_value: number | null; perk_type: string | null;
  target_city: string | null; target_county: string | null; content_requirements: string | null;
  brand_instructions: string | null;
  talking_points: string[] | null; inspiration: any[] | null; deliverables: any;
  creator_target: number; open_date: string | null; expression_deadline: string | null;
  content_deadline: string | null; campaign_type: 'brand' | 'community'; campaign_image: string | null;
  status: string; min_level: number; required_tags: string[] | null;
  num_winners: number | null; winner_announced_at: string | null;
  created_at: string;
  businesses?: { name: string; category?: string; logo_url?: string | null } | null;
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
  content_deadline_override: string | null;
  creators?: { name: string; display_name: string | null; instagram_handle: string; };
}
interface Creator { id: string; name: string; display_name: string | null; instagram_handle: string; level: number; completion_rate: number; }

// ─── Shared styling (using CSS variables from theme.css) ───
const inputCls = "w-full px-3 py-2.5 min-h-[40px] rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[var(--ink)] text-[14px] focus:outline-none focus:border-[var(--terra)] placeholder:text-[var(--ink-50)] font-['Instrument_Sans']";
const labelCls = "block text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1.5";
const thCls = "text-left text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] py-[10px] px-4 bg-[rgba(42,32,24,0.02)]";
const tdCls = "py-0 px-4 text-[14px] text-[var(--ink)] border-b border-[rgba(42,32,24,0.06)]";
const modalOverlay = "fixed inset-0 z-[60] flex items-center justify-center";
const modalBackdrop = "absolute inset-0 bg-[rgba(42,32,24,0.40)] animate-overlay";
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
    <span className={`inline-flex items-center rounded-[6px] text-[12px] font-medium ${cls[status] || cls.draft}`} style={{ padding: '3px 9px' }}>
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

/** Short phrase for hours remaining — "18h left", "2h left", "<1h left",
 * "Expired — auto-declining soon". Used on pending-confirmation rows in
 * the admin selection panel so the 48-hour window is never invisible. */
function fmtHoursLeft(hours: number | null): string {
  if (hours === null) return '';
  if (hours <= 0) return 'Expired — auto-declining soon';
  if (hours < 1) return '<1h left';
  return `${Math.floor(hours)}h left`;
}

interface PeekAppLike {
  id: string;
  creator_id: string;
  status: string;
  selected_at: string | null;
  previously_selected_at: string | null;
  applied_at: string;
  pitch: string | null;
  creators?: { name: string; display_name: string | null; instagram_handle: string; level: number | null; avatar_url: string | null };
}

function SelectionSection({ campaignId: _campaignId, applications, target, onSelect, onReturnToReserves, onDecline }: {
  campaignId: string;
  applications: PeekAppLike[];
  target: number;
  onSelect: (creatorId: string) => void;
  onReturnToReserves: (appId: string) => void;
  onDecline: (appId: string) => void;
}) {
  const selected = applications.filter(a => a.status === 'selected' || a.status === 'confirmed');
  const reserves = applications.filter(a => a.status === 'interested');
  const declined = applications.filter(a => a.status === 'declined');
  const confirmedCount = selected.filter(a => a.status === 'confirmed').length;
  const awaitingCount = selected.filter(a => a.status === 'selected').length;
  const hasUnconfirmed = awaitingCount > 0;

  // Is at least one awaiting selection in its final 12 hours? Used to
  // flag the whole Selected header as urgent at a glance.
  const anyUrgent = selected.some(a => {
    if (a.status !== 'selected') return false;
    const h = hoursUntilConfirmDeadline(a.selected_at);
    return h !== null && h <= 12;
  });

  if (applications.length === 0) {
    return (
      <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)]">
        <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-2">Selection</p>
        <p className="text-[13px] text-[var(--ink-50)]">No applicants yet.</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)] space-y-4">
      {/* Summary header */}
      <div>
        <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1">Selection</p>
        <p className="text-[13px] text-[var(--ink-60)]">
          <span className="text-[var(--ink)] font-semibold">{confirmedCount}{target > 0 ? `/${target}` : ''}</span> confirmed
          {awaitingCount > 0 && <> · <span className={`font-semibold ${anyUrgent ? 'text-[var(--terra)]' : 'text-[var(--ink)]'}`}>{awaitingCount}</span> awaiting</>}
          {' · '}
          <span className="text-[var(--ink)] font-semibold">{reserves.length}</span> reserve{reserves.length === 1 ? '' : 's'}
        </p>
      </div>

      {selected.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-50)] mb-2">Selected</p>
          <div className="space-y-1.5">
            {selected.map(a => {
              const name = a.creators?.display_name || a.creators?.name || 'Creator';
              const handle = a.creators?.instagram_handle?.replace('@', '') || '';
              const isConfirmed = a.status === 'confirmed';
              const hoursLeft = hoursUntilConfirmDeadline(a.selected_at);
              const urgent = !isConfirmed && hoursLeft !== null && hoursLeft <= 12;
              const expired = !isConfirmed && hoursLeft !== null && hoursLeft <= 0;
              return (
                <div key={a.id} className="flex items-start justify-between gap-3 py-2 px-3 rounded-[8px] bg-[rgba(42,32,24,0.02)]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{name}</p>
                    <p className="text-[12px] text-[var(--ink-50)] truncate">@{handle}{a.creators?.level ? ` · L${a.creators.level}` : ''}</p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {isConfirmed ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold bg-[#E1F5EE] text-[#0F6E56]">Confirmed</span>
                      ) : expired ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold bg-[rgba(42,32,24,0.06)] text-[var(--ink-50)]">Expired</span>
                      ) : (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold ${urgent ? 'bg-[rgba(196,103,74,0.12)] text-[var(--terra)]' : 'bg-[#FAEEDA] text-[#854F0B]'}`}>
                          {fmtHoursLeft(hoursLeft)}
                        </span>
                      )}
                    </div>
                  </div>
                  {!isConfirmed && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => onReturnToReserves(a.id)}
                        className="text-[11px] font-medium text-[var(--ink-50)] hover:text-[var(--ink)] px-2 py-1 rounded-[6px] hover:bg-[rgba(42,32,24,0.04)]">
                        To reserves
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {hasUnconfirmed && reserves.length > 0 && (
            <p className="text-[12px] text-[var(--ink-50)] mt-2">Keep reserves on hand — {awaitingCount} selected creator{awaitingCount === 1 ? " hasn't" : "s haven't"} confirmed yet.</p>
          )}
        </div>
      )}

      {reserves.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-50)] mb-2">Reserves</p>
          <div className="space-y-1.5">
            {reserves.map(a => {
              const name = a.creators?.display_name || a.creators?.name || 'Creator';
              const handle = a.creators?.instagram_handle?.replace('@', '') || '';
              const ghosted = !!a.previously_selected_at;
              return (
                <div key={a.id} className="flex items-start justify-between gap-3 py-2 px-3 rounded-[8px]"
                  style={{ background: ghosted ? 'rgba(192,57,43,0.06)' : 'rgba(42,32,24,0.02)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--ink)] truncate">{name}</p>
                    <p className="text-[12px] text-[var(--ink-50)] truncate">@{handle}{a.creators?.level ? ` · L${a.creators.level}` : ''}</p>
                    {ghosted && (
                      <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold"
                        style={{ background: 'rgba(192,57,43,0.10)', color: 'var(--destructive)' }}
                        title="Previously selected but didn't confirm within 48h">
                        Didn't confirm before
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onSelect(a.creator_id)}
                      className="text-[11px] font-semibold text-white bg-[var(--terra)] px-2.5 py-1 rounded-[6px] hover:opacity-85">
                      Select
                    </button>
                    <button onClick={() => onDecline(a.id)}
                      className="text-[11px] font-medium text-[var(--ink-50)] hover:text-[var(--ink)] px-2 py-1 rounded-[6px] hover:bg-[rgba(42,32,24,0.04)]">
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {declined.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ink-50)] hover:text-[var(--ink)] list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▸</span> Declined ({declined.length})
          </summary>
          <div className="mt-2 space-y-1 opacity-60">
            {declined.map(a => {
              const name = a.creators?.display_name || a.creators?.name || 'Creator';
              return (
                <div key={a.id} className="py-1.5 px-3 rounded-[8px] bg-[rgba(42,32,24,0.02)] text-[12px] text-[var(--ink-60)] truncate">
                  {name}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Kanban column config ───
const kanbanColumns = [
  { key: 'draft', label: 'Draft', dot: 'rgba(42,32,24,0.45)' },
  { key: 'active', label: 'Active', dot: '#7A9478' },
  { key: 'selecting', label: 'Selecting', dot: '#7AA0B8' },
  { key: 'live', label: 'Live', dot: '#8C7AAA' },
  { key: 'completed', label: 'Completed', dot: '#C4A84A' },
] as const;

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
    brand_instructions: campaign?.brand_instructions || '',
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
  // Advanced options (currently just Min Creator Level) — collapsed by
  // default. Level-gating works against small-creator fairness, so we keep
  // the lever available but discourage brands from reaching for it. Open
  // automatically if the campaign we're editing already has a non-default
  // min_level set.
  const [showAdvanced, setShowAdvanced] = useState((campaign?.min_level || 1) > 1);
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
    const isCommunity = form.campaign_type === 'community';
    if (!form.title) { setFormError('Title is required'); return; }
    if (!isCommunity && !form.brand_id) { setFormError('Brand is required for brand campaigns'); return; }
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
      brand_id: isCommunity ? null : form.brand_id,
      title: form.title, headline: form.headline || null,
      about_brand: form.about_brand || null, perk_description: form.perk_description || null,
      perk_value: perkVal, perk_type: form.perk_type,
      target_city: form.target_city || null, target_county: form.target_county || null,
      creator_target: creatorTarget, min_level: parseInt(form.min_level as any) || 1,
      content_requirements: form.content_requirements || null,
      brand_instructions: isCommunity ? null : (form.brand_instructions || null),
      talking_points: [form.tp1, form.tp2, form.tp3].filter(Boolean),
      inspiration: form.insp.filter((i: any) => i.title),
      deliverables: { reel: form.reel, story: form.story },
      campaign_type: form.campaign_type,
      campaign_image: form.campaign_image || null,
      open_date: form.open_date ? toStartOfDayISO(form.open_date) : null,
      expression_deadline: form.expression_deadline ? toEndOfDayISO(form.expression_deadline) : null,
      content_deadline: form.content_deadline ? toEndOfDayISO(form.content_deadline) : null,
    };
    // When editing, preserve the existing status; when creating, use the chosen status
    if (!campaign) {
      payload.status = asStatus;
    }
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
      <div className="relative bg-white rounded-[10px] w-full max-w-[720px] mx-4 flex flex-col overflow-hidden animate-slide-up" style={{ maxHeight: '88vh' }}>
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
              {/* Campaign type leads — every other field downstream depends on it. */}
              <div className="md:col-span-2"><label className={labelCls}>Campaign Type</label><Select value={form.campaign_type} onChange={val => set('campaign_type', val)} options={[{ value: 'brand', label: 'Brand Campaign' }, { value: 'community', label: 'Community Campaign (Nayba — prize draw)' }]} /></div>
              {form.campaign_type !== 'community' && (
                <div><label className={labelCls}>Brand *</label><Select value={form.brand_id} onChange={val => set('brand_id', val)} placeholder="Select brand..." options={[{ value: '', label: 'Select brand...' }, ...brands.map(b => ({ value: b.id, label: b.name }))]} /></div>
              )}
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
              <div><label className={labelCls}>Perk Type</label><Select value={form.perk_type} onChange={val => set('perk_type', val)} options={[{ value: 'experience', label: 'Experience' }, { value: 'product', label: 'Product' }, { value: 'gift_card', label: 'Gift Card' }]} /></div>
              <div><label className={labelCls}>Target City</label><input value={form.target_city} onChange={e => set('target_city', e.target.value)} className={inputCls} placeholder="e.g. Bury St Edmunds" /></div>
              <div><label className={labelCls}>Target County</label><Select value={form.target_county} onChange={val => set('target_county', val)} options={[{ value: 'Suffolk', label: 'Suffolk' }, { value: 'Norfolk', label: 'Norfolk' }, { value: 'Cambridgeshire', label: 'Cambridgeshire' }, { value: 'Essex', label: 'Essex' }]} /></div>
              <div><label className={labelCls}>{form.campaign_type === 'community' ? 'Max entries' : 'Creator Target'}</label><input type="number" min="1" value={form.creator_target} onChange={e => set('creator_target', e.target.value)} className={inputCls} /></div>
              <div className="md:col-span-2"><ImageUpload value={form.campaign_image} onChange={url => set('campaign_image', url)} folder="campaigns" label="Campaign Image" /></div>
              {/* Advanced options — collapsed by default. Min Creator Level
                  lives here so brands don't default to excluding newcomers. */}
              <div className="md:col-span-2 pt-1">
                <button type="button" onClick={() => setShowAdvanced(s => !s)}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--ink-50)] hover:text-[var(--ink)] transition-colors">
                  {showAdvanced ? '▾' : '▸'} Advanced options
                </button>
                {showAdvanced && (
                  <div className="mt-3 pt-3 border-t border-[rgba(42,32,24,0.06)]">
                    <label className={labelCls}>Min Creator Level</label>
                    <Select value={form.min_level} onChange={val => set('min_level', val)} options={[{ value: '1', label: 'Any (Level 1+) — recommended' }, { value: '3', label: 'Regular+ (Level 3+)' }, { value: '5', label: 'Trusted+ (Level 5+)' }]} />
                    <p className="text-[12px] text-[var(--ink-35)] mt-1">Leave as "Any" unless the campaign specifically requires an experienced creator — newer creators deliver strong engagement too.</p>
                  </div>
                )}
              </div>
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
                    <div className="md:col-span-2"><label className={labelCls}>{form.campaign_type === 'community' ? 'About this campaign' : 'About the Brand'}</label><textarea value={form.about_brand} onChange={e => set('about_brand', e.target.value)} className={`${taCls} min-h-[80px]`} /></div>
                    <div className="md:col-span-2"><label className={labelCls}>Content Requirements</label><textarea value={form.content_requirements} onChange={e => set('content_requirements', e.target.value)} className={`${taCls} min-h-[80px]`} /></div>
                    {form.campaign_type !== 'community' && (
                      <div className="md:col-span-2">
                        <label className={labelCls}>Booking Instructions <span className="text-[var(--ink-35)] normal-case">(optional — only shown after confirmation)</span></label>
                        <textarea value={form.brand_instructions} onChange={e => set('brand_instructions', e.target.value)} className={`${taCls} min-h-[60px]`} placeholder="e.g. Book on the Fresha app using code NAYBA. DM @theskinstudiosuffolk to confirm your slot." />
                        <p className="text-[12px] text-[var(--ink-35)] mt-1">Only revealed to confirmed creators — safe for coupon codes, booking links, and access instructions. Also included in their confirmation email.</p>
                      </div>
                    )}
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
                  <div className="flex gap-2"><span className="text-[var(--ink-60)] w-24 flex-shrink-0">{form.campaign_type === 'community' ? 'Owner' : 'Brand'}</span><span className="text-[var(--ink)] font-medium">{form.campaign_type === 'community' ? 'Nayba Community' : (brandName || '—')}</span></div>
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
              <button onClick={() => setStep(2)} disabled={(form.campaign_type !== 'community' && !form.brand_id) || !form.title} className={primaryBtn} style={{ fontWeight: 700 }}>Next: Brief →</button>
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
              {campaign ? (
                <button onClick={() => handleSave(campaign.status)} disabled={saving} className={primaryBtn} style={{ fontWeight: 700 }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => handleSave('draft')} disabled={saving} className={secondaryBtn}>Save as Draft</button>
                  <button onClick={() => handleSave('active')} disabled={saving} className={primaryBtn} style={{ fontWeight: 700 }}>
                    {saving ? 'Publishing...' : 'Publish Campaign'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pick Winners Modal (community / prize-draw campaigns) ───
function PickWinnersModal({ campaign, onClose, onRefresh }: {
  campaign: Campaign; onClose: () => void; onRefresh: () => void;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);

  type Entry = {
    id: string; creator_id: string; reel_url: string | null; status: string;
    creators?: { name: string; display_name: string | null; instagram_handle: string };
  };
  const [entries, setEntries] = useState<Entry[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('participations')
        .select('id, creator_id, reel_url, status, creators(name, display_name, instagram_handle)')
        .eq('campaign_id', campaign.id);
      if (fetchErr) { setError('Failed to load entries — ' + fetchErr.message); setLoading(false); return; }
      // Supabase types joined relations as arrays even when the FK is unique;
      // collapse to the single creator object the rest of the modal expects.
      const rows = (data || []) as unknown as Array<Omit<Entry, 'creators'> & { creators: Entry['creators'] | Entry['creators'][] | null }>;
      setEntries(rows.map(r => ({
        ...r,
        creators: Array.isArray(r.creators) ? r.creators[0] : (r.creators ?? undefined),
      })));
      // Pre-select existing winners so the admin can see / adjust prior picks.
      const existingWinners = (data || []).filter((e: any) => e.status === 'winner').map((e: any) => e.id);
      setPicked(new Set(existingWinners));
      setLoading(false);
    })();
  }, [campaign.id]);

  const target = campaign.num_winners || 1;
  const submitted = entries.filter(e => !!e.reel_url);
  const noReel = entries.filter(e => !e.reel_url);

  const togglePick = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < target) next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (picked.size === 0) { setError('Pick at least one winner.'); return; }
    setError(''); setSaving(true);

    const now = new Date().toISOString();
    const winnerIds = Array.from(picked);
    const loserIds = entries.filter(e => !picked.has(e.id)).map(e => e.id);
    // Stats only fire on the *first* announcement. On a re-pick (admin
    // adjusting winners) statuses still swap but creator stats don't move
    // — otherwise every adjustment would double-count entries.
    const isFirstAnnouncement = !campaign.winner_announced_at;

    // Mark winners — also set perk_sent so tracking matches the brand-flow
    // intent (admin will physically send the gift card next, then can clear
    // the tick box if needed).
    const { error: winErr } = await supabase.from('participations')
      .update({ status: 'winner', perk_sent: true, perk_sent_at: now })
      .in('id', winnerIds);
    if (winErr) { setError('Failed to save winners — ' + winErr.message); setSaving(false); return; }

    if (loserIds.length > 0) {
      const { error: loseErr } = await supabase.from('participations')
        .update({ status: 'not_selected' })
        .in('id', loserIds);
      if (loseErr) { setError('Saved winners but failed to mark others — ' + loseErr.message); setSaving(false); return; }
    }

    // Stamp the campaign so the creator-side "Awaiting winner pick" state
    // flips to "Winners picked".
    await supabase.from('campaigns')
      .update({ winner_announced_at: now, status: 'completed' })
      .eq('id', campaign.id);

    // ── Update creator completion-rate stats (Hummingbirds Bible §5) ──
    // Per the Bible: "Ghost a campaign = lower completion rate = fewer
    // future selections." For community campaigns we treat the act of
    // submitting a Reel as completion (whether they won or not — they did
    // the work). Entering without submitting is the ghost case.
    //
    // Mirrors the brand-side stat update in markComplete (line ~640) so
    // the level-promotion thresholds stay consistent across both flows.
    if (isFirstAnnouncement) {
      const completedCreatorIds = entries.filter(e => !!e.reel_url).map(e => e.creator_id);
      const ghostedCreatorIds = entries.filter(e => !e.reel_url).map(e => e.creator_id);
      const allCreatorIds = Array.from(new Set([...completedCreatorIds, ...ghostedCreatorIds]));

      if (allCreatorIds.length > 0) {
        const { data: creatorRows } = await supabase.from('creators')
          .select('id, total_campaigns, completed_campaigns')
          .in('id', allCreatorIds);

        const completedSet = new Set(completedCreatorIds);
        await Promise.all((creatorRows || []).map(async (cr: any) => {
          const newTotal = (cr.total_campaigns || 0) + 1;
          const newCompleted = (cr.completed_campaigns || 0) + (completedSet.has(cr.id) ? 1 : 0);
          const rate = Math.round((newCompleted / newTotal) * 100);
          // Auto-promote level — same thresholds as brand markComplete.
          let newLevel = 1, newLevelName = 'Newcomer';
          if (newCompleted >= 21 && rate >= 95) { newLevel = 6; newLevelName = 'Nayba ✦'; }
          else if (newCompleted >= 11) { newLevel = 5; newLevelName = 'Trusted'; }
          else if (newCompleted >= 6) { newLevel = 4; newLevelName = 'Local'; }
          else if (newCompleted >= 3) { newLevel = 3; newLevelName = 'Regular'; }
          else if (newCompleted >= 1) { newLevel = 2; newLevelName = 'Explorer'; }
          await supabase.from('creators').update({
            total_campaigns: newTotal,
            completed_campaigns: newCompleted,
            completion_rate: rate,
            level: newLevel,
            level_name: newLevelName,
          }).eq('id', cr.id);
        }));
      }
    }

    // Fan out emails. Best-effort — don't block UI on failures.
    const winnerEntries = entries.filter(e => picked.has(e.id));
    const loserEntries = entries.filter(e => !picked.has(e.id));
    await Promise.all([
      ...winnerEntries.map(w => sendCreatorWonCommunityEmail(w.creator_id, {
        campaign_title: campaign.title,
        perk_description: campaign.perk_description || '',
      }).catch(() => {})),
      ...loserEntries.map(l => sendCreatorNotSelectedCommunityEmail(l.creator_id, {
        campaign_title: campaign.title,
      }).catch(() => {})),
      sendAdminCommunityWinnersPickedEmail({
        campaign_title: campaign.title,
        num_winners: winnerEntries.length,
        num_entries: entries.length,
      }).catch(() => {}),
    ]);

    setSaving(false);
    onRefresh();
    onClose();
  };

  const initial = (s: string) => (s[0] || '?').toUpperCase();

  return (
    <div className={modalOverlay}>
      <div className={modalBackdrop} onClick={onClose} />
      <div className="relative bg-white rounded-[10px] w-full max-w-[640px] mx-4 flex flex-col overflow-hidden animate-slide-up" style={{ maxHeight: '88vh' }}>
        <div className={modalHeader}>
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--ink)]">Pick winner{target === 1 ? '' : 's'}</h2>
            <p className="text-[12px] text-[var(--ink-50)] mt-0.5">{campaign.title} · choose {target} of {submitted.length} submitted Reel{submitted.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={onClose} className={modalClose}><X size={15} /></button>
        </div>
        <div className={modalBody}>
          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-[10px]" style={{ background: 'rgba(220,38,38,0.06)', color: '#DC2626' }}>
              <span className="text-[14px] font-medium">{error}</span>
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-[14px] text-[var(--ink-50)]">Loading entries…</div>
          ) : submitted.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[14px] text-[var(--ink-50)]">No Reels submitted yet — wait for the content deadline.</p>
            </div>
          ) : (
            <>
              <p className="text-[12px] text-[var(--ink-50)] mb-3">{picked.size}/{target} picked</p>
              <div className="space-y-2">
                {submitted.map(e => {
                  const name = e.creators?.display_name || e.creators?.name || 'Unknown';
                  const handle = (e.creators?.instagram_handle || '').replace('@', '');
                  const isPicked = picked.has(e.id);
                  const disabled = !isPicked && picked.size >= target;
                  return (
                    <div key={e.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border ${isPicked ? 'border-[var(--terra)] bg-[rgba(196,103,74,0.04)]' : 'border-[rgba(42,32,24,0.10)]'}`}>
                      <button onClick={() => togglePick(e.id)} disabled={disabled}
                        className={`w-[20px] h-[20px] rounded-[6px] border-[1.5px] flex items-center justify-center transition-colors flex-shrink-0 ${isPicked ? 'bg-[var(--terra)] border-[var(--terra)]' : 'border-[rgba(42,32,24,0.25)] hover:border-[var(--terra)]'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        {isPicked && <Check size={12} className="text-white" />}
                      </button>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: getAvatarColors(initial(name)).bg }}>
                        <span className="text-[12px] font-semibold" style={{ color: getAvatarColors(initial(name)).text }}>{initial(name)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-[var(--ink)] truncate">{name}</p>
                        {handle && <p className="text-[12px] text-[var(--ink-50)]">@{handle}</p>}
                      </div>
                      {e.reel_url && (
                        <a href={e.reel_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--terra)] hover:underline flex-shrink-0">
                          View Reel <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
              {noReel.length > 0 && (
                <p className="text-[12px] text-[var(--ink-35)] mt-4">
                  {noReel.length} entr{noReel.length === 1 ? 'y' : 'ies'} without a Reel — they'll be marked as not selected.
                </p>
              )}
            </>
          )}
        </div>
        <div className={modalFooterCls}>
          <button onClick={onClose} className={ghostBtn}>Cancel</button>
          <button onClick={handleConfirm} disabled={saving || picked.size === 0}
            className={primaryBtn} style={{ fontWeight: 700 }}>
            <Trophy size={13} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
            {saving ? 'Announcing…' : `Announce ${picked.size} winner${picked.size === 1 ? '' : 's'}`}
          </button>
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
      .eq('id', part.creator_id).maybeSingle();
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
      const { data: campInfo } = await supabase.from('campaigns').select('title, businesses(name)').eq('id', part.campaign_id).maybeSingle();
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
      <div className="relative bg-white rounded-[10px] w-full max-w-[960px] mx-4 flex flex-col overflow-hidden animate-slide-up" style={{ maxHeight: '88vh' }}>
        {/* Header */}
        <div className={modalHeader}>
          <h2 className="text-[20px] font-semibold text-[var(--ink)]">
            Manage Participation — {campaign.title}
          </h2>
          <button onClick={onClose} className={modalClose}><X size={15} /></button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[6px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>
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
                  <th className={pThCls}>Deadline</th>
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
                        <Select value={p.status} onChange={val => updateField(p.id, 'status', val)} options={[
                          { value: 'confirmed', label: 'Confirmed' },
                          { value: 'visited', label: 'Visited' },
                          { value: 'content_submitted', label: 'Content Submitted' },
                          { value: 'completed', label: 'Completed' },
                          { value: 'overdue', label: 'Overdue' },
                        ]} />
                      </td>
                      <td className={pTdCls}>
                        <input type="checkbox" checked={p.perk_sent}
                          onChange={e => updatePerkSent(p.id, e.target.checked)}
                          className="accent-[var(--terra)] w-4 h-4" />
                      </td>
                      <td className={pTdCls}>
                        {/* Per-creator override of campaigns.content_deadline.
                            Empty input clears the override (falls back to
                            the campaign-wide date). Stored as end-of-day UTC. */}
                        <input type="date"
                          defaultValue={p.content_deadline_override ? new Date(p.content_deadline_override).toISOString().slice(0, 10) : ''}
                          onBlur={e => {
                            const v = e.target.value;
                            const iso = v ? new Date(v + 'T23:59:59Z').toISOString() : null;
                            updateField(p.id, 'content_deadline_override', iso);
                          }}
                          className="px-2 py-1.5 rounded-[10px] bg-[rgba(42,32,24,0.02)] border border-[rgba(42,32,24,0.08)] text-[12px] focus:outline-none focus:border-[var(--terra)]"
                        />
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
                            background: p.status === 'completed' ? 'rgba(42,32,24,0.06)' : 'rgba(122,148,120,0.12)',
                            color: p.status === 'completed' ? 'var(--ink-35)' : 'var(--sage)',
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
interface PeekApplication {
  id: string;
  creator_id: string;
  status: string;
  selected_at: string | null;
  previously_selected_at: string | null;
  applied_at: string;
  pitch: string | null;
  creators?: { name: string; display_name: string | null; instagram_handle: string; level: number | null; avatar_url: string | null };
}

function CampaignPeekPanel({ campaign, onClose, onViewParticipation, onEdit, onDelete, onPickWinners }: {
  campaign: Campaign; onClose: () => void; onViewParticipation: () => void; onEdit: () => void; onDelete: () => void; onPickWinners: () => void;
}) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  const [showAddApplicant, setShowAddApplicant] = useState(false);
  const [allCreators, setAllCreators] = useState<{id:string;name:string;display_name:string|null;instagram_handle:string}[]>([]);
  const [addingCreator, setAddingCreator] = useState<string | null>(null);
  const [applications, setApplications] = useState<PeekApplication[]>([]);

  const fetchApplications = async () => {
    const { data } = await supabase.from('applications')
      .select('id, creator_id, status, selected_at, previously_selected_at, applied_at, pitch, creators(name, display_name, instagram_handle, level, avatar_url)')
      .eq('campaign_id', campaign.id)
      .order('applied_at', { ascending: false });
    if (data) setApplications(data as unknown as PeekApplication[]);
  };

  useEffect(() => { fetchApplications(); }, [campaign.id]);

  const fetchCreatorsForAdd = async () => {
    const { data } = await supabase.from('creators').select('id, name, display_name, instagram_handle').eq('approved', true).order('name');
    if (data) setAllCreators(data);
    setShowAddApplicant(true);
  };

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
    fetchApplications();
  };

  const handleSelectCreator = async (creatorId: string) => {
    // Transition to 'selected' — the creator still needs to confirm their spot
    // before a participation is created. This triggers the selection email
    // and unlocks the "Confirm your spot" CTA in the creator app.
    // Community campaigns don't have a manual "select" step — entries are
    // already auto-confirmed at apply-time and judged later via the
    // winner-pick flow — so this CTA shouldn't be reachable for them.
    const { error: appErr } = await supabase.from('applications').update({
      status: 'selected', selected_at: new Date().toISOString(),
    }).eq('campaign_id', campaign.id).eq('creator_id', creatorId);
    if (appErr) { showToast('Failed to select creator'); return; }
    const { data: campData } = await supabase.from('campaigns').select('title, campaign_type, businesses(name)').eq('id', campaign.id).maybeSingle();
    if (campData && (campData as any).campaign_type !== 'community') {
      sendCreatorSelectedEmail(creatorId, {
        campaign_title: campData.title,
        brand_name: (campData as any).businesses?.name || '',
        campaign_id: campaign.id,
      });
    }
    showToast('Creator selected — waiting for them to confirm');
    fetchApplications();
  };

  // Fires the same selection_expired email the cron would've sent if
  // the 48h window had run out naturally — used when the admin manually
  // moves a 'selected' creator back to reserves or declines them, so the
  // creator always hears their spot was closed rather than silently
  // vanishing.
  const emailSelectionExpiredForApp = async (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app?.creator_id) return;
    const { data: campData } = await supabase.from('campaigns')
      .select('id, title, businesses(name)')
      .eq('id', campaign.id)
      .maybeSingle();
    if (!campData?.title) return;
    const brandName = (campData as any).businesses?.name || '';
    sendCreatorSelectionExpiredEmail(app.creator_id, {
      campaign_title: campData.title,
      brand_name: brandName,
      campaign_id: campaign.id,
    }).catch(() => {});
  };

  const handleReturnToReserves = async (appId: string) => {
    if (!window.confirm("Return this creator to reserves? They'll no longer be selected.")) return;
    const prev = applications.find(a => a.id === appId);
    const { error } = await supabase.from('applications')
      .update({
        status: 'interested',
        selected_at: null,
        // Record the ghost so the UI can flag them next time.
        previously_selected_at: prev?.selected_at ?? null,
      })
      .eq('id', appId);
    if (error) { showToast('Failed to update'); return; }
    emailSelectionExpiredForApp(appId);
    showToast('Creator moved to reserves');
    fetchApplications();
  };

  const handleDeclineApp = async (appId: string) => {
    if (!window.confirm('Decline this creator?')) return;
    // Grab previous row before the update so we only fire the expiry
    // email when this was a pending selection (not an unpicked reserve)
    // and so we can preserve selected_at on previously_selected_at.
    const prev = applications.find(a => a.id === appId);
    const updates: Record<string, any> = { status: 'declined' };
    if (prev?.status === 'selected' && prev.selected_at) {
      updates.previously_selected_at = prev.selected_at;
    }
    const { error } = await supabase.from('applications')
      .update(updates)
      .eq('id', appId);
    if (error) { showToast('Failed to update'); return; }
    if (prev?.status === 'selected') emailSelectionExpiredForApp(appId);
    showToast('Creator declined');
    fetchApplications();
  };

  const peekLabel = "text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1";

  return (
    <>
      <div className="fixed inset-0 z-40 animate-overlay" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[420px] bg-white border-l border-[rgba(42,32,24,0.08)] flex flex-col animate-slide-in-right" style={{ boxShadow: '-4px 0 24px rgba(42,32,24,0.10)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(42,32,24,0.08)] flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-[var(--ink)] truncate">{campaign.title}</p>
            <p className="text-[14px] text-[var(--ink-50)] mt-0.5">{campaign.campaign_type === 'community' ? 'Nayba Community' : (campaign.businesses?.name || '—')}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[var(--ink-50)] hover:bg-[rgba(42,32,24,0.06)] transition-colors flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        {toast && (
          <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[6px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>{toast}</div>
        )}

        {/* Scrollable body — reuses CampaignDetail from creator app */}
        <div className="flex-1 overflow-y-auto">
          <CampaignDetail campaignId={campaign.id} hideActions />

          {/* Selection — groups applicants by status so admin can see at
              a glance which selected creators haven't confirmed yet and
              how long each has left in their 48h window. Mirrors the
              Selected / Reserves / Declined split on the brand side. */}
          {campaign.campaign_type !== 'community' && (
            <SelectionSection
              campaignId={campaign.id}
              applications={applications}
              target={campaign.creator_target || 0}
              onSelect={handleSelectCreator}
              onReturnToReserves={handleReturnToReserves}
              onDecline={handleDeclineApp}
            />
          )}

          {/* Admin controls */}
          <div className="px-5 py-4 border-t border-[rgba(42,32,24,0.08)]">
          <div className="mb-4">
            <p className={peekLabel}>Status</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { value: 'draft', label: 'Draft', bg: 'rgba(42,32,24,0.06)', color: 'var(--ink-60)' },
                { value: 'active', label: 'Active', bg: 'rgba(122,148,120,0.12)', color: 'var(--sage)' },
                { value: 'selecting', label: 'Selecting', bg: 'rgba(122,160,184,0.12)', color: 'var(--baltic)' },
                { value: 'live', label: 'Live', bg: 'rgba(140,122,170,0.12)', color: 'var(--violet)' },
                { value: 'completed', label: 'Completed', bg: 'rgba(42,32,24,0.06)', color: 'var(--ink-60)' },
              ] as const).map(s => (
                <button key={s.value} onClick={async () => {
                  if (s.value === campaign.status) return;
                  if (s.value === 'completed' && !window.confirm('Mark this campaign as completed?')) return;
                  const { error } = await supabase.from('campaigns').update({ status: s.value }).eq('id', campaign.id);
                  if (error) showToast('Failed to update status');
                  else { showToast(`Status → ${s.value}`); onEdit(); }
                }}
                  className="px-3 py-1.5 rounded-[6px] text-[12px] transition-all"
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
          {campaign.campaign_type === 'community' && (
            <button onClick={onPickWinners} className="w-full px-4 py-2.5 rounded-[10px] mb-2 text-[14px] flex items-center justify-center gap-1.5 transition-colors"
              style={{ background: campaign.winner_announced_at ? 'rgba(42,32,24,0.06)' : 'rgba(196,103,74,0.10)', color: campaign.winner_announced_at ? 'var(--ink-60)' : 'var(--terra)', fontWeight: 700 }}>
              <Trophy size={13} /> {campaign.winner_announced_at ? 'Adjust winners' : `Pick winner${(campaign.num_winners || 1) === 1 ? '' : 's'}`}
            </button>
          )}
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
              const { brand_id, title, headline, about_brand, perk_description, perk_value, perk_type, target_city, target_county, creator_target, min_level, content_requirements, brand_instructions, talking_points, inspiration, deliverables, campaign_type, campaign_image, num_winners } = campaign;
              const dupPayload: any = {
                brand_id, title: `Copy of ${title}`, headline, about_brand, perk_description, perk_value, perk_type,
                target_city, target_county, creator_target, min_level, content_requirements, brand_instructions,
                talking_points, inspiration, deliverables, campaign_type, campaign_image, status: 'draft',
              };
              // Only carry num_winners over for community dupes — avoids
              // referencing the column for brand campaigns when the migration
              // hasn't landed.
              if (campaign_type === 'community') dupPayload.num_winners = num_winners;
              const { error } = await supabase.from('campaigns').insert(dupPayload);
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
export default function AdminCampaignsTab({ showModal, onCloseModal, onOpenModal, initialPeekId, onPeekHandled }: {
  showModal: boolean; onCloseModal: () => void; onOpenModal: () => void;
  initialPeekId?: string; onPeekHandled?: () => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [peekCampaign, setPeekCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [participationCampaign, setParticipationCampaign] = useState<Campaign | null>(null);
  const [pickWinnersCampaign, setPickWinnersCampaign] = useState<Campaign | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [appCounts, setAppCounts] = useState<Record<string, { applicants: number; selected: number; confirmed: number; awaiting: number; reserves: number; urgent: boolean; submitted: number; completed: number }>>({});
  const [totalStats, setTotalStats] = useState({ active: 0, applicants: 0, reels: 0, reach: 0 });
  const [deletingCampaign, setDeletingCampaign] = useState<string | null>(null);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'gallery'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'deadline'>('newest');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Delete a campaign plus every row that references it. Child FKs don't all
  // have ON DELETE CASCADE (participations.campaign_id doesn't, neither does
  // notifications.campaign_id), so we clean up manually before deleting the
  // campaign itself. Returns true on success.
  const cascadeDeleteCampaigns = async (ids: string[]): Promise<boolean> => {
    if (ids.length === 0) return true;
    // Notifications keep campaign_id for audit — null it rather than delete.
    await supabase.from('notifications').update({ campaign_id: null }).in('campaign_id', ids);
    await supabase.from('participations').delete().in('campaign_id', ids);
    await supabase.from('applications').delete().in('campaign_id', ids);
    const { error } = await supabase.from('campaigns').delete().in('id', ids);
    if (error) {
      console.error('[admin] campaign delete failed:', error);
      showToast(`Delete failed — ${error.message}`);
      return false;
    }
    return true;
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedCampaigns);
    if (ids.length === 0) return;
    const msg = ids.length === 1
      ? 'Permanently delete this campaign, its applications, and participations? This cannot be undone.'
      : `Permanently delete ${ids.length} campaigns and all their applications and participations? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setBulkDeleting(true);
    const ok = await cascadeDeleteCampaigns(ids);
    setBulkDeleting(false);
    if (!ok) return;
    showToast(`Deleted ${ids.length} campaign${ids.length > 1 ? 's' : ''}`);
    setSelectedCampaigns(new Set());
    fetchCampaigns();
  };

  const toggleSelectCampaign = (id: string) => {
    setSelectedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => { fetchCampaigns(); }, []);

  // Cmd-K deep link
  useEffect(() => {
    if (initialPeekId && campaigns.length > 0) {
      const c = campaigns.find(x => x.id === initialPeekId);
      if (c) { setPeekCampaign(c); onPeekHandled?.(); }
    }
  }, [initialPeekId, campaigns]);

  const fetchCampaigns = async () => {
    const [campRes, brandRes] = await Promise.all([
      supabase.from('campaigns').select('*, businesses(name, category, logo_url)').order('created_at', { ascending: false }),
      supabase.from('businesses').select('id, name').eq('approved', true).order('name'),
    ]);
    if (campRes.data) {
      setCampaigns(campRes.data as Campaign[]);
      const counts: Record<string, any> = {};
      let totalApplicants = 0, totalReels = 0, totalReach = 0;
      for (const c of campRes.data) {
        const [appRes, partRes] = await Promise.all([
          supabase.from('applications').select('status, selected_at').eq('campaign_id', c.id),
          supabase.from('participations').select('status, reach, reel_url').eq('campaign_id', c.id),
        ]);
        const a = appRes.data?.length || 0;
        const r = partRes.data?.filter((p: any) => p.reel_url).length || 0;
        const reach = partRes.data?.reduce((s: number, p: any) => s + (p.reach || 0), 0) || 0;
        const confirmed = appRes.data?.filter((x: any) => x.status === 'confirmed').length || 0;
        const awaitingRows = appRes.data?.filter((x: any) => x.status === 'selected') || [];
        const awaiting = awaitingRows.length;
        const reserves = appRes.data?.filter((x: any) => x.status === 'interested').length || 0;
        // Any pending selection within 12 hours of expiry — mirrors the
        // same threshold used inside SelectionSection for consistency.
        const urgent = awaitingRows.some((x: any) => {
          const h = hoursUntilConfirmDeadline(x.selected_at);
          return h !== null && h <= 12;
        });
        counts[c.id] = {
          applicants: a,
          selected: confirmed + awaiting,
          confirmed,
          awaiting,
          reserves,
          urgent,
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

  const filteredCampaigns = campaigns
    .filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (typeFilter !== 'all' && c.campaign_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const ownerName = c.campaign_type === 'community' ? 'nayba community' : (c.businesses?.name || '').toLowerCase();
        return c.title.toLowerCase().includes(q) || ownerName.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'deadline') {
        const da = a.expression_deadline ? new Date(a.expression_deadline).getTime() : Infinity;
        const db = b.expression_deadline ? new Date(b.expression_deadline).getTime() : Infinity;
        return da - db;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const selectAllCampaigns = () => {
    if (filteredCampaigns.length === 0) return;
    if (selectedCampaigns.size === filteredCampaigns.length) setSelectedCampaigns(new Set());
    else setSelectedCampaigns(new Set(filteredCampaigns.map(c => c.id)));
  };

  return (
    <div>
      {toast && (
        <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 rounded-[6px] text-white text-[14px]" style={{ background: 'var(--ink)', fontWeight: 600, boxShadow: '0 4px 16px rgba(42,32,24,0.20)' }}>{toast}</div>
      )}

      {/* Bulk action toolbar (desktop) */}
      {selectedCampaigns.size > 0 && (
        <div className="hidden md:flex items-center justify-between px-4 py-2.5 mb-4 rounded-[10px] border border-[rgba(42,32,24,0.08)] bg-white">
          <div className="text-[13px] text-[var(--ink-60)]">
            <span className="font-semibold text-[var(--ink)]">{selectedCampaigns.size}</span> campaign{selectedCampaigns.size > 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedCampaigns(new Set())}
              className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold text-[var(--ink-60)] hover:bg-[rgba(42,32,24,0.06)]">
              Clear
            </button>
            <button onClick={bulkDelete} disabled={bulkDeleting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] bg-[rgba(220,38,38,0.06)] text-[#DC2626] text-[12px] font-semibold hover:bg-[rgba(220,38,38,0.12)] disabled:opacity-50">
              <Trash2 size={13} /> {bulkDeleting ? 'Deleting…' : `Delete ${selectedCampaigns.size}`}
            </button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-stagger">
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

      {/* Search & filter toolbar */}
      {campaigns.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-50)]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or brand..."
              className="w-full pl-9 pr-4 py-2.5 rounded-[10px] bg-white border border-[rgba(42,32,24,0.15)] text-[14px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)]" />
          </div>
          <Select value={statusFilter} onChange={setStatusFilter} options={[
            { value: 'all', label: 'All statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'selecting', label: 'Selecting' },
            { value: 'live', label: 'Live' },
            { value: 'completed', label: 'Completed' },
          ]} />
          <Select value={typeFilter} onChange={setTypeFilter} options={[
            { value: 'all', label: 'All types' },
            { value: 'brand', label: 'Brand only' },
            { value: 'community', label: 'Community only' },
          ]} />
          <Select value={sortBy} onChange={val => setSortBy(val as any)} options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'deadline', label: 'By deadline' },
          ]} />
        </div>
      )}

      {/* View toggle — desktop only */}
      {campaigns.length > 0 && (
        <div className="hidden md:flex items-center gap-1 mb-4">
          {([
            { mode: 'table' as const, icon: LayoutList, label: 'Table' },
            { mode: 'kanban' as const, icon: Kanban, label: 'Board' },
            { mode: 'gallery' as const, icon: LayoutGrid, label: 'Gallery' },
          ]).map(v => (
            <button key={v.mode} onClick={() => setViewMode(v.mode)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[13px] font-medium transition-colors"
              style={{
                background: viewMode === v.mode ? 'rgba(42,32,24,0.06)' : 'transparent',
                color: viewMode === v.mode ? 'var(--ink)' : 'var(--ink-35)',
              }}>
              <v.icon size={14} />
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Campaign views */}
      {campaigns.length > 0 ? (<>
        {/* Mobile card list (always list view on mobile) */}
        <div className="md:hidden space-y-2">
          {filteredCampaigns.map(c => {
            const counts = appCounts[c.id] || { applicants: 0, selected: 0, confirmed: 0, awaiting: 0, reserves: 0, urgent: false, submitted: 0, completed: 0 };
            return (
              <div key={c.id} onClick={() => setPeekCampaign(peekCampaign?.id === c.id ? null : c)}
                className="bg-white rounded-[12px] p-4 active:bg-[rgba(42,32,24,0.02)]" style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--ink)]">{c.title}</p>
                    <p className="text-[12px] text-[var(--ink-60)]">{c.campaign_type === 'community' ? 'Nayba Community' : c.businesses?.name}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[var(--ink-50)] flex-wrap">
                  <span>{counts.applicants}/{c.creator_target} applicants</span>
                  {c.campaign_type !== 'community' && (counts.confirmed + counts.awaiting > 0 || counts.reserves > 0) && (
                    <span className="inline-flex items-center gap-1">
                      {counts.urgent && <span className="w-1.5 h-1.5 rounded-full bg-[var(--terra)]" title="A pending selection is within 12h of expiry" />}
                      <span><span className="text-[var(--ink)] font-semibold">{counts.confirmed}</span> confirmed{counts.awaiting > 0 ? ` · ${counts.awaiting} awaiting` : ''}{counts.reserves > 0 ? ` · ${counts.reserves} reserve${counts.reserves === 1 ? '' : 's'}` : ''}</span>
                    </span>
                  )}
                  <span>{counts.submitted} reels</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: Table view */}
        {viewMode === 'table' && (
        <div className="hidden md:block bg-white rounded-[12px] overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[940px]">
            <thead><tr>
              <th className={thCls} style={{ width: 40 }}>
                <button onClick={selectAllCampaigns}
                  className={`w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors ${filteredCampaigns.length > 0 && selectedCampaigns.size === filteredCampaigns.length ? 'bg-[var(--terra)] border-[var(--terra)]' : 'border-[rgba(42,32,24,0.25)] hover:border-[var(--terra)]'}`}
                  title={selectedCampaigns.size === filteredCampaigns.length ? 'Deselect all' : 'Select all'}>
                  {filteredCampaigns.length > 0 && selectedCampaigns.size === filteredCampaigns.length && <Check size={10} className="text-white" />}
                </button>
              </th>
              <th className={thCls}>Brand</th><th className={thCls}>Campaign</th><th className={thCls}>Status</th>
              <th className={thCls}>City</th><th className={thCls}>Target</th><th className={thCls}>Applicants</th>
              <th className={thCls}>Selected</th><th className={thCls}>Submitted</th><th className={thCls}>Completed</th>
              <th className={thCls}>Deadline</th>
            </tr></thead>
            <tbody>
              {filteredCampaigns.map(c => {
                const counts = appCounts[c.id] || { applicants: 0, selected: 0, confirmed: 0, awaiting: 0, reserves: 0, urgent: false, submitted: 0, completed: 0 };
                const selected = peekCampaign?.id === c.id;
                const isChecked = selectedCampaigns.has(c.id);
                return (
                    <tr key={c.id} onClick={() => setPeekCampaign(selected ? null : c)}
                      className={`cursor-pointer transition-colors ${isChecked ? 'bg-[rgba(196,103,74,0.04)]' : selected ? 'bg-[rgba(42,32,24,0.04)]' : 'hover:bg-[rgba(42,32,24,0.03)]'}`} style={{ height: 44 }}>
                      <td className={tdCls} onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleSelectCampaign(c.id)}
                          className={`w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors ${isChecked ? 'bg-[var(--terra)] border-[var(--terra)]' : 'border-[rgba(42,32,24,0.20)] hover:border-[var(--terra)]'}`}>
                          {isChecked && <Check size={10} className="text-white" />}
                        </button>
                      </td>
                      <td className={tdCls}>
                        {(() => {
                          const isCommunity = c.campaign_type === 'community';
                          const displayName = isCommunity ? 'Nayba Community' : (c.businesses?.name || '—');
                          const initial = (displayName === '—' ? '?' : displayName[0]);
                          const logoUrl = c.businesses?.logo_url;
                          const ac = isCommunity
                            ? { bg: '#F9E8E1', text: 'var(--terra)' }
                            : getAvatarColors(initial);
                          return (
                            <div className="flex items-center gap-2.5">
                              {!isCommunity && logoUrl ? (
                                <img src={logoUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ac.bg }}>
                                  <span className="text-[12px] font-semibold" style={{ color: ac.text }}>{initial}</span>
                                </div>
                              )}
                              <span className="font-medium text-[14px]">{displayName}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className={`${tdCls} font-medium`}>{c.title}</td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={c.status} />
                          {c.campaign_type === 'community' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[10px] text-[12px] font-semibold bg-[var(--terra-light)] text-[var(--terra)]">Community</span>
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
                      <td className={tdCls}>
                        {c.campaign_type === 'community' ? (
                          counts.selected
                        ) : (
                          <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            {counts.urgent && <span className="w-1.5 h-1.5 rounded-full bg-[var(--terra)]" title="Pending selection <12h from expiry" />}
                            <span>
                              <span className="text-[var(--ink)] font-semibold">{counts.confirmed}</span>
                              {counts.awaiting > 0 && <span className="text-[var(--ink-60)]"> + {counts.awaiting}</span>}
                              {counts.reserves > 0 && <span className="text-[var(--ink-50)]"> · {counts.reserves}R</span>}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className={tdCls}>{counts.submitted}</td>
                      <td className={tdCls}>{counts.completed}</td>
                      <td className={`${tdCls} text-[var(--ink-50)]`}>{fmtShortDate(c.expression_deadline)}</td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Desktop: Kanban view */}
        {viewMode === 'kanban' && (
        <div className="hidden md:grid gap-3 animate-fade-in" style={{ gridTemplateColumns: `repeat(${kanbanColumns.length}, minmax(200px, 1fr))` }}>
          {kanbanColumns.map(col => {
            const colCampaigns = filteredCampaigns.filter(c => c.status === col.key);
            return (
              <div key={col.key} className="min-h-[200px]">
                {/* Column header */}
                <div className="flex items-center gap-2 px-2 mb-3">
                  <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: col.dot }} />
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--ink-60)', textTransform: 'uppercase' as const }}>{col.label}</span>
                  <span className="text-[12px] font-medium text-[var(--ink-35)]">{colCampaigns.length}</span>
                </div>

                {/* Cards */}
                <div className="space-y-2.5">
                  {colCampaigns.map(c => {
                    const counts = appCounts[c.id] || { applicants: 0, selected: 0, confirmed: 0, awaiting: 0, reserves: 0, urgent: false, submitted: 0, completed: 0 };
                    const selected = peekCampaign?.id === c.id;
                    return (
                      <div key={c.id} onClick={() => setPeekCampaign(selected ? null : c)}
                        className={`bg-white rounded-[12px] p-3.5 cursor-pointer transition-all ${selected ? 'ring-2 ring-[var(--terra)]' : 'hover:shadow-md'}`}
                        style={{ boxShadow: selected ? undefined : '0 1px 4px rgba(42,32,24,0.04)' }}>
                        {/* Brand row */}
                        {(() => {
                          const isCommunity = c.campaign_type === 'community';
                          const displayName = isCommunity ? 'Nayba Community' : (c.businesses?.name || '—');
                          const initial = (displayName === '—' ? '?' : displayName[0]);
                          const logoUrl = c.businesses?.logo_url;
                          const ac = isCommunity
                            ? { bg: '#F9E8E1', text: 'var(--terra)' }
                            : getAvatarColors(initial);
                          return (
                            <div className="flex items-center gap-2 mb-2">
                              {!isCommunity && logoUrl ? (
                                <img src={logoUrl} alt={displayName} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ac.bg }}>
                                  <span className="text-[9px] font-bold" style={{ color: ac.text }}>{initial}</span>
                                </div>
                              )}
                              <span className="text-[12px] text-[var(--ink-50)] truncate">{displayName}</span>
                            </div>
                          );
                        })()}

                        {/* Title */}
                        <p className="text-[13px] font-semibold text-[var(--ink)] leading-snug mb-2.5">{c.title}</p>

                        {/* Progress bar */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-1 bg-[rgba(42,32,24,0.06)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ background: col.dot, width: `${Math.min((counts.applicants / Math.max(c.creator_target, 1)) * 100, 100)}%` }} />
                          </div>
                          <span className="text-[11px] text-[var(--ink-50)] flex-shrink-0">{counts.applicants}/{c.creator_target}</span>
                        </div>

                        {/* Footer meta */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[11px] text-[var(--ink-35)]">
                            {c.campaign_type !== 'community' && counts.confirmed + counts.awaiting > 0 && (
                              <span className="inline-flex items-center gap-1">
                                {counts.urgent && <span className="w-1 h-1 rounded-full bg-[var(--terra)]" title="Pending selection <12h from expiry" />}
                                <span>{counts.confirmed}{counts.awaiting > 0 ? `+${counts.awaiting}` : ''}</span>
                              </span>
                            )}
                            {c.campaign_type !== 'community' && counts.reserves > 0 && <span>{counts.reserves}R</span>}
                            {c.campaign_type === 'community' && counts.selected > 0 && <span>{counts.selected} selected</span>}
                            {counts.submitted > 0 && <span>{counts.submitted} reels</span>}
                          </div>
                          {c.expression_deadline && (
                            <div className="flex items-center gap-1 text-[11px] text-[var(--ink-35)]">
                              <Calendar size={10} />
                              <span>{fmtShortDate(c.expression_deadline)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty column */}
                  {colCampaigns.length === 0 && (
                    <div className="rounded-[12px] border border-dashed border-[rgba(42,32,24,0.10)] p-6 text-center">
                      <p className="text-[12px] text-[var(--ink-35)]">No campaigns</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Desktop: Gallery view */}
        {viewMode === 'gallery' && (
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
            {filteredCampaigns.map(c => {
              const counts = appCounts[c.id] || { applicants: 0, selected: 0, confirmed: 0, awaiting: 0, reserves: 0, urgent: false, submitted: 0, completed: 0 };
              const selected = peekCampaign?.id === c.id;
              return (
                <button key={c.id} onClick={() => setPeekCampaign(selected ? null : c)}
                  className={`w-full text-left rounded-[12px] flex flex-col bg-white transition-shadow duration-200 hover:shadow-[0_4px_12px_rgba(42,32,24,0.10)] press-card ${selected ? 'ring-2 ring-[var(--terra)]' : ''}`}
                  style={{ boxShadow: '0 1px 4px rgba(42,32,24,0.04)' }}>
                  <div className="px-2.5 pt-2.5">
                    <div className="w-full relative rounded-[8px] overflow-hidden" style={{ height: 150 }}>
                      {c.campaign_image ? (
                        <img src={c.campaign_image} alt={c.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: getCategoryPalette(c.businesses?.category).tint }}>
                          <Megaphone size={32} style={{ color: getCategoryPalette(c.businesses?.category).color, opacity: 0.5 }} />
                        </div>
                      )}
                      <span className="absolute top-2 right-2 bg-white rounded-[6px] shadow-sm"><StatusBadge status={c.status} /></span>
                    </div>
                  </div>
                  <div className="flex-1 px-3.5 pb-3.5 pt-3 flex flex-col">
                    <span className="text-[11px] font-medium text-[var(--ink-50)] mb-1">{c.campaign_type === 'community' ? 'Nayba Community' : c.businesses?.name}</span>
                    <p className="text-[15px] text-[var(--ink)] leading-[1.3] mb-2 line-clamp-2" style={{ fontWeight: 600 }}>{c.headline || c.title}</p>
                    <div className="mt-auto space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[rgba(42,32,24,0.06)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--terra)] rounded-full" style={{ width: `${Math.min((counts.applicants / Math.max(c.creator_target, 1)) * 100, 100)}%` }} />
                        </div>
                        <span className="text-[11px] text-[var(--ink-50)]">{counts.applicants}/{c.creator_target}</span>
                      </div>
                      {c.expression_deadline && <p className="text-[11px] text-[var(--ink-35)]">Deadline: {fmtShortDate(c.expression_deadline)}</p>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </>) : (
        /* Empty state */
        <div className="bg-white rounded-[12px] p-12 text-center">
          <div className="w-12 h-12 rounded-[10px] flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(196,103,74,0.08)' }}>
            <Megaphone size={22} className="text-[var(--terra)]" />
          </div>
          <p className="text-[17px] font-semibold text-[var(--ink)] mb-1">No campaigns yet</p>
          <p className="text-[14px] text-[var(--ink-60)] mb-5">Create your first campaign to get started</p>
          <button onClick={onOpenModal} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[var(--terra)] text-white text-[14px]" style={{ fontWeight: 700 }}>
            ✦ New Campaign
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
          onPickWinners={() => { setPickWinnersCampaign(peekCampaign); setPeekCampaign(null); }}
        />
      )}

      {/* Pick Winners Modal (community campaigns) */}
      {pickWinnersCampaign && (
        <PickWinnersModal
          campaign={pickWinnersCampaign}
          onClose={() => setPickWinnersCampaign(null)}
          onRefresh={fetchCampaigns}
        />
      )}

      {/* AI Campaign Wizard (new campaigns) */}
      {(showModal && !editingCampaign) && (
        <CampaignWizard
          brands={brands}
          onSave={() => { onCloseModal(); fetchCampaigns(); }}
          onClose={onCloseModal}
        />
      )}

      {/* Legacy Campaign Modal (editing existing campaigns) */}
      {editingCampaign && (
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

      {/* Delete campaign confirmation modal */}
      {deletingCampaign && (
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-50 flex items-center justify-center animate-overlay">
          <div className="bg-white rounded-[12px] max-w-[340px] w-full mx-4 p-6 text-center animate-slide-up">
            <h3 className="nayba-h3">Delete campaign?</h3>
            <p className="text-[14px] text-[var(--ink-50)] mt-2 mb-5">This will permanently remove this campaign and all its applications and participations. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingCampaign(null)} className="flex-1 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink)] font-medium text-[14px]">Cancel</button>
              <button onClick={async () => {
                const id = deletingCampaign;
                const ok = await cascadeDeleteCampaigns([id]);
                if (!ok) return; // toast already shown
                setDeletingCampaign(null);
                setPeekCampaign(null);
                fetchCampaigns();
                showToast('Campaign deleted');
              }} className="flex-1 py-2.5 rounded-[10px] bg-[var(--destructive)] text-white font-semibold text-[14px]">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
