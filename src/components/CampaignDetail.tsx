import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sendCreatorConfirmedEmail, sendBusinessCreatorConfirmedEmail, sendAdminInterestExpressedEmail, sendAdminCreatorConfirmedEmail } from '../lib/notifications';
import { ArrowLeft, Check, X, AtSign, ExternalLink, Gift, Clock, Film, MapPin, AlertCircle, Sparkles } from 'lucide-react';
import { getCategoryPalette, CategoryIcon } from '../lib/categories';

function CampaignFallbackImage({ category, name }: { category?: string | null; name?: string | null }) {
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
  id: string; brand_id: string; title: string; headline: string | null;
  about_brand: string | null; perk_description: string | null; perk_value: number | null;
  perk_type: string | null; target_city: string | null; content_requirements: string | null;
  brand_instructions: string | null;
  talking_points: string[] | null; inspiration: any[] | null; deliverables: any;
  required_tags: string[] | null;
  open_date: string | null; expression_deadline: string | null; content_deadline: string | null;
  status: string; campaign_image: string | null;
  businesses?: { name: string; category?: string; bio?: string | null; instagram_handle?: string | null; logo_url?: string | null; address?: string | null };
}

interface Application {
  id: string; status: string;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function CampaignDetail({ campaignId, onBack, hideActions }: CampaignDetailProps) {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [creatorInstagram, setCreatorInstagram] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [pitch, setPitch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showBrandInfo, setShowBrandInfo] = useState(false);
  const [applyError, setApplyError] = useState<string>('');

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  const fetchCampaign = async () => {
    setLoading(true);
    const { data: campData, error: campErr } = await supabase
      .from('campaigns')
      .select('*, businesses(name, category, bio, instagram_handle, logo_url, address)')
      .eq('id', campaignId)
      .maybeSingle();
    if (campErr || !campData) { setNotFound(true); setLoading(false); return; }
    setCampaign(campData as Campaign);

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
          .select('id, status')
          .eq('campaign_id', campaignId)
          .eq('creator_id', creatorData.id)
          .maybeSingle();
        if (appData) setApplication(appData as Application);
      }
    }
    setLoading(false);
  };

  const handleApply = async (withPitch?: string) => {
    if (!creatorId || !campaign || submitting) return;
    setApplyError('');
    setSubmitting(true);
    const { data, error } = await supabase.from('applications').insert({
      campaign_id: campaign.id,
      creator_id: creatorId,
      pitch: withPitch || null,
      status: 'interested',
    }).select('id, status').single();
    if (error) {
      console.error('[CampaignDetail] Failed to apply:', error);
      const msg = error.message.toLowerCase();
      setApplyError(
        msg.includes('duplicate')
          ? "You've already registered interest for this campaign."
          : msg.includes('row-level security') || msg.includes('policy')
          ? "Permission denied — please make sure your account is approved."
          : "Couldn't register your interest — please try again."
      );
      setSubmitting(false);
      return;
    }
    // Optimistically update application state so CTA changes immediately
    if (data) setApplication(data as Application);
    // Notify admin
    sendAdminInterestExpressedEmail({
      creator_name: creatorName,
      campaign_title: campaign.title,
      brand_name: campaign.businesses?.name || '',
    }).catch(() => {});
    setShowPitchModal(false);
    setPitch('');
    setSubmitting(false);
  };

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
    if (campaign.businesses?.name) {
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

  const brandInstructions = campaign?.brand_instructions?.trim() || '';
  const brandHandle = (campaign?.businesses?.instagram_handle || '').replace('@', '');

  // Brand requirements callout shown before applying.
  const PreApplyCallout = brandInstructions ? (
    <div className="mb-3 rounded-[12px] border border-[rgba(217,95,59,0.20)] bg-[rgba(249,232,225,0.50)] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <AlertCircle size={16} className="text-[var(--terra)] mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--terra)] mb-1">Brand requirements</p>
          <p className="text-[14px] text-[var(--ink)] leading-[1.5]">{brandInstructions}</p>
        </div>
      </div>
    </div>
  ) : null;

  // Acceptance callout shown before confirming.
  const PreConfirmCallout = brandInstructions ? (
    <div className="mb-3 rounded-[12px] border border-[rgba(42,32,24,0.10)] bg-[var(--stone)] px-4 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--ink-60)] mb-1.5">By confirming, you agree to:</p>
      <p className="text-[14px] text-[var(--ink)] leading-[1.5]">{brandInstructions}</p>
    </div>
  ) : null;

  // Next-step callout shown after confirming.
  const PostConfirmCallout = brandInstructions ? (
    <div className="mt-3 rounded-[12px] border border-[rgba(217,95,59,0.20)] bg-[rgba(249,232,225,0.50)] px-4 py-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={13} className="text-[var(--terra)]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--terra)]">Next step</p>
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

  const ctaContent = (
    <>
      {!application && !showPitchModal && (
        <div>
          {PreApplyCallout}
          <button onClick={() => setShowPitchModal(true)}
            className="w-full min-h-[44px] py-3 rounded-[10px] bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-85 transition-opacity">
            I'm Interested
          </button>
          <p className="text-[14px] text-[var(--ink-60)] text-center mt-2">This won't commit you — the brand will review and select</p>
        </div>
      )}
      {!application && showPitchModal && (
        <div className="bg-[var(--stone)] rounded-[12px] p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[15px] font-semibold text-[var(--ink)]">Tell them why you</p>
              <p className="text-[13px] text-[var(--ink-60)] mt-0.5">Optional — a short pitch helps you stand out</p>
            </div>
            <button onClick={() => { setShowPitchModal(false); setPitch(''); setApplyError(''); }}
              className="text-[var(--ink-50)] hover:text-[var(--ink)] flex-shrink-0 ml-2"><X size={18} /></button>
          </div>
          <textarea
            value={pitch}
            onChange={e => setPitch(e.target.value)}
            placeholder="I'd love to be part of this because..."
            maxLength={500}
            className="w-full px-3 py-2.5 rounded-[10px] border border-[rgba(42,32,24,0.15)] bg-white text-[var(--ink)] text-[14px] h-20 resize-none focus:outline-none focus:border-[var(--terra)]"
          />
          <p className="text-[12px] text-[var(--ink-50)] text-right mt-1 mb-2">{pitch.length}/500</p>
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
              onClick={() => handleApply(pitch)}
              disabled={submitting}
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
      {application?.status === 'selected' && (
        <div>
          {PreConfirmCallout}
          <button onClick={handleConfirm} disabled={submitting}
            className="w-full min-h-[44px] py-3 rounded-[10px] bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-85 transition-opacity disabled:opacity-50">
            {submitting ? 'Confirming...' : "You've been selected — confirm your spot"}
          </button>
          {applyError && (
            <p className="text-[13px] text-[var(--terra)] text-center mt-2">{applyError}</p>
          )}
        </div>
      )}
      {application?.status === 'confirmed' && (
        <div>
          <div className="w-full min-h-[44px] py-3 rounded-[10px] bg-[rgba(122,148,120,0.10)] text-center text-[#0F6E56] font-medium text-[14px]">
            <Check size={15} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
            You're confirmed
          </div>
          {PostConfirmCallout}
        </div>
      )}
      {application?.status === 'declined' && (
        <div className="w-full min-h-[44px] py-3 rounded-[6px] bg-[rgba(42,32,24,0.04)] text-center text-[var(--ink-50)] font-medium text-[14px]">
          Not selected for this campaign
        </div>
      )}
    </>
  );

  const catPalette = getCategoryPalette(campaign.businesses?.category);
  const deliverablesList = [campaign.deliverables?.reel && 'Reel', campaign.deliverables?.story && 'Story'].filter(Boolean);

  return (
    <div className="bg-white">
      <div className="max-w-[720px] mx-auto">
        {/* Hero image */}
        <div className="w-full relative" style={{ height: 280, marginBottom: 44 }}>
          {campaign.campaign_image ? (
            <img src={campaign.campaign_image} alt={campaign.title} className="w-full h-full object-cover" />
          ) : (
            <CampaignFallbackImage category={campaign.businesses?.category} />
          )}
          {onBack && (
            <button onClick={onBack} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-[var(--ink-60)] hover:bg-white transition-colors z-10">
              <X size={18} />
            </button>
          )}
          {/* Logo overlapping bottom edge */}
          <div className="absolute -bottom-9 left-6">
            {campaign.businesses?.logo_url ? (
              <img src={campaign.businesses.logo_url} alt="" className="w-[72px] h-[72px] rounded-full object-cover border-[3px] border-white" style={{ boxShadow: '0 2px 8px rgba(42,32,24,0.10)' }} />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center border-[3px] border-white" style={{ background: catPalette.tint, boxShadow: '0 2px 8px rgba(42,32,24,0.10)' }}>
                <CategoryIcon category={campaign.businesses?.category} className="w-7 h-7" style={{ color: catPalette.color, opacity: 0.6 }} />
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-24 md:pb-8">
          {/* Brand info */}
          <div className="mb-5">
            <button onClick={() => setShowBrandInfo(true)} className="text-[16px] font-semibold text-[var(--ink)] hover:text-[var(--terra)] transition-colors">
              {campaign.businesses?.name}
            </button>
            <div className="flex items-center gap-2 mt-1.5">
              {campaign.businesses?.category && (
                <span className="text-[14px] md:text-[12px] rounded-[999px] px-2 py-0.5" style={{ fontWeight: 600, background: catPalette.tint, color: catPalette.color }}>{campaign.businesses.category}</span>
              )}
              {campaign.businesses?.instagram_handle && (
                <a href={`https://instagram.com/${campaign.businesses.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  className="text-[14px] md:text-[12px] text-[var(--ink-50)] hover:text-[var(--terra)] flex items-center gap-0.5">
                  <AtSign size={10} />{campaign.businesses.instagram_handle.replace('@', '')}
                </a>
              )}
            </div>
            {campaign.businesses?.address && (
              <div className="flex items-center gap-1.5 mt-2">
                <MapPin size={12} className="text-[var(--ink-50)]" />
                <span className="text-[14px] text-[var(--ink-60)]">{campaign.businesses.address}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-[22px] text-[var(--ink)] mb-2" style={{ fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.3px' }}>
            {campaign.headline || campaign.title}
          </h1>

          {/* Dates — inline under title */}
          <div className="flex items-center gap-1.5 text-[14px] text-[var(--ink-60)] mb-3">
            {campaign.expression_deadline && <span>Apply by <span className="font-semibold">{fmtDate(campaign.expression_deadline)}</span></span>}
            {campaign.expression_deadline && campaign.content_deadline && <span className="text-[var(--ink-15)]">·</span>}
            {campaign.content_deadline && <span>Content due <span className="font-semibold">{fmtDate(campaign.content_deadline)}</span></span>}
          </div>

          {/* Perk — part of header area */}
          {campaign.perk_description && (
            <div className="px-4 py-3 rounded-[10px] bg-[var(--terra-light)]">
              <p className="text-[14px] font-semibold text-[var(--terra)]">{campaign.perk_description?.split('—')[0]?.trim()}</p>
              {campaign.perk_value && <p className="text-[14px] md:text-[12px] text-[var(--terra)] mt-0.5" style={{}}>Worth £{campaign.perk_value}</p>}
            </div>
          )}

          {/* ── About ── */}
          <div className="border-t border-[rgba(42,32,24,0.06)] mt-6 pt-5">
            {campaign.about_brand && (
              <div>
                <p className="text-[14px] font-medium text-[var(--ink-60)] mb-2">About {campaign.businesses?.name}</p>
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

          {/* CTA — inline on desktop */}
          {!hideActions && (
            <div className="hidden md:block mt-6 pt-6 border-t border-[rgba(42,32,24,0.06)]">
              {ctaContent}
            </div>
          )}
        </div>
      </div>

      {/* CTA — fixed bottom bar on mobile */}
      {!hideActions && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white px-4 py-3 z-40 border-t border-[rgba(42,32,24,0.06)]" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          {ctaContent}
        </div>
      )}

      {/* Brand info modal */}
      {showBrandInfo && campaign.businesses && (
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-50 flex items-center justify-center px-4 animate-overlay" onClick={() => setShowBrandInfo(false)}>
          <div className="bg-white rounded-[12px] max-w-[400px] w-full p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-[var(--ink)]">{campaign.businesses.name}</h3>
              <button onClick={() => setShowBrandInfo(false)} className="text-[var(--ink-50)] hover:text-[var(--ink)]"><X size={20} /></button>
            </div>
            {campaign.businesses.category && (
              <p className="text-[14px] text-[var(--ink-50)] mb-3">{campaign.businesses.category}</p>
            )}
            {(campaign.about_brand || campaign.businesses.bio) && (
              <p className="text-[15px] text-[var(--ink)] leading-[1.65] mb-4">{campaign.about_brand || campaign.businesses.bio}</p>
            )}
            {!campaign.about_brand && !campaign.businesses.bio && (
              <p className="text-[14px] text-[var(--ink-50)] mb-4">No description available yet.</p>
            )}
            {campaign.businesses.instagram_handle && (
              <a href={`https://instagram.com/${campaign.businesses.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[14px] text-[var(--terra)] font-medium hover:underline">
                <AtSign size={14} /> @{campaign.businesses.instagram_handle.replace('@', '')} <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Pitch modal */}
    </div>
  );
}
