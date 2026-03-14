import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LogOut, Plus, ExternalLink, Camera, Bell,
  Package, Users, Film,
  CheckCircle2, XCircle, VideoOff, Flag,
  Sparkles, ClipboardList, Clock
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getCategoryGradient } from '../lib/categories';
import { getInitials } from '../lib/avatar';
import DisputeModal from './DisputeModal';
import { Logo } from './Logo';

interface Offer {
  id: string;
  description: string;
  monthly_cap: number | null;
  is_live: boolean;
  created_at: string;
  slotsUsed?: number;
}

interface ClaimWithDetails {
  id: string;
  status: string;
  claimed_at: string;
  redeemed_at: string | null;
  reel_url: string | null;
  qr_token: string;
  creators: { name: string; instagram_handle: string; code: string };
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

function QRScanner({ onScan, active }: { onScan: (token: string) => void; active: boolean }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startScanner = async () => {
    setCameraError(null);
    try {
      const scanner = new Html5Qrcode('qr-scanner-region');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          let token = decodedText;
          try {
            const url = new URL(decodedText);
            const redeemParam = url.searchParams.get('redeem');
            if (redeemParam) token = redeemParam;
          } catch {
            // Not a URL — use the raw scanned value
          }
          onScan(token);
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
      setScanning(true);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFoundError')) {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not start camera. Use the code field below instead.');
      }
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  useEffect(() => {
    if (!active && scanning) stopScanner();
  }, [active]);

  if (cameraError) {
    return (
      <div className="p-5 rounded-[20px] bg-amber-50 border border-amber-100 text-center">
        <VideoOff className="w-6 h-6 text-amber-500 mx-auto mb-2" />
        <p className="text-[14px] text-amber-700">{cameraError}</p>
      </div>
    );
  }

  return (
    <div>
      <div
        id="qr-scanner-region"
        className="rounded-[20px] overflow-hidden mx-auto"
        style={{ display: scanning ? 'block' : 'none', maxWidth: '280px', background: '#222222' }}
      />
      {!scanning && (
        <button
          onClick={startScanner}
          className="w-full flex items-center justify-center gap-2 py-[14px] rounded-[50px] font-bold text-[14px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
        >
          <Camera className="w-[18px] h-[18px]" /> Open Camera
        </button>
      )}
      {scanning && (
        <button
          onClick={stopScanner}
          className="w-full mt-3 py-[10px] rounded-[50px] font-semibold text-[13px] bg-[var(--bg)] text-[var(--mid)] hover:bg-[#ececec] transition-all border border-[var(--faint)] min-h-[44px]"
        >
          Stop Scanner
        </button>
      )}
    </div>
  );
}

export default function BusinessPortal() {
  const { userProfile, signOut } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'offers' | 'claims' | 'content' | 'scan' | 'notifications'>(
    new URLSearchParams(window.location.search).get('redeem') ? 'scan' : 'offers'
  );
  const [showNewOffer, setShowNewOffer] = useState(false);
  const [newOfferDescription, setNewOfferDescription] = useState('');
  const [newOfferCap, setNewOfferCap] = useState<number | null>(null);
  const [limitClaims, setLimitClaims] = useState(false);
  const [scanCode, setScanCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('redeem') || '';
  });
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string; creatorName?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [disputeClaimId, setDisputeClaimId] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offersLoaded, setOffersLoaded] = useState(false);

  // Clean redeem param from URL after reading it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('redeem')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (userProfile?.approved) {
      fetchOffers();
      fetchClaims();
      fetchNotifications();
    }
  }, [userProfile]);

  // Realtime subscriptions for claims and notifications
  useEffect(() => {
    if (!userProfile?.approved) return;

    const channel = supabase
      .channel('business-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims', filter: `business_id=eq.${userProfile.id}` },
        () => { fetchClaims(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userProfile.id}` },
        () => { fetchNotifications(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userProfile]);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchOffers = async () => {
    const { data, error } = await supabase.from('offers').select('*').eq('business_id', userProfile.id).order('created_at', { ascending: false });
    if (error) { setFetchError('Failed to load offers.'); return; }
    if (data) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const offersWithSlots = await Promise.all(
        data.map(async (offer) => {
          const { count } = await supabase
            .from('claims')
            .select('*', { count: 'exact', head: true })
            .eq('offer_id', offer.id)
            .eq('month', currentMonth);
          return { ...offer, slotsUsed: count || 0 };
        })
      );
      setOffers(offersWithSlots as Offer[]);
    }
    setOffersLoaded(true);
  };

  const fetchClaims = async () => {
    const { data, error } = await supabase.from('claims').select('*, creators(name, instagram_handle, code)').eq('business_id', userProfile.id).order('claimed_at', { ascending: false });
    if (error) { setFetchError('Failed to load claims.'); return; }
    if (data) setClaims(data as ClaimWithDetails[]);
  };

  const fetchNotifications = async () => {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false }).limit(20);
    if (error) return;
    if (data) setNotifications(data);
  };

  const markNotificationRead = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
      fetchNotifications();
    } catch (err: any) {
      console.error('Failed to mark notification read:', err.message);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setOfferError(null);

    const desc = newOfferDescription.trim();
    if (!desc || desc.length < 10) { setOfferError('Description must be at least 10 characters.'); return; }
    if (desc.length > 300) { setOfferError('Description must be under 300 characters.'); return; }
    if (limitClaims && (!newOfferCap || newOfferCap < 1)) { setOfferError('Monthly cap must be at least 1.'); return; }
    if (limitClaims && newOfferCap && newOfferCap > 1000) { setOfferError('Monthly cap cannot exceed 1000.'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.from('offers').insert({
        business_id: userProfile.id,
        description: desc,
        monthly_cap: limitClaims ? newOfferCap : null,
        is_live: true,
      });
      if (error) throw error;
      setNewOfferDescription('');
      setNewOfferCap(null);
      setLimitClaims(false);
      setShowNewOffer(false);
      fetchOffers();
    } catch (error: any) {
      setOfferError(error.message || 'Failed to create offer');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOffer = async (offerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('offers').update({ is_live: !currentStatus }).eq('id', offerId);
      if (error) throw error;
      fetchOffers();
    } catch (err: any) {
      console.error('Failed to toggle offer:', err.message);
    }
  };

  const handleScanCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setScanResult(null);
    try {
      const { data: claim } = await supabase.from('claims').select('*, creators(name, code)').eq('qr_token', scanCode).eq('business_id', userProfile.id).maybeSingle();
      if (!claim) { setScanResult({ type: 'error', message: 'Code not recognised. Check and try again.' }); setScanCode(''); return; }
      if (claim.status !== 'active') {
        setScanResult({ type: 'error', message: claim.status === 'redeemed' ? 'This pass has already been used.' : `This pass is ${claim.status}. Cannot redeem.` });
        setScanCode('');
        return;
      }
      if (new Date(claim.qr_expires_at) < new Date()) { setScanResult({ type: 'error', message: 'QR code expired. Ask the creator to refresh it.' }); setScanCode(''); return; }
      const redeemedAt = new Date();
      const reelDueAt = new Date(redeemedAt.getTime() + 48 * 60 * 60 * 1000);
      const { error } = await supabase.from('claims').update({ status: 'redeemed', redeemed_at: redeemedAt.toISOString(), reel_due_at: reelDueAt.toISOString() }).eq('id', claim.id);
      if (error) throw error;
      setScanResult({ type: 'success', message: 'Visit confirmed', creatorName: claim.creators.name });
      setScanCode('');
      fetchClaims();
    } catch (error: any) {
      setScanResult({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const activeClaimsCount = claims.filter(c => c.status === 'active').length;

  if (!userProfile?.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-white">
        <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.05)] p-8 max-w-sm text-center border border-[var(--faint)]">
          <Clock className="w-12 h-12 text-[var(--soft)] mx-auto mb-4" />
          <h2 className="text-[18px] font-bold mb-1 text-[#222222]">Pending Approval</h2>
          <p className="text-[14px] text-[var(--mid)] mb-6">Your business account is under review.</p>
          <button onClick={signOut} className="inline-flex items-center gap-2 px-6 py-3 rounded-[50px] text-white font-bold text-[14px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors min-h-[48px]">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'offers' as const, label: 'Offers', icon: Package },
    { key: 'scan' as const, label: 'Scan', icon: Camera, badge: activeClaimsCount || undefined },
    { key: 'claims' as const, label: 'Claims', icon: Users },
    { key: 'content' as const, label: 'Reels', icon: Film },
    { key: 'notifications' as const, label: 'Alerts', icon: Bell, badge: unreadCount || undefined },
  ];

  const claimStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'bg-[var(--terra)] text-white';
      case 'redeemed': return 'bg-[rgba(26,60,52,0.08)] text-[var(--forest)]';
      case 'reel_due': return 'bg-[var(--peach)] text-[#222222]';
      case 'completed': return 'bg-[var(--bg)] text-[var(--soft)]';
      case 'disputed': return 'bg-[var(--terra-15)] text-[var(--terra)]';
      default: return 'bg-[var(--bg)] text-[var(--soft)]';
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {disputeClaimId && (
        <DisputeModal
          claimId={disputeClaimId}
          reporterRole="business"
          onClose={() => setDisputeClaimId(null)}
        />
      )}
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-[var(--faint)]" style={{ padding: '20px 20px 14px' }}>
          <div className="flex items-center justify-between">
            <Logo />
            <div className="text-right">
              <p className="text-[13px] font-semibold text-[#222222]">{userProfile.name}</p>
              <span className="inline-block bg-[var(--bg)] text-[var(--mid)] text-[11px] font-bold rounded-[20px] px-[10px] py-[3px] mt-0.5">
                Business
              </span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-white border-b border-[var(--faint)] overflow-x-auto px-[20px]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setView(tab.key); setScanResult(null); }}
              className={`flex items-center gap-[5px] px-[14px] py-[10px] pb-[12px] text-[11px] font-semibold whitespace-nowrap transition-all relative min-h-[44px] ${
                view === tab.key ? 'text-[var(--terra)]' : 'text-[var(--soft)]'
              }`}
            >
              <div className="relative">
                <tab.icon className="w-[18px] h-[18px]" />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--terra)] text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[var(--terra)] rounded-[1px]" />}
            </button>
          ))}
        </div>

        <div className="p-[20px]">
          {fetchError && (
            <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-[14px] text-rose-700 font-medium">
              {fetchError}
            </div>
          )}

          {/* ═══ OFFERS ═══ */}
          {view === 'offers' && (
            <div>
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-1" style={{ letterSpacing: '-0.4px' }}>Offers</h2>
              <p className="text-[14px] text-[var(--mid)] mb-5">{offers.length} offer{offers.length !== 1 ? 's' : ''} · {offers.filter(o => o.is_live).length} live</p>

              {offersLoaded && offers.length === 0 && (
                <div className="flex flex-col items-center py-16 px-6">
                  <Sparkles className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[16px] font-bold text-[#222222] mb-1">No offers yet</p>
                  <p className="text-[14px] text-[var(--mid)] text-center mb-5 max-w-[260px]">Create your first offer to start receiving creators</p>
                  <button
                    onClick={() => setShowNewOffer(true)}
                    className="inline-flex items-center gap-2 px-[24px] py-[13px] rounded-[50px] bg-[var(--terra)] text-white font-bold text-[14px] hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
                  >
                    <Plus className="w-4 h-4" /> Create First Offer
                  </button>
                </div>
              )}

              {offers.length > 0 && (
                <button
                  onClick={() => setShowNewOffer(!showNewOffer)}
                  className="inline-flex items-center gap-2 px-[24px] py-[13px] rounded-[50px] text-white font-bold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all text-[14px] mb-4 min-h-[48px]"
                >
                  <Plus className="w-4 h-4" /> New Offer
                </button>
              )}

              {showNewOffer && (
                <form onSubmit={handleCreateOffer} className="bg-white rounded-[20px] p-[18px] border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)] space-y-4 mb-4">
                  <div>
                    <label className="block text-[12px] font-bold text-[#222222] mb-1.5">Description</label>
                    <textarea
                      value={newOfferDescription}
                      onChange={(e) => setNewOfferDescription(e.target.value)}
                      placeholder="e.g. Free juice + acai bowl for a reel"
                      className="w-full px-4 py-[14px] rounded-[12px] bg-[var(--bg)] border border-[var(--faint)] resize-none text-[14px] text-[#222222] placeholder:text-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)] min-h-[52px]"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[12px] font-bold text-[#222222]">Limit monthly claims?</label>
                      <button
                        type="button"
                        onClick={() => {
                          setLimitClaims(!limitClaims);
                          if (!limitClaims) setNewOfferCap(4);
                          else setNewOfferCap(null);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          limitClaims ? 'bg-[var(--terra)]' : 'bg-[var(--bg)]'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                          limitClaims ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    {limitClaims ? (
                      <input
                        type="number"
                        value={newOfferCap || ''}
                        onChange={(e) => setNewOfferCap(parseInt(e.target.value) || 1)}
                        className="w-full px-4 py-[14px] rounded-[12px] bg-[var(--bg)] border border-[var(--faint)] text-[14px] text-[#222222] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)] min-h-[52px]"
                        min={1}
                        placeholder="Max claims per month"
                        required
                      />
                    ) : (
                      <p className="text-[13px] text-[var(--soft)]">Creators can claim this offer any time — no slot limit</p>
                    )}
                  </div>
                  {offerError && (
                    <div className="p-3 rounded-[12px] bg-rose-50 border border-rose-200">
                      <p className="text-[14px] text-rose-700">{offerError}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" disabled={loading} className="px-[24px] py-[13px] rounded-[50px] text-white font-bold bg-[var(--terra)] hover:bg-[var(--terra-hover)] disabled:opacity-50 text-[14px] transition-all min-h-[48px]">
                      Create
                    </button>
                    <button type="button" onClick={() => { setShowNewOffer(false); setOfferError(null); }} className="px-[24px] py-[13px] rounded-[50px] bg-[var(--bg)] text-[#222222] font-bold text-[14px] hover:bg-[#ececec] transition-all border border-[var(--faint)] min-h-[48px]">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {offers.map((offer) => {
                  const isUnlimited = offer.monthly_cap === null;
                  const slotsUsed = offer.slotsUsed || 0;
                  const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                  const pct = isUnlimited ? 0 : Math.min((slotsUsed / (offer.monthly_cap as number)) * 100, 100);

                  return (
                    <div key={offer.id} className="bg-white rounded-[20px] p-[18px] border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)]">
                      {/* Top: title + status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <p className="text-[15px] font-bold text-[#222222] flex-1 line-clamp-2">{offer.description}</p>
                        <span className={`flex-shrink-0 px-3 py-1 rounded-[50px] text-[12px] font-bold ${
                          offer.is_live
                            ? 'bg-[rgba(26,60,52,0.08)] text-[var(--forest)]'
                            : 'bg-[var(--bg)] text-[var(--soft)]'
                        }`}>
                          {offer.is_live ? 'Live' : 'Paused'}
                        </span>
                      </div>

                      {/* Middle: claims + progress */}
                      <div className="mb-3">
                        <p className="text-[13px] text-[var(--mid)] mb-2">
                          {isUnlimited ? `${slotsUsed} claimed · Unlimited` : `${slotsUsed}/${offer.monthly_cap} claimed`}
                        </p>
                        {!isUnlimited && (
                          <div className="h-[3px] bg-[var(--terra-10)] rounded-[3px] overflow-hidden">
                            <div
                              className="h-full bg-[var(--terra)] rounded-[3px] transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Bottom: slots badge + toggle */}
                      <div className="flex items-center justify-between">
                        {isUnlimited ? (
                          <span className="px-3 py-1 rounded-[50px] text-[12px] font-bold bg-[var(--peach)] text-[#222222]">Open</span>
                        ) : slotsLeft === 0 ? (
                          <span className="px-3 py-1 rounded-[50px] text-[12px] font-bold bg-[var(--bg)] text-[var(--soft)]">Full</span>
                        ) : (
                          <span className="px-3 py-1 rounded-[50px] text-[12px] font-bold bg-[var(--peach)] text-[#222222]">{slotsLeft} left</span>
                        )}
                        <button
                          onClick={() => handleToggleOffer(offer.id, offer.is_live)}
                          className={`px-[18px] py-[8px] rounded-[50px] font-semibold text-[13px] transition-all min-h-[36px] ${
                            offer.is_live
                              ? 'bg-[var(--bg)] text-[var(--mid)] border border-[var(--faint)]'
                              : 'bg-[var(--terra)] text-white'
                          }`}
                        >
                          {offer.is_live ? 'Pause' : 'Resume'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sign out link at bottom of Offers tab */}
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 mt-8 text-[13px] font-medium text-[var(--soft)] hover:text-[var(--mid)] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}

          {/* ═══ SCAN ═══ */}
          {view === 'scan' && (
            <div className="max-w-sm mx-auto">
              {scanResult ? (
                /* Scan result state */
                <div className="flex flex-col items-center py-8">
                  {scanResult.type === 'success' ? (
                    <>
                      <CheckCircle2 className="w-16 h-16 text-[var(--terra)] mb-4" />
                      {scanResult.creatorName && (
                        <p className="text-[20px] font-extrabold text-[#222222] mb-1">{scanResult.creatorName}</p>
                      )}
                      <p className="text-[16px] font-semibold text-[#222222] mb-1">{scanResult.message}</p>
                      <p className="text-[12px] text-[var(--soft)] mb-6">{new Date().toLocaleString()}</p>
                      <button
                        onClick={() => setScanResult(null)}
                        className="px-[28px] py-[13px] rounded-[50px] bg-[#222222] text-white font-bold text-[14px] hover:bg-[#333] transition-all min-h-[48px]"
                      >
                        Done
                      </button>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-12 h-12 text-[var(--terra)] mb-4" />
                      <p className="text-[16px] font-bold text-[#222222] mb-1 text-center">{scanResult.message}</p>
                      <button
                        onClick={() => setScanResult(null)}
                        className="mt-4 px-[28px] py-[13px] rounded-[50px] bg-[var(--terra)] text-white font-bold text-[14px] hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
                      >
                        Try again
                      </button>
                    </>
                  )}
                </div>
              ) : (
                /* Scanner UI */
                <>
                  <h2 className="text-[22px] font-extrabold text-[#222222] mb-2" style={{ letterSpacing: '-0.4px' }}>Scan creator pass</h2>
                  <p className="text-[14px] text-[var(--mid)] mb-7">Ask the creator to open their Active tab and show their QR code</p>

                  <QRScanner
                    onScan={(token) => { setScanCode(token); }}
                    active={view === 'scan' && !scanResult}
                  />

                  <div className="mt-6 mb-4 relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--faint)]" /></div>
                    <div className="relative flex justify-center"><span className="bg-white px-3 text-[12px] text-[var(--soft)]">or enter code manually</span></div>
                  </div>

                  <form onSubmit={handleScanCode} className="space-y-3">
                    <input
                      type="text"
                      value={scanCode}
                      onChange={(e) => { setScanCode(e.target.value); setScanResult(null); }}
                      placeholder="e.g. SOPHIE101"
                      className="w-full px-4 py-[14px] rounded-[12px] bg-[var(--bg)] border border-[var(--faint)] text-[15px] text-[#222222] placeholder:text-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)] min-h-[52px]"
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-[13px] rounded-[50px] text-white font-bold bg-[var(--terra)] hover:bg-[var(--terra-hover)] disabled:opacity-50 transition-all text-[14px] min-h-[48px]"
                    >
                      {loading ? 'Verifying...' : 'Verify'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* ═══ CLAIMS ═══ */}
          {view === 'claims' && (
            <div>
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-1" style={{ letterSpacing: '-0.4px' }}>Claims</h2>
              <p className="text-[14px] text-[var(--mid)] mb-5">
                {claims.filter(c => c.status === 'active').length} active · {claims.length} total
              </p>

              {claims.length === 0 ? (
                <div className="flex flex-col items-center py-16 px-6">
                  <ClipboardList className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[16px] font-bold text-[#222222] mb-1">No claims yet</p>
                  <p className="text-[14px] text-[var(--mid)] text-center max-w-[260px]">Claims will appear here when creators claim your offers</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {claims.map((claim) => (
                    <div key={claim.id} className="bg-white rounded-[20px] p-[18px] border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)]">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[14px] flex-shrink-0"
                          style={{ background: getCategoryGradient(userProfile.category || 'Cafe & Coffee') }}
                        >
                          {getInitials(claim.creators.name)}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-[#222222]">{claim.creators.name}</p>
                          <p className="text-[13px] text-[var(--mid)] truncate">{claim.creators.instagram_handle}</p>
                          <p className="text-[13px] text-[var(--soft)] mt-0.5">{new Date(claim.claimed_at).toLocaleDateString()}</p>
                        </div>
                        {/* Status + actions */}
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-3 py-1 rounded-[50px] text-[12px] font-bold ${claimStatusStyle(claim.status)}`}>
                            {claim.status}
                          </span>
                          <button
                            onClick={() => setDisputeClaimId(claim.id)}
                            className="flex items-center gap-1 text-[12px] text-[var(--soft)] hover:text-[var(--terra)] transition-colors"
                          >
                            <Flag className="w-3 h-3" /> Report
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ REELS ═══ */}
          {view === 'content' && (
            <div>
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-1" style={{ letterSpacing: '-0.4px' }}>Reels</h2>
              <p className="text-[14px] text-[var(--mid)] mb-5">{claims.filter(c => c.reel_url).length} reel{claims.filter(c => c.reel_url).length !== 1 ? 's' : ''} received</p>

              {claims.filter(c => c.reel_url).length === 0 ? (
                <div className="flex flex-col items-center py-16 px-6">
                  <Film className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[16px] font-bold text-[#222222] mb-1">No reels submitted yet</p>
                  <p className="text-[14px] text-[var(--mid)] text-center max-w-[260px]">Reels will appear here once creators post and submit their links</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {claims.filter(c => c.reel_url).map((claim) => (
                    <div key={claim.id} className="bg-white rounded-[20px] p-[18px] border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)]">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-[56px] h-[56px] rounded-[12px] flex items-center justify-center text-white font-bold text-[16px] flex-shrink-0"
                          style={{ background: getCategoryGradient(userProfile.category || 'Cafe & Coffee') }}
                        >
                          {getInitials(claim.creators.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-[#222222]">{claim.creators.name}</p>
                          <p className="text-[13px] text-[var(--mid)] truncate">{claim.creators.instagram_handle}</p>
                          <p className="text-[12px] text-[var(--soft)] mt-0.5">{new Date(claim.claimed_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <a
                        href={claim.reel_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[12px] font-semibold text-[var(--terra)] hover:underline"
                      >
                        View reel <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ NOTIFICATIONS ═══ */}
          {view === 'notifications' && (
            <div className="max-w-lg mx-auto">
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-5" style={{ letterSpacing: '-0.4px' }}>Alerts</h2>

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center py-16 px-6">
                  <Bell className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[16px] font-bold text-[#222222] mb-1">No notifications</p>
                  <p className="text-[14px] text-[var(--mid)] text-center max-w-[260px]">You'll be notified when creators claim your offers</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => !notif.read && markNotificationRead(notif.id)}
                      className={`w-full text-left bg-white rounded-[20px] p-4 shadow-[0_1px_4px_rgba(34,34,34,0.05)] transition-all ${
                        notif.read ? 'border border-[var(--faint)] opacity-50' : 'border border-[var(--terra-20)] bg-[var(--terra-5)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-[var(--faint)]' : 'bg-[var(--terra)]'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] text-[#222222]">{notif.message}</p>
                          <p className="text-[13px] text-[var(--soft)] mt-1">{new Date(notif.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
