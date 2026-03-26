import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertTriangle, BarChart, Check, ClipboardList, Clapperboard, LogOut, Plus, Settings, Store, Tag, Upload, Users, X } from 'lucide-react';
import { CategoryIcon } from '../lib/categories';
import { Logo } from './Logo';
import LevelBadge from './LevelBadge';
import { sendCreatorApprovedEmail, sendBusinessApprovedEmail, sendCreatorDeniedEmail, sendBusinessDeniedEmail } from '../lib/notifications';

function StatusPill({ status, type = 'claim' }: { status: string; type?: 'claim' | 'approval' | 'offer' }) {
  const badgeBase = "inline-flex items-center gap-1 text-[11px] rounded-[999px]" as const;
  const badgeStyle: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, padding: '3px 10px' };
  if (type === 'approval') {
    return status === 'approved'
      ? <span className={`${badgeBase} bg-[var(--card)] text-[var(--ink)]`} style={badgeStyle}><Check size={12} strokeWidth={1.5} /> Approved</span>
      : <span className={`${badgeBase} bg-[var(--terra)] text-white`} style={badgeStyle}>Pending</span>;
  }
  if (type === 'offer') {
    return status === 'live'
      ? <span className={`${badgeBase} bg-[var(--card)] text-[var(--ink)]`} style={badgeStyle}><Check size={12} strokeWidth={1.5} /> Live</span>
      : <span className={`${badgeBase} bg-[var(--card)] text-[var(--ink-35)]`} style={badgeStyle}>Paused</span>;
  }
  const styles: Record<string, string> = {
    active: 'bg-[var(--terra)] text-white',
    redeemed: 'bg-[var(--card)] text-[var(--ink)]',
    expired: 'bg-[var(--terra-10)] text-[var(--terra)]',
  };
  return <span className={`${badgeBase} ${styles[status] || 'bg-[var(--card)] text-[var(--ink-35)]'}`} style={badgeStyle}>{status}</span>;
}

interface Creator { id: string; name: string; instagram_handle: string; follower_count: string | null; email: string; code: string; approved: boolean; created_at: string; level?: number; level_name?: string; }
interface Business { id: string; name: string; slug: string; owner_email: string; category: string; region: string; approved: boolean; is_live: boolean; instagram_handle: string | null; created_at: string; }
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
  const [toast, setToast] = useState<string | null>(null);

  // Add Business modal state
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [bizName, setBizName] = useState('');
  const [bizSlug, setBizSlug] = useState('');
  const [bizSlugManual, setBizSlugManual] = useState(false);
  const [bizEmail, setBizEmail] = useState('');
  const [bizCategory, setBizCategory] = useState('');
  const [bizRegion, setBizRegion] = useState('bury-st-edmunds');
  const [bizAddress, setBizAddress] = useState('');
  const [bizLat, setBizLat] = useState('');
  const [bizLng, setBizLng] = useState('');
  const [bizInstagram, setBizInstagram] = useState('');
  const [bizBio, setBizBio] = useState('');
  const [bizLogoFile, setBizLogoFile] = useState<File | null>(null);
  const [bizLogoPreview, setBizLogoPreview] = useState<string | null>(null);
  const [bizApproved, setBizApproved] = useState(true);
  const [bizIsLive, setBizIsLive] = useState(false);
  const [bizOnboardingComplete, setBizOnboardingComplete] = useState(true);
  const [bizSubmitting, setBizSubmitting] = useState(false);
  const [bizErrors, setBizErrors] = useState<Record<string, string>>({});
  const [inlineUpdating, setInlineUpdating] = useState<string | null>(null);

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

  const handleInlineBusinessUpdate = async (id: string, field: string, value: any) => {
    setInlineUpdating(`${id}-${field}`);
    const { error } = await supabase.from('businesses').update({ [field]: value }).eq('id', id);
    setInlineUpdating(null);
    if (error) {
      setActionFeedback({ type: 'error', text: `Failed to update ${field}: ${error.message}` });
    } else {
      setBusinesses(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    }
  };

  const CATEGORIES = ['Food & Drink', 'Hair & Beauty', 'Health & Fitness', 'Retail', 'Cafe & Coffee', 'Arts & Entertainment', 'Wellness & Spa', 'Pets', 'Education', 'Services'];
  const REGIONS = ['bury-st-edmunds', 'ipswich', 'norwich', 'cambridge'];

  const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const resetBizForm = () => {
    setBizName(''); setBizSlug(''); setBizSlugManual(false); setBizEmail('');
    setBizCategory(''); setBizRegion('bury-st-edmunds'); setBizAddress('');
    setBizLat(''); setBizLng(''); setBizInstagram(''); setBizBio('');
    setBizLogoFile(null); setBizLogoPreview(null); setBizApproved(true);
    setBizIsLive(false); setBizOnboardingComplete(true); setBizErrors({});
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!bizName.trim()) errors.name = 'Business name is required';
    if (!bizSlug.trim()) errors.slug = 'Slug is required';
    if (!bizEmail.trim()) errors.email = 'Owner email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bizEmail)) errors.email = 'Invalid email format';
    if (!bizCategory) errors.category = 'Category is required';

    if (Object.keys(errors).length > 0) { setBizErrors(errors); return; }

    setBizSubmitting(true);
    setBizErrors({});

    // Check slug uniqueness
    const { data: existingSlug } = await supabase.from('businesses').select('id').eq('slug', bizSlug.trim()).limit(1);
    if (existingSlug && existingSlug.length > 0) {
      setBizErrors({ slug: 'This slug is already taken' });
      setBizSubmitting(false);
      return;
    }

    // Upload logo if provided
    let logoUrl: string | null = null;
    if (bizLogoFile) {
      const ext = bizLogoFile.name.split('.').pop();
      const path = `business-logos/${Date.now()}-${bizSlug}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, bizLogoFile);
      if (uploadError) {
        setBizErrors({ logo: 'Failed to upload logo: ' + uploadError.message });
        setBizSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from('businesses').insert({
      name: bizName.trim(),
      slug: bizSlug.trim(),
      owner_email: bizEmail.trim(),
      category: bizCategory,
      region: bizRegion,
      address: bizAddress.trim() || null,
      latitude: bizLat ? parseFloat(bizLat) : null,
      longitude: bizLng ? parseFloat(bizLng) : null,
      instagram_handle: bizInstagram.trim().replace(/^@/, '') || null,
      bio: bizBio.trim() || null,
      logo_url: logoUrl,
      approved: bizApproved,
      is_live: bizIsLive,
      onboarding_complete: bizOnboardingComplete,
      onboarding_step: bizOnboardingComplete ? 4 : 0,
    });

    setBizSubmitting(false);
    if (error) {
      setBizErrors({ submit: error.message });
      return;
    }

    showToast('Business created');
    setShowAddBusiness(false);
    resetBizForm();
    fetchAll();
  };

  const statCardData = [
    { Icon: Users, value: stats.totalCreators, label: 'Total Creators' },
    { Icon: Store, value: stats.totalBusinesses, label: 'Total Businesses' },
    { Icon: ClipboardList, value: stats.totalClaims, label: 'Claims This Month' },
    { Icon: Clapperboard, value: stats.totalReels, label: 'Reels Posted' },
  ];

  const tabData = [
    { key: 'stats' as const, label: 'Overview', Icon: BarChart },
    { key: 'creators' as const, label: 'Creators', Icon: Users, badge: stats.pendingCreators },
    { key: 'businesses' as const, label: 'Businesses', Icon: Store, badge: stats.pendingBusinesses },
    { key: 'offers' as const, label: 'Offers', Icon: Tag },
    { key: 'claims' as const, label: 'Claims', Icon: ClipboardList },
    { key: 'settings' as const, label: 'Settings', Icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[var(--shell)]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-[var(--shell)] border-b border-[var(--faint)]" style={{ padding: '20px 20px 14px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Logo size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--mid)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Admin Dashboard</p>
              </div>
            </div>
            <button onClick={signOut} className="p-2 rounded-[12px] hover:bg-[var(--bg)] transition-colors">
              <LogOut size={18} strokeWidth={1.5} className="text-[var(--soft)]" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 bg-[var(--shell)] overflow-x-auto" style={{ padding: '12px 20px' }}>
          {tabData.map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 whitespace-nowrap transition-all rounded-[999px] ${
                view === tab.key
                  ? 'bg-[var(--terra)] text-white border-[1.5px] border-[var(--terra)]'
                  : 'bg-[var(--card)] text-[var(--ink-35)] border-[1.5px] border-[var(--ink-08)] hover:border-[var(--ink-15)]'
              }`}
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: view === tab.key ? 700 : 600, fontSize: '14px' }}
            >
              <div className="relative">
                <tab.Icon size={16} strokeWidth={1.5} />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[var(--terra)] text-white text-[10px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {fetchError && (
            <div className="mb-4 p-3 rounded-[12px] bg-[var(--terra-10)] text-[15px] text-[var(--terra)] font-medium" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {fetchError}
            </div>
          )}
          {actionFeedback && (
            <div className={`mb-4 p-3 rounded-[12px] text-[15px] font-medium ${actionFeedback.type === 'error' ? 'bg-[var(--terra-10)] text-[var(--terra)]' : 'bg-[rgba(34,34,34,0.06)] text-[var(--ink)]'}`} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {actionFeedback.text}
            </div>
          )}
          {/* STATS */}
          {view === 'stats' && (
            <div className="space-y-4">
              {(stats.pendingCreators > 0 || stats.pendingBusinesses > 0) && (
                <div className="bg-[var(--terra-10)] rounded-[18px] p-5">
                  <h3 className="text-base text-[var(--near-black)] mb-3 flex items-center gap-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}><AlertTriangle size={16} strokeWidth={1.5} className="text-[var(--terra)]" /> Pending Approvals</h3>
                  <div className="flex gap-4">
                    {stats.pendingCreators > 0 && (
                      <button
                        onClick={() => setView('creators')}
                        className="flex items-center gap-2 px-4 py-2 rounded-[12px] bg-[var(--card)] transition-all"
                      >
                        <Users size={24} strokeWidth={1.5} />
                        <div className="text-left">
                          <p className="text-lg text-[var(--near-black)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>{stats.pendingCreators}</p>
                          <p className="text-[12px] text-[var(--mid)] font-medium" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Creator{stats.pendingCreators !== 1 ? 's' : ''}</p>
                        </div>
                      </button>
                    )}
                    {stats.pendingBusinesses > 0 && (
                      <button
                        onClick={() => setView('businesses')}
                        className="flex items-center gap-2 px-4 py-2 rounded-[12px] bg-[var(--card)] transition-all"
                      >
                        <Store size={24} strokeWidth={1.5} />
                        <div className="text-left">
                          <p className="text-lg text-[var(--near-black)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>{stats.pendingBusinesses}</p>
                          <p className="text-[12px] text-[var(--mid)] font-medium" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Business{stats.pendingBusinesses !== 1 ? 'es' : ''}</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCardData.map((stat, i) => (
                  <div key={i} className="bg-[var(--card)] rounded-[16px] p-6 border border-[var(--ink-08)]" style={{ boxShadow: 'var(--shadow-md)' }}>
                    <div className="mb-3"><stat.Icon size={24} strokeWidth={1.5} className="text-[var(--ink-60)]" /></div>
                    <p className="text-[24px] text-[var(--terra)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>{stat.value}</p>
                    <p className="text-[12px] text-[var(--ink-60)] mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CREATORS */}
          {view === 'creators' && (
            <div className="bg-[var(--card)] rounded-[16px] border border-[var(--ink-08)] overflow-hidden">
              {creators.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><Users size={32} strokeWidth={1.5} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No creators yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--card)] border-b border-[var(--ink-08)]">
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Name</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Handle</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Followers</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Code</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Email</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Status</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ink-08)]">
                      {[...creators].sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1)).map((creator) => (
                        <tr key={creator.id} className={`hover:bg-[var(--bg)]/50 transition-colors ${!creator.approved ? 'bg-[var(--terra-5)]' : ''}`}>
                          <td className="px-5 py-3.5 whitespace-nowrap text-[14px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>
                            <span className="mr-2">{creator.name}</span>
                            {creator.level && <LevelBadge level={creator.level} levelName={creator.level_name || 'Newcomer'} size="sm" />}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-[14px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{creator.instagram_handle}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {creator.follower_count ? (
                              <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-[var(--bg)] text-[var(--near-black)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{creator.follower_count}</span>
                            ) : (
                              <span className="text-sm text-[var(--soft)]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><span className="text-sm font-mono font-bold px-2 py-0.5 rounded bg-[var(--near-black)] text-[var(--card)]">{creator.code}</span></td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-[14px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{creator.email}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><StatusPill status={creator.approved ? 'approved' : 'pending'} type="approval" /></td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!creator.approved ? (
                              <button onClick={() => handleApproveCreator(creator.id, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-white font-bold text-[15px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
                                <Check size={12} strokeWidth={1.5} /> Approve
                              </button>
                            ) : (
                              <button onClick={() => handleApproveCreator(creator.id, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-white font-bold text-[15px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
                                <X size={12} strokeWidth={1.5} /> Revoke
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
            <>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { resetBizForm(); setShowAddBusiness(true); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[999px] text-white font-bold text-[15px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}
              >
                <Plus size={16} strokeWidth={2} /> Add business
              </button>
            </div>
            <div className="bg-[var(--card)] rounded-[16px] border border-[var(--ink-08)] overflow-hidden">
              {businesses.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><Store size={32} strokeWidth={1.5} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No businesses yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--card)] border-b border-[var(--ink-08)]">
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Business</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Slug</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Email</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Live</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Category</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Region</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Status</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ink-08)]">
                      {[...businesses].sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1)).map((business) => (
                        <tr key={business.id} className={`hover:bg-[var(--bg)]/50 transition-colors ${!business.approved ? 'bg-[var(--terra-5)]' : ''}`}>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-[46px] h-[46px] rounded-[12px] bg-[var(--card)] flex items-center justify-center flex-shrink-0">
                                <CategoryIcon category={business.category} className="w-5 h-5 text-[var(--mid)]" />
                              </div>
                              <span className="text-base font-medium text-[var(--near-black)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{business.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-base text-[var(--mid)] font-mono">{business.slug}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-[14px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{business.owner_email}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <button
                              onClick={() => handleInlineBusinessUpdate(business.id, 'is_live', !business.is_live)}
                              disabled={inlineUpdating === `${business.id}-is_live`}
                              className="relative"
                            >
                              {inlineUpdating === `${business.id}-is_live` ? (
                                <div className="w-[44px] h-[26px] rounded-full bg-[var(--ink-08)] flex items-center justify-center">
                                  <div className="w-4 h-4 border-2 border-[var(--ink-35)] border-t-transparent rounded-full animate-spin" />
                                </div>
                              ) : (
                                <div className={`w-[44px] h-[26px] rounded-full transition-all flex items-center ${business.is_live ? 'bg-[var(--terra)] justify-end' : 'bg-[var(--ink-08)] justify-start'}`}>
                                  <div className="w-[22px] h-[22px] rounded-full bg-white mx-[2px] shadow-sm" />
                                </div>
                              )}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <select
                              value={business.category}
                              onChange={e => handleInlineBusinessUpdate(business.id, 'category', e.target.value)}
                              disabled={inlineUpdating === `${business.id}-category`}
                              className="px-2.5 py-1.5 rounded-[12px] text-[13px] font-semibold border border-[var(--ink-08)] text-[var(--ink)] bg-[var(--shell)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)]"
                              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            >
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <select
                              value={business.region || 'bury-st-edmunds'}
                              onChange={e => handleInlineBusinessUpdate(business.id, 'region', e.target.value)}
                              disabled={inlineUpdating === `${business.id}-region`}
                              className="px-2.5 py-1.5 rounded-[12px] text-[13px] font-semibold border border-[var(--ink-08)] text-[var(--ink)] bg-[var(--shell)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)]"
                              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            >
                              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap"><StatusPill status={business.approved ? 'approved' : 'pending'} type="approval" /></td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!business.approved ? (
                              <button onClick={() => handleApproveBusiness(business.id, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-white font-bold text-[15px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
                                <Check size={12} strokeWidth={1.5} /> Approve
                              </button>
                            ) : (
                              <button onClick={() => handleApproveBusiness(business.id, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-white font-bold text-[15px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
                                <X size={12} strokeWidth={1.5} /> Revoke
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
            </>
          )}

          {/* OFFERS */}
          {view === 'offers' && (
            <>
              {offers.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><Tag size={32} strokeWidth={1.5} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No offers yet.</p></div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {offers.map((offer) => (
                    <div key={offer.id} className="bg-[var(--card)] rounded-[18px] p-5 shadow-[0_2px_12px_rgba(34,34,34,0.08)]">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-[46px] h-[46px] rounded-[12px] bg-[var(--card)] flex items-center justify-center flex-shrink-0">
                          <CategoryIcon category={offer.businesses.category} className="w-5 h-5 text-[var(--mid)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base text-[var(--near-black)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>{offer.businesses.name}</h3>
                            <StatusPill status={offer.is_live ? 'live' : 'paused'} type="offer" />
                          </div>
                          <p className="text-[var(--mid)] text-base mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{offer.description}</p>
                          <p className="text-sm text-[var(--soft)] mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cap: {offer.monthly_cap ? `${offer.monthly_cap}/month` : 'Unlimited'}</p>
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
            <div className="bg-[var(--card)] rounded-[16px] border border-[var(--ink-08)] overflow-hidden">
              {claims.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><ClipboardList size={32} strokeWidth={1.5} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>No claims yet.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--card)] border-b border-[var(--ink-08)]">
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Creator</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Business</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Claimed</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Status</th>
                        <th className="px-5 py-3 text-left text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ink-08)]">
                      {claims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-[var(--bg)]/50 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap text-[14px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{claim.creators.name}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-[46px] h-[46px] rounded-[12px] bg-[var(--card)] flex items-center justify-center flex-shrink-0">
                                <CategoryIcon category={claim.businesses.category} className="w-5 h-5 text-[var(--mid)]" />
                              </div>
                              <span className="text-base text-[var(--mid)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{claim.businesses.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-[14px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{new Date(claim.claimed_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <select
                              value={claim.status}
                              onChange={(e) => handleUpdateClaimStatus(claim.id, e.target.value)}
                              className="px-2.5 py-1 rounded-[12px] text-sm font-semibold border border-[var(--faint)] text-[var(--near-black)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)]"
                              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            >
                              <option value="active">Active</option>
                              <option value="redeemed">Redeemed</option>
                              <option value="expired">Expired</option>
                            </select>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {claim.status === 'active' && (
                              <button onClick={() => handleUpdateClaimStatus(claim.id, 'expired')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-white font-bold text-[15px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>
                                <X size={12} strokeWidth={1.5} /> Expire
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
              <div className="bg-[var(--card)] rounded-[18px] shadow-[0_2px_12px_rgba(34,34,34,0.08)] p-6">
                <h2 className="text-lg text-[var(--near-black)] mb-5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>Change Password</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-base font-semibold text-[var(--near-black)] mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Current Password
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-[50px] border-[1.5px] border-[rgba(34,34,34,0.08)] focus:outline-none focus:border-[var(--near-black)] text-[16px] bg-[var(--card)] text-[var(--near-black)] placeholder:text-[var(--ink)]/40"
                      placeholder="Enter current password"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="block text-base font-semibold text-[var(--near-black)] mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 rounded-[50px] border-[1.5px] border-[rgba(34,34,34,0.08)] focus:outline-none focus:border-[var(--near-black)] text-[16px] bg-[var(--card)] text-[var(--near-black)] placeholder:text-[var(--ink)]/40"
                      placeholder="Enter new password (min 8 characters)"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-base font-semibold text-[var(--near-black)] mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      Confirm New Password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-2.5 rounded-[50px] border-[1.5px] border-[rgba(34,34,34,0.08)] focus:outline-none focus:border-[var(--near-black)] text-[16px] bg-[var(--card)] text-[var(--near-black)] placeholder:text-[var(--ink)]/40"
                      placeholder="Confirm new password"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    />
                  </div>
                  {passwordMessage && (
                    <div
                      className={`p-3 rounded-[12px] text-[15px] font-medium ${
                        passwordMessage.type === 'success'
                          ? 'bg-[rgba(34,34,34,0.06)] text-[var(--ink)]'
                          : 'bg-[var(--terra-10)] text-[var(--terra)]'
                      }`}
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {passwordMessage.text}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 bg-[var(--terra)] text-white rounded-[999px] font-bold text-[15px] hover:bg-[var(--terra-hover)] transition-colors"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}
                  >
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-[999px] bg-[var(--ink)] text-white text-[15px] font-semibold shadow-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {toast}
        </div>
      )}

      {/* Add Business Modal */}
      {showAddBusiness && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" style={{ background: 'rgba(34,34,34,0.45)' }} onClick={() => setShowAddBusiness(false)}>
          <div className="w-full max-w-[560px] my-8 mx-4 rounded-[24px] p-7" style={{ background: 'var(--shell)', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[20px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>Add business</h2>
              <button onClick={() => setShowAddBusiness(false)} className="p-2 rounded-[12px] hover:bg-[var(--card)] transition-colors">
                <X size={20} strokeWidth={1.5} className="text-[var(--ink-35)]" />
              </button>
            </div>

            <form onSubmit={handleCreateBusiness} className="space-y-5">
              {/* BASIC INFO */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>Basic info</p>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Business name <span className="text-[var(--terra)]">*</span></label>
                <input
                  value={bizName}
                  onChange={e => { setBizName(e.target.value); if (!bizSlugManual) setBizSlug(slugify(e.target.value)); }}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                  placeholder="e.g. Wildcraft Coffee"
                />
                {bizErrors.name && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{bizErrors.name}</p>}
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Slug <span className="text-[var(--terra)]">*</span></label>
                <input
                  value={bizSlug}
                  onChange={e => { setBizSlug(e.target.value); setBizSlugManual(true); }}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] font-mono focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                  placeholder="wildcraft-coffee"
                />
                {bizErrors.slug && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{bizErrors.slug}</p>}
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Owner email <span className="text-[var(--terra)]">*</span></label>
                <input
                  type="email"
                  value={bizEmail}
                  onChange={e => setBizEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                  placeholder="hello@business.com"
                />
                {bizErrors.email && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{bizErrors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Category <span className="text-[var(--terra)]">*</span></label>
                  <select
                    value={bizCategory}
                    onChange={e => setBizCategory(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                  >
                    <option value="">Select…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {bizErrors.category && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{bizErrors.category}</p>}
                </div>
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Region</label>
                  <select
                    value={bizRegion}
                    onChange={e => setBizRegion(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                  >
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* LOCATION */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)] pt-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>Location</p>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Address</label>
                <input
                  value={bizAddress}
                  onChange={e => setBizAddress(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                  placeholder="123 High Street, Bury St Edmunds"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={bizLat}
                    onChange={e => setBizLat(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                    placeholder="52.2434"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={bizLng}
                    onChange={e => setBizLng(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                    placeholder="0.7137"
                  />
                </div>
              </div>

              {/* PROFILE */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)] pt-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>Profile</p>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Instagram handle</label>
                <input
                  value={bizInstagram}
                  onChange={e => setBizInstagram(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                  placeholder="@wildcraftcoffee"
                />
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Bio <span className="text-[var(--ink-35)]">(max 200 chars)</span></label>
                <textarea
                  value={bizBio}
                  onChange={e => { if (e.target.value.length <= 200) setBizBio(e.target.value); }}
                  rows={3}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] resize-none focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}
                  placeholder="A short description of the business…"
                />
                <p className="text-right text-[12px] text-[var(--ink-35)] mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{bizBio.length}/200</p>
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>Logo</label>
                {bizLogoPreview ? (
                  <div className="flex items-center gap-3">
                    <img src={bizLogoPreview} alt="Logo preview" className="w-14 h-14 rounded-[12px] object-cover" />
                    <button type="button" onClick={() => { setBizLogoFile(null); setBizLogoPreview(null); }} className="text-[13px] text-[var(--terra)] font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Remove</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-[12px] border-[1.5px] border-dashed border-[var(--ink-15)] bg-[var(--card)] cursor-pointer hover:border-[var(--ink-35)] transition-colors">
                    <Upload size={20} strokeWidth={1.5} className="text-[var(--ink-35)]" />
                    <span className="text-[14px] text-[var(--ink-35)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>Upload photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setBizLogoFile(file);
                        setBizLogoPreview(URL.createObjectURL(file));
                      }
                    }} />
                  </label>
                )}
                {bizErrors.logo && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{bizErrors.logo}</p>}
              </div>

              {/* STATUS */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)] pt-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}>Status</p>

              <div className="space-y-3">
                {[
                  { label: 'Approved', value: bizApproved, set: setBizApproved },
                  { label: 'Is live', value: bizIsLive, set: setBizIsLive },
                  { label: 'Onboarding complete', value: bizOnboardingComplete, set: setBizOnboardingComplete },
                ].map(toggle => (
                  <button
                    key={toggle.label}
                    type="button"
                    onClick={() => toggle.set(!toggle.value)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-[12px] bg-[var(--card)] border border-[var(--ink-08)]"
                  >
                    <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>{toggle.label}</span>
                    <div className={`w-[44px] h-[26px] rounded-full transition-all flex items-center ${toggle.value ? 'bg-[var(--terra)] justify-end' : 'bg-[var(--ink-08)] justify-start'}`}>
                      <div className="w-[22px] h-[22px] rounded-full bg-white mx-[2px] shadow-sm" />
                    </div>
                  </button>
                ))}
              </div>

              {bizErrors.submit && <p className="text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>{bizErrors.submit}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBusiness(false)}
                  className="flex-1 px-4 py-3 rounded-[999px] text-[15px] text-[var(--ink-60)] border-[1.5px] border-[var(--ink-08)] hover:border-[var(--ink-15)] transition-colors"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bizSubmitting}
                  className="flex-1 px-4 py-3 rounded-[999px] text-[15px] text-white bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors disabled:opacity-50"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 }}
                >
                  {bizSubmitting ? 'Creating…' : 'Create business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
