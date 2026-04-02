import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface CampaignDetailProps {
  campaignId: string;
}

export default function CampaignDetail({ campaignId }: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('campaigns')
      .select('id, title, headline, status')
      .eq('id', campaignId)
      .single()
      .then(({ data }) => {
        setCampaign(data);
        setLoading(false);
      });
  }, [campaignId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--shell)]">
        <div className="w-10 h-10 border-[3px] border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--shell)] flex items-center justify-center px-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-8 max-w-md w-full text-center">
        <h1 style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.4px', margin: '0 0 8px' }}>
          {campaign?.title || 'Campaign'}
        </h1>
        {campaign?.headline && (
          <p style={{ color: 'var(--ink-60)', fontSize: 15, margin: '0 0 16px' }}>{campaign.headline}</p>
        )}
        <p style={{ color: 'var(--ink-35)', fontSize: 14 }}>
          Campaign ID: {campaignId}
        </p>
        <p style={{ color: 'var(--ink-35)', fontSize: 14, marginTop: 8 }}>
          Full campaign detail page coming soon — Phase 5
        </p>
      </div>
    </div>
  );
}
