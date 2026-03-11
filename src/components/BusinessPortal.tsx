import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LogOut, Plus, ExternalLink, Camera, Clock, Bell,
  Package, Users, Film, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle
} from 'lucide-react';

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
  creators: {
    name: string;
    instagram_handle: string;
    code: string;
  };
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function BusinessPortal() {
  const { userProfile, signOut } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'offers' | 'claims' | 'content' | 'scan' | 'notifications'>('offers');
  const [showNewOffer, setShowNewOffer] = useState(false);
  const [newOfferDescription, setNewOfferDescription] = useState('');
  const [newOfferCap, setNewOfferCap] = useState(4);
  const [scanCode, setScanCode] = useState('');
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userProfile?.approved) {
      fetchOffers();
      fetchClaims();
      fetchNotifications();
    }
  }, [userProfile]);

  const fetchOffers = async () => {
    const { data } = await supabase
      .from('offers')
      .select('*')
      .eq('business_id', userProfile.id)
      .order('created_at', { ascending: false });

    if (data) setOffers(data);
  };

  const fetchClaims = async () => {
    const { data } = await supabase
      .from('claims')
      .select('*, creators(name, instagram_handle, code)')
      .eq('business_id', userProfile.id)
      .order('claimed_at', { ascending: false });

    if (data) setClaims(data as ClaimWithDetails[]);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('created_at', { ascending: false })
      .limit(20);
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
      const { error } = await supabase.from('offers').insert({
        business_id: userProfile.id,
        description: newOfferDescription,
        monthly_cap: newOfferCap,
        is_live: true
      });

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
    await supabase
      .from('offers')
      .update({ is_live: !currentStatus })
      .eq('id', offerId);
    fetchOffers();
  };

  const handleScanCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setScanResult(null);

    try {
      const { data: claim } = await supabase
        .from('claims')
        .select('*, creators(name, code)')
        .eq('qr_token', scanCode)
        .eq('business_id', userProfile.id)
        .maybeSingle();

      if (!claim) {
        setScanResult({ type: 'error', message: 'Invalid QR code. Not found or not for this business.' });
        setScanCode('');
        return;
      }

      // Must be active — reject redeemed, expired, or any other status
      if (claim.status !== 'active') {
        const msg = claim.status === 'redeemed'
          ? 'This pass has already been redeemed.'
          : `This pass is ${claim.status}. Cannot redeem.`;
        setScanResult({ type: 'error', message: msg });
        setScanCode('');
        return;
      }

      // Check QR token expiry
      const qrExpiresAt = new Date(claim.qr_expires_at);
      if (qrExpiresAt < new Date()) {
        setScanResult({ type: 'error', message: 'This QR code has expired. Ask the creator to refresh it.' });
        setScanCode('');
        return;
      }

      const { error } = await supabase
        .from('claims')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString()
        })
        .eq('id', claim.id);

      if (error) throw error;

      setScanResult({ type: 'success', message: `Pass redeemed for ${claim.creators.name}!` });
      setScanCode('');
      fetchClaims();
    } catch (error: any) {
      setScanResult({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!userProfile?.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#f0eaff] via-[#e8e0f5] to-[#f5f0ff]">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm text-center border border-gray-100">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
            <Clock className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-[#1a1025]">Pending Approval</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your business account is under review. You'll be notified once approved!
          </p>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium bg-[#5b3df5] hover:bg-[#4e35d4] transition-colors"
          >
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
    <div className="min-h-screen bg-gradient-to-br from-[#f0eaff] via-[#f5f0ff] to-[#e8e0f5]">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-lg border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#1a1025]">{userProfile.name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">Business Portal</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-white/80 backdrop-blur-lg border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setView(tab.key); setScanResult(null); }}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all relative ${
                view === tab.key ? 'text-[#5b3df5]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="relative">
                <tab.icon className="w-4 h-4" />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#5b3df5] rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* OFFERS */}
          {view === 'offers' && (
            <div className="space-y-4">
              <button
                onClick={() => setShowNewOffer(!showNewOffer)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold bg-[#5b3df5] hover:bg-[#4e35d4] transition-all shadow-sm text-sm"
              >
                <Plus className="w-4 h-4" /> New Offer
              </button>

              {showNewOffer && (
                <form onSubmit={handleCreateOffer} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#1a1025] mb-1.5">Description</label>
                    <textarea
                      value={newOfferDescription}
                      onChange={(e) => setNewOfferDescription(e.target.value)}
                      placeholder="e.g. Free juice + acai bowl for a reel"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 resize-none text-sm focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5]"
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
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5]"
                      min={1}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 rounded-xl text-white font-semibold bg-[#5b3df5] hover:bg-[#4e35d4] disabled:opacity-50 text-sm transition-all"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewOffer(false)}
                      className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {offers.map((offer) => (
                  <div key={offer.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700 text-sm">{offer.description}</p>
                        <p className="text-xs text-gray-400 mt-1">Cap: {offer.monthly_cap}/month</p>
                      </div>
                      <span
                        className={`ml-2 flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          offer.is_live ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {offer.is_live ? 'Live' : 'Paused'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleOffer(offer.id, offer.is_live)}
                      className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl font-semibold text-sm transition-all ${
                        offer.is_live
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-[#5b3df5] text-white hover:bg-[#4e35d4]'
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
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#f0eaff] mb-5">
                  <Camera className="w-8 h-8 text-[#5b3df5]" />
                </div>
                <h2 className="text-xl font-bold mb-1 text-[#1a1025]">Redeem Pass</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Enter the QR token to redeem a creator's pass
                </p>
                <form onSubmit={handleScanCode} className="space-y-3">
                  <input
                    type="text"
                    value={scanCode}
                    onChange={(e) => { setScanCode(e.target.value); setScanResult(null); }}
                    placeholder="Paste QR token here"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#5b3df5]/30 focus:border-[#5b3df5]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl text-white font-semibold bg-[#5b3df5] hover:bg-[#4e35d4] disabled:opacity-50 transition-all text-sm"
                  >
                    {loading ? 'Verifying...' : 'Redeem Pass'}
                  </button>
                </form>

                {scanResult && (
                  <div className={`mt-4 flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
                    scanResult.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-100'
                      : 'bg-red-50 text-red-600 border border-red-100'
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

          {/* CLAIMS TABLE */}
          {view === 'claims' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {claims.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No claims yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Creator</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Handle</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Claimed</th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {claims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-[#1a1025]">
                            {claim.creators.name}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">
                            {claim.creators.instagram_handle}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm font-mono text-[#5b3df5] font-semibold">
                            {claim.creators.code}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">
                            {new Date(claim.claimed_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                claim.status === 'redeemed'
                                  ? 'bg-green-50 text-green-600'
                                  : claim.status === 'expired'
                                  ? 'bg-red-50 text-red-500'
                                  : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {claim.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CONTENT WALL */}
          {view === 'content' && (
            <>
              {claims.filter(c => c.reel_url).length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">No reels submitted yet.</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {claims
                    .filter((claim) => claim.reel_url)
                    .map((claim) => (
                      <div key={claim.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="mb-3">
                          <p className="font-semibold text-sm text-[#1a1025]">{claim.creators.name}</p>
                          <p className="text-xs text-gray-500">{claim.creators.instagram_handle}</p>
                        </div>
                        <a
                          href={claim.reel_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white font-semibold text-sm bg-[#5b3df5] hover:bg-[#4e35d4] transition-all"
                        >
                          View Reel <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}

          {/* NOTIFICATIONS */}
          {view === 'notifications' && (
            <div className="max-w-lg mx-auto space-y-3">
              {notifications.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No notifications yet.</div>
              )}
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => !notif.read && markNotificationRead(notif.id)}
                  className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border transition-all ${
                    notif.read ? 'border-gray-100 opacity-60' : 'border-[#5b3df5]/20 bg-[#faf8ff]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-gray-300' : 'bg-[#5b3df5]'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1a1025]">{notif.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {new Date(notif.created_at).toLocaleDateString()}
                      </p>
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
