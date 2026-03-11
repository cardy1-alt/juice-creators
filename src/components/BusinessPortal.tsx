import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Plus, QrCode, ExternalLink, Camera, Clock } from 'lucide-react';

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

export default function BusinessPortal() {
  const { userProfile, signOut } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [view, setView] = useState<'offers' | 'claims' | 'content' | 'scan'>('offers');
  const [showNewOffer, setShowNewOffer] = useState(false);
  const [newOfferDescription, setNewOfferDescription] = useState('');
  const [newOfferCap, setNewOfferCap] = useState(4);
  const [scanCode, setScanCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userProfile?.approved) {
      fetchOffers();
      fetchClaims();
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

    if (data) setClaims(data as any);
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.from('offers').insert({
        business_id: userProfile.id,
        description: newOfferDescription,
        monthly_cap: newOfferCap,
        is_live: true
      });

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

    try {
      const { data: claim } = await supabase
        .from('claims')
        .select('*, creators(name, code)')
        .eq('qr_token', scanCode)
        .eq('business_id', userProfile.id)
        .maybeSingle();

      if (!claim) {
        alert('Invalid or expired QR code');
        setScanCode('');
        setLoading(false);
        return;
      }

      if (claim.status === 'redeemed') {
        alert('This pass has already been redeemed');
        setScanCode('');
        setLoading(false);
        return;
      }

      const qrExpiresAt = new Date(claim.qr_expires_at);
      if (qrExpiresAt < new Date()) {
        alert('This QR code has expired. Please ask the creator to refresh it.');
        setScanCode('');
        setLoading(false);
        return;
      }

      await supabase
        .from('claims')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString()
        })
        .eq('id', claim.id);

      alert(`Pass redeemed successfully for ${claim.creators.name}!`);
      setScanCode('');
      fetchClaims();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!userProfile?.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f0eaff' }}>
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md text-center">
          <Clock className="w-16 h-16 mx-auto mb-4" style={{ color: '#5b3df5' }} />
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a1025' }}>
            Pending Approval
          </h2>
          <p className="text-gray-600 mb-6">
            Your business account is under review. You'll be notified once approved!
          </p>
          <button
            onClick={signOut}
            className="px-6 py-2 rounded-xl text-white font-medium"
            style={{ backgroundColor: '#5b3df5' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0eaff' }}>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#1a1025' }}>
                {userProfile.name}
              </h1>
              <p className="text-sm text-gray-600">Business Portal</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-xl hover:bg-gray-100"
            >
              <LogOut className="w-5 h-5" style={{ color: '#1a1025' }} />
            </button>
          </div>
        </div>

        <div className="flex bg-white border-b overflow-x-auto">
          <button
            onClick={() => setView('offers')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
              view === 'offers' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'offers' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            My Offers
          </button>
          <button
            onClick={() => setView('scan')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
              view === 'scan' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'scan' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            Scan QR
          </button>
          <button
            onClick={() => setView('claims')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
              view === 'claims' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'claims' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            All Claims
          </button>
          <button
            onClick={() => setView('content')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
              view === 'content' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'content' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            Content Wall
          </button>
        </div>

        <div className="p-6">
          {view === 'offers' && (
            <div className="space-y-4">
              <button
                onClick={() => setShowNewOffer(!showNewOffer)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium"
                style={{ backgroundColor: '#5b3df5' }}
              >
                <Plus className="w-5 h-5" /> Create New Offer
              </button>

              {showNewOffer && (
                <form onSubmit={handleCreateOffer} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#1a1025' }}>
                      Offer Description
                    </label>
                    <textarea
                      value={newOfferDescription}
                      onChange={(e) => setNewOfferDescription(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 resize-none"
                      rows={3}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#1a1025' }}>
                      Monthly Cap
                    </label>
                    <input
                      type="number"
                      value={newOfferCap}
                      onChange={(e) => setNewOfferCap(parseInt(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200"
                      min={1}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 rounded-xl text-white font-medium"
                      style={{ backgroundColor: '#5b3df5' }}
                    >
                      Create Offer
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewOffer(false)}
                      className="px-6 py-2 rounded-xl bg-gray-200 text-gray-700 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {offers.map((offer) => (
                  <div key={offer.id} className="bg-white rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <p className="text-gray-600 mb-2">{offer.description}</p>
                        <p className="text-sm text-gray-500">Cap: {offer.monthly_cap}/month</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          offer.is_live ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {offer.is_live ? 'Live' : 'Paused'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleOffer(offer.id, offer.is_live)}
                      className="w-full py-2 rounded-xl font-medium"
                      style={{
                        backgroundColor: offer.is_live ? '#e5e7eb' : '#5b3df5',
                        color: offer.is_live ? '#374151' : '#ffffff'
                      }}
                    >
                      {offer.is_live ? 'Pause Offer' : 'Activate Offer'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'scan' && (
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                <Camera className="w-16 h-16 mx-auto mb-4" style={{ color: '#5b3df5' }} />
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a1025' }}>
                  Scan Creator Pass
                </h2>
                <p className="text-gray-600 mb-6">
                  Enter the QR code or creator code to redeem
                </p>
                <form onSubmit={handleScanCode} className="space-y-4">
                  <input
                    type="text"
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    placeholder="Enter code or scan QR"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg font-mono"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl text-white font-medium"
                    style={{ backgroundColor: '#5b3df5' }}
                  >
                    Redeem Pass
                  </button>
                </form>
              </div>
            </div>
          )}

          {view === 'claims' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creator</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Handle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claimed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {claims.map((claim) => (
                      <tr key={claim.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#1a1025' }}>
                          {claim.creators.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {claim.creators.instagram_handle}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: '#5b3df5' }}>
                          {claim.creators.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(claim.claimed_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              claim.status === 'redeemed'
                                ? 'bg-green-100 text-green-700'
                                : claim.status === 'expired'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
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
            </div>
          )}

          {view === 'content' && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {claims
                .filter((claim) => claim.reel_url)
                .map((claim) => (
                  <div key={claim.id} className="bg-white rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-bold" style={{ color: '#1a1025' }}>
                          {claim.creators.name}
                        </p>
                        <p className="text-sm text-gray-600">{claim.creators.instagram_handle}</p>
                      </div>
                    </div>
                    <a
                      href={claim.reel_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-medium"
                      style={{ backgroundColor: '#5b3df5' }}
                    >
                      View Reel <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
