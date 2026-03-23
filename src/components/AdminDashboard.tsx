import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DoodleIcon } from '../lib/doodle-icons';
import { CategoryIcon } from '../lib/categories';
import { Logo } from './Logo';
import LevelBadge from './LevelBadge';
import { sendCreatorApprovedEmail, sendBusinessApprovedEmail, sendCreatorDeniedEmail, sendBusinessDeniedEmail } from '../lib/notifications';

function StatusPill({ status, type = 'claim' }: { status: string; type?: 'claim' | 'approval' | 'offer' }) {
  if (type === 'approval') {
    return status === 'approved'
      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px] font-semibold bg-[#EDE8DC] text-[var(--near-black)]"><DoodleIcon name="check" size={12} /> Approved</span>
      : <span className="px-2.5 py-1 rounded-full text-[13px] font-semibold bg-[#D4470C] text-white">Pending</span>;
  }
  if (type === 'offer') {
    return status === 'live'
      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px] font-semibold bg-[var(--bg)] text-[var(--near-black)]"><DoodleIcon name="check" size={12} /> Live</span>
      : <span className="px-2.5 py-1 rounded-full text-[13px] font-semibold bg-[var(--bg)] text-[var(--mid)]">Paused</span>;
  }
  const styles: Record<string, string> = {
    active: 'bg-[#D4470C] text-white',
    redeemed: 'bg-[#EDE8DC] text-[var(--near-black)]',
    expired: 'bg-[var(--terra-10)] text-[var(--terra)]',
  };
  return <span className={`text-[13px] px-2.5 py-1 rounded-full font-semibold ${styles[status] || 'bg-[var(--bg)] text-[var(--mid)]'}`}>{status}</span>;
}

interface Creator { id: string; name: string; instagram_handle: string; follower_count: string | null; email: string; code: string; approved: boolean; created_at: string; level?: number; level_name?: string; }
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
    if (creatorsData.data) setCreators([...creatorsData.data]);
    if (businessesData.data) setBusinesses([...businessesData.data]);
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
      setActionFeedback({ type: 'success', text: `Creator ${approved ? 'approved' : 'denied'} successfully.` });
      // Send approval/denial email (non-blocking)
      if (approved) {
        sendCreatorApprovedEmail(id).catch(() => {});
      } else {
        sendCreatorDeniedEmail(id).catch(() => {});
      }
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
      setActionFeedback({ type: 'success', text: `Business ${approved ? 'approved' : 'denied'} successfully.` });
      // Send approval/denial email (non-blocking)
      if (approved) {
        sendBusinessApprovedEmail(id).catch(() => {});
      } else {
        sendBusinessDeniedEmail(id).catch(() => {});
      }
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

  const statCardData = [
    { iconName: 'users' as const, value: stats.totalCreators, label: 'Total Creators' },
    { iconName: 'store' as const, value: stats.totalBusinesses, label: 'Total Businesses' },
    { iconName: 'clipboard-list' as const, value: stats.totalClaims, label: 'Claims This Month' },
    { iconName: 'film' as const, value: stats.totalReels, label: 'Reels Posted' },
  ];

  const tabData = [
    { key: 'stats' as const, label: 'Overview', iconName: 'bar-chart' as const },
    { key: 'creators' as const, label: 'Creators', iconName: 'users' as const, badge: stats.pendingCreators },
    { key: 'businesses' as const, label: 'Businesses', iconName: 'store' as const, badge: stats.pendingBusinesses },
    { key: 'offers' as const, label: 'Offers', iconName: 'bag' as const },
    { key: 'claims' as const, label: 'Claims', iconName: 'clipboard-list' as const },
    { key: 'settings' as const, label: 'Settings', iconName: 'settings' as const },
  ];

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-[#F7F6F3] border-b border-[var(--faint)]" style={{ padding: '20px 20px 14px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Logo size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--mid)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>Admin Dashboard</p>
              </div>
            </div>
            <button onClick={signOut} className="p-2 rounded-[12px] hover:bg-[var(--bg)] transition-colors">
              <DoodleIcon name="logout" size={18} className="text-[var(--soft)]" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-[#F7F6F3] border-b border-[var(--faint)] overflow-x-auto">
          {tabData.map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-base font-semibold whitespace-nowrap transition-all relative ${
                view === tab.key ? 'text-[var(--near-black)]' : 'text-[var(--soft)] hover:text-[var(--mid)]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <div className="relative">
                <DoodleIcon name={tab.iconName} size={16} />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[var(--terra)] text-[#EDE8DC] text-[12px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[var(--terra)] rounded-full" />}
            </button>
          ))}
        </div>

        <div className="p-6">
          {fetchError && (
            <div className="mb-4 p-3 rounded-[12px] bg-[var(--terra-10)] text-[15px] text-[var(--terra)] font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {fetchError}
            </div>
          )}
          {actionFeedback && (
            <div className={`mb-4 p-3 rounded-[12px] text-[15px] font-medium ${actionFeedback.type === 'error' ? 'bg-[var(--terra-10)] text-[var(--terra)]' : 'bg-[rgba(44,36,32,0.06)] text-[var(--forest)]'}`} style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {actionFeedback.text}
            </div>
          )}
          {/* STATS */}
          {view === 'stats' && (
            <div className="space-y-4">
              {(stats.pendingCreators > 0 || stats.pendingBusinesses > 0) && (
                <div className="bg-[var(--terra-10)] rounded-[18px] p-5">
                  <h3 className="text-base text-[var(--near-black)] mb-3 flex items-center gap-2" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.025em' }}><DoodleIcon name="alert-triangle" size={16} className="text-[var(--terra)]" /> Pending Approvals</h3>
                  <div className="flex gap-4">
                    {stats.pendingCreators > 0 && (
                      <button
                        onClick={() => setView('creators')}
                        className="flex items-center gap-2 px-4 py-2 rounded-[12px] bg-[#EDE8DC] transition-all"
                      >
                        <DoodleIcon name="users" size={24} />
                        <div className="text-left">
                          <p className="text-lg text-[var(--near-black)]" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.025em' }}>{stats.pendingCreators}</p>
                          <p className="text-[12px] text-[var(--mid)] font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>Creator{stats.pendingCreators !== 1 ? 's' : ''}</p>
                        </div>
                      </button>
                    )}
                    {stats.pendingBusinesses > 0 && (
                      <button
                        onClick={() => setView('businesses')}
                        className="flex items-center gap-2 px-4 py-2 rounded-[12px] bg-[#EDE8DC] transition-all"
                      >
                        <DoodleIcon name="store" size={24} />
                        <div className="text-left">
                          <p className="text-lg text-[var(--near-black)]" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.025em' }}>{stats.pendingBusinesses}</p>
                          <p className="text-[12px] text-[var(--mid)] font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>Business{stats.pendingBusinesses !== 1 ? 'es' : ''}</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCardData.map((stat, i) => (
                  <div key={i} className="bg-[#EDE8DC] rounded-[18px] p-6 shadow-[0_2px_12px_rgba(44,36,32,0.08)]">
                    <div className="mb-3"><DoodleIcon name={stat.iconName} size={24} className="text-[var(--mid)]" /></div>
                    <p className="text-3xl text-[var(--near-black)]" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.025em' }}>{stat.value}</p>
                    <p className="text-sm text-[var(--mid)] mt-1 font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CREATORS */}
          {view === 'creators' && (
            <div className="bg-[#EDE8DC] rounded-[18px] shadow-[0_2px_12px_rgba(44,36,32,0.08)] overflow-hidden">
              {creators.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><DoodleIcon name="users" size={32} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'DM Sans', sans-serif" }}>No creators yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#EDE8DC] border-b border-[var(--faint)]">
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Name</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Handle</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Followers</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Code</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Email</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Status</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(44,36,32,0.05)]">
                      {[...creators].sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1)).map((creator) => (
                        <tr key={creator.id} className={`hover:bg-[var(--bg)]/50 transition-colors ${!creator.approved ? 'bg-[var(--terra-5)]' : ''}`}>
                          <td className="px-5 py-3.5 whitespace-nowrap text-base font-medium text-[var(--near-black)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            <span className="mr-2">{creator.name}</span>
                            {creator.level && <LevelBadge level={creator.level} levelName={creator.level_name || 'Newcomer'} size="sm" />}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-base text-[var(--mid)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{creator.instagram_handle}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {creator.follower_count ? (
                              <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-[var(--bg)] text-[var(--near-black)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{creator.follower_count}</span>
                            ) : (
                              <span className="text-sm text-[var(--soft)]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><span className="text-sm font-mono font-bold px-2 py-0.5 rounded bg-[var(--near-black)] text-[#EDE8DC]">{creator.code}</span></td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-base text-[var(--mid)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{creator.email}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><StatusPill status={creator.approved ? 'approved' : 'pending'} type="approval" /></td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!creator.approved ? (
                              <button onClick={() => handleApproveCreator(creator.id, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#EDE8DC] font-semibold text-sm bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                <DoodleIcon name="check" size={12} /> Approve
                              </button>
                            ) : (
                              <button onClick={() => handleApproveCreator(creator.id, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#EDE8DC] font-semibold text-sm bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                <DoodleIcon name="x" size={12} /> Revoke
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
            <div className="bg-[#EDE8DC] rounded-[18px] shadow-[0_2px_12px_rgba(44,36,32,0.08)] overflow-hidden">
              {businesses.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><DoodleIcon name="store" size={32} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'DM Sans', sans-serif" }}>No businesses yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#EDE8DC] border-b border-[var(--faint)]">
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Business</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Slug</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Email</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Status</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(44,36,32,0.05)]">
                      {[...businesses].sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1)).map((business) => (
                        <tr key={business.id} className={`hover:bg-[var(--bg)]/50 transition-colors ${!business.approved ? 'bg-[var(--terra-5)]' : ''}`}>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-[46px] h-[46px] rounded-[12px] bg-[#EDE8DC] flex items-center justify-center flex-shrink-0">
                                <CategoryIcon category={business.category} className="w-5 h-5 text-[var(--mid)]" />
                              </div>
                              <span className="text-base font-medium text-[var(--near-black)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{business.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-base text-[var(--mid)] font-mono">{business.slug}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-base text-[var(--mid)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{business.owner_email}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><StatusPill status={business.approved ? 'approved' : 'pending'} type="approval" /></td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!business.approved ? (
                              <button onClick={() => handleApproveBusiness(business.id, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#EDE8DC] font-semibold text-sm bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                <DoodleIcon name="check" size={12} /> Approve
                              </button>
                            ) : (
                              <button onClick={() => handleApproveBusiness(business.id, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#EDE8DC] font-semibold text-sm bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                <DoodleIcon name="x" size={12} /> Revoke
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
                <div className="text-center py-16"><div className="flex justify-center mb-3"><DoodleIcon name="bag" size={32} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'DM Sans', sans-serif" }}>No offers yet.</p></div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {offers.map((offer) => (
                    <div key={offer.id} className="bg-[#EDE8DC] rounded-[18px] p-5 shadow-[0_2px_12px_rgba(44,36,32,0.08)]">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-[46px] h-[46px] rounded-[12px] bg-[#EDE8DC] flex items-center justify-center flex-shrink-0">
                          <CategoryIcon category={offer.businesses.category} className="w-5 h-5 text-[var(--mid)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base text-[var(--near-black)]" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.025em' }}>{offer.businesses.name}</h3>
                            <StatusPill status={offer.is_live ? 'live' : 'paused'} type="offer" />
                          </div>
                          <p className="text-[var(--mid)] text-base mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>{offer.description}</p>
                          <p className="text-sm text-[var(--soft)] mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Cap: {offer.monthly_cap ? `${offer.monthly_cap}/month` : 'Unlimited'}</p>
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
            <div className="bg-[#EDE8DC] rounded-[18px] shadow-[0_2px_12px_rgba(44,36,32,0.08)] overflow-hidden">
              {claims.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><DoodleIcon name="clipboard-list" size={32} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'DM Sans', sans-serif" }}>No claims yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#EDE8DC] border-b border-[var(--faint)]">
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Creator</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Business</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Claimed</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Status</th>
                        <th className="px-5 py-3 text-left text-[13px] font-semibold text-[var(--mid)] uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(44,36,32,0.05)]">
                      {claims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-[var(--bg)]/50 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap text-base font-medium text-[var(--near-black)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{claim.creators.name}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-[46px] h-[46px] rounded-[12px] bg-[#EDE8DC] flex items-center justify-center flex-shrink-0">
                                <CategoryIcon category={claim.businesses.category} className="w-5 h-5 text-[var(--mid)]" />
                              </div>
                              <span className="text-base text-[var(--mid)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{claim.businesses.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-base text-[var(--mid)]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{new Date(claim.claimed_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <select
                              value={claim.status}
                              onChange={(e) => handleUpdateClaimStatus(claim.id, e.target.value)}
                              className="px-2.5 py-1 rounded-[12px] text-sm font-semibold border border-[var(--faint)] text-[var(--near-black)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)]"
                              style={{ fontFamily: "'DM Sans', sans-serif" }}
                            >
                              <option value="active">Active</option>
                              <option value="redeemed">Redeemed</option>
                              <option value="expired">Expired</option>
                            </select>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {claim.status === 'active' && (
                              <button onClick={() => handleUpdateClaimStatus(claim.id, 'expired')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[#EDE8DC] font-semibold text-sm bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                <DoodleIcon name="x" size={12} /> Expire
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
              <div className="bg-[#EDE8DC] rounded-[18px] shadow-[0_2px_12px_rgba(44,36,32,0.08)] p-6">
                <h2 className="text-lg text-[var(--near-black)] mb-5" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.025em' }}>Change Password</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-base font-semibold text-[var(--near-black)] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      Current Password
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-[50px] border-[1.5px] border-[rgba(44,36,32,0.08)] focus:outline-none focus:border-[var(--near-black)] text-[16px] bg-[#EDE8DC] text-[var(--near-black)] placeholder:text-[#2C2420]/40"
                      placeholder="Enter current password"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="block text-base font-semibold text-[var(--near-black)] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 rounded-[50px] border-[1.5px] border-[rgba(44,36,32,0.08)] focus:outline-none focus:border-[var(--near-black)] text-[16px] bg-[#EDE8DC] text-[var(--near-black)] placeholder:text-[#2C2420]/40"
                      placeholder="Enter new password (min 8 characters)"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-base font-semibold text-[var(--near-black)] mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      Confirm New Password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 rounded-[50px] border-[1.5px] border-[rgba(44,36,32,0.08)] focus:outline-none focus:border-[var(--near-black)] text-[16px] bg-[#EDE8DC] text-[var(--near-black)] placeholder:text-[#2C2420]/40"
                      placeholder="Confirm new password"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    />
                  </div>
                  {passwordMessage && (
                    <div
                      className={`p-3 rounded-[12px] text-[15px] font-medium ${
                        passwordMessage.type === 'success'
                          ? 'bg-[rgba(44,36,32,0.06)] text-[var(--forest)]'
                          : 'bg-[var(--terra-10)] text-[var(--terra)]'
                      }`}
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {passwordMessage.text}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 bg-[var(--terra)] text-[#EDE8DC] rounded-full font-semibold text-base hover:bg-[var(--terra-hover)] transition-colors"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
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
