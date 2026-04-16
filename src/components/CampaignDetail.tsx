import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sendCreatorConfirmedEmail, sendBusinessCreatorConfirmedEmail, sendAdminInterestExpressedEmail, sendAdminCreatorConfirmedEmail, sendCreatorEnteredCommunityEmail } from '../lib/notifications';
import { ArrowLeft, Check, X, AtSign, ExternalLink, Gift, Clock, Film, MapPin, Sparkles, Megaphone, Trophy } from 'lucide-react';
import { getCategoryPalette, CategoryIcon } from '../lib/categories';
import { getCampaignBrandDisplay } from '../lib/campaignDisplay';
import { fmtDeadline } from '../lib/dates';
import NaybaLogo from '../assets/logomark.svg';

function CampaignFallbackImage({ category, name, isCommunity }: { category?: string | null; name?: string | null; isCommunity?: boolean }) {
  if (isCommunity) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: 'rgba(59,130,246,0.08)' }}>
        <Megaphone className="w-14 h-14 mb-2" style={{ color: '#3B82F6', opacity: 0.7 }} />
        {name && <span className="text-[14px] font-medium" style={{ color: '#3B82F6', opacity: 0.7 }}>{name}</span>}
      </div>
    );
  }
  const cp = getCategoryPalette(category);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: cp.tint }}>
      <CategoryIcon category={category} className="w-14 h-14 mb-2" style={{ color: cp.color, opacity: 0.7 }} />
      {name && <span className="text-[14px] font-medium" style={{ color: cp.color, opacity: 0.6 }}>{name}</span>}
    </div>
  );
}

interface CampaignDetailProps {
  campaignId: string;
  onBack?: () => void;
  hideActions?: boolean;
}

interface Campaign {
  id: string; brand_id: string | null; title: string; headline: string | null;
  about_brand: string | null; perk_description: string | null; perk_value: number | null;
  perk_type: string | null; target_city: string | null; content_requirements: string | null;
  brand_instructions: string | null;
  talking_points: string[] | null; inspiration: any[] | null; deliverables: any;
  required_tags: string[] | null; creator_target: number | null;
  open_date: string | null; expression_deadline: string | null; content_deadline: string | null;
  status: string; campaign_image: string | null;
  campaign_type: 'brand' | 'community';
  num_winners: number | null; winner_announced_at: string | null;
  businesses?: { name: string; category?: string; bio?: string | null; instagram_handle?: string | null; logo_url?: string | null; address?: string | null; approved?: boolean } | null;
}

interface Application {
  id: string; status: string; selected_at: string | null;
}

interface ParticipationLite {
  id: string; status: string; reel_url: string | null;
}

/** Hours remaining until `selected_at` + 48h. Negative if already past. */
function hoursUntilConfirmDeadline(selectedAt: string | null): number | null {
  if (!selectedAt) return null;
  const deadline = new Date(selectedAt).getTime() + 48 * 60 * 60 * 1000;
  return (deadline - Date.now()) / (60 * 60 * 1000);
}

export default function CampaignDetail({ campaignId, onBack, hideActions }: CampaignDetailProps) {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [participation, setParticipation] = useState<ParticipationLite | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [creatorInstagram, setCreatorInstagram] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [pitchFit, setPitchFit] = useState('');
  const [pitchIdea, setPitchIdea] = useState('');
  const [pitchBrief, setPitchBrief] = useState('');
  const [showPitchExample, setShowPitchExample] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState<string>('');
  const [confirmedCount, setConfirmedCount] = useState(0);

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  const fetchCampaign = async () => {
    setLoading(true);
    const { data: campData, error: campErr } = await supabase
      .from('campaigns')
      .select('*, businesses(name, category, bio, instagram_handle, logo_url, address, approved)')
      .eq('id', campaignId)
      .maybeSingle();
    if (campErr || !campData) { setNotFound(true); setLoading(false); return; }
    setCampaign(campData as Campaign);

    // Count confirmed spots so we can show capacity + disable CTA when full.
    const { count: partCount } = await supabase
      .from('participations')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);
    setConfirmedCount(partCount || 0);

    // Look up real creator ID by email (creators.id != auth.uid())
    if (user?.email) {
      const { data: creatorData } = await supabase
        .from('creators')
        .select('id, display_name, instagram_handle')
        .eq('email', user.email)
        .maybeSingle();
      if (creatorData) {
        setCreatorId(creatorData.id);
        setCreatorName(creatorData.display_name || creatorData.instagram_handle || user.email?.split('@')[0] || 'A creator');
        setCreatorInstagram(creatorData.instagram_handle || '');
        // Check if creator already applied (0 or 1 row expected)
        const { data: appData } = await supabase
          .from('applications')
          .select('id, status, selected_at')
          .eq('campaign_id', campaignId)
          .eq('creator_id', creatorData.id)
          .maybeSingle();
        if (appData) setApplication(appData as Application);

        // Community campaigns expose a Reel-submission CTA inline on detail
        // (because they auto-confirm at apply time and the brand-only "active
        // campaigns" tab won't surface them). Pull the participation row so
        // we know whether the creator has already submitted.
        const { data: partData } = await supabase
          .from('participations')
          .select('id, status, reel_url')
          .eq('campaign_id', campaignId)
          .eq('creator_id', creatorData.id)
          .maybeSingle();
        if (partData) setParticipation(partData as ParticipationLite);
      }
    }
    setLoading(false);
  };

  const handleApply = async (withPitch?: string) => {
    if (!creatorId || !campaign || submitting) return;
    setApplyError('');
    setSubmitting(true);
    const isCommunity = campaign.campaign_type === 'community';

    // Community campaigns auto-confirm at apply time — there's no manual
    // "select" step from a brand. The application row is created confirmed
    // and a participation row is created immediately so the creator can
    // submit a Reel right away. perk_sent stays false until the admin picks
    // a winner.
    const initialStatus = isCommunity ? 'confirmed' : 'interested';
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase.from('applications').insert({
      campaign_id: campaign.id,
      creator_id: creatorId,
      pitch: withPitch || null,
      status: initialStatus,
      ...(isCommunity ? { selected_at: nowIso, confirmed_at: nowIso } : {}),
    }).select('id, status').single();
    if (error) {
      console.error('[CampaignDetail] Failed to apply:', error);
      const msg = error.message.toLowerCase();
      setApplyError(
        msg.includes('duplicate')
          ? (isCommunity ? "You've already entered this draw." : "You've already registered interest for this campaign.")
          : msg.includes('row-level security') || msg.includes('policy')
          ? "Permission denied — please make sure your account is approved."
          : (isCommunity ? "Couldn't enter the draw — please try again." : "Couldn't register your interest — please try again.")
      );
      setSubmitting(false);
      return;
    }
    // Optimistically update application state so CTA changes immediately
    if (data) setApplication(data as Application);

    // Community: create the participation row now so the Reel submission CTA
    // unlocks. We deliberately roll back the application if this fails.
    if (isCommunity && data) {
      const { data: partData, error: partErr } = await supabase.from('participations').insert({
        application_id: data.id,
        campaign_id: campaign.id,
        creator_id: creatorId,
        perk_sent: false,
        status: 'confirmed',
      }).select('id, status, reel_url').single();
      if (partErr) {
        console.error('[CampaignDetail] Failed to create community participation:', partErr);
        await supabase.from('applications').delete().eq('id', data.id);
        setApplication(null);
        setApplyError("Couldn't enter the draw — please try again.");
        setSubmitting(false);
        return;
      }
      if (partData) setParticipation(partData as ParticipationLite);

      // Community-specific creator email — there's no brand to promise a
      // perk from; just confirm entry and remind about the Reel deadline.
      sendCreatorEnteredCommunityEmail(creatorId, {
        campaign_title: campaign.title,
        perk_description: campaign.perk_description || '',
        content_deadline: campaign.content_deadline || '',
      }).catch(() => {});
    }

    // Notify admin (for both flows). Use "Nayba Community" as the brand
    // label for community campaigns so the email body still reads cleanly.
    sendAdminInterestExpressedEmail({
      creator_name: creatorName,
      campaign_title: campaign.title,
      brand_name: isCommunity ? 'Nayba Community' : (campaign.businesses?.name || ''),
    }).catch(() => {});
    setShowPitchModal(false);
    setPitchFit('');
    setPitchIdea('');
    setPitchBrief('');
    setSubmitting(false);
  };

  // Combine the three prompted fields into a single pitch string,
  // labelled so the admin/brand can read the answers in context.
  const composePitch = (): string => {
    const parts: string[] = [];
    if (pitchFit.trim()) parts.push(`Why I'm a fit: ${pitchFit.trim()}`);
    if (pitchIdea.trim()) parts.push(`My content idea: ${pitchIdea.trim()}`);
    if (pitchBrief.trim()) parts.push(`What caught my eye: ${pitchBrief.trim()}`);
    return parts.join('\n\n');
  };
  const pitchHasContent = !!(pitchFit.trim() || pitchIdea.trim() || pitchBrief.trim());

  const handleConfirm = async () => {
    if (!application || !creatorId || !campaign || submitting) return;
    setSubmitting(true);
    setApplyError('');

    // Step 1: mark application confirmed
    const { error: updateErr } = await supabase.from('applications').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    }).eq('id', application.id);
    if (updateErr) {
      console.error('[CampaignDetail] Failed to confirm application:', updateErr);
      setApplyError("Couldn't confirm — please try again.");
      setSubmitting(false);
      return;
    }

    // Step 2: create participation (perk is ready immediately)
    const { error: partErr } = await supabase.from('participations').insert({
      application_id: application.id,
      campaign_id: campaign.id,
      creator_id: creatorId,
      perk_sent: true,
      perk_sent_at: new Date().toISOString(),
    });
    if (partErr) {
      console.error('[CampaignDetail] Failed to create participation:', partErr);
      // Roll back: revert the application status so user isn't stuck in
      // a half-confirmed state.
      await supabase.from('applications').update({
        status: 'selected',
        confirmed_at: null,
      }).eq('id', application.id);
      setApplyError("Couldn't reserve your spot — please try again.");
      setSubmitting(false);
      return;
    }

    // Only now — both DB writes succeeded — update UI and fire emails.
    setApplication({ ...application, status: 'confirmed' });
    // Brand confirmation emails. Community campaigns reach this path only
    // when something has gone wrong (their flow auto-confirms in handleApply
    // and never surfaces the "selected → confirm" step); skip the
    // brand-specific notifications and only ping the admin.
    if (campaign.campaign_type !== 'community' && campaign.brand_id && campaign.businesses?.name) {
      sendCreatorConfirmedEmail(creatorId, {
        campaign_title: campaign.title,
        brand_name: campaign.businesses.name,
        perk_description: campaign.perk_description || '',
        brand_address: campaign.businesses.address || '',
        brand_instructions: campaign.brand_instructions || '',
        brand_instagram: campaign.businesses.instagram_handle || '',
      }).catch(() => {});
      sendBusinessCreatorConfirmedEmail(campaign.brand_id, {
        creator_name: creatorName,
        creator_instagram: creatorInstagram,
        campaign_title: campaign.title,
        perk_description: campaign.perk_description || '',
      }).catch(() => {});
      sendAdminCreatorConfirmedEmail({
        creator_name: creatorName,
        campaign_title: campaign.title,
        brand_name: campaign.businesses.name,
      }).catch(() => {});
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--chalk)]">
        <div className="w-10 h-10 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--chalk)] px-6 text-center">
        <p className="text-[15px] font-medium text-[var(--ink)] mb-2">Campaign not available</p>
        <p className="text-[14px] text-[var(--ink-60)] mb-5 max-w-xs">This campaign may have ended or been removed.</p>
        {onBack && <button onClick={onBack} className="px-4 py-2 min-h-[44px] rounded-[10px] bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-85 transition-opacity">Go back</button>}
      </div>
    );
  }

  const sectionGap = 'mt-6';

  const display = getCampaignBrandDisplay(campaign, getCategoryPalette);
  const isCommunity = display.isCommunity;
  // Community campaigns don't have brand instructions — the helper already
  // returns ''; this preserves the brand path unchanged.
  const brandInstructions = display.instructions;
  const brandHandle = display.instagramHandle;

  // Booking instructions are only revealed AFTER the creator is confirmed.
  // This protects coupon codes / booking links from being visible to
  // creators who are just browsing or haven't been selected yet.
  const PreApplyCallout = null;
  const PreConfirmCallout = null;

  // Next-step callout shown after confirming.
  const PostConfirmCallout = brandInstructions ? (
    <div className="mt-3 rounded-[12px] border border-[rgba(217,95,59,0.20)] bg-[rgba(249,232,225,0.50)] px-4 py-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={13} className="text-[var(--terra)]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--terra)]">How to book</p>
      </div>
      <p className="text-[14px] leading-[1.55] text-[var(--ink)] mb-3">{brandInstructions}</p>
      {brandHandle && (
        <a href={`https://instagram.com/${brandHandle}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[var(--terra)] text-white text-[13px] font-semibold hover:opacity-[0.85] transition-opacity">
          <AtSign size={13} />DM @{brandHandle}
        </a>
      )}
    </div>
  ) : null;

  const target = campaign?.creator_target || 0;
  const remaining = Math.max(0, target - confirmedCount);
  const isFull = target > 0 && remaining === 0;

  const winnersAnnounced = !!campaign?.winner_announced_at;

  const ctaContent = (
    <>
      {!application && !showPitchModal && (
        <div>
          {isFull && !isCommunity ? (
            <>
              <div className="w-full min-h-[44px] py-3 rounded-[10px] bg-[rgba(42,32,24,0.04)] text-center text-[var(--ink-50)] font-medium text-[14px]">
                This campaign is full
              </div>
              <p className="text-[14px] text-[var(--ink-60)] text-center mt-2">Keep an eye out — new campaigns drop every week.</p>
            </>
          ) : isCommunity && winnersAnnounced ? (
            <div className="w-full min-h-[44px] py-3 rounded-[10px] bg-[rgba(42,32,24,0.04)] text-center text-[var(--ink-50)] font-medium text-[14px]">
              The winners have been picked — entries are closed
            </div>
          ) : (
            <>
              <button onClick={() => setShowPitchModal(true)}
                className="w-full min-h-[44px] py-3 rounded-[10px] bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-85 transition-opacity">
                {isCommunity ? 'Enter the draw' : "I'm Interested"}
              </button>
              <p className="text-[14px] text-[var(--ink-60)] text-center mt-2">
                {isCommunity
                  ? `Submit a Reel by the deadline — winner${(campaign?.num_winners || 1) === 1 ? '' : 's'} picked by the Nayba team.`
                  : target > 0 && remaining / target <= 0.5
                    ? `Only ${remaining} spot${remaining === 1 ? '' : 's'} left — the brand will review and select`
                    : "This won't commit you — the brand will review and select"}
              </p>
            </>
          )}
        </div>
      )}
      {!application && showPitchModal && (
        <div className="bg-[var(--stone)] rounded-[12px] p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[15px] font-semibold text-[var(--ink)]">{isCommunity ? 'Tell us about your idea' : 'Tell them why you'}</p>
              <p className="text-[13px] text-[var(--ink-60)] mt-0.5">{isCommunity ? "Optional — context for the Nayba team picking the winner" : 'Short answers help the brand pick you — all optional'}</p>
            </div>
            <button onClick={() => { setShowPitchModal(false); setPitchFit(''); setPitchIdea(''); setPitchBrief(''); setApplyError(''); }}
              className="text-[var(--ink-50)] hover:text-[var(--ink)] flex-shrink-0 ml-2"><X size={18} /></button>
          </div>

          <button type="button"
            onClick={() => setShowPitchExample(s => !s)}
            className="text-[12px] text-[var(--terra)] font-medium mb-3 hover:underline">
            {showPitchExample ? 'Hide example' : 'See a great pitch →'}
          </button>
          {showPitchExample && (
            <div className="mb-3 px-3 py-2.5 rounded-[10px] bg-white border border-[rgba(42,32,24,0.08)] text-[13px] text-[var(--ink-60)] leading-[1.6] space-y-1.5">
              <p><span className="font-semibold text-[var(--ink)]">Fit:</span> I already walk past every weekend with my toddler — we've been meaning to try the brunch.</p>
              <p><span className="font-semibold text-[var(--ink)]">Idea:</span> A 15-sec "morning in the café" Reel cut to a local indie track, close-ups on the pastries.</p>
              <p><span className="font-semibold text-[var(--ink)]">Brief:</span> Loved the "warm, not cheesy" talking point — that's exactly my tone.</p>
            </div>
          )}

          <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1">{isCommunity ? 'Why is this Suffolk experience worth shouting about?' : `How does ${campaign?.businesses?.name || 'this brand'} fit into your life?`}</label>
          <textarea
            value={pitchFit}
            onChange={e => setPitchFit(e.target.value)}
            placeholder="Already a regular, bumped into it recently, been meaning to try..."
            maxLength={300}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(42,32,24,0.15)] bg-white text-[var(--ink)] text-[14px] h-16 resize-none focus:outline-none focus:border-[var(--terra)] mb-2"
          />

          <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1">One content idea you'd shoot</label>
          <textarea
            value={pitchIdea}
            onChange={e => setPitchIdea(e.target.value)}
            placeholder="The specific Reel or shot you'd film — the more concrete, the better"
            maxLength={300}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(42,32,24,0.15)] bg-white text-[var(--ink)] text-[14px] h-16 resize-none focus:outline-none focus:border-[var(--terra)] mb-2"
          />

          <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1">What caught your eye in the brief?</label>
          <textarea
            value={pitchBrief}
            onChange={e => setPitchBrief(e.target.value)}
            placeholder="A talking point, the inspiration, the perk — something specific"
            maxLength={300}
            className="w-full px-3 py-2 rounded-[10px] border border-[rgba(42,32,24,0.15)] bg-white text-[var(--ink)] text-[14px] h-16 resize-none focus:outline-none focus:border-[var(--terra)] mb-2"
          />

          {applyError && (
            <p className="text-[13px] text-[var(--terra)] mb-2">{applyError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => handleApply()}
              disabled={submitting}
              className="flex-1 min-h-[40px] py-2 rounded-[10px] border border-[rgba(42,32,24,0.15)] text-[var(--ink)] font-medium text-[14px] hover:bg-white disabled:opacity-50"
            >
              Skip pitch
            </button>
            <button
              onClick={() => handleApply(composePitch())}
              disabled={submitting || !pitchHasContent}
              className="flex-1 min-h-[40px] py-2 rounded-[10px] bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-85 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit interest'}
            </button>
          </div>
        </div>
      )}
      {application?.status === 'interested' && (
        <div className="w-full min-h-[44px] py-3 rounded-[6px] bg-[rgba(42,32,24,0.04)] text-center text-[#0F6E56] font-medium text-[14px]">
          <Check size={15} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
          Interest registered — we'll be in touch
        </div>
      )}
      {/* Community campaigns: applied → auto-confirmed → submission /
          winner / not_selected. The brand "selected → confirm" path
          doesn't apply to community. */}
      {isCommunity && application?.status === 'confirmed' && participation?.status !== 'winner' && participation?.status !== 'not_selected' && (
        <div>
          <div className="w-full min-h-[44px] py-3 rounded-[10px] bg-[rgba(59,130,246,0.08)] text-center text-[#3B82F6] font-medium text-[14px]">
            <Check size={15} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
            {participation?.reel_url ? 'Reel submitted — winners announced after the deadline' : "You're entered — submit your Reel below"}
          </div>
          {!participation?.reel_url && campaign.content_deadline && (
            <p className="text-[13px] text-[var(--ink-60)] text-center mt-2">
              Reel due by <span className="font-semibold">{fmtDeadline(campaign.content_deadline)}</span>
            </p>
          )}
        </div>
      )}
      {isCommunity && participation?.status === 'winner' && (
        <div className="w-full min-h-[44px] py-3 rounded-[10px] text-center text-[14px]" style={{ background: 'rgba(196,103,74,0.12)', color: 'var(--terra)', fontWeight: 700 }}>
          <Trophy size={15} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
          You won! We'll be in touch with your prize.
        </div>
      )}
      {isCommunity && participation?.status === 'not_selected' && (
        <div className="w-full min-h-[44px] py-3 rounded-[10px] bg-[rgba(42,32,24,0.04)] text-center text-[var(--ink-60)] font-medium text-[14px]">
          The winners are picked — thanks for entering!
        </div>
      )}
      {!isCommunity && application?.status === 'selected' && (() => {
        const hoursLeft = hoursUntilConfirmDeadline(application.selected_at);
        const isExpired = hoursLeft !== null && hoursLeft <= 0;
        const isUrgent = hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 12;
        const countdownLabel =
          hoursLeft === null ? null
          : isExpired ? 'Your 48-hour window has passed — please confirm as soon as you can'
          : hoursLeft < 1 ? `Less than an hour left to confirm your spot`
          : hoursLeft < 2 ? `About 1 hour left to confirm your spot`
          : `${Math.floor(hoursLeft)} hours left to confirm your spot`;
        return (
          <div>
            {countdownLabel && (
              <p className={`text-[13px] text-center mb-2 ${isExpired || isUrgent ? 'text-[var(--terra)] font-medium' : 'text-[var(--ink-60)]'}`}>
                {countdownLabel}
              </p>
            )}
            <button onClick={handleConfirm} disabled={submitting}
              className="w-full min-h-[44px] py-3 rounded-[10px] bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-85 transition-opacity disabled:opacity-50">
              {submitting ? 'Confirming...' : "You've been selected — confirm your spot"}
            </button>
            {applyError && (
              <p className="text-[13px] text-[var(--terra)] text-center mt-2">{applyError}</p>
            )}
          </div>
        );
      })()}
      {!isCommunity && application?.status === 'confirmed' && (
        <div>
          <div className="w-full min-h-[44px] py-3 rounded-[10px] bg-[rgba(122,148,120,0.10)] text-center text-[#0F6E56] font-medium text-[14px]">
            <Check size={15} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
            You're confirmed
          </div>
        </div>
      )}
      {application?.status === 'declined' && (
        <div className="w-full min-h-[44px] py-3 rounded-[6px] bg-[rgba(42,32,24,0.04)] text-center text-[var(--ink-50)] font-medium text-[14px]">
          Not selected for this campaign
        </div>
      )}
    </>
  );

  // The brand-instructions callout is rendered inline in the scrollable
  // content (below) rather than inside the mobile fixed bottom bar — when
  // instructions are long, stuffing them into the fixed bar blocked creators
  // from scrolling to see the rest of the page.
  const currentCallout = !application && !showPitchModal
    ? PreApplyCallout
    : application?.status === 'selected'
      ? PreConfirmCallout
      : application?.status === 'confirmed'
        ? PostConfirmCallout
        : null;

  const catPalette = display.palette;
  const deliverablesList = [campaign.deliverables?.reel && 'Reel', campaign.deliverables?.story && 'Story'].filter(Boolean);

  return (
    <div className="bg-white">
      <div className="max-w-[720px] mx-auto">
        {/* Hero image */}
        <div className="w-full relative" style={{ height: 280, marginBottom: 44 }}>
          {campaign.campaign_image ? (
            <img src={campaign.campaign_image} alt={campaign.title} className="w-full h-full object-cover" />
          ) : (
            <CampaignFallbackImage category={campaign.businesses?.category} isCommunity={isCommunity} />
          )}
          {onBack && (
            <button onClick={onBack} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-[var(--ink-60)] hover:bg-white transition-colors z-10">
              <X size={18} />
            </button>
          )}
          {/* Logo overlapping bottom edge */}
          <div className="absolute -bottom-9 left-6">
            {isCommunity ? (
              <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center border-[3px] border-white bg-white" style={{ boxShadow: '0 2px 8px rgba(42,32,24,0.10)' }}>
                <img src={NaybaLogo} alt="Nayba" className="w-8 h-8" />
              </div>
            ) : display.logoUrl ? (
              <img src={display.logoUrl} alt="" className="w-[72px] h-[72px] rounded-full object-cover border-[3px] border-white" style={{ boxShadow: '0 2px 8px rgba(42,32,24,0.10)' }} />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center border-[3px] border-white" style={{ background: catPalette.tint, boxShadow: '0 2px 8px rgba(42,32,24,0.10)' }}>
                <CategoryIcon category={campaign.businesses?.category} className="w-7 h-7" style={{ color: catPalette.color, opacity: 0.6 }} />
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-24 md:pb-8">
          {/* Brand info — for community campaigns this becomes a "Run by
              Nayba" pill since there's no brand to link to. */}
          <div className="mb-5">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[16px] font-semibold text-[var(--ink)]">
                {display.name}
              </p>
              {/* Verified-by-Nayba signal — additive only (no unverified
                  state is ever shown to creators). Hidden for community
                  campaigns because there's no business to verify. */}
              {!isCommunity && campaign.businesses?.approved && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[11px] font-semibold"
                  style={{ background: 'var(--terra-light)', color: 'var(--terra)' }}
                  title="This brand has been verified by the Nayba team"
                >
                  <img src={NaybaLogo} alt="" className="w-3 h-3" />
                  Verified by Nayba
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {display.category && (
                <span className="text-[14px] md:text-[12px] rounded-[999px] px-2 py-0.5" style={{ fontWeight: 600, background: catPalette.tint, color: catPalette.color }}>{display.category}</span>
              )}
              {brandHandle && (
                <a href={`https://instagram.com/${brandHandle}`} target="_blank" rel="noopener noreferrer"
                  className="text-[14px] md:text-[12px] text-[var(--ink-50)] hover:text-[var(--terra)] flex items-center gap-0.5">
                  <AtSign size={10} />{brandHandle}
                </a>
              )}
              {isCommunity && (
                <span className="text-[12px] text-[var(--ink-50)]">Run by Nayba — prize draw</span>
              )}
            </div>
            {display.address && (
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin size={12} className="text-[var(--ink-50)]" />
                <span className="text-[14px] text-[var(--ink-60)]">{display.address}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-[22px] text-[var(--ink)] mb-2" style={{ fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.3px' }}>
            {campaign.headline || campaign.title}
          </h1>

          {/* Dates — inline under title */}
          <div className="flex items-center gap-1.5 text-[14px] text-[var(--ink-60)] mb-3">
            {campaign.expression_deadline && <span>Apply by <span className="font-semibold">{fmtDeadline(campaign.expression_deadline)}</span></span>}
            {campaign.expression_deadline && campaign.content_deadline && <span className="text-[var(--ink-15)]">·</span>}
            {campaign.content_deadline && <span>Content due <span className="font-semibold">{fmtDeadline(campaign.content_deadline)}</span></span>}
          </div>

          {/* Perk — part of header area. £value is shown on the feed card
              and again next to "Apply by" in the meta row, so no need to
              repeat it here as a subtitle. */}
          {campaign.perk_description && (
            <div className="px-4 py-3 rounded-[10px] bg-[var(--terra-light)]">
              <p className="text-[14px] font-semibold text-[var(--terra)]">{campaign.perk_description?.split('—')[0]?.trim()}</p>
            </div>
          )}

          {/* ── About ── */}
          <div className="border-t border-[rgba(42,32,24,0.06)] mt-6 pt-5">
            {campaign.about_brand && (
              <div>
                <p className="text-[14px] font-medium text-[var(--ink-60)] mb-2">About</p>
                <p className="text-[15px] text-[var(--ink)] leading-[1.7]">{campaign.about_brand}</p>
              </div>
            )}
          </div>

          {/* ── What to post ── */}
          {campaign.content_requirements && (
            <div className="border-t border-[rgba(42,32,24,0.06)] mt-5 pt-5">
              <div className="p-4 rounded-[10px]" style={{ background: 'rgba(42,32,24,0.025)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: catPalette.tint }}>
                    <Film size={14} style={{ color: catPalette.color }} />
                  </div>
                  <p className="text-[14px] font-semibold text-[var(--ink)]">
                    What to post{deliverablesList.length > 0 ? ` · ${deliverablesList.join(' + ')}` : ''}
                  </p>
                </div>
                <p className="text-[14px] text-[var(--ink)] leading-[1.65]">{campaign.content_requirements}</p>
                {campaign.required_tags && campaign.required_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {campaign.required_tags.map((tag, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-[6px] bg-white text-[14px] text-[var(--ink-60)]" style={{ fontWeight: 500 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Key messages ── */}
          {campaign.talking_points && campaign.talking_points.length > 0 && (
            <div className="border-t border-[rgba(42,32,24,0.06)] mt-5 pt-5">
              <p className="text-[14px] font-medium text-[var(--ink-60)] mb-3">Key messages</p>
              <ol className="space-y-2.5">
                {campaign.talking_points.map((tp, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-[var(--ink)] leading-[1.5]">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[14px] md:text-[12px]" style={{ fontWeight: 700, background: catPalette.tint, color: catPalette.color }}>{i + 1}</span>
                    {tp}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ── Inspiration ── */}
          {campaign.inspiration && campaign.inspiration.length > 0 && (
            <div className="border-t border-[rgba(42,32,24,0.06)] mt-5 pt-5">
              <p className="text-[14px] font-medium text-[var(--ink-60)] mb-3">Inspiration</p>
              <div className="space-y-3">
                {campaign.inspiration.map((item: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: catPalette.tint }}>
                      <Film size={15} style={{ color: catPalette.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--ink)] mb-0.5">{item.title}</p>
                      <p className="text-[14px] text-[var(--ink-60)] leading-[1.55]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brand-instructions callout — rendered inline in the main
              scroll content so the mobile fixed bottom bar stays compact
              even when instructions are long. */}
          {!hideActions && currentCallout && (
            <div className="mt-6">
              {currentCallout}
            </div>
          )}

          {/* CTA — inline on desktop */}
          {!hideActions && (
            <div className="hidden md:block mt-6 pt-6 border-t border-[rgba(42,32,24,0.06)]">
              {ctaContent}
            </div>
          )}

          {/* Pitch form — inline on mobile so the creator can scroll
              through it with the keyboard open. The fixed bottom bar
              can't hold 3 textareas + buttons without overflowing on
              iPhone, so we render the form here instead. */}
          {!hideActions && showPitchModal && (
            <div className="md:hidden mt-6 pt-6 border-t border-[rgba(42,32,24,0.06)] pb-24">
              {ctaContent}
            </div>
          )}
        </div>
      </div>

      {/* CTA — fixed bottom bar on mobile. Hidden when pitch form is
          open (it renders inline above instead). */}
      {!hideActions && !showPitchModal && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white px-4 py-3 z-40 border-t border-[rgba(42,32,24,0.06)]" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          {ctaContent}
        </div>
      )}
    </div>
  );
}
