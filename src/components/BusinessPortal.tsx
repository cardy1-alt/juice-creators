import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LogOut, Plus, ExternalLink, Camera, Bell,
  Package, Users, Film, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle, VideoOff, Flag
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getCategoryEmoji } from '../lib/categories';
import DisputeModal from './DisputeModal';

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-sky-50 text-sky-600 border border-sky-100',
    redeemed: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    expired: 'bg-rose-50 text-rose-500 border border-rose-100',
  };
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${styles[status] || 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
      {status}
    </span>
  );
}

interface Offer {
  id: string;
  description: string;
  monthly_cap: number;
  is_live: boolean;
  created_at: string;
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
          // Extract the redeem token from URL or use raw value
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
        () => {} // ignore scan failures (no QR found in frame)
      );
      setScanning(true);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFoundError')) {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not start camera. Use the token field below instead.');
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
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-center">
        <VideoOff className="w-6 h-6 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-amber-700">{cameraError}</p>
      </div>
    );
  }

  return (
    <div>
      <div id="qr-scanner-region" className="rounded-xl overflow-hidden" style={{ display: scanning ? 'block' : 'none' }} />
      {!scanning && (
        <button
          onClick={startScanner}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-[#5b3df5] text-white hover:bg-[#4e35d4] transition-all"
        >
          <Camera className="w-4 h-4" /> Open Camera Scanner
        </button>
      )}
      {scanning && (
        <button
          onClick={stopScanner}
          className="w-full mt-2 py-2 rounded-xl font-semibold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
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
  const [newOfferCap, setNewOfferCap] = useState(4);
  const [scanCode, setScanCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('redeem') || '';
  });
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [disputeClaimId, setDisputeClaimId] = useState<string | null>(null);


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

  const fetchOffers = async () => {
    const { data } = await supabase.from('offers').select('*').eq('business_id', userProfile.id).order('created_at', { ascending: false });
    if (data) setOffers(data);
  };

  const fetchClaims = async () => {
    const { data } = await supabase.from('claims').select('*, creators(name, instagram_handle, code)').eq('business_id', userProfile.id).order('claimed_at', { ascending: false });
    if (data) setClaims(data as ClaimWithDetails[]);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false }).limit(20);
    if (data) setNotifications(data);
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    fetchNotifications();
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('offers').insert({ business_id: userProfile.id, description: newOfferDescription, monthly_cap: newOfferCap, is_live: true });
      if (error) throw error;
      setNewOfferDescription('');
      setNewOfferCap(4);
      setShowNewOffer(false);
      fetchOffers();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOffer = async (offerId: string, currentStatus: boolean) => {
    await supabase.from('offers').update({ is_live: !currentStatus }).eq('id', offerId);
    fetchOffers();
  };

  const handleScanCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setScanResult(null);
    try {
      const { data: claim } = await supabase.from('claims').select('*, creators(name, code)').eq('qr_token', scanCode).eq('business_id', userProfile.id).maybeSingle();
      if (!claim) { setScanResult({ type: 'error', message: 'Invalid QR code. Not found or not for this business.' }); setScanCode(''); return; }
      if (claim.status !== 'active') {
        setScanResult({ type: 'error', message: claim.status === 'redeemed' ? 'This pass has already been redeemed.' : `This pass is ${claim.status}. Cannot redeem.` });
        setScanCode('');
        return;
      }
      if (new Date(claim.qr_expires_at) < new Date()) { setScanResult({ type: 'error', message: 'QR code expired. Ask the creator to refresh it.' }); setScanCode(''); return; }
      const redeemedAt = new Date();
      const reelDueAt = new Date(redeemedAt.getTime() + 48 * 60 * 60 * 1000);
      const { error } = await supabase.from('claims').update({ status: 'redeemed', redeemed_at: redeemedAt.toISOString(), reel_due_at: reelDueAt.toISOString() }).eq('id', claim.id);
      if (error) throw error;
      // Notify the creator their pass was redeemed
      await supabase.from('notifications').insert({
        user_id: claim.creator_id,
        user_type: 'creator',
        message: `Your pass at ${userProfile.name} has been redeemed! Don't forget to post your reel.`
      });
      setScanResult({ type: 'success', message: `✅ Pass redeemed for ${claim.creators.name}!` });
      setScanCode('');
      fetchClaims();
    } catch (error: any) {
      setScanResult({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const emoji = getCategoryEmoji(userProfile.category);

  if (!userProfile?.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#faf8ff] to-[#f0eaff]">
        <div className="bg-white rounded-2xl shadow-xl shadow-black/5 p-8 max-w-sm text-center border border-gray-100">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-xl font-bold mb-2 text-[#1a1025]">Pending Approval</h2>
          <p className="text-gray-500 text-sm mb-6">Your business account is under review.</p>
          <button onClick={signOut} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium bg-[#1a1025] hover:bg-[#2d1f45] transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'offers' as const, label: 'Offers', icon: Package },
    { key: 'scan' as const, label: 'Scan', icon: Camera },
    { key: 'claims' as const, label: 'Claims', icon: Users },
    { key: 'content' as const, label: 'Reels', icon: Film },
    { key: 'notifications' as const, label: 'Alerts', icon: Bell, badge: unreadCount },
  ];

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      {disputeClaimId && (
        <DisputeModal
          claimId={disputeClaimId}
          reporterRole="business"
          onClose={() => setDisputeClaimId(null)}
        />
      )}
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50 flex items-center justify-center text-xl">
                {emoji}
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-[#1a1025]">{userProfile.name}</h1>
                <p className="text-xs text-gray-400">Business Portal</p>
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
              onClick={() => { setView(tab.key); setScanResult(null); }}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all relative ${
                view === tab.key ? 'text-[#1a1025]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="relative">
                <tab.icon className="w-4 h-4" />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-[#5b3df5] text-white text-[8px] font-bold flex items-center justify-center">
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
          {/* OFFERS */}
          {view === 'offers' && (
            <div className="space-y-4">
              {offers.length === 0 && (
                <div className="bg-gradient-to-br from-[#5b3df5] to-[#8b6cf7] rounded-2xl p-6 text-white text-center shadow-lg">
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="text-xl font-bold mb-2">You're All Set!</h3>
                  <p className="text-white/90 text-sm mb-4">
                    Create your first offer to start receiving creators and building your content library.
                  </p>
                  <button
                    onClick={() => setShowNewOffer(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#5b3df5] font-bold text-sm hover:bg-gray-50 transition-all shadow-lg"
                  >
                    <Plus className="w-4 h-4" /> Create First Offer
                  </button>
                </div>
              )}

              {offers.length > 0 && (
                <button
                  onClick={() => setShowNewOffer(!showNewOffer)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold bg-[#1a1025] hover:bg-[#2d1f45] transition-all text-sm"
                >
                  <Plus className="w-4 h-4" /> New Offer
                </button>
              )}

              {showNewOffer && (
                <form onSubmit={handleCreateOffer} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#1a1025] mb-1.5">Description</label>
                    <textarea
                      value={newOfferDescription}
                      onChange={(e) => setNewOfferDescription(e.target.value)}
                      placeholder="e.g. Free juice + acai bowl for a reel"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/20 focus:border-[#5b3df5]"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1a1025] mb-1.5">Monthly Cap</label>
                    <input
                      type="number"
                      value={newOfferCap}
                      onChange={(e) => setNewOfferCap(parseInt(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/20 focus:border-[#5b3df5]"
                      min={1}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl text-white font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-sm transition-all">
                      Create
                    </button>
                    <button type="button" onClick={() => setShowNewOffer(false)} className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 transition-all">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {offers.map((offer) => (
                  <div key={offer.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm shadow-black/[0.03]">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-gray-700 text-sm flex-1">{offer.description}</p>
                      <span className={`ml-2 flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        offer.is_live
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-gray-50 text-gray-500 border-gray-100'
                      }`}>
                        {offer.is_live ? '● Live' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Cap: {offer.monthly_cap}/month</p>
                    <button
                      onClick={() => handleToggleOffer(offer.id, offer.is_live)}
                      className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl font-semibold text-sm transition-all ${
                        offer.is_live
                          ? 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                          : 'bg-emerald-500 text-white hover:bg-emerald-600'
                      }`}
                    >
                      {offer.is_live ? <><ToggleRight className="w-4 h-4" /> Pause</> : <><ToggleLeft className="w-4 h-4" /> Activate</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCAN */}
          {view === 'scan' && (
            <div className="max-w-sm mx-auto">
              <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
                <div className="text-5xl mb-4">📸</div>
                <h2 className="text-xl font-bold mb-1 text-[#1a1025]">Redeem Pass</h2>
                <p className="text-gray-500 text-sm mb-6">Scan the creator's QR code or paste the token</p>

                <QRScanner
                  onScan={(token) => { setScanCode(token); }}
                  active={view === 'scan' && !scanResult}
                />

                <div className="mt-4 relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or paste token</span></div>
                </div>

                <form onSubmit={handleScanCode} className="space-y-3 mt-4">
                  <input
                    type="text"
                    value={scanCode}
                    onChange={(e) => { setScanCode(e.target.value); setScanResult(null); }}
                    placeholder="Paste QR token here"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/20 focus:border-[#5b3df5]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl text-white font-semibold bg-[#1a1025] hover:bg-[#2d1f45] disabled:opacity-50 transition-all text-sm"
                  >
                    {loading ? 'Verifying...' : 'Redeem Pass'}
                  </button>
                </form>

                {scanResult && (
                  <div className={`mt-4 flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
                    scanResult.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-rose-50 text-rose-600 border border-rose-100'
                  }`}>
                    {scanResult.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 flex-shrink-0" />
                    }
                    {scanResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CLAIMS */}
          {view === 'claims' && (
            <div>
              {claims.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-gray-400 text-sm">No claims yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {claims.map((claim) => (
                    <div key={claim.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[15px] font-bold text-[#1a1025] mb-1">{claim.creators.name}</h3>
                          <p className="text-sm text-gray-500">{claim.creators.instagram_handle}</p>
                          <div className="flex items-center gap-3 mt-3">
                            <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-[#1a1025] text-white">{claim.creators.code}</span>
                            <span className="text-xs text-gray-400">{new Date(claim.claimed_at).toLocaleDateString()}</span>
                            <StatusPill status={claim.status} />
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col gap-2">
                          <button
                            onClick={() => { setScanCode(claim.qr_token); setView('scan'); }}
                            className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#5b3df5] text-white hover:bg-[#4e35d4] transition-colors whitespace-nowrap"
                          >
                            Scan Pass
                          </button>
                          <button
                            onClick={() => setDisputeClaimId(claim.id)}
                            className="flex items-center justify-center gap-1 px-3 py-1 text-xs text-gray-500 hover:text-amber-600 transition-colors"
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

          {/* CONTENT WALL */}
          {view === 'content' && (
            <>
              {claims.filter(c => c.reel_url).length === 0 ? (
                <div className="text-center py-16"><div className="text-4xl mb-3">🎬</div><p className="text-gray-400 text-sm">No reels submitted yet.</p></div>
              ) : (
                <>
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-4">
                    <h3 className="text-sm font-bold text-[#1a1025] mb-2">Content Library</h3>
                    <p className="text-gray-600 text-sm">
                      <span className="font-bold text-[#1a1025]">{claims.filter(c => c.reel_url).length}</span> reels received
                      {claims.filter(c => c.reel_url).length > 0 && (
                        <span className="text-gray-400 ml-2">
                          · Latest on {new Date(claims.filter(c => c.reel_url)[0].claimed_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {claims.filter(c => c.reel_url).map((claim) => (
                      <div key={claim.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm shadow-black/[0.03]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5b3df5] to-[#8b6cf7] flex items-center justify-center text-white font-bold text-xs">
                            {claim.creators.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-[#1a1025]">{claim.creators.name}</p>
                            <p className="text-xs text-gray-400">{claim.creators.instagram_handle}</p>
                          </div>
                        </div>
                        <a
                          href={claim.reel_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 transition-all"
                        >
                          View Reel <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* NOTIFICATIONS */}
          {view === 'notifications' && (
            <div className="max-w-lg mx-auto space-y-3">
              {notifications.length === 0 && (
                <div className="text-center py-16"><div className="text-4xl mb-3">🔔</div><p className="text-gray-400 text-sm">No notifications yet.</p></div>
              )}
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => !notif.read && markNotificationRead(notif.id)}
                  className={`w-full text-left bg-white rounded-2xl p-4 border transition-all ${
                    notif.read ? 'border-gray-100 opacity-50' : 'border-sky-200 bg-sky-50/30 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-gray-300' : 'bg-sky-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1a1025]">{notif.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{new Date(notif.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
