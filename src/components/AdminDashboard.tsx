import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LogOut, Users, Store,
  CheckCircle2, XCircle, BarChart3, Package, ClipboardList
} from 'lucide-react';

const BUSINESS_EMOJIS = ['🍊', '🥤', '🧃', '🍋', '🫐', '🥑', '🍇', '🍓', '🥭', '🍍', '🥝', '🍉', '🫒', '🌶️', '🍑', '🥥'];
function getBusinessEmoji(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return BUSINESS_EMOJIS[Math.abs(hash) % BUSINESS_EMOJIS.length];
}

function StatusPill({ status, type = 'claim' }: { status: string; type?: 'claim' | 'approval' | 'offer' }) {
  if (type === 'approval') {
    return status === 'approved'
      ? <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">✓ Approved</span>
      : <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">● Pending</span>;
  }
  if (type === 'offer') {
    return status === 'live'
      ? <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">● Live</span>
      : <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-50 text-gray-500 border border-gray-100">Paused</span>;
  }
  const styles: Record<string, string> = {
    active: 'bg-sky-50 text-sky-600 border border-sky-100',
    redeemed: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    expired: 'bg-rose-50 text-rose-500 border border-rose-100',
  };
  return <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${styles[status] || 'bg-gray-50 text-gray-500 border border-gray-100'}`}>{status}</span>;
}

interface Creator { id: string; name: string; instagram_handle: string; email: string; code: string; approved: boolean; created_at: string; }
interface Business { id: string; name: string; slug: string; owner_email: string; approved: boolean; created_at: string; }
interface OfferWithBusiness { id: string; description: string; monthly_cap: number; is_live: boolean; businesses: { name: string }; }
interface ClaimWithDetails { id: string; status: string; claimed_at: string; reel_url: string | null; creators: { name: string }; businesses: { name: string }; }

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [view, setView] = useState<'stats' | 'creators' | 'businesses' | 'offers' | 'claims'>('stats');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [offers, setOffers] = useState<OfferWithBusiness[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [stats, setStats] = useState({ totalCreators: 0, totalBusinesses: 0, totalClaims: 0, totalReels: 0, pendingCreators: 0, pendingBusinesses: 0 });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [creatorsData, businessesData, offersData, claimsData] = await Promise.all([
      supabase.from('creators').select('*').order('created_at', { ascending: false }),
      supabase.from('businesses').select('*').order('created_at', { ascending: false }),
      supabase.from('offers').select('*, businesses(name)').order('created_at', { ascending: false }),
      supabase.from('claims').select('*, creators(name), businesses(name)').order('claimed_at', { ascending: false })
    ]);
    if (creatorsData.data) setCreators(creatorsData.data);
    if (businessesData.data) setBusinesses(businessesData.data);
    if (offersData.data) setOffers(offersData.data as OfferWithBusiness[]);
    if (claimsData.data) {
      setClaims(claimsData.data as ClaimWithDetails[]);
      setStats({
        totalCreators: creatorsData.data?.length || 0,
        totalBusinesses: businessesData.data?.length || 0,
        totalClaims: claimsData.data.filter((c: any) => c.claimed_at?.startsWith(currentMonth)).length,
        totalReels: claimsData.data.filter((c: any) => c.reel_url).length,
        pendingCreators: creatorsData.data?.filter(c => !c.approved).length || 0,
        pendingBusinesses: businessesData.data?.filter(b => !b.approved).length || 0,
      });
    }
  };

  const handleApproveCreator = async (id: string, approved: boolean) => { await supabase.from('creators').update({ approved }).eq('id', id); fetchAll(); };
  const handleApproveBusiness = async (id: string, approved: boolean) => { await supabase.from('businesses').update({ approved }).eq('id', id); fetchAll(); };
  const handleUpdateClaimStatus = async (id: string, status: string) => { await supabase.from('claims').update({ status }).eq('id', id); fetchAll(); };

  const statCards = [
    { emoji: '👥', value: stats.totalCreators, label: 'Total Creators', accent: 'from-violet-50 to-purple-50 border-violet-100' },
    { emoji: '🏪', value: stats.totalBusinesses, label: 'Total Businesses', accent: 'from-amber-50 to-orange-50 border-amber-100' },
    { emoji: '📋', value: stats.totalClaims, label: 'Claims This Month', accent: 'from-sky-50 to-cyan-50 border-sky-100' },
    { emoji: '🎬', value: stats.totalReels, label: 'Reels Posted', accent: 'from-rose-50 to-pink-50 border-rose-100' },
  ];

  const tabs = [
    { key: 'stats' as const, label: 'Overview', icon: BarChart3 },
    { key: 'creators' as const, label: 'Creators', icon: Users, badge: stats.pendingCreators },
    { key: 'businesses' as const, label: 'Businesses', icon: Store, badge: stats.pendingBusinesses },
    { key: 'offers' as const, label: 'Offers', icon: Package },
    { key: 'claims' as const, label: 'Claims', icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1a1025] flex items-center justify-center text-lg">🧃</div>
              <div>
                <h1 className="text-[15px] font-bold text-[#1a1025]">Admin Dashboard</h1>
                <p className="text-xs text-gray-400">Juice Creators Platform</p>
              </div>
            </div>
            <button onClick={signOut} className="p-2 rounded-xl hover:bg-gray-50 transition-colors">
              <LogOut className="w-4.5 h-4.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-white border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all relative ${
                view === tab.key ? 'text-[#1a1025]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="relative">
                <tab.icon className="w-4 h-4" />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#1a1025] rounded-full" />}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* STATS */}
          {view === 'stats' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br ${stat.accent} rounded-2xl p-5 border`}>
                  <div className="text-2xl mb-3">{stat.emoji}</div>
                  <p className="text-3xl font-bold text-[#1a1025]">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* CREATORS */}
          {view === 'creators' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {creators.length === 0 ? (
                <div className="text-center py-16"><div className="text-4xl mb-3">👥</div><p className="text-gray-400 text-sm">No creators yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Handle</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {creators.map((creator) => (
                        <tr key={creator.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-[#1a1025]">{creator.name}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">{creator.instagram_handle}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#1a1025] text-white">{creator.code}</span></td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">{creator.email}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><StatusPill status={creator.approved ? 'approved' : 'pending'} type="approval" /></td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!creator.approved ? (
                              <button onClick={() => handleApproveCreator(creator.id, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white font-semibold text-xs bg-emerald-500 hover:bg-emerald-600 transition-all">
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </button>
                            ) : (
                              <button onClick={() => handleApproveCreator(creator.id, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white font-semibold text-xs bg-rose-500 hover:bg-rose-600 transition-all">
                                <XCircle className="w-3 h-3" /> Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* BUSINESSES */}
          {view === 'businesses' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {businesses.length === 0 ? (
                <div className="text-center py-16"><div className="text-4xl mb-3">🏪</div><p className="text-gray-400 text-sm">No businesses yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Business</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Slug</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {businesses.map((business) => (
                        <tr key={business.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{getBusinessEmoji(business.name)}</span>
                              <span className="text-sm font-medium text-[#1a1025]">{business.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 font-mono">{business.slug}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">{business.owner_email}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><StatusPill status={business.approved ? 'approved' : 'pending'} type="approval" /></td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!business.approved ? (
                              <button onClick={() => handleApproveBusiness(business.id, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white font-semibold text-xs bg-emerald-500 hover:bg-emerald-600 transition-all">
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </button>
                            ) : (
                              <button onClick={() => handleApproveBusiness(business.id, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white font-semibold text-xs bg-rose-500 hover:bg-rose-600 transition-all">
                                <XCircle className="w-3 h-3" /> Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* OFFERS */}
          {view === 'offers' && (
            <>
              {offers.length === 0 ? (
                <div className="text-center py-16"><div className="text-4xl mb-3">📦</div><p className="text-gray-400 text-sm">No offers yet.</p></div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {offers.map((offer) => (
                    <div key={offer.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm shadow-black/[0.03]">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-xl flex-shrink-0">{getBusinessEmoji(offer.businesses.name)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-sm text-[#1a1025]">{offer.businesses.name}</h3>
                            <StatusPill status={offer.is_live ? 'live' : 'paused'} type="offer" />
                          </div>
                          <p className="text-gray-500 text-sm mt-1">{offer.description}</p>
                          <p className="text-xs text-gray-400 mt-1">Cap: {offer.monthly_cap}/month</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* CLAIMS */}
          {view === 'claims' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {claims.length === 0 ? (
                <div className="text-center py-16"><div className="text-4xl mb-3">📋</div><p className="text-gray-400 text-sm">No claims yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Creator</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Business</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Claimed</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {claims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-[#1a1025]">{claim.creators.name}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{getBusinessEmoji(claim.businesses.name)}</span>
                              <span className="text-sm text-gray-500">{claim.businesses.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">{new Date(claim.claimed_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <select
                              value={claim.status}
                              onChange={(e) => handleUpdateClaimStatus(claim.id, e.target.value)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 text-[#1a1025] bg-white focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/20"
                            >
                              <option value="active">Active</option>
                              <option value="redeemed">Redeemed</option>
                              <option value="expired">Expired</option>
                            </select>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {claim.status === 'active' && (
                              <button onClick={() => handleUpdateClaimStatus(claim.id, 'expired')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white font-semibold text-xs bg-rose-500 hover:bg-rose-600 transition-all">
                                <XCircle className="w-3 h-3" /> Expire
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
