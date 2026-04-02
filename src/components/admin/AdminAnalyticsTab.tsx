import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart3, Users, Film, Eye } from 'lucide-react';

interface Stats {
  totalCampaigns: number;
  totalCreators: number;
  totalReels: number;
  totalReach: number;
  completionRate: number;
  creatorsByCity: { city: string; count: number }[];
  creatorsByMonth: { month: string; count: number }[];
}

export default function AdminAnalyticsTab() {
  const [stats, setStats] = useState<Stats>({
    totalCampaigns: 0, totalCreators: 0, totalReels: 0, totalReach: 0,
    completionRate: 0, creatorsByCity: [], creatorsByMonth: [],
  });

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    const [campaignsRes, creatorsRes, participationsRes] = await Promise.all([
      supabase.from('campaigns').select('id, status'),
      supabase.from('creators').select('id, address, created_at, approved'),
      supabase.from('participations').select('id, status, reach, reel_url'),
    ]);

    const campaigns = campaignsRes.data || [];
    const creators = (creatorsRes.data || []).filter((c: any) => c.approved);
    const participations = participationsRes.data || [];

    const reels = participations.filter((p: any) => p.reel_url);
    const totalReach = participations.reduce((sum: number, p: any) => sum + (p.reach || 0), 0);
    const completed = participations.filter((p: any) => p.status === 'completed').length;
    const completionRate = participations.length > 0 ? Math.round((completed / participations.length) * 100) : 0;

    // Creators by city
    const cityMap: Record<string, number> = {};
    creators.forEach((c: any) => {
      const city = c.address || 'Unknown';
      cityMap[city] = (cityMap[city] || 0) + 1;
    });
    const creatorsByCity = Object.entries(cityMap)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);

    // Creators by month
    const monthMap: Record<string, number> = {};
    creators.forEach((c: any) => {
      const month = c.created_at?.slice(0, 7) || 'unknown';
      monthMap[month] = (monthMap[month] || 0) + 1;
    });
    const creatorsByMonth = Object.entries(monthMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    setStats({
      totalCampaigns: campaigns.length,
      totalCreators: creators.length,
      totalReels: reels.length,
      totalReach,
      completionRate,
      creatorsByCity,
      creatorsByMonth,
    });
  };

  const statCards = [
    { label: 'Total Campaigns', value: stats.totalCampaigns, icon: BarChart3 },
    { label: 'Total Creators', value: stats.totalCreators, icon: Users },
    { label: 'Reels Submitted', value: stats.totalReels, icon: Film },
    { label: 'Estimated Reach', value: stats.totalReach.toLocaleString(), icon: Eye },
  ];

  const maxCityCount = Math.max(...stats.creatorsByCity.map(c => c.count), 1);
  const maxMonthCount = Math.max(...stats.creatorsByMonth.map(m => m.count), 1);

  return (
    <div>
      <h1 className="text-[24px] font-bold text-[var(--ink)] mb-5" style={{ letterSpacing: '-0.4px' }}>Analytics</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-[var(--r-sm)] bg-[var(--terra-light)] flex items-center justify-center">
                <s.icon size={18} className="text-[var(--terra)]" />
              </div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)]">{s.label}</p>
            </div>
            <p className="text-[28px] font-bold text-[var(--ink)]" style={{ letterSpacing: '-0.4px' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Completion rate */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5 mb-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-3">Campaign Completion Rate</p>
        <div className="flex items-center gap-4">
          <p className="text-[28px] font-bold text-[var(--ink)]">{stats.completionRate}%</p>
          <div className="flex-1 h-3 bg-[var(--ink-10)] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[var(--terra)] transition-all" style={{ width: `${stats.completionRate}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Creators by city */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-4">Creators by City</p>
          <div className="space-y-3">
            {stats.creatorsByCity.map(c => (
              <div key={c.city} className="flex items-center gap-3">
                <span className="text-[14px] text-[var(--ink)] w-32 truncate">{c.city}</span>
                <div className="flex-1 h-6 bg-[var(--ink-10)] rounded-[var(--r-sm)] overflow-hidden">
                  <div className="h-full rounded-[var(--r-sm)] bg-[var(--terra)] flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${(c.count / maxCityCount) * 100}%`, minWidth: 24 }}>
                    <span className="text-[11px] font-semibold text-white">{c.count}</span>
                  </div>
                </div>
              </div>
            ))}
            {stats.creatorsByCity.length === 0 && (
              <p className="text-[13px] text-[var(--ink-35)]">No data yet</p>
            )}
          </div>
        </div>

        {/* New creators over time */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--r-card)] p-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--ink-60)] mb-4">New Creators Over Time</p>
          <div className="space-y-3">
            {stats.creatorsByMonth.map(m => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-[14px] text-[var(--ink)] w-24">
                  {new Date(m.month + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </span>
                <div className="flex-1 h-6 bg-[var(--ink-10)] rounded-[var(--r-sm)] overflow-hidden">
                  <div className="h-full rounded-[var(--r-sm)] bg-[var(--success)] flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${(m.count / maxMonthCount) * 100}%`, minWidth: 24 }}>
                    <span className="text-[11px] font-semibold text-white">{m.count}</span>
                  </div>
                </div>
              </div>
            ))}
            {stats.creatorsByMonth.length === 0 && (
              <p className="text-[13px] text-[var(--ink-35)]">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
