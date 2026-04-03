import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Megaphone, Users, Film, Eye } from 'lucide-react';

interface Stats {
  totalCampaigns: number; totalCreators: number; totalReels: number; totalReach: number;
  completionRate: number; avgFillRate: number; avgProfileComplete: number;
  creatorsByCity: { city: string; count: number }[];
  creatorsByMonth: { month: string; count: number }[];
  campaignPerformance: { title: string; reach: number }[];
}

export default function AdminAnalyticsTab() {
  const [stats, setStats] = useState<Stats>({
    totalCampaigns: 0, totalCreators: 0, totalReels: 0, totalReach: 0,
    completionRate: 0, avgFillRate: 0, avgProfileComplete: 0,
    creatorsByCity: [], creatorsByMonth: [], campaignPerformance: [],
  });

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    const [campaignsRes, creatorsRes, participationsRes] = await Promise.all([
      supabase.from('campaigns').select('id, status, title, creator_target'),
      supabase.from('creators').select('id, address, created_at, approved, profile_complete'),
      supabase.from('participations').select('id, status, reach, reel_url, campaign_id'),
    ]);
    const campaigns = campaignsRes.data || [];
    const creators = (creatorsRes.data || []).filter((c: any) => c.approved);
    const participations = participationsRes.data || [];
    const reels = participations.filter((p: any) => p.reel_url);
    const totalReach = participations.reduce((sum: number, p: any) => sum + (p.reach || 0), 0);
    const completed = participations.filter((p: any) => p.status === 'completed').length;
    const completionRate = participations.length > 0 ? Math.round((completed / participations.length) * 100) : 0;

    // Avg fill rate: applicants / target across active campaigns
    let fillRateSum = 0, fillCount = 0;
    for (const c of campaigns.filter((x: any) => x.status === 'active' || x.status === 'live')) {
      const { count } = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id);
      fillRateSum += Math.min(((count || 0) / Math.max(c.creator_target, 1)) * 100, 100);
      fillCount++;
    }
    const avgFillRate = fillCount > 0 ? Math.round(fillRateSum / fillCount) : 0;
    const profileComplete = creators.filter((c: any) => c.profile_complete).length;
    const avgProfileComplete = creators.length > 0 ? Math.round((profileComplete / creators.length) * 100) : 0;

    // Creators by city
    const cityMap: Record<string, number> = {};
    creators.forEach((c: any) => { const city = c.address || 'Unknown'; cityMap[city] = (cityMap[city] || 0) + 1; });
    const creatorsByCity = Object.entries(cityMap).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);

    // Creators by month
    const monthMap: Record<string, number> = {};
    creators.forEach((c: any) => { const month = c.created_at?.slice(0, 7) || 'unknown'; monthMap[month] = (monthMap[month] || 0) + 1; });
    const creatorsByMonth = Object.entries(monthMap).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));

    // Campaign performance (reach per campaign)
    const campReach: Record<string, { title: string; reach: number }> = {};
    campaigns.forEach((c: any) => { campReach[c.id] = { title: c.title, reach: 0 }; });
    participations.forEach((p: any) => { if (campReach[p.campaign_id]) campReach[p.campaign_id].reach += (p.reach || 0); });
    const campaignPerformance = Object.values(campReach).filter(c => c.reach > 0).sort((a, b) => b.reach - a.reach);

    setStats({
      totalCampaigns: campaigns.length, totalCreators: creators.length, totalReels: reels.length, totalReach,
      completionRate, avgFillRate, avgProfileComplete, creatorsByCity, creatorsByMonth, campaignPerformance,
    });
  };

  const statCards = [
    { label: 'Total Campaigns', value: stats.totalCampaigns, icon: Megaphone },
    { label: 'Total Creators', value: stats.totalCreators, icon: Users },
    { label: 'Reels Submitted', value: stats.totalReels, icon: Film },
    { label: 'Estimated Reach', value: stats.totalReach.toLocaleString(), icon: Eye },
  ];

  const maxCity = Math.max(...stats.creatorsByCity.map(c => c.count), 1);
  const maxMonth = Math.max(...stats.creatorsByMonth.map(m => m.count), 1);
  const maxCampReach = Math.max(...stats.campaignPerformance.map(c => c.reach), 1);

  const barChart = (items: { label: string; value: number; max: number; color: string }[]) => (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-[13px] text-[#222] truncate" style={{ width: 90, flexShrink: 0 }}>{item.label}</span>
          <div className="flex-1 h-6 bg-[rgba(34,34,34,0.04)] rounded-[6px] overflow-hidden">
            <div className="h-full rounded-[6px] flex items-center justify-end pr-2 transition-all" style={{ width: `${Math.max((item.value / item.max) * 100, 8)}%`, background: item.color, minWidth: 28 }}>
              <span className="text-[11px] font-semibold text-white">{item.value.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-[13px] text-[rgba(34,34,34,0.35)]">No data yet</p>}
    </div>
  );

  const progressMetric = (label: string, value: number) => (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] text-[#222] font-medium">{label}</span>
        <span className="text-[13px] font-semibold text-[#222]">{value}%</span>
      </div>
      <div className="h-2 bg-[rgba(34,34,34,0.06)] rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#C4674A] transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );

  const chartLabel = "text-[12px] font-bold uppercase tracking-[0.6px] text-[rgba(34,34,34,0.35)] mb-4";

  return (
    <div>
      {/* Stat cards */}
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

      {/* Charts: row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#E6E2DB] rounded-[12px] p-5">
          <p className={chartLabel}>Creators by City</p>
          {barChart(stats.creatorsByCity.map(c => ({ label: c.city, value: c.count, max: maxCity, color: '#C4674A' })))}
        </div>
        <div className="bg-white border border-[#E6E2DB] rounded-[12px] p-5">
          <p className={chartLabel}>New Creators Over Time</p>
          {barChart(stats.creatorsByMonth.map(m => ({
            label: new Date(m.month + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
            value: m.count, max: maxMonth, color: '#2D7A4F',
          })))}
        </div>
      </div>

      {/* Charts: row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E6E2DB] rounded-[12px] p-5">
          <p className={chartLabel}>Campaign Performance</p>
          {barChart(stats.campaignPerformance.map(c => ({ label: c.title.slice(0, 20), value: c.reach, max: maxCampReach, color: '#C4674A' })))}
        </div>
        <div className="bg-white border border-[#E6E2DB] rounded-[12px] p-5">
          <p className={chartLabel}>Platform Health</p>
          {progressMetric('Avg Completion Rate', stats.completionRate)}
          {progressMetric('Campaign Fill Rate', stats.avgFillRate)}
          {progressMetric('Profile Completeness', stats.avgProfileComplete)}
        </div>
      </div>
    </div>
  );
}
