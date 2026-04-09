import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Megaphone, Users, Film, Eye } from 'lucide-react';

// ─── Skeleton Loaders ───
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[rgba(42,32,24,0.06)] rounded-[10px] ${className || ''}`} />;
}

function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-4 mb-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[10px] p-4">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

interface Stats {
  totalCampaigns: number; totalCreators: number; totalReels: number; totalReach: number;
  completionRate: number; avgFillRate: number; avgProfileComplete: number;
  creatorsByCity: { city: string; count: number }[];
  creatorsByMonth: { month: string; count: number }[];
  campaignPerformance: { title: string; reach: number }[];
}

// Animated SVG bar chart
function AnimatedBarChart({ items, color }: { items: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...items.map(i => i.value), 1);
  if (items.length === 0) return <p className="text-[13px] text-[var(--ink-35)]">No data yet</p>;

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-[13px] text-[var(--ink)] truncate" style={{ width: 90, flexShrink: 0 }}>{item.label}</span>
          <div className="flex-1 h-6 bg-[rgba(42,32,24,0.08)] rounded-[10px] overflow-hidden">
            <div className="h-full rounded-[10px] flex items-center justify-end pr-2 chart-bar-enter"
              style={{
                width: `${Math.max((item.value / max) * 100, 8)}%`,
                background: color,
                minWidth: 28,
                animationDelay: `${i * 0.08}s`,
                animationFillMode: 'both',
              }}>
              <span className="text-[11px] font-semibold text-white">{item.value.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] text-[var(--ink)] font-medium">{label}</span>
        <span className="text-[13px] font-semibold text-[var(--ink)]">{value}%</span>
      </div>
      <div className="h-1 bg-[rgba(42,32,24,0.08)] rounded-full overflow-hidden">
        <div className="h-full rounded-[10px] bg-[var(--terra)] transition-all duration-700" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function AdminAnalyticsTab() {
  const [stats, setStats] = useState<Stats>({
    totalCampaigns: 0, totalCreators: 0, totalReels: 0, totalReach: 0,
    completionRate: 0, avgFillRate: 0, avgProfileComplete: 0,
    creatorsByCity: [], creatorsByMonth: [], campaignPerformance: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
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

    // Batch application counts instead of N+1
    const { data: allApps } = await supabase.from('applications').select('campaign_id');
    const appCountMap: Record<string, number> = {};
    (allApps || []).forEach((a: any) => { appCountMap[a.campaign_id] = (appCountMap[a.campaign_id] || 0) + 1; });

    let fillRateSum = 0, fillCount = 0;
    for (const c of campaigns.filter((x: any) => x.status === 'active' || x.status === 'live')) {
      const appCount = appCountMap[c.id] || 0;
      fillRateSum += Math.min((appCount / Math.max(c.creator_target, 1)) * 100, 100);
      fillCount++;
    }
    const avgFillRate = fillCount > 0 ? Math.round(fillRateSum / fillCount) : 0;
    const profileComplete = creators.filter((c: any) => c.profile_complete).length;
    const avgProfileComplete = creators.length > 0 ? Math.round((profileComplete / creators.length) * 100) : 0;

    const cityMap: Record<string, number> = {};
    creators.forEach((c: any) => { const city = c.address || 'Unknown'; cityMap[city] = (cityMap[city] || 0) + 1; });
    const creatorsByCity = Object.entries(cityMap).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);

    const monthMap: Record<string, number> = {};
    creators.forEach((c: any) => { const month = c.created_at?.slice(0, 7) || 'unknown'; monthMap[month] = (monthMap[month] || 0) + 1; });
    const creatorsByMonth = Object.entries(monthMap).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month));

    const campReach: Record<string, { title: string; reach: number }> = {};
    campaigns.forEach((c: any) => { campReach[c.id] = { title: c.title, reach: 0 }; });
    participations.forEach((p: any) => { if (campReach[p.campaign_id]) campReach[p.campaign_id].reach += (p.reach || 0); });
    const campaignPerformance = Object.values(campReach).filter(c => c.reach > 0).sort((a, b) => b.reach - a.reach);

    setStats({
      totalCampaigns: campaigns.length, totalCreators: creators.length, totalReels: reels.length, totalReach,
      completionRate, avgFillRate, avgProfileComplete, creatorsByCity, creatorsByMonth, campaignPerformance,
    });
    setLoading(false);
  };

  const statCards = [
    { label: 'Total Campaigns', value: stats.totalCampaigns, icon: Megaphone },
    { label: 'Total Creators', value: stats.totalCreators, icon: Users },
    { label: 'Reels Submitted', value: stats.totalReels, icon: Film },
    { label: 'Estimated Reach', value: stats.totalReach.toLocaleString(), icon: Eye },
  ];

  const chartLabel = "text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--ink-35)] mb-4";

  if (loading) {
    return (
      <div className="tab-fade-in">
        <StatCardsSkeleton count={4} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-[200px] rounded-[10px]" />
          <Skeleton className="h-[200px] rounded-[10px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="tab-fade-in">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[10px]" style={{ padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', color: 'var(--ink-35)', textTransform: 'uppercase' as const, marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts: row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[10px] p-5">
          <p className={chartLabel}>Creators by County</p>
          <AnimatedBarChart items={stats.creatorsByCity.map(c => ({ label: c.city, value: c.count }))} color="var(--terra)" />
        </div>
        <div className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[10px] p-5">
          <p className={chartLabel}>New Creators Over Time</p>
          <AnimatedBarChart items={stats.creatorsByMonth.map(m => ({
            label: new Date(m.month + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
            value: m.count,
          }))} color="#2D7A4F" />
        </div>
      </div>

      {/* Charts: row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[10px] p-5">
          <p className={chartLabel}>Campaign Performance</p>
          <AnimatedBarChart items={stats.campaignPerformance.map(c => ({ label: c.title.slice(0, 20), value: c.reach }))} color="var(--terra)" />
        </div>
        <div className="bg-white border border-[rgba(42,32,24,0.08)] rounded-[10px] p-5">
          <p className={chartLabel}>Platform Health</p>
          <ProgressMetric label="Avg Completion Rate" value={stats.completionRate} />
          <ProgressMetric label="Campaign Fill Rate" value={stats.avgFillRate} />
          <ProgressMetric label="Profile Completeness" value={stats.avgProfileComplete} />
        </div>
      </div>
    </div>
  );
}
