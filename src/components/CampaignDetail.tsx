import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { sendCreatorConfirmedEmail } from '../lib/notifications';
import { ArrowLeft, Check, X, AtSign, ExternalLink } from 'lucide-react';

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
  businesses?: { name: string; category?: string; bio?: string | null; instagram_handle?: string | null; logo_url?: string | null };
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
      .select('*, businesses(name, category, bio, instagram_handle, logo_url)')
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
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
        <div className="w-10 h-10 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F6F3] px-6 text-center">
        <p className="text-[15px] font-medium text-[#1C1917] mb-2">Campaign not available</p>
        <p className="text-[13px] text-[rgba(0,0,0,0.4)] mb-5 max-w-xs">This campaign may have ended or been removed.</p>
        {onBack && <button onClick={onBack} className="px-4 py-2 min-h-[44px] rounded-[6px] bg-[#C4674A] text-white font-semibold text-[13px] hover:opacity-85 transition-opacity">Go back</button>}
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3] px-4">
        <div className="text-center">
          <p className="text-[18px] font-semibold text-[#1C1917] mb-2">Campaign not found</p>
          <p className="text-[14px] text-[rgba(0,0,0,0.5)]">This campaign may have been removed or the link is invalid.</p>
          {onBack && <button onClick={onBack} className="mt-4 text-[#C4674A] font-semibold text-[14px]">Go back</button>}
        </div>
      </div>
    );
  }

  const sectionCls = 'bg-white border-[0.5px] border-[rgba(0,0,0,0.08)] rounded-[10px] p-5 mb-3';

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-[720px] mx-auto px-4 pb-28 pt-4">
        {/* Back button */}
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1 text-[14px] text-[rgba(0,0,0,0.4)] hover:text-[#C4674A] mb-3">
            <ArrowLeft size={16} /> Back
          </button>
        )}

        {/* Hero image */}
        <div className="relative w-full aspect-video rounded-[10px] overflow-hidden mb-3">
          {campaign.campaign_image ? (
            <img src={campaign.campaign_image} alt={campaign.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[var(--terra)] to-[#A8573E] flex items-center justify-center">
              {campaign.businesses?.logo_url ? (
                <img src={campaign.businesses.logo_url} alt={campaign.businesses.name} className="w-20 h-20 rounded-full object-cover border-3 border-white/30" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-[32px] font-semibold text-white">{(campaign.businesses?.name || '?')[0]}</span>
                </div>
              )}
            </div>
          )}
          <div className="hero-gradient absolute inset-0" />
        </div>

        {/* 1. Header */}
        <div className={sectionCls}>
          <button onClick={() => setShowBrandInfo(true)}
            className="text-[13px] font-medium text-[rgba(0,0,0,0.45)] mb-1 hover:text-[#C4674A] hover:underline transition-colors">
            {campaign.businesses?.name}
          </button>
          <h1 className="text-[18px] font-semibold text-[#1C1917] mb-3" style={{ lineHeight: 1.3 }}>
            {campaign.headline || campaign.title}
          </h1>
          {/* Perk */}
          {campaign.perk_description && (
            <p className="text-[14px] font-medium text-[#C4674A] mb-3">
              {campaign.perk_description?.split('—')[0]?.trim() || 'Perk included'}
              {campaign.perk_value ? ` — worth £${campaign.perk_value}` : ''}
            </p>
          )}
          {/* Dates row */}
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-4 text-[13px] text-[rgba(0,0,0,0.4)]">
            {campaign.expression_deadline && <span>Apply by {fmtDate(campaign.expression_deadline)}</span>}
            {campaign.content_deadline && <span>Content due {fmtDate(campaign.content_deadline)}</span>}
          </div>
        </div>

        {/* 2. About the brand */}
        {campaign.about_brand && (
          <div className={sectionCls}>
            <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-2">About the brand</p>
            <p className="text-[15px] text-[#1C1917] leading-[1.65]">{campaign.about_brand}</p>
          </div>
        )}

        {/* 3. The perk */}
        {campaign.perk_description && (
          <div className={sectionCls}>
            <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-2">The perk</p>
            <p className="text-[15px] text-[#1C1917] leading-[1.65]">{campaign.perk_description}</p>
            <div className="flex items-center gap-4 mt-3 text-[13px] text-[rgba(0,0,0,0.45)]">
              {campaign.perk_value && <span>Worth £{campaign.perk_value}</span>}
              {campaign.perk_type && <span className="capitalize">{campaign.perk_type.replace('_', ' ')}</span>}
            </div>
          </div>
        )}

        {/* 4. What to post */}
        <div className={sectionCls}>
          <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-2">What to post</p>
          {/* Deliverables */}
          <p className="text-[14px] text-[rgba(0,0,0,0.5)] mb-3">
            {[campaign.deliverables?.reel && 'Reel', campaign.deliverables?.story && 'Story'].filter(Boolean).join(' + ') || 'Reel'}
          </p>
          {campaign.content_requirements && (
            <p className="text-[15px] text-[#1C1917] leading-[1.65]">{campaign.content_requirements}</p>
          )}
          {campaign.required_tags && campaign.required_tags.length > 0 && (
            <div className="mt-3 pt-3 border-t-[0.5px] border-[rgba(0,0,0,0.08)]">
              <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-2">Required tags</p>
              <div className="flex flex-wrap gap-2">
                {campaign.required_tags.map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-[6px] bg-[rgba(196,103,74,0.08)] text-[13px] font-medium text-[#C4674A]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5. Talking points */}
        {campaign.talking_points && campaign.talking_points.length > 0 && (
          <div className={sectionCls}>
            <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-2">Talking points</p>
            <ol className="space-y-1.5 list-decimal list-inside">
              {campaign.talking_points.map((tp, i) => (
                <li key={i} className="text-[15px] text-[#1C1917] leading-[1.65]">{tp}</li>
              ))}
            </ol>
          </div>
        )}

        {/* 6. Inspiration */}
        {campaign.inspiration && campaign.inspiration.length > 0 && (
          <div className={sectionCls}>
            <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-2">Inspiration</p>
            <div className="space-y-2">
              {campaign.inspiration.map((item: any, i: number) => (
                <div key={i}>
                  <p className="text-[14px] font-semibold text-[#1C1917]">{item.title}</p>
                  <p className="text-[14px] text-[rgba(0,0,0,0.45)] leading-[1.6]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Key dates */}
        <div className={sectionCls}>
          <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-[rgba(0,0,0,0.45)] mb-2">Key dates</p>
          <div className="space-y-1.5 text-[14px]">
            {campaign.open_date && <div className="flex justify-between"><span className="text-[rgba(0,0,0,0.45)]">Opens</span><span className="text-[#1C1917] font-medium">{fmtDate(campaign.open_date)}</span></div>}
            {campaign.expression_deadline && <div className="flex justify-between"><span className="text-[rgba(0,0,0,0.45)]">Apply by</span><span className="text-[#1C1917] font-medium">{fmtDate(campaign.expression_deadline)}</span></div>}
            {campaign.content_deadline && <div className="flex justify-between"><span className="text-[rgba(0,0,0,0.45)]">Content due</span><span className="text-[#1C1917] font-medium">{fmtDate(campaign.content_deadline)}</span></div>}
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-[0.5px] border-[rgba(0,0,0,0.08)] px-4 py-4 z-40" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="max-w-[720px] mx-auto">
          {!application && (
            <div>
              <button
                onClick={() => setShowPitchModal(true)}
                className="w-full min-h-[44px] py-3 rounded-[6px] bg-[#C4674A] text-white font-semibold text-[13px] hover:opacity-85 transition-opacity"
              >
                I'm Interested
              </button>
              <p className="text-[12px] text-[rgba(0,0,0,0.4)] text-center mt-1.5">This won't commit you — the brand will review and select</p>
            </div>
          )}
          {application?.status === 'interested' && (
            <div className="confetti-burst w-full min-h-[44px] py-3 rounded-[6px] bg-[#E1F5EE] text-center text-[#0F6E56] font-semibold text-[13px] border-[0.5px] border-[rgba(0,0,0,0.08)]">
              <Check size={16} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
              Interest registered — we'll be in touch
            </div>
          )}
          {application?.status === 'selected' && (
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full min-h-[44px] py-3 rounded-[6px] bg-[#C4674A] text-white font-semibold text-[13px] hover:opacity-85 transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Confirming...' : "You've been selected — confirm your spot"}
            </button>
          )}
          {application?.status === 'confirmed' && (
            <div className="w-full min-h-[44px] py-3 rounded-[6px] bg-[#E1F5EE] text-center text-[#0F6E56] font-semibold text-[13px] border-[0.5px] border-[rgba(0,0,0,0.08)]">
              <Check size={16} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
              You're in — view your campaign
            </div>
          )}
          {application?.status === 'declined' && (
            <div className="w-full min-h-[44px] py-3 rounded-[6px] bg-[#F7F6F3] text-center text-[rgba(0,0,0,0.4)] font-medium text-[13px] border-[0.5px] border-[rgba(0,0,0,0.08)]">
              Not selected for this campaign
            </div>
          )}
        </div>
      </div>

      {/* Brand info modal */}
      {showBrandInfo && campaign.businesses && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] z-50 flex items-center justify-center px-4" onClick={() => setShowBrandInfo(false)}>
          <div className="bg-white rounded-[10px] max-w-[400px] w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-[#1C1917]">{campaign.businesses.name}</h3>
              <button onClick={() => setShowBrandInfo(false)} className="text-[rgba(0,0,0,0.4)] hover:text-[#1C1917]"><X size={20} /></button>
            </div>
            {campaign.businesses.category && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-[8px] text-[12px] font-semibold bg-[rgba(196,103,74,0.08)] text-[#C4674A] mb-3">
                {campaign.businesses.category}
              </span>
            )}
            {(campaign.about_brand || campaign.businesses.bio) && (
              <p className="text-[15px] text-[#1C1917] leading-[1.65] mb-4">{campaign.about_brand || campaign.businesses.bio}</p>
            )}
            {!campaign.about_brand && !campaign.businesses.bio && (
              <p className="text-[14px] text-[rgba(0,0,0,0.4)] mb-4">No description available yet.</p>
            )}
            {campaign.businesses.instagram_handle && (
              <a href={`https://instagram.com/${campaign.businesses.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[14px] text-[#C4674A] font-medium hover:underline">
                <AtSign size={14} /> @{campaign.businesses.instagram_handle.replace('@', '')} <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Pitch modal */}
      {showPitchModal && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-[480px] rounded-t-[10px] sm:rounded-[10px] p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-[#1C1917]">Tell them why you</h3>
              <button onClick={() => setShowPitchModal(false)} className="text-[rgba(0,0,0,0.4)] hover:text-[#1C1917]"><X size={20} /></button>
            </div>
            <p className="text-[14px] text-[rgba(0,0,0,0.5)] mb-4">Write a short pitch to stand out — totally optional but helps your chances</p>
            <textarea
              value={pitch}
              onChange={e => setPitch(e.target.value)}
              placeholder="I'd love to be part of this because..."
              className="w-full px-4 py-3 rounded-[8px] border-[0.5px] border-[rgba(0,0,0,0.18)] bg-white text-[#1C1917] text-[14px] h-24 resize-none focus:outline-none focus:border-[#C4674A] mb-1"
            />
            <p className="text-[12px] text-[rgba(0,0,0,0.35)] text-right mb-3">{pitch.length}/500</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleApply()}
                className="flex-1 min-h-[44px] py-2.5 rounded-[6px] border-[0.5px] border-[rgba(0,0,0,0.18)] text-[#1C1917] font-medium text-[13px] hover:bg-[rgba(0,0,0,0.04)]"
              >
                Skip
              </button>
              <button
                onClick={() => handleApply(pitch)}
                disabled={submitting}
                className="flex-1 min-h-[44px] py-2.5 rounded-[6px] bg-[#C4674A] text-white font-semibold text-[13px] hover:opacity-85 disabled:opacity-50"
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
