import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Calendar, Gift, Film, Image, MessageCircle, Clock, Check, X } from 'lucide-react';

interface CampaignDetailProps {
  campaignId: string;
  onBack?: () => void;
}

interface Campaign {
  id: string; brand_id: string; title: string; headline: string | null;
  about_brand: string | null; perk_description: string | null; perk_value: number | null;
  perk_type: string | null; target_city: string | null; content_requirements: string | null;
  talking_points: string[] | null; inspiration: any[] | null; deliverables: any;
  open_date: string | null; expression_deadline: string | null; content_deadline: string | null;
  status: string; businesses?: { name: string };
}

interface Application {
  id: string; status: string;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function PerkIcon({ type }: { type: string | null }) {
  if (type === 'experience') return <Gift size={18} className="text-[var(--terra)]" />;
  if (type === 'product') return <Gift size={18} className="text-[var(--terra)]" />;
  return <Gift size={18} className="text-[var(--terra)]" />;
}

export default function CampaignDetail({ campaignId, onBack }: CampaignDetailProps) {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [pitch, setPitch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  const fetchCampaign = async () => {
    setLoading(true);
    const { data: campData } = await supabase
      .from('campaigns')
      .select('*, businesses(name)')
      .eq('id', campaignId)
      .single();
    if (campData) setCampaign(campData as Campaign);

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
    setSubmitting(false);
    fetchCampaign();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)]">
        <div className="w-10 h-10 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)] px-4">
        <div className="text-center">
          <p className="text-[18px] font-semibold text-[var(--ink)] mb-2">Campaign not found</p>
          <p className="text-[14px] text-[var(--ink-60)]">This campaign may have been removed or the link is invalid.</p>
          {onBack && <button onClick={onBack} className="mt-4 text-[var(--terra)] font-semibold text-[14px]">Go back</button>}
        </div>
      </div>
    );
  }

  const sectionCls = 'bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5 mb-3';

  return (
    <div className="min-h-screen bg-[var(--shell)]">
      <div className="max-w-[600px] mx-auto px-4 pb-28 pt-4">
        {/* Back button */}
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1 text-[14px] text-[var(--ink-35)] hover:text-[var(--terra)] mb-3">
            <ArrowLeft size={16} /> Back
          </button>
        )}

        {/* 1. Header */}
        <div className={sectionCls}>
          <p className="text-[14px] font-semibold text-[var(--ink-60)] mb-1">{campaign.businesses?.name}</p>
          <h1 className="text-[24px] font-bold text-[var(--ink)] mb-3" style={{ letterSpacing: '-0.4px', lineHeight: 1.2 }}>
            {campaign.headline || campaign.title}
          </h1>
          {/* Perk pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-pill)] bg-[var(--terra-light)]">
            <PerkIcon type={campaign.perk_type} />
            <span className="text-[14px] font-semibold text-[var(--terra)]">
              {campaign.perk_description?.split('—')[0]?.trim() || 'Perk included'}
              {campaign.perk_value ? ` — worth £${campaign.perk_value}` : ''}
            </span>
          </div>
          {campaign.expression_deadline && (
            <p className="text-[13px] text-[var(--ink-35)] mt-3 flex items-center gap-1.5">
              <Clock size={14} /> Apply by {fmtDate(campaign.expression_deadline)}
            </p>
          )}
        </div>

        {/* 2. About the brand */}
        {campaign.about_brand && (
          <div className={sectionCls}>
            <h2 className="text-[16px] font-semibold text-[var(--ink)] mb-2">About the brand</h2>
            <p className="text-[15px] text-[var(--ink)] leading-[1.65]">{campaign.about_brand}</p>
          </div>
        )}

        {/* 3. What's in it for you */}
        {campaign.perk_description && (
          <div className={sectionCls}>
            <h2 className="text-[16px] font-semibold text-[var(--ink)] mb-2">What's in it for you</h2>
            <p className="text-[15px] text-[var(--ink)] leading-[1.65]">{campaign.perk_description}</p>
            <div className="flex items-center gap-4 mt-3 text-[13px] text-[var(--ink-60)]">
              {campaign.perk_value && <span className="flex items-center gap-1"><Gift size={14} /> Worth £{campaign.perk_value}</span>}
              {campaign.perk_type && <span className="capitalize">{campaign.perk_type.replace('_', ' ')}</span>}
            </div>
          </div>
        )}

        {/* 4. What to post */}
        <div className={sectionCls}>
          <h2 className="text-[16px] font-semibold text-[var(--ink)] mb-2">What to post</h2>
          {/* Deliverables */}
          <div className="flex gap-3 mb-3">
            {campaign.deliverables?.reel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-sm)] bg-[var(--shell)] text-[13px] font-medium text-[var(--ink)]">
                <Film size={14} /> Reel
              </span>
            )}
            {campaign.deliverables?.story && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-sm)] bg-[var(--shell)] text-[13px] font-medium text-[var(--ink)]">
                <Image size={14} /> Story
              </span>
            )}
          </div>
          {campaign.content_requirements && (
            <p className="text-[15px] text-[var(--ink)] leading-[1.65]">{campaign.content_requirements}</p>
          )}
        </div>

        {/* 5. Talking points */}
        {campaign.talking_points && campaign.talking_points.length > 0 && (
          <div className={sectionCls}>
            <h2 className="text-[16px] font-semibold text-[var(--ink)] mb-2">Talking points</h2>
            <ol className="space-y-2">
              {campaign.talking_points.map((tp, i) => (
                <li key={i} className="flex gap-3 text-[15px] text-[var(--ink)] leading-[1.65]">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--terra-light)] text-[var(--terra)] text-[12px] font-semibold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {tp}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 6. Inspiration */}
        {campaign.inspiration && campaign.inspiration.length > 0 && (
          <div className={sectionCls}>
            <h2 className="text-[16px] font-semibold text-[var(--ink)] mb-3">Inspiration</h2>
            <div className="space-y-3">
              {campaign.inspiration.map((item: any, i: number) => (
                <div key={i} className="bg-[var(--shell)] rounded-[var(--r-sm)] p-4">
                  <p className="text-[15px] font-semibold text-[var(--ink)] mb-1">{item.title}</p>
                  <p className="text-[14px] text-[var(--ink-60)] leading-[1.6]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. Campaign dates */}
        <div className={sectionCls}>
          <h2 className="text-[16px] font-semibold text-[var(--ink)] mb-3">Campaign dates</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <Calendar size={16} className="text-[var(--ink-35)] mx-auto mb-1" />
              <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-35)] mb-0.5">Opens</p>
              <p className="text-[14px] font-medium text-[var(--ink)]">{fmtDate(campaign.open_date)}</p>
            </div>
            <div className="text-center">
              <MessageCircle size={16} className="text-[var(--ink-35)] mx-auto mb-1" />
              <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-35)] mb-0.5">Apply by</p>
              <p className="text-[14px] font-medium text-[var(--terra)]">{fmtDate(campaign.expression_deadline)}</p>
            </div>
            <div className="text-center">
              <Film size={16} className="text-[var(--ink-35)] mx-auto mb-1" />
              <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-35)] mb-0.5">Content due</p>
              <p className="text-[14px] font-medium text-[var(--ink)]">{fmtDate(campaign.content_deadline)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--card)] border-t border-[var(--border)] px-4 py-4 z-40">
        <div className="max-w-[600px] mx-auto">
          {!application && (
            <button
              onClick={() => setShowPitchModal(true)}
              className="w-full py-3.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 transition-opacity"
              style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}
            >
              I'm Interested
            </button>
          )}
          {application?.status === 'interested' && (
            <div className="w-full py-3.5 rounded-[var(--r-pill)] bg-[var(--shell)] text-center text-[var(--ink-60)] font-medium text-[15px] border border-[var(--border)]">
              Interest registered — we'll be in touch
            </div>
          )}
          {application?.status === 'selected' && (
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full py-3.5 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}
            >
              {submitting ? 'Confirming...' : "You've been selected — confirm your spot"}
            </button>
          )}
          {application?.status === 'confirmed' && (
            <div className="w-full py-3.5 rounded-[var(--r-pill)] bg-[rgba(45,122,79,0.1)] text-center text-[var(--success)] font-semibold text-[15px] border border-[rgba(45,122,79,0.2)]">
              <Check size={16} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
              You're in — view your campaign
            </div>
          )}
          {application?.status === 'declined' && (
            <div className="w-full py-3.5 rounded-[var(--r-pill)] bg-[var(--shell)] text-center text-[var(--ink-35)] font-medium text-[15px] border border-[var(--border)]">
              Not selected for this campaign
            </div>
          )}
        </div>
      </div>

      {/* Pitch modal */}
      {showPitchModal && (
        <div className="fixed inset-0 bg-[rgba(34,34,34,0.4)] z-50 flex items-end sm:items-center justify-center">
          <div className="bg-[var(--card)] w-full max-w-[480px] rounded-t-[16px] sm:rounded-[var(--r-card)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-[var(--ink)]">Express interest</h3>
              <button onClick={() => setShowPitchModal(false)} className="text-[var(--ink-35)] hover:text-[var(--ink)]"><X size={20} /></button>
            </div>
            <p className="text-[14px] text-[var(--ink-60)] mb-4">Tell the brand why you're a great fit — optional</p>
            <textarea
              value={pitch}
              onChange={e => setPitch(e.target.value)}
              placeholder="I'd love to be part of this because..."
              className="w-full px-4 py-3 rounded-[var(--r-input)] border border-[var(--ink-10)] bg-white text-[var(--ink)] text-[15px] h-24 resize-none focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[rgba(196,103,74,0.12)] mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleApply()}
                className="flex-1 py-3 rounded-[var(--r-pill)] border border-[var(--border)] text-[var(--ink)] font-semibold text-[15px] hover:bg-[var(--shell)]"
              >
                Skip
              </button>
              <button
                onClick={() => handleApply(pitch)}
                disabled={submitting}
                className="flex-1 py-3 rounded-[var(--r-pill)] bg-[var(--terra)] text-white font-semibold text-[15px] hover:opacity-90 disabled:opacity-50"
                style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.28)' }}
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
