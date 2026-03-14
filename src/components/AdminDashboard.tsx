import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LogOut, Users, Store,
  CheckCircle2, XCircle, BarChart3, Package, ClipboardList, Settings,
  Film, AlertTriangle
} from 'lucide-react';
import { CategoryIcon } from '../lib/categories';
import { Logo } from './Logo';

function StatusPill({ status, type = 'claim' }: { status: string; type?: 'claim' | 'approval' | 'offer' }) {
  if (type === 'approval') {
    return status === 'approved'
      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F7F7F7] text-[#222222] border border-[rgba(34,34,34,0.1)]"><CheckCircle2 className="w-3 h-3" /> Approved</span>
      : <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#C4674A]/10 text-[#C4674A] border border-[#C4674A]/20">Pending</span>;
  }
  if (type === 'offer') {
    return status === 'live'
      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F7F7F7] text-[#222222] border border-[rgba(34,34,34,0.1)]"><CheckCircle2 className="w-3 h-3" /> Live</span>
      : <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F7F7F7] text-[rgba(34,34,34,0.5)] border border-[rgba(34,34,34,0.1)]">Paused</span>;
  }
  const styles: Record<string, string> = {
    active: 'bg-[#F7F7F7] text-[#222222] border border-[rgba(34,34,34,0.1)]',
    redeemed: 'bg-[#F7F7F7] text-[#222222] border border-[rgba(34,34,34,0.1)]',
    expired: 'bg-[#C4674A]/10 text-[#C4674A] border border-[#C4674A]/20',
  };
  return <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${styles[status] || 'bg-[#F7F7F7] text-[rgba(34,34,34,0.5)] border border-[rgba(34,34,34,0.1)]'}`}>{status}</span>;
}

interface Creator { id: string; name: string; instagram_handle: string; follower_count: string | null; email: string; code: string; approved: boolean; created_at: string; }
interface Business { id: string; name: string; slug: string; owner_email: string; category: string; approved: boolean; created_at: string; }
interface OfferWithBusiness { id: string; description: string; monthly_cap: number; is_live: boolean; businesses: { name: string; category: string }; }
interface ClaimWithDetails { id: string; status: string; claimed_at: string; reel_url: string | null; creators: { name: string }; businesses: { name: string; category: string }; }

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [view, setView] = useState<'stats' | 'creators' | 'businesses' | 'offers' | 'claims' | 'settings'>('stats');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [offers, setOffers] = useState<OfferWithBusiness[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [stats, setStats] = useState({ totalCreators: 0, totalBusinesses: 0, totalClaims: 0, totalReels: 0, pendingCreators: 0, pendingBusinesses: 0 });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchAll(); }, []);

  // Realtime: auto-refresh when new creators or businesses sign up
  useEffect(() => {
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'creators' }, () => { fetchAll(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => { fetchAll(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, () => { fetchAll(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAll = async () => {
    setFetchError(null);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [creatorsData, businessesData, offersData, claimsData] = await Promise.all([
      supabase.from('creators').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('businesses').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('offers').select('*, businesses(name, category)').order('created_at', { ascending: false }).limit(500),
      supabase.from('claims').select('*, creators(name), businesses(name, category)').order('claimed_at', { ascending: false }).limit(500)
    ]);
    const errors = [creatorsData.error, businessesData.error, offersData.error, claimsData.error].filter(Boolean);
    if (errors.length > 0) {
      console.error('[AdminDashboard] Fetch errors:', errors.map(e => `${e!.code}: ${e!.message}`));
      setFetchError('Failed to load some data. Check console for details.');
    }
    if (creatorsData.data) setCreators(creatorsData.data);
    if (businessesData.data) setBusinesses(businessesData.data);
    if (offersData.data) setOffers(offersData.data as OfferWithBusiness[]);
    if (claimsData.data) setClaims(claimsData.data as ClaimWithDetails[]);

    setStats({
      totalCreators: creatorsData.data?.length || 0,
      totalBusinesses: businessesData.data?.length || 0,
      totalClaims: claimsData.data?.filter((c: any) => c.claimed_at?.startsWith(currentMonth)).length || 0,
      totalReels: claimsData.data?.filter((c: any) => c.reel_url).length || 0,
      pendingCreators: creatorsData.data?.filter(c => !c.approved).length || 0,
      pendingBusinesses: businessesData.data?.filter(b => !b.approved).length || 0,
    });
  };

  const handleApproveCreator = async (id: string, approved: boolean) => {
    try {
      setActionFeedback(null);
      const { error } = await supabase.from('creators').update({ approved }).eq('id', id);
      if (error) throw error;
      setActionFeedback({ type: 'success', text: `Creator ${approved ? 'approved' : 'unapproved'} successfully.` });
      fetchAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to update creator.' });
    }
  };
  const handleApproveBusiness = async (id: string, approved: boolean) => {
    try {
      setActionFeedback(null);
      const { error } = await supabase.from('businesses').update({ approved }).eq('id', id);
      if (error) throw error;
      setActionFeedback({ type: 'success', text: `Business ${approved ? 'approved' : 'unapproved'} successfully.` });
      fetchAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to update business.' });
    }
  };
  const handleUpdateClaimStatus = async (id: string, status: string) => {
    try {
      setActionFeedback(null);
      const { error } = await supabase.from('claims').update({ status }).eq('id', id);
      if (error) throw error;
      setActionFeedback({ type: 'success', text: `Claim status updated to "${status}".` });
      fetchAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to update claim status.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters long' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    // Verify current password by re-authenticating
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setPasswordMessage({ type: 'error', text: 'Current password is incorrect' });
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      if (error.message.includes('same')) {
        setPasswordMessage({ type: 'error', text: 'New password must be different from current password' });
      } else {
        setPasswordMessage({ type: 'error', text: error.message || 'Failed to update password' });
      }
    } else {
      setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const statCards = [
    { icon: Users, value: stats.totalCreators, label: 'Total Creators' },
    { icon: Store, value: stats.totalBusinesses, label: 'Total Businesses' },
    { icon: ClipboardList, value: stats.totalClaims, label: 'Claims This Month' },
    { icon: Film, value: stats.totalReels, label: 'Reels Posted' },
  ];

  const tabs = [
    { key: 'stats' as const, label: 'Overview', icon: BarChart3 },
    { key: 'creators' as const, label: 'Creators', icon: Users, badge: stats.pendingCreators },
    { key: 'businesses' as const, label: 'Businesses', icon: Store, badge: stats.pendingBusinesses },
    { key: 'offers' as const, label: 'Offers', icon: Package },
    { key: 'claims' as const, label: 'Claims', icon: ClipboardList },
    { key: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-[#FFFFFF] border-b border-[rgba(34,34,34,0.1)]" style={{ padding: '20px 20px 14px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Logo size={18} />
              </div>
              <div>
                <p className="text-xs text-[rgba(34,34,34,0.5)]">Admin Dashboard</p>
              </div>
            </div>
            <button onClick={signOut} className="p-2 rounded-lg hover:bg-[#F7F7F7] transition-colors">
              <LogOut className="w-4.5 h-4.5 text-[rgba(34,34,34,0.28)]" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-[#FFFFFF] border-b border-[rgba(34,34,34,0.1)] overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all relative ${
                view === tab.key ? 'text-[#222222]' : 'text-[rgba(34,34,34,0.28)] hover:text-[rgba(34,34,34,0.5)]'
              }`}
            >
              <div className="relative">
                <tab.icon className="w-4 h-4" />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#C4674A] text-white text-[8px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#C4674A] rounded-full" />}
            </button>
          ))}
        </div>

        <div className="p-6">
          {fetchError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
              {fetchError}
            </div>
          )}
          {actionFeedback && (
            <div className={`mb-4 p-3 rounded-xl border text-sm font-medium ${actionFeedback.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              {actionFeedback.text}
            </div>
          )}
          {/* STATS */}
          {view === 'stats' && (
            <div className="space-y-4">
              {(stats.pendingCreators > 0 || stats.pendingBusinesses > 0) && (
                <div className="bg-[#C4674A]/10 rounded-2xl p-5 border border-[#C4674A]/20">
                  <h3 className="text-sm font-bold text-[#222222] mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-[#C4674A]" /> Pending Approvals</h3>
                  <div className="flex gap-4">
                    {stats.pendingCreators > 0 && (
                      <button
                        onClick={() => setView('creators')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFFFFF] border border-[#C4674A]/20 hover:border-[#C4674A]/40 transition-all"
                      >
                        <Users className="w-6 h-6" />
                        <div className="text-left">
                          <p className="text-lg font-bold text-[#222222]">{stats.pendingCreators}</p>
                          <p className="text-[10px] text-[rgba(34,34,34,0.5)] font-medium">Creator{stats.pendingCreators !== 1 ? 's' : ''}</p>
                        </div>
                      </button>
                    )}
                    {stats.pendingBusinesses > 0 && (
                      <button
                        onClick={() => setView('businesses')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFFFFF] border border-[#C4674A]/20 hover:border-[#C4674A]/40 transition-all"
                      >
                        <Store className="w-6 h-6" />
                        <div className="text-left">
                          <p className="text-lg font-bold text-[#222222]">{stats.pendingBusinesses}</p>
                          <p className="text-[10px] text-[rgba(34,34,34,0.5)] font-medium">Business{stats.pendingBusinesses !== 1 ? 'es' : ''}</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat, i) => (
                  <div key={i} className="bg-white rounded-[20px] p-6 shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)]">
                    <div className="mb-3"><stat.icon className="w-6 h-6 text-[rgba(34,34,34,0.5)]" /></div>
                    <p className="text-3xl font-bold text-[#222222]">{stat.value}</p>
                    <p className="text-xs text-[rgba(34,34,34,0.5)] mt-1 font-medium">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CREATORS */}
          {view === 'creators' && (
            <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] overflow-hidden">
              {creators.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><Users className="w-8 h-8 text-[rgba(34,34,34,0.28)]" /></div><p className="text-[rgba(34,34,34,0.5)] text-sm">No creators yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white border-b border-[rgba(34,34,34,0.1)]">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Name</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Handle</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Followers</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Code</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Email</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(34,34,34,0.05)]">
                      {[...creators].sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1)).map((creator) => (
                        <tr key={creator.id} className={`hover:bg-[#F7F7F7]/50 transition-colors ${!creator.approved ? 'bg-[#C4674A]/5' : ''}`}>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-[#222222]">{creator.name}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-[rgba(34,34,34,0.5)]">{creator.instagram_handle}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {creator.follower_count ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F7F7F7] text-[#222222]">{creator.follower_count}</span>
                            ) : (
                              <span className="text-xs text-[rgba(34,34,34,0.28)]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#222222] text-[#FFFFFF]">{creator.code}</span></td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-[rgba(34,34,34,0.5)]">{creator.email}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><StatusPill status={creator.approved ? 'approved' : 'pending'} type="approval" /></td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!creator.approved ? (
                              <button onClick={() => handleApproveCreator(creator.id, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#FFFFFF] font-semibold text-xs bg-[#C4674A] hover:bg-[#b35a3f] transition-all">
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </button>
                            ) : (
                              <button onClick={() => handleApproveCreator(creator.id, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#FFFFFF] font-semibold text-xs bg-[#C4674A] hover:bg-[#b35a3f] transition-all">
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
            <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] overflow-hidden">
              {businesses.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><Store className="w-8 h-8 text-[rgba(34,34,34,0.28)]" /></div><p className="text-[rgba(34,34,34,0.5)] text-sm">No businesses yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white border-b border-[rgba(34,34,34,0.1)]">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Business</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Slug</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Email</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(34,34,34,0.05)]">
                      {[...businesses].sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1)).map((business) => (
                        <tr key={business.id} className={`hover:bg-[#F7F7F7]/50 transition-colors ${!business.approved ? 'bg-[#C4674A]/5' : ''}`}>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <CategoryIcon category={business.category} className="w-5 h-5" />
                              <span className="text-sm font-medium text-[#222222]">{business.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-[rgba(34,34,34,0.5)] font-mono">{business.slug}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-[rgba(34,34,34,0.5)]">{business.owner_email}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><StatusPill status={business.approved ? 'approved' : 'pending'} type="approval" /></td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!business.approved ? (
                              <button onClick={() => handleApproveBusiness(business.id, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#FFFFFF] font-semibold text-xs bg-[#C4674A] hover:bg-[#b35a3f] transition-all">
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </button>
                            ) : (
                              <button onClick={() => handleApproveBusiness(business.id, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#FFFFFF] font-semibold text-xs bg-[#C4674A] hover:bg-[#b35a3f] transition-all">
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
                <div className="text-center py-16"><div className="flex justify-center mb-3"><Package className="w-8 h-8 text-[rgba(34,34,34,0.28)]" /></div><p className="text-[rgba(34,34,34,0.5)] text-sm">No offers yet.</p></div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {offers.map((offer) => (
                    <div key={offer.id} className="bg-white rounded-[20px] p-5 shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)]">
                      <div className="flex items-start gap-3 mb-2">
                        <CategoryIcon category={offer.businesses.category} className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-sm text-[#222222]">{offer.businesses.name}</h3>
                            <StatusPill status={offer.is_live ? 'live' : 'paused'} type="offer" />
                          </div>
                          <p className="text-[rgba(34,34,34,0.5)] text-sm mt-1">{offer.description}</p>
                          <p className="text-xs text-[rgba(34,34,34,0.28)] mt-1">Cap: {offer.monthly_cap ? `${offer.monthly_cap}/month` : 'Unlimited'}</p>
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
            <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] overflow-hidden">
              {claims.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><ClipboardList className="w-8 h-8 text-[rgba(34,34,34,0.28)]" /></div><p className="text-[rgba(34,34,34,0.5)] text-sm">No claims yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white border-b border-[rgba(34,34,34,0.1)]">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Creator</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Business</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Claimed</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Status</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-[rgba(34,34,34,0.5)] uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(34,34,34,0.05)]">
                      {claims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-[#F7F7F7]/50 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-[#222222]">{claim.creators.name}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <CategoryIcon category={claim.businesses.category} className="w-4 h-4" />
                              <span className="text-sm text-[rgba(34,34,34,0.5)]">{claim.businesses.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-[rgba(34,34,34,0.5)]">{new Date(claim.claimed_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <select
                              value={claim.status}
                              onChange={(e) => handleUpdateClaimStatus(claim.id, e.target.value)}
                              className="px-2.5 py-1 rounded-[12px] text-xs font-semibold border border-[rgba(34,34,34,0.15)] text-[#222222] bg-[#F7F7F7] focus:outline-none focus:ring-2 focus:ring-[#C4674A]/30 focus:border-[#C4674A]"
                            >
                              <option value="active">Active</option>
                              <option value="redeemed">Redeemed</option>
                              <option value="expired">Expired</option>
                            </select>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {claim.status === 'active' && (
                              <button onClick={() => handleUpdateClaimStatus(claim.id, 'expired')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#FFFFFF] font-semibold text-xs bg-[#C4674A] hover:bg-[#b35a3f] transition-all">
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

          {/* SETTINGS */}
          {view === 'settings' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] p-6">
                <h2 className="text-lg font-bold text-[#222222] mb-5">Change Password</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-semibold text-[#222222] mb-2">
                      Current Password
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-[12px] border border-[rgba(34,34,34,0.15)] focus:outline-none focus:ring-2 focus:ring-[#C4674A]/30 focus:border-[#C4674A] text-sm bg-[#F7F7F7] text-[#222222]"
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-semibold text-[#222222] mb-2">
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 rounded-[12px] border border-[rgba(34,34,34,0.15)] focus:outline-none focus:ring-2 focus:ring-[#C4674A]/30 focus:border-[#C4674A] text-sm bg-[#F7F7F7] text-[#222222]"
                      placeholder="Enter new password (min 8 characters)"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[#222222] mb-2">
                      Confirm New Password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 rounded-[12px] border border-[rgba(34,34,34,0.15)] focus:outline-none focus:ring-2 focus:ring-[#C4674A]/30 focus:border-[#C4674A] text-sm bg-[#F7F7F7] text-[#222222]"
                      placeholder="Confirm new password"
                    />
                  </div>
                  {passwordMessage && (
                    <div
                      className={`p-3 rounded-xl text-sm font-medium ${
                        passwordMessage.type === 'success'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}
                    >
                      {passwordMessage.text}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 bg-[#C4674A] text-[#FFFFFF] rounded-full font-semibold text-sm hover:bg-[#b35a3f] transition-colors"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
