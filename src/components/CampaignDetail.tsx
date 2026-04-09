import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sendCreatorConfirmedEmail } from '../lib/notifications';
import { ArrowLeft, Check, X, AtSign, ExternalLink, Gift, Clock, Film, MapPin } from 'lucide-react';
import { getCategoryPalette, CategoryIcon } from '../lib/categories';

function CampaignFallbackImage({ category, name }: { category?: string | null; name?: string | null }) {
  const cp = getCategoryPalette(category);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: cp.tint }}>
      <CategoryIcon category={category} className="w-14 h-14 mb-2" style={{ color: cp.color, opacity: 0.5 }} />
      {name && <span className="text-[14px] font-medium" style={{ color: cp.color, opacity: 0.6 }}>{name}</span>}
    </div>
  );
}

interface CampaignDetailProps {
  campaignId: string;
  onBack?: () => void;
}

interface Campaign {
  id: string; brand_id: string; title: string; headline: string | null;
  about_brand: string | null; perk_description: string | null; perk_value: number | null;
  perk_type: string | null; target_city: string | null; content_requirements: string | null;
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

export default function CampaignDetail({ campaignId, onBack }: CampaignDetailProps) {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [pitch, setPitch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showBrandInfo, setShowBrandInfo] = useState(false);

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  const fetchCampaign = async () => {
    setLoading(true);
    const { data: campData, error: campErr } = await supabase
      .from('campaigns')
      .select('*, businesses(name, category, bio, instagram_handle, logo_url, address)')
      .eq('id', campaignId)
      .single();
    if (campErr || !campData) { setNotFound(true); setLoading(false); return; }
    setCampaign(campData as Campaign);

    // Look up real creator ID by email (creators.id != auth.uid())
    if (user?.email) {
      const { data: creatorData } = await supabase
        .from('creators')
        .select('id')
        .eq('email', user.email)
        .single();
      if (creatorData) {
        setCreatorId(creatorData.id);
        // Check if creator already applied
        const { data: appData } = await supabase
          .from('applications')
          .select('id, status')
          .eq('campaign_id', campaignId)
          .eq('creator_id', creatorData.id)
        .single();
        if (appData) setApplication(appData as Application);
      }
    }
    setLoading(false);
  };

  const handleApply = async (withPitch?: string) => {
    if (!creatorId || !campaign) return;
    setSubmitting(true);
    await supabase.from('applications').insert({
      campaign_id: campaign.id,
      creator_id: creatorId,
      pitch: withPitch || null,
      status: 'interested',
    });
    setShowPitchModal(false);
    setPitch('');
    setSubmitting(false);
    fetchCampaign();
  };

  const handleConfirm = async () => {
    if (!application || !creatorId || !campaign) return;
    setSubmitting(true);
    await supabase.from('applications').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    }).eq('id', application.id);
    // Create participation
    await supabase.from('participations').insert({
      application_id: application.id,
      campaign_id: campaign.id,
      creator_id: creatorId,
    });
    // Send confirmation email
    if (campaign.businesses?.name) {
      sendCreatorConfirmedEmail(creatorId, {
        campaign_title: campaign.title,
        brand_name: campaign.businesses.name,
        perk_description: campaign.perk_description || '',
      });
    }
    setSubmitting(false);
    fetchCampaign();
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
        <p className="text-[13px] text-[var(--ink-35)] mb-5 max-w-xs">This campaign may have ended or been removed.</p>
        {onBack && <button onClick={onBack} className="px-4 py-2 min-h-[44px] rounded-full bg-[var(--terra)] text-white font-semibold text-[13px] hover:opacity-85 transition-opacity">Go back</button>}
      </div>
    );
  }

  const sectionGap = 'mt-6';

  const ctaContent = (
    <>
      {!application && (
        <div>
          <button onClick={() => setShowPitchModal(true)}
            className="w-full min-h-[44px] py-3 rounded-full bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-85 transition-opacity">
            I'm Interested
          </button>
          <p className="text-[12px] text-[var(--ink-35)] text-center mt-2">This won't commit you — the brand will review and select</p>
        </div>
      )}
      {application?.status === 'interested' && (
        <div className="w-full min-h-[44px] py-3 rounded-[6px] bg-[rgba(42,32,24,0.04)] text-center text-[#0F6E56] font-medium text-[13px]">
          <Check size={15} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
          Interest registered — we'll be in touch
        </div>
      )}
      {application?.status === 'selected' && (
        <button onClick={handleConfirm} disabled={submitting}
          className="w-full min-h-[44px] py-3 rounded-full bg-[var(--terra)] text-white font-semibold text-[14px] hover:opacity-85 transition-opacity disabled:opacity-50">
          {submitting ? 'Confirming...' : "You've been selected — confirm your spot"}
        </button>
      )}
      {application?.status === 'confirmed' && (
        <div className="w-full min-h-[44px] py-3 rounded-[6px] bg-[rgba(42,32,24,0.04)] text-center text-[#0F6E56] font-medium text-[13px]">
          <Check size={15} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
          You're confirmed
        </div>
      )}
      {application?.status === 'declined' && (
        <div className="w-full min-h-[44px] py-3 rounded-[6px] bg-[rgba(42,32,24,0.04)] text-center text-[var(--ink-35)] font-medium text-[13px]">
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
        <div className="w-full relative" style={{ height: 280 }}>
          {campaign.campaign_image ? (
            <img src={campaign.campaign_image} alt={campaign.title} className="w-full h-full object-cover" />
          ) : (
            <CampaignFallbackImage category={campaign.businesses?.category} />
          )}
          {onBack && (
            <button onClick={onBack} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-[var(--ink-60)] hover:bg-white transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="px-6 pt-7 pb-24 md:pb-8">
          {/* Brand row */}
          <div className="flex items-center gap-3 mb-2">
            {campaign.businesses?.logo_url ? (
              <img src={campaign.businesses.logo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: catPalette.tint }}>
                <CategoryIcon category={campaign.businesses?.category} className="w-5 h-5" style={{ color: catPalette.color, opacity: 0.6 }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <button onClick={() => setShowBrandInfo(true)} className="text-[14px] font-semibold text-[var(--ink)] hover:text-[var(--terra)] transition-colors">
                {campaign.businesses?.name}
              </button>
              <div className="flex items-center gap-2">
                {campaign.businesses?.category && (
                  <span className="text-[11px] rounded-[999px] px-2 py-0.5" style={{ fontWeight: 600, background: catPalette.tint, color: catPalette.color }}>{campaign.businesses.category}</span>
                )}
                {campaign.businesses?.instagram_handle && (
                  <a href={`https://instagram.com/${campaign.businesses.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-[var(--ink-35)] hover:text-[var(--terra)] flex items-center gap-0.5">
                    <AtSign size={10} />{campaign.businesses.instagram_handle.replace('@', '')}
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* Address */}
          {campaign.businesses?.address && (
            <div className="flex items-center gap-1.5 mb-5 ml-[52px]">
              <MapPin size={12} className="text-[var(--ink-35)]" />
              <span className="text-[13px] text-[var(--ink-60)]">{campaign.businesses.address}</span>
            </div>
          )}
          {!campaign.businesses?.address && <div className="mb-5" />}

          {/* Title */}
          <h1 className="text-[22px] text-[var(--ink)] mb-2" style={{ fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.3px' }}>
            {campaign.headline || campaign.title}
          </h1>

          {/* Dates — inline under title */}
          <div className="flex items-center gap-1.5 text-[13px] text-[var(--ink-35)] mb-3">
            {campaign.expression_deadline && <span>Apply by <span className="font-medium text-[var(--ink)]">{fmtDate(campaign.expression_deadline)}</span></span>}
            {campaign.expression_deadline && campaign.content_deadline && <span className="text-[var(--ink-15)]">·</span>}
            {campaign.content_deadline && <span>Content due <span className="font-medium text-[var(--ink)]">{fmtDate(campaign.content_deadline)}</span></span>}
          </div>

          {/* Perk — part of header area */}
          {campaign.perk_description && (
            <div className="px-4 py-3 rounded-[10px] bg-[var(--terra-light)]">
              <p className="text-[14px] font-semibold text-[var(--terra)]">{campaign.perk_description?.split('—')[0]?.trim()}</p>
              {campaign.perk_value && <p className="text-[12px] text-[var(--terra)] mt-0.5" style={{ opacity: 0.7 }}>Worth £{campaign.perk_value}</p>}
            </div>
          )}

          {/* ── About ── */}
          <div className="border-t border-[rgba(42,32,24,0.06)] mt-6 pt-5">
            {campaign.about_brand && (
              <div className="flex gap-3">
                {campaign.businesses?.logo_url ? (
                  <img src={campaign.businesses.logo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: catPalette.tint }}>
                    <span className="text-[12px]" style={{ fontWeight: 700, color: catPalette.color }}>{(campaign.businesses?.name || '?')[0]}</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-[var(--ink-35)] mb-1">About {campaign.businesses?.name}</p>
                  <p className="text-[15px] text-[var(--ink)] leading-[1.7]">{campaign.about_brand}</p>
                </div>
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
                  <p className="text-[13px] font-semibold text-[var(--ink)]">
                    What to post{deliverablesList.length > 0 ? ` · ${deliverablesList.join(' + ')}` : ''}
                  </p>
                </div>
                <p className="text-[14px] text-[var(--ink)] leading-[1.65]">{campaign.content_requirements}</p>
                {campaign.required_tags && campaign.required_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {campaign.required_tags.map((tag, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-[6px] bg-white text-[13px] text-[var(--ink-60)]" style={{ fontWeight: 500 }}>
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
              <p className="text-[13px] font-medium text-[var(--ink-35)] mb-3">Key messages</p>
              <ol className="space-y-2.5">
                {campaign.talking_points.map((tp, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-[var(--ink)] leading-[1.5]">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px]" style={{ fontWeight: 700, background: catPalette.tint, color: catPalette.color }}>{i + 1}</span>
                    {tp}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ── Inspiration ── */}
          {campaign.inspiration && campaign.inspiration.length > 0 && (
            <div className="border-t border-[rgba(42,32,24,0.06)] mt-5 pt-5">
              <p className="text-[13px] font-medium text-[var(--ink-35)] mb-3">Inspiration</p>
              <div className="space-y-3">
                {campaign.inspiration.map((item: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: catPalette.tint }}>
                      <Film size={15} style={{ color: catPalette.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--ink)] mb-0.5">{item.title}</p>
                      <p className="text-[13px] text-[var(--ink-60)] leading-[1.55]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA — inline on desktop */}
          <div className="hidden md:block mt-6 pt-6 border-t border-[rgba(42,32,24,0.06)]">
            {ctaContent}
          </div>
        </div>
      </div>

      {/* CTA — fixed bottom bar on mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white px-4 py-3 z-40 border-t border-[rgba(42,32,24,0.06)]" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        {ctaContent}
      </div>

      {/* Brand info modal */}
      {showBrandInfo && campaign.businesses && (
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-50 flex items-center justify-center px-4" onClick={() => setShowBrandInfo(false)}>
          <div className="bg-white rounded-[12px] max-w-[400px] w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-[var(--ink)]">{campaign.businesses.name}</h3>
              <button onClick={() => setShowBrandInfo(false)} className="text-[var(--ink-35)] hover:text-[var(--ink)]"><X size={20} /></button>
            </div>
            {campaign.businesses.category && (
              <p className="text-[13px] text-[var(--ink-35)] mb-3">{campaign.businesses.category}</p>
            )}
            {(campaign.about_brand || campaign.businesses.bio) && (
              <p className="text-[15px] text-[var(--ink)] leading-[1.65] mb-4">{campaign.about_brand || campaign.businesses.bio}</p>
            )}
            {!campaign.about_brand && !campaign.businesses.bio && (
              <p className="text-[14px] text-[var(--ink-35)] mb-4">No description available yet.</p>
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
      {showPitchModal && (
        <div className="fixed inset-0 bg-[rgba(42,32,24,0.40)] z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-[480px] rounded-t-[10px] sm:rounded-[12px] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-[var(--ink)]">Tell them why you</h3>
              <button onClick={() => setShowPitchModal(false)} className="text-[var(--ink-35)] hover:text-[var(--ink)]"><X size={20} /></button>
            </div>
            <p className="text-[14px] text-[var(--ink-60)] mb-4">Write a short pitch to stand out — totally optional but helps your chances</p>
            <textarea
              value={pitch}
              onChange={e => setPitch(e.target.value)}
              placeholder="I'd love to be part of this because..."
              className="w-full px-4 py-3 rounded-[12px] border border-[rgba(42,32,24,0.15)] bg-white text-[var(--ink)] text-[14px] h-24 resize-none focus:outline-none focus:border-[var(--terra)] mb-1"
            />
            <p className="text-[12px] text-[var(--ink-35)] text-right mb-3">{pitch.length}/500</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleApply()}
                className="flex-1 min-h-[44px] py-2.5 rounded-[6px] border border-[rgba(42,32,24,0.15)] text-[var(--ink)] font-medium text-[13px] hover:bg-[rgba(42,32,24,0.04)]"
              >
                Skip
              </button>
              <button
                onClick={() => handleApply(pitch)}
                disabled={submitting}
                className="flex-1 min-h-[44px] py-2.5 rounded-full bg-[var(--terra)] text-white font-semibold text-[13px] hover:opacity-85 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
