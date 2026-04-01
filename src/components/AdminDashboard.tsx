import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import { AlertTriangle, BarChart, Check, ChevronLeft, ChevronRight, ClipboardList, Clapperboard, LogOut, Pencil, Plus, Settings, Store, Tag, Upload, Users, X } from 'lucide-react';
import { CategoryIcon } from '../lib/categories';
import { Logo } from './Logo';
import { sendCreatorApprovedEmail, sendBusinessApprovedEmail, sendCreatorDeniedEmail, sendBusinessDeniedEmail } from '../lib/notifications';

function StatusPill({ status, type = 'claim' }: { status: string; type?: 'claim' | 'approval' | 'offer' }) {
  const badgeBase = "inline-flex items-center gap-1 text-[11px] rounded-[999px]" as const;
  const badgeStyle: React.CSSProperties = { fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, padding: '3px 10px' };
  if (type === 'approval') {
    if (status === 'approved') return <span className={`${badgeBase} bg-[var(--card)] text-[var(--ink)]`} style={badgeStyle}><Check size={12} strokeWidth={1.5} /> Approved</span>;
    if (status === 'disapproved') return <span className={`${badgeBase} bg-[var(--ink-08)] text-[var(--ink-60)]`} style={badgeStyle}><X size={12} strokeWidth={1.5} /> Disapproved</span>;
    return <span className={`${badgeBase} bg-[var(--terra)] text-white`} style={badgeStyle}>Pending</span>;
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

interface Creator { id: string; name: string; instagram_handle: string; follower_count: string | null; email: string; code: string; approved: boolean; disapproved: boolean; created_at: string; }
interface Business { id: string; name: string; slug: string; owner_email: string; category: string; region: string; approved: boolean; disapproved: boolean; is_live: boolean; instagram_handle: string | null; created_at: string; address?: string | null; bio?: string | null; logo_url?: string | null; onboarding_complete?: boolean; }
interface OfferWithBusiness { id: string; business_id: string; description: string; offer_type: string | null; offer_item: string | null; generated_title: string | null; content_type: string | null; specific_ask: string | null; offer_photo_url: string | null; monthly_cap: number | null; is_live: boolean; businesses: { name: string; category: string }; }
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

  const PAGE_SIZE = 20;
  const [creatorsPage, setCreatorsPage] = useState(0);
  const [businessesPage, setBusinessesPage] = useState(0);

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
  const [editingBusinessId, setEditingBusinessId] = useState<string | null>(null);

  // Add Offer modal state
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [offerBusinessId, setOfferBusinessId] = useState('');
  const [offerType, setOfferType] = useState('');
  const [offerItem, setOfferItem] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerTitleManual, setOfferTitleManual] = useState(false);
  const [offerDesc, setOfferDesc] = useState('');
  const [offerMonthlyCap, setOfferMonthlyCap] = useState('');
  const [offerSlots, setOfferSlots] = useState('4');
  const [offerSpecificAsk, setOfferSpecificAsk] = useState('');
  const [offerPhotoFile, setOfferPhotoFile] = useState<File | null>(null);
  const [offerPhotoPreview, setOfferPhotoPreview] = useState<string | null>(null);
  const [offerContentType, setOfferContentType] = useState('reel');
  const [offerIsLive, setOfferIsLive] = useState(false);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);

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
    setCreatorsPage(0);
    setBusinessesPage(0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [creatorsData, businessesData, offersData, claimsData] = await Promise.all([
      supabase.from('creators').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('businesses').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('offers').select('*, businesses(name, category)').order('created_at', { ascending: false }).limit(500),
      supabase.from('claims').select('*, creators(name), businesses(name, category), offers(generated_title, description)').order('claimed_at', { ascending: false }).limit(500)
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

  const handleApproveCreator = async (id: string) => {
    try {
      setActionFeedback(null);
      const { error } = await supabase.from('creators').update({ approved: true, disapproved: false }).eq('id', id);
      if (error) throw error;
      setActionFeedback({ type: 'success', text: 'Creator approved successfully.' });
      sendCreatorApprovedEmail(id).catch(() => {});
      fetchAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to update creator.' });
    }
  };
  const handleDisapproveCreator = async (id: string) => {
    try {
      setActionFeedback(null);
      const { error } = await supabase.from('creators').update({ approved: false, disapproved: true }).eq('id', id);
      if (error) throw error;
      setActionFeedback({ type: 'success', text: 'Creator disapproved successfully.' });
      sendCreatorDeniedEmail(id).catch(() => {});
      fetchAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to update creator.' });
    }
  };
  const handleRevokeCreator = async (id: string) => {
    try {
      setActionFeedback(null);
      const { error } = await supabase.from('creators').update({ approved: false, disapproved: false }).eq('id', id);
      if (error) throw error;
      setActionFeedback({ type: 'success', text: 'Creator approval revoked successfully.' });
      sendCreatorDeniedEmail(id).catch(() => {});
      fetchAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to update creator.' });
    }
  };
  const handleApproveBusiness = async (id: string) => {
    try {
      setActionFeedback(null);
      const { error } = await supabase.from('businesses').update({ approved: true, disapproved: false }).eq('id', id);
      if (error) throw error;
      setActionFeedback({ type: 'success', text: 'Business approved successfully.' });
      sendBusinessApprovedEmail(id).catch(() => {});
      fetchAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to update business.' });
    }
  };
  const handleDisapproveBusiness = async (id: string) => {
    try {
      setActionFeedback(null);
      const { error } = await supabase.from('businesses').update({ approved: false, disapproved: true }).eq('id', id);
      if (error) throw error;
      setActionFeedback({ type: 'success', text: 'Business disapproved successfully.' });
      sendBusinessDeniedEmail(id).catch(() => {});
      fetchAll();
    } catch (err: any) {
      setActionFeedback({ type: 'error', text: err.message || 'Failed to update business.' });
    }
  };
  const handleRevokeBusiness = async (id: string) => {
    try {
      setActionFeedback(null);
      const { error } = await supabase.from('businesses').update({ approved: false, disapproved: false }).eq('id', id);
      if (error) throw error;
      setActionFeedback({ type: 'success', text: 'Business approval revoked successfully.' });
      sendBusinessDeniedEmail(id).catch(() => {});
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
        setPasswordMessage({ type: 'error', text: friendlyError(error.message) });
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
      setActionFeedback({ type: 'error', text: friendlyError(error.message) });
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
    if (!bizEmail.trim()) errors.email = 'Owner email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bizEmail)) errors.email = 'Invalid email format';
    if (!bizCategory) errors.category = 'Category is required';

    if (Object.keys(errors).length > 0) { setBizErrors(errors); return; }

    setBizSubmitting(true);
    setBizErrors({});

    // Auto-generate slug from name
    const generatedSlug = bizSlug.trim() || slugify(bizName.trim());

    // Check slug uniqueness
    const { data: existingSlug } = await supabase.from('businesses').select('id').eq('slug', generatedSlug).limit(1);
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
        setBizErrors({ logo: friendlyError(uploadError.message) });
        setBizSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from('businesses').insert({
      name: bizName.trim(),
      slug: generatedSlug,
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
      setBizErrors({ submit: friendlyError(error.message) });
      return;
    }

    showToast('Business created');
    setShowAddBusiness(false);
    resetBizForm();
    fetchAll();
  };

  const openEditBusiness = (business: Business) => {
    resetBizForm();
    setEditingBusinessId(business.id);
    setBizName(business.name);
    setBizSlug(business.slug);
    setBizEmail(business.owner_email);
    setBizCategory(business.category);
    setBizRegion(business.region || 'bury-st-edmunds');
    setBizAddress((business as any).address || '');
    setBizInstagram(business.instagram_handle || '');
    setBizBio((business as any).bio || '');
    setBizLogoPreview((business as any).logo_url || null);
    setBizApproved(business.approved);
    setBizIsLive(business.is_live);
    setBizOnboardingComplete((business as any).onboarding_complete ?? true);
    setShowAddBusiness(true);
  };

  const handleUpdateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusinessId) return;
    const errors: Record<string, string> = {};
    if (!bizName.trim()) errors.name = 'Business name is required';
    if (!bizEmail.trim()) errors.email = 'Owner email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bizEmail)) errors.email = 'Invalid email format';
    if (!bizCategory) errors.category = 'Category is required';
    if (Object.keys(errors).length > 0) { setBizErrors(errors); return; }

    setBizSubmitting(true);
    setBizErrors({});

    let logoUrl: string | null | undefined = undefined;
    if (bizLogoFile) {
      const ext = bizLogoFile.name.split('.').pop();
      const path = `business-logos/${Date.now()}-${editingBusinessId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, bizLogoFile);
      if (uploadError) {
        console.error('[EditBusiness] Logo upload error:', uploadError);
        setBizErrors({ logo: `Upload failed: ${uploadError.message}` });
        setBizSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    } else if (!bizLogoPreview) {
      logoUrl = null;
    }

    const updateData: Record<string, any> = {
      name: bizName.trim(),
      owner_email: bizEmail.trim(),
      category: bizCategory,
      region: bizRegion,
      address: bizAddress.trim() || null,
      instagram_handle: bizInstagram.trim().replace(/^@/, '') || null,
      bio: bizBio.trim() || null,
      approved: bizApproved,
      is_live: bizIsLive,
      onboarding_complete: bizOnboardingComplete,
    };
    if (logoUrl !== undefined) updateData.logo_url = logoUrl;

    const { error } = await supabase.from('businesses').update(updateData).eq('id', editingBusinessId);
    setBizSubmitting(false);
    if (error) {
      console.error('[EditBusiness] Update error:', error);
      setBizErrors({ submit: `Save failed: ${error.message}` });
      return;
    }

    showToast('Business updated');
    setShowAddBusiness(false);
    setEditingBusinessId(null);
    resetBizForm();
    fetchAll();
  };

  const handleInlineOfferUpdate = async (id: string, field: string, value: any) => {
    setInlineUpdating(`offer-${id}-${field}`);
    const { error } = await supabase.from('offers').update({ [field]: value }).eq('id', id);
    setInlineUpdating(null);
    if (error) {
      setActionFeedback({ type: 'error', text: friendlyError(error.message) });
    } else {
      setOffers(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o));
    }
  };

  const OFFER_TYPES = ['Free Product', 'Free Service', 'Discount', 'Experience'];

  const resetOfferForm = () => {
    setOfferBusinessId(''); setOfferType(''); setOfferItem(''); setOfferTitle('');
    setOfferTitleManual(false); setOfferDesc(''); setOfferMonthlyCap(''); setOfferSlots('4');
    setOfferSpecificAsk(''); setOfferPhotoFile(null); setOfferPhotoPreview(null);
    setOfferContentType('reel'); setOfferIsLive(false); setOfferErrors({});
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!offerBusinessId) errors.business = 'Business is required';
    if (!offerType) errors.offer_type = 'Collab type is required';
    if (!offerItem.trim()) errors.offer_item = 'This field is required';
    const slotsNum = parseInt(offerSlots);
    if (!offerSlots || isNaN(slotsNum) || slotsNum < 1 || slotsNum > 20) errors.slots = 'Total slots required (1–20)';
    if (offerMonthlyCap && (isNaN(parseInt(offerMonthlyCap)) || parseInt(offerMonthlyCap) < 1)) errors.monthly_cap = 'Must be a positive integer';

    if (Object.keys(errors).length > 0) { setOfferErrors(errors); return; }

    setOfferSubmitting(true);
    setOfferErrors({});

    // Upload photo if provided
    let photoUrl: string | null = null;
    if (offerPhotoFile) {
      const ext = offerPhotoFile.name.split('.').pop();
      const path = `offer-photos/${Date.now()}-${offerBusinessId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, offerPhotoFile);
      if (uploadError) {
        setOfferErrors({ photo: friendlyError(uploadError.message) });
        setOfferSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }

    const generatedTitle = offerTitleManual && offerTitle.trim() ? offerTitle.trim() : `Free ${offerItem.trim()}`;

    const { error } = await supabase.from('offers').insert({
      business_id: offerBusinessId,
      offer_type: offerType,
      offer_item: offerItem.trim(),
      generated_title: generatedTitle,
      description: offerDesc.trim() || generatedTitle,
      monthly_cap: offerMonthlyCap ? parseInt(offerMonthlyCap) : null,
      specific_ask: offerSpecificAsk.trim() || null,
      offer_photo_url: photoUrl,
      content_type: offerContentType,
      is_live: offerIsLive,
    });

    setOfferSubmitting(false);
    if (error) {
      setOfferErrors({ submit: friendlyError(error.message) });
      return;
    }

    showToast('Collab created');
    setShowAddOffer(false);
    resetOfferForm();
    fetchAll();
  };

  const openEditOffer = (offer: OfferWithBusiness) => {
    resetOfferForm();
    setEditingOfferId(offer.id);
    setOfferBusinessId(offer.business_id);
    setOfferType(offer.offer_type || '');
    setOfferItem(offer.offer_item || '');
    setOfferTitle(offer.generated_title || '');
    setOfferTitleManual(true);
    setOfferDesc(offer.description || '');
    setOfferMonthlyCap(offer.monthly_cap != null ? String(offer.monthly_cap) : '');
    setOfferSpecificAsk(offer.specific_ask || '');
    setOfferPhotoPreview(offer.offer_photo_url || null);
    setOfferContentType(offer.content_type || 'reel');
    setOfferIsLive(offer.is_live);
    setShowAddOffer(true);
  };

  const handleUpdateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOfferId) return;
    const errors: Record<string, string> = {};
    if (!offerBusinessId) errors.business = 'Business is required';
    if (!offerType) errors.offer_type = 'Collab type is required';
    if (!offerItem.trim()) errors.offer_item = 'This field is required';
    if (offerMonthlyCap && (isNaN(parseInt(offerMonthlyCap)) || parseInt(offerMonthlyCap) < 1)) errors.monthly_cap = 'Must be a positive integer';
    if (Object.keys(errors).length > 0) { setOfferErrors(errors); return; }

    setOfferSubmitting(true);
    setOfferErrors({});

    let photoUrl: string | null | undefined = undefined;
    if (offerPhotoFile) {
      const ext = offerPhotoFile.name.split('.').pop();
      const path = `offer-photos/${Date.now()}-${offerBusinessId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, offerPhotoFile);
      if (uploadError) {
        console.error('[EditOffer] Photo upload error:', uploadError);
        setOfferErrors({ photo: `Upload failed: ${uploadError.message}` });
        setOfferSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    } else if (!offerPhotoPreview) {
      photoUrl = null;
    }

    const generatedTitle = offerTitle.trim() || `Free ${offerItem.trim()}`;
    const updateData: Record<string, any> = {
      business_id: offerBusinessId,
      offer_type: offerType,
      offer_item: offerItem.trim(),
      generated_title: generatedTitle,
      description: offerDesc.trim() || generatedTitle,
      monthly_cap: offerMonthlyCap ? parseInt(offerMonthlyCap) : null,
      specific_ask: offerSpecificAsk.trim() || null,
      content_type: offerContentType,
      is_live: offerIsLive,
    };
    if (photoUrl !== undefined) updateData.offer_photo_url = photoUrl;

    const { error } = await supabase.from('offers').update(updateData).eq('id', editingOfferId);
    setOfferSubmitting(false);
    if (error) {
      console.error('[EditOffer] Update error:', error);
      setOfferErrors({ submit: `Save failed: ${error.message}` });
      return;
    }

    showToast('Collab updated');
    setShowAddOffer(false);
    setEditingOfferId(null);
    resetOfferForm();
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
    { key: 'offers' as const, label: 'Collabs', Icon: Tag },
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
              <Logo size={24} variant="wordmark" />
              <span className="text-[15px] text-[var(--mid)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500 }}>Admin</span>
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
              style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: view === tab.key ? 700 : 600, fontSize: '14px' }}
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
            <div className="mb-4 p-3 rounded-[12px] bg-[var(--terra-10)] text-[15px] text-[var(--terra)] font-medium" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              {fetchError}
            </div>
          )}
          {actionFeedback && (
            <div className={`mb-4 p-3 rounded-[12px] text-[15px] font-medium ${actionFeedback.type === 'error' ? 'bg-[var(--terra-10)] text-[var(--terra)]' : 'bg-[rgba(34,34,34,0.06)] text-[var(--ink)]'}`} style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
              {actionFeedback.text}
            </div>
          )}
          {/* STATS */}
          {view === 'stats' && (
            <div className="space-y-4">
              {(stats.pendingCreators > 0 || stats.pendingBusinesses > 0) && (
                <div className="bg-[var(--terra-10)] rounded-[18px] p-5">
                  <h3 className="text-[18px] text-[var(--near-black)] mb-3 flex items-center gap-2" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.03em' }}><AlertTriangle size={16} strokeWidth={1.5} className="text-[var(--terra)]" /> Pending Approvals</h3>
                  <div className="flex gap-4">
                    {stats.pendingCreators > 0 && (
                      <button
                        onClick={() => setView('creators')}
                        className="flex items-center gap-2 px-4 py-2 rounded-[12px] bg-[var(--card)] transition-all"
                      >
                        <Users size={24} strokeWidth={1.5} />
                        <div className="text-left">
                          <p className="text-lg text-[var(--near-black)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, letterSpacing: '-0.03em' }}>{stats.pendingCreators}</p>
                          <p className="text-[12px] text-[var(--mid)] font-medium" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Creator{stats.pendingCreators !== 1 ? 's' : ''}</p>
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
                          <p className="text-lg text-[var(--near-black)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, letterSpacing: '-0.03em' }}>{stats.pendingBusinesses}</p>
                          <p className="text-[12px] text-[var(--mid)] font-medium" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Business{stats.pendingBusinesses !== 1 ? 'es' : ''}</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {statCardData.map((stat, i) => (
                  <div key={i} className="bg-[var(--card)] rounded-[16px] p-4 border border-[var(--ink-08)]" style={{ boxShadow: 'var(--shadow-md)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <stat.Icon size={18} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                      <p className="text-[22px] text-[var(--terra)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 800, letterSpacing: '-0.03em' }}>{stat.value}</p>
                    </div>
                    <p className="text-[12px] text-[var(--ink-60)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500 }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CREATORS */}
          {view === 'creators' && (
            <div>
              {creators.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><Users size={32} strokeWidth={1.5} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>No creators yet.</p></div>
              ) : (
                <div className="space-y-3">
                  {[...creators].sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1)).slice(creatorsPage * PAGE_SIZE, (creatorsPage + 1) * PAGE_SIZE).map((creator) => (
                    <div key={creator.id} className={`bg-[var(--card)] rounded-[16px] border border-[var(--ink-08)] p-4 ${!creator.approved ? 'border-[var(--terra)]' : ''}`} style={{ boxShadow: 'var(--shadow-md)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>{creator.name}</span>
                            <StatusPill status={creator.approved ? 'approved' : creator.disapproved ? 'disapproved' : 'pending'} type="approval" />
                          </div>
                          <p className="text-[13px] text-[var(--ink-60)] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>@{creator.instagram_handle}</p>
                          <div className="flex items-center gap-4 mt-2">
                            {creator.follower_count && (
                              <span className="text-[13px] text-[var(--ink-60)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500 }}>{creator.follower_count} followers</span>
                            )}
                            <span className="text-[13px] text-[var(--ink-35)]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{claims.filter(c => c.creators.name === creator.name && c.reel_url).length} reels</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {!creator.approved && !creator.disapproved && (
                            <>
                              <button onClick={() => handleApproveCreator(creator.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-white font-bold text-[13px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>
                                <Check size={12} strokeWidth={1.5} /> Approve
                              </button>
                              <button onClick={() => handleDisapproveCreator(creator.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-[var(--ink-60)] font-bold text-[13px] border-[1.5px] border-[var(--ink-08)] hover:border-[var(--ink-15)] transition-all" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>
                                <X size={12} strokeWidth={1.5} /> Disapprove
                              </button>
                            </>
                          )}
                          {creator.approved && (
                            <button onClick={() => handleRevokeCreator(creator.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-[var(--ink-60)] font-bold text-[13px] border-[1.5px] border-[var(--ink-08)] hover:border-[var(--ink-15)] transition-all" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>
                              <X size={12} strokeWidth={1.5} /> Revoke
                            </button>
                          )}
                          {creator.disapproved && (
                            <button onClick={() => handleApproveCreator(creator.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-white font-bold text-[13px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>
                              <Check size={12} strokeWidth={1.5} /> Approve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {creators.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[13px] text-[var(--mid)]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                    {creatorsPage * PAGE_SIZE + 1}–{Math.min((creatorsPage + 1) * PAGE_SIZE, creators.length)} of {creators.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCreatorsPage(p => p - 1)}
                      disabled={creatorsPage === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-[13px] font-bold border border-[var(--ink-08)] text-[var(--ink)] disabled:opacity-30 hover:bg-[var(--card)] transition-all"
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      <ChevronLeft size={14} strokeWidth={2} /> Previous
                    </button>
                    <button
                      onClick={() => setCreatorsPage(p => p + 1)}
                      disabled={(creatorsPage + 1) * PAGE_SIZE >= creators.length}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-[13px] font-bold border border-[var(--ink-08)] text-[var(--ink)] disabled:opacity-30 hover:bg-[var(--card)] transition-all"
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      Next <ChevronRight size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BUSINESSES */}
          {view === 'businesses' && (
            <>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { resetBizForm(); setEditingBusinessId(null); setShowAddBusiness(true); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[999px] text-white font-bold text-[15px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all"
                style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
              >
                <Plus size={16} strokeWidth={2} /> Add business
              </button>
            </div>
            <div>
              {businesses.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><Store size={32} strokeWidth={1.5} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>No businesses yet.</p></div>
              ) : (
                <div className="space-y-3">
                  {[...businesses].sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1)).slice(businessesPage * PAGE_SIZE, (businessesPage + 1) * PAGE_SIZE).map((business) => (
                    <div key={business.id} className={`bg-[var(--card)] rounded-[16px] border border-[var(--ink-08)] p-4 ${!business.approved ? 'border-[var(--terra)]' : ''}`} style={{ boxShadow: 'var(--shadow-md)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-[42px] h-[42px] rounded-[12px] bg-[var(--shell)] flex items-center justify-center flex-shrink-0">
                            <CategoryIcon category={business.category} className="w-5 h-5 text-[var(--mid)]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>{business.name}</span>
                              <StatusPill status={business.approved ? 'approved' : business.disapproved ? 'disapproved' : 'pending'} type="approval" />
                            </div>
                            <p className="text-[13px] text-[var(--ink-60)] mt-0.5" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{business.region?.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => openEditBusiness(business)}
                            className="p-1.5 rounded-[10px] hover:bg-[var(--shell)] transition-colors"
                          >
                            <Pencil size={14} strokeWidth={1.5} className="text-[var(--ink-35)]" />
                          </button>
                          <button
                            onClick={() => handleInlineBusinessUpdate(business.id, 'is_live', !business.is_live)}
                            disabled={inlineUpdating === `${business.id}-is_live`}
                          >
                            {inlineUpdating === `${business.id}-is_live` ? (
                              <div className="w-[40px] h-[24px] rounded-full bg-[var(--ink-08)] flex items-center justify-center">
                                <div className="w-3.5 h-3.5 border-2 border-[var(--ink-35)] border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : (
                              <div className={`w-[40px] h-[24px] rounded-full transition-all flex items-center ${business.is_live ? 'bg-[var(--terra)] justify-end' : 'bg-[var(--ink-08)] justify-start'}`}>
                                <div className="w-[20px] h-[20px] rounded-full bg-[var(--card)] mx-[2px] shadow-sm" />
                              </div>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <select
                          value={business.category}
                          onChange={e => handleInlineBusinessUpdate(business.id, 'category', e.target.value)}
                          disabled={inlineUpdating === `${business.id}-category`}
                          className="px-2.5 py-1 rounded-[10px] text-[12px] font-semibold border border-[var(--ink-08)] text-[var(--ink)] bg-[var(--shell)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)]"
                          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select
                          value={business.region || 'bury-st-edmunds'}
                          onChange={e => handleInlineBusinessUpdate(business.id, 'region', e.target.value)}
                          disabled={inlineUpdating === `${business.id}-region`}
                          className="px-2.5 py-1 rounded-[10px] text-[12px] font-semibold border border-[var(--ink-08)] text-[var(--ink)] bg-[var(--shell)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)]"
                          style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                        >
                          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {!business.approved && !business.disapproved && (
                          <>
                            <button onClick={() => handleApproveBusiness(business.id)} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-white font-bold text-[13px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>
                              <Check size={12} strokeWidth={1.5} /> Approve
                            </button>
                            <button onClick={() => handleDisapproveBusiness(business.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-[var(--ink-60)] font-bold text-[13px] border-[1.5px] border-[var(--ink-08)] hover:border-[var(--ink-15)] transition-all" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>
                              <X size={12} strokeWidth={1.5} /> Disapprove
                            </button>
                          </>
                        )}
                        {business.approved && (
                          <button onClick={() => handleRevokeBusiness(business.id)} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-[var(--ink-60)] font-bold text-[13px] border-[1.5px] border-[var(--ink-08)] hover:border-[var(--ink-15)] transition-all" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>
                            <X size={12} strokeWidth={1.5} /> Revoke
                          </button>
                        )}
                        {business.disapproved && (
                          <button onClick={() => handleApproveBusiness(business.id)} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-white font-bold text-[13px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>
                            <Check size={12} strokeWidth={1.5} /> Approve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {businesses.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[13px] text-[var(--mid)]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                    {businessesPage * PAGE_SIZE + 1}–{Math.min((businessesPage + 1) * PAGE_SIZE, businesses.length)} of {businesses.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBusinessesPage(p => p - 1)}
                      disabled={businessesPage === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-[13px] font-bold border border-[var(--ink-08)] text-[var(--ink)] disabled:opacity-30 hover:bg-[var(--card)] transition-all"
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      <ChevronLeft size={14} strokeWidth={2} /> Previous
                    </button>
                    <button
                      onClick={() => setBusinessesPage(p => p + 1)}
                      disabled={(businessesPage + 1) * PAGE_SIZE >= businesses.length}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[999px] text-[13px] font-bold border border-[var(--ink-08)] text-[var(--ink)] disabled:opacity-30 hover:bg-[var(--card)] transition-all"
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      Next <ChevronRight size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            </>
          )}

          {/* OFFERS */}
          {view === 'offers' && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => { resetOfferForm(); setEditingOfferId(null); setShowAddOffer(true); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[999px] text-white font-bold text-[15px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
                >
                  <Plus size={16} strokeWidth={2} /> New collab
                </button>
              </div>
              {offers.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><Tag size={32} strokeWidth={1.5} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>No collabs yet.</p></div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {offers.map((offer) => (
                    <div key={offer.id} className="bg-[var(--card)] rounded-[18px] p-5 shadow-[0_2px_12px_rgba(34,34,34,0.08)]">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-[46px] h-[46px] rounded-[12px] bg-[var(--card)] flex items-center justify-center flex-shrink-0">
                          <CategoryIcon category={offer.businesses.category} className="w-5 h-5 text-[var(--mid)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base text-[var(--near-black)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, letterSpacing: '-0.03em' }}>{offer.businesses.name}</h3>
                            <button
                              onClick={() => openEditOffer(offer)}
                              className="p-1.5 rounded-[10px] hover:bg-[var(--shell)] transition-colors flex-shrink-0"
                            >
                              <Pencil size={14} strokeWidth={1.5} className="text-[var(--ink-35)]" />
                            </button>
                          </div>
                          <p className="text-[var(--mid)] text-base mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{offer.generated_title || offer.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* is_live toggle */}
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Live</span>
                          <button
                            onClick={() => handleInlineOfferUpdate(offer.id, 'is_live', !offer.is_live)}
                            disabled={inlineUpdating === `offer-${offer.id}-is_live`}
                          >
                            {inlineUpdating === `offer-${offer.id}-is_live` ? (
                              <div className="w-[40px] h-[24px] rounded-full bg-[var(--ink-08)] flex items-center justify-center">
                                <div className="w-3.5 h-3.5 border-2 border-[var(--ink-35)] border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : (
                              <div className={`w-[40px] h-[24px] rounded-full transition-all flex items-center ${offer.is_live ? 'bg-[var(--terra)] justify-end' : 'bg-[var(--ink-08)] justify-start'}`}>
                                <div className="w-[20px] h-[20px] rounded-full bg-[var(--card)] mx-[2px] shadow-sm" />
                              </div>
                            )}
                          </button>
                        </div>
                        {/* monthly_cap inline edit */}
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-[var(--ink-35)] uppercase" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600, letterSpacing: '0.5px' }}>Cap</span>
                          <input
                            type="number"
                            min="0"
                            value={offer.monthly_cap ?? ''}
                            onChange={e => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value);
                              setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, monthly_cap: val } : o));
                            }}
                            onBlur={e => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value);
                              handleInlineOfferUpdate(offer.id, 'monthly_cap', val);
                            }}
                            className="w-[70px] px-2 py-1 rounded-[10px] text-[13px] font-semibold border border-[var(--ink-08)] text-[var(--ink)] bg-[var(--shell)] text-center focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)]"
                            style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                            placeholder="∞"
                          />
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
            <div>
              {claims.length === 0 ? (
                <div className="text-center py-16"><div className="flex justify-center mb-3"><ClipboardList size={32} strokeWidth={1.5} className="text-[var(--soft)]" /></div><p className="text-[var(--mid)] text-base" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>No claims yet.</p></div>
              ) : (
                <div className="space-y-3">
                  {claims.map((claim) => {
                    const borderColor = claim.status === 'active' ? 'var(--terra)' : claim.status === 'redeemed' ? 'rgba(34,34,34,0.15)' : 'var(--terra-10)';
                    return (
                      <div key={claim.id} className="bg-[var(--card)] rounded-[16px] border border-[var(--ink-08)] p-4 overflow-hidden" style={{ boxShadow: 'var(--shadow-md)', borderLeft: `4px solid ${borderColor}` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>{claim.creators.name}</span>
                              <StatusPill status={claim.status} type="claim" />
                            </div>
                            <p className="text-[13px] text-[var(--ink-60)] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{claim.businesses.name}</p>
                            {(claim as any).offers?.generated_title && (
                              <p className="text-[13px] text-[var(--ink-35)] mt-0.5" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{(claim as any).offers.generated_title}</p>
                            )}
                            <p className="text-[12px] text-[var(--ink-35)] mt-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{new Date(claim.claimed_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex-shrink-0">
                            <select
                              value={claim.status}
                              onChange={(e) => handleUpdateClaimStatus(claim.id, e.target.value)}
                              className="px-2.5 py-1 rounded-[10px] text-[12px] font-semibold border border-[var(--ink-08)] text-[var(--ink)] bg-[var(--shell)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)]"
                              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                            >
                              <option value="active">Active</option>
                              <option value="redeemed">Redeemed</option>
                              <option value="expired">Expired</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS */}
          {view === 'settings' && (
            <div className="max-w-2xl">
              <div className="bg-[var(--card)] rounded-[18px] shadow-[0_2px_12px_rgba(34,34,34,0.08)] p-6">
                <h2 className="text-[22px] text-[var(--near-black)] mb-5" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.03em' }}>Change Password</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-base font-semibold text-[var(--near-black)] mb-2" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
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
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="block text-base font-semibold text-[var(--near-black)] mb-2" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
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
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-base font-semibold text-[var(--near-black)] mb-2" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
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
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    />
                  </div>
                  {passwordMessage && (
                    <div
                      className={`p-3 rounded-[12px] text-[15px] font-medium ${
                        passwordMessage.type === 'success'
                          ? 'bg-[rgba(34,34,34,0.06)] text-[var(--ink)]'
                          : 'bg-[var(--terra-10)] text-[var(--terra)]'
                      }`}
                      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      {passwordMessage.text}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 bg-[var(--terra)] text-white rounded-[999px] font-bold text-[15px] hover:bg-[var(--terra-hover)] transition-colors"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-[999px] bg-[var(--ink)] text-white text-[15px] font-semibold shadow-lg" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
          {toast}
        </div>
      )}

      {/* Add Business Modal */}
      {showAddBusiness && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" style={{ background: 'rgba(34,34,34,0.45)' }} onClick={() => { setShowAddBusiness(false); setEditingBusinessId(null); }}>
          <div className="w-full max-w-[560px] my-8 mx-4 rounded-[24px] p-7" style={{ background: 'var(--shell)', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] text-[var(--ink)]" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.03em' }}>{editingBusinessId ? 'Edit business' : 'Add business'}</h2>
              <button onClick={() => { setShowAddBusiness(false); setEditingBusinessId(null); }} className="p-2 rounded-[12px] hover:bg-[var(--card)] transition-colors">
                <X size={20} strokeWidth={1.5} className="text-[var(--ink-35)]" />
              </button>
            </div>

            <form onSubmit={editingBusinessId ? handleUpdateBusiness : handleCreateBusiness} className="space-y-5">
              {/* BASIC INFO */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>Basic info</p>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Business name <span className="text-[var(--terra)]">*</span></label>
                <input
                  value={bizName}
                  onChange={e => { setBizName(e.target.value); setBizSlug(slugify(e.target.value)); }}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  placeholder="e.g. Wildcraft Coffee"
                />
                {bizErrors.name && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{bizErrors.name}</p>}
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Owner email <span className="text-[var(--terra)]">*</span></label>
                <input
                  type="email"
                  value={bizEmail}
                  onChange={e => setBizEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  placeholder="hello@business.com"
                />
                {bizErrors.email && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{bizErrors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Category <span className="text-[var(--terra)]">*</span></label>
                  <select
                    value={bizCategory}
                    onChange={e => setBizCategory(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  >
                    <option value="">Select…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {bizErrors.category && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{bizErrors.category}</p>}
                </div>
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Region</label>
                  <select
                    value={bizRegion}
                    onChange={e => setBizRegion(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  >
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* LOCATION */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)] pt-2" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>Location</p>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Address</label>
                <input
                  value={bizAddress}
                  onChange={e => setBizAddress(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  placeholder="123 High Street, Bury St Edmunds"
                />
                <p className="mt-1.5 text-[12px] text-[var(--ink-35)]" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Coordinates can be added later if needed.</p>
              </div>

              {/* PROFILE */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)] pt-2" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>Profile</p>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Instagram handle</label>
                <input
                  value={bizInstagram}
                  onChange={e => setBizInstagram(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  placeholder="@wildcraftcoffee"
                />
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Bio <span className="text-[var(--ink-35)]">(max 200 chars)</span></label>
                <textarea
                  value={bizBio}
                  onChange={e => { if (e.target.value.length <= 200) setBizBio(e.target.value); }}
                  rows={3}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] resize-none focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  placeholder="A short description of the business…"
                />
                <p className="text-right text-[12px] text-[var(--ink-35)] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{bizBio.length}/200</p>
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Logo</label>
                {bizLogoPreview ? (
                  <div className="flex items-center gap-3">
                    <img src={bizLogoPreview} alt="Logo preview" className="w-14 h-14 rounded-[12px] object-cover" />
                    <button type="button" onClick={() => { setBizLogoFile(null); setBizLogoPreview(null); }} className="text-[13px] text-[var(--terra)] font-semibold" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Remove</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-[12px] border-[1.5px] border-dashed border-[var(--ink-15)] bg-[var(--card)] cursor-pointer hover:border-[var(--ink-35)] transition-colors">
                    <Upload size={20} strokeWidth={1.5} className="text-[var(--ink-35)]" />
                    <span className="text-[14px] text-[var(--ink-35)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500 }}>Upload photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setBizLogoFile(file);
                        setBizLogoPreview(URL.createObjectURL(file));
                      }
                    }} />
                  </label>
                )}
                {bizErrors.logo && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{bizErrors.logo}</p>}
              </div>

              {/* STATUS */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)] pt-2" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>Status</p>

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
                    <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500 }}>{toggle.label}</span>
                    <div className={`w-[44px] h-[26px] rounded-full transition-all flex items-center ${toggle.value ? 'bg-[var(--terra)] justify-end' : 'bg-[var(--ink-08)] justify-start'}`}>
                      <div className="w-[22px] h-[22px] rounded-full bg-[var(--card)] mx-[2px] shadow-sm" />
                    </div>
                  </button>
                ))}
              </div>

              {bizErrors.submit && <p className="text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{bizErrors.submit}</p>}

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={bizSubmitting}
                  className="w-full px-4 py-3 rounded-[999px] text-[15px] text-white bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors disabled:opacity-50"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
                >
                  {bizSubmitting ? (editingBusinessId ? 'Saving…' : 'Creating…') : (editingBusinessId ? 'Save changes' : 'Create business')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddBusiness(false); setEditingBusinessId(null); }}
                  className="w-full px-4 py-3 rounded-[999px] text-[15px] text-[var(--ink-60)] border-[1.5px] border-[var(--ink-08)] hover:border-[var(--ink-15)] transition-colors"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Offer Modal */}
      {showAddOffer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" style={{ background: 'rgba(34,34,34,0.45)' }} onClick={() => { setShowAddOffer(false); setEditingOfferId(null); }}>
          <div className="w-full max-w-[560px] my-8 mx-4 rounded-[24px] p-7" style={{ background: 'var(--shell)', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] text-[var(--ink)]" style={{ fontFamily: "'Corben', serif", fontWeight: 400, letterSpacing: '-0.03em' }}>{editingOfferId ? 'Edit collab' : 'New collab'}</h2>
              <button onClick={() => { setShowAddOffer(false); setEditingOfferId(null); }} className="p-2 rounded-[12px] hover:bg-[var(--card)] transition-colors">
                <X size={20} strokeWidth={1.5} className="text-[var(--ink-35)]" />
              </button>
            </div>

            <form onSubmit={editingOfferId ? handleUpdateOffer : handleCreateOffer} className="space-y-5">
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>Collab details</p>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Business <span className="text-[var(--terra)]">*</span></label>
                <select
                  value={offerBusinessId}
                  onChange={e => setOfferBusinessId(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                >
                  <option value="">Select business…</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {offerErrors.business && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{offerErrors.business}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Collab type <span className="text-[var(--terra)]">*</span></label>
                  <select
                    value={offerType}
                    onChange={e => setOfferType(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  >
                    <option value="">Select…</option>
                    {OFFER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {offerErrors.offer_type && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{offerErrors.offer_type}</p>}
                </div>
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Content type</label>
                  <select
                    value={offerContentType}
                    onChange={e => setOfferContentType(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  >
                    <option value="reel">Reel</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>What they get <span className="text-[var(--terra)]">*</span></label>
                <input
                  value={offerItem}
                  onChange={e => {
                    setOfferItem(e.target.value);
                    if (!offerTitleManual) setOfferTitle(`Free ${e.target.value}`);
                  }}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  placeholder='e.g. "oat flat white", "gel manicure"'
                />
                {offerErrors.offer_item && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{offerErrors.offer_item}</p>}
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Title</label>
                <input
                  value={offerTitle}
                  onChange={e => { setOfferTitle(e.target.value); setOfferTitleManual(true); }}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  placeholder="Auto-generated from offer item"
                />
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Description</label>
                <textarea
                  value={offerDesc}
                  onChange={e => setOfferDesc(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] resize-none focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  placeholder="Optional description"
                />
              </div>

              {/* CAPACITY */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)] pt-2" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>Capacity</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Monthly slot cap <span className="text-[var(--ink-35)]">(blank = unlimited)</span></label>
                  <input
                    type="number"
                    min="1"
                    value={offerMonthlyCap}
                    onChange={e => setOfferMonthlyCap(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                    placeholder="Unlimited"
                  />
                  {offerErrors.monthly_cap && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{offerErrors.monthly_cap}</p>}
                </div>
                <div>
                  <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Total slots <span className="text-[var(--terra)]">*</span></label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={offerSlots}
                    onChange={e => setOfferSlots(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                    style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  />
                  {offerErrors.slots && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{offerErrors.slots}</p>}
                </div>
              </div>

              {/* BRIEF */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)] pt-2" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>Brief</p>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Specific ask <span className="text-[var(--ink-35)]">(max 100 chars)</span></label>
                <textarea
                  value={offerSpecificAsk}
                  onChange={e => { if (e.target.value.length <= 100) setOfferSpecificAsk(e.target.value); }}
                  rows={2}
                  className="w-full px-4 py-3.5 rounded-[14px] border-[1.5px] border-[var(--ink-08)] bg-[var(--card)] text-[15px] text-[var(--ink)] resize-none focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra-ring)]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}
                  placeholder={"e.g. \"they'd love if you showed the latte art\""}
                />
                <p className="text-right text-[12px] text-[var(--ink-35)] mt-1" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{offerSpecificAsk.length}/100</p>
              </div>

              <div>
                <label className="block text-[13px] text-[var(--ink-60)] mb-1.5" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>Collab photo</label>
                {offerPhotoPreview ? (
                  <div className="flex items-center gap-3">
                    <img src={offerPhotoPreview} alt="Collab preview" className="w-14 h-14 rounded-[12px] object-cover" />
                    <button type="button" onClick={() => { setOfferPhotoFile(null); setOfferPhotoPreview(null); }} className="text-[13px] text-[var(--terra)] font-semibold" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>Remove</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-[12px] border-[1.5px] border-dashed border-[var(--ink-15)] bg-[var(--card)] cursor-pointer hover:border-[var(--ink-35)] transition-colors">
                    <Upload size={20} strokeWidth={1.5} className="text-[var(--ink-35)]" />
                    <span className="text-[14px] text-[var(--ink-35)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500 }}>Upload photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setOfferPhotoFile(file);
                        setOfferPhotoPreview(URL.createObjectURL(file));
                      }
                    }} />
                  </label>
                )}
                {offerErrors.photo && <p className="mt-1 text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{offerErrors.photo}</p>}
              </div>

              {/* STATUS */}
              <p className="text-[13px] uppercase tracking-[1px] text-[var(--ink-35)] pt-2" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>Status</p>

              <button
                type="button"
                onClick={() => setOfferIsLive(!offerIsLive)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-[12px] bg-[var(--card)] border border-[var(--ink-08)]"
              >
                <span className="text-[15px] text-[var(--ink)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500 }}>Is live</span>
                <div className={`w-[44px] h-[26px] rounded-full transition-all flex items-center ${offerIsLive ? 'bg-[var(--terra)] justify-end' : 'bg-[var(--ink-08)] justify-start'}`}>
                  <div className="w-[22px] h-[22px] rounded-full bg-[var(--card)] mx-[2px] shadow-sm" />
                </div>
              </button>

              {offerErrors.submit && <p className="text-[13px] text-[var(--ochre)]" style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 400 }}>{offerErrors.submit}</p>}

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={offerSubmitting}
                  className="w-full px-4 py-3 rounded-[999px] text-[15px] text-white bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors disabled:opacity-50"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
                >
                  {offerSubmitting ? (editingOfferId ? 'Saving…' : 'Creating…') : (editingOfferId ? 'Save changes' : 'Create collab')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddOffer(false); setEditingOfferId(null); }}
                  className="w-full px-4 py-3 rounded-[999px] text-[15px] text-[var(--ink-60)] border-[1.5px] border-[var(--ink-08)] hover:border-[var(--ink-15)] transition-colors"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
