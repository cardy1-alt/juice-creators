import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Clock, ExternalLink } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';

interface Offer {
  id: string;
  business_id: string;
  description: string;
  monthly_cap: number;
  businesses: {
    name: string;
  };
}

interface Claim {
  id: string;
  status: string;
  qr_token: string;
  qr_expires_at: string;
  claimed_at: string;
  redeemed_at: string | null;
  reel_url: string | null;
  offers: {
    description: string;
  };
  businesses: {
    name: string;
  };
}

export default function CreatorApp() {
  const { userProfile, signOut } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [activeClaim, setActiveClaim] = useState<Claim | null>(null);
  const [view, setView] = useState<'offers' | 'active' | 'history'>('offers');
  const [reelUrl, setReelUrl] = useState('');
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
      .select('*, businesses(name)')
      .eq('is_live', true);

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
      setOffers(offersWithSlots as any);
    }
  };

  const fetchClaims = async () => {
    const { data } = await supabase
      .from('claims')
      .select('*, offers(description), businesses(name)')
      .eq('creator_id', userProfile.id)
      .order('claimed_at', { ascending: false });

    if (data) {
      setClaims(data as any);
      const active = data.find((c: any) => c.status === 'active');
      if (active) setActiveClaim(active as any);
    }
  };

  const handleClaim = async (offer: Offer) => {
    if (activeClaim) {
      alert('You already have an active claim. Please redeem or wait for it to expire.');
      return;
    }

    setLoading(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const qrToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const qrExpiresAt = new Date(Date.now() + 30000).toISOString();

      const { data, error } = await supabase
        .from('claims')
        .insert({
          creator_id: userProfile.id,
          offer_id: offer.id,
          business_id: offer.business_id,
          status: 'active',
          qr_token: qrToken,
          qr_expires_at: qrExpiresAt,
          month: currentMonth
        })
        .select('*, offers(description), businesses(name)')
        .single();

      if (error) throw error;

      setActiveClaim(data as any);
      setView('active');
      fetchOffers();
      fetchClaims();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReel = async () => {
    if (!reelUrl || !activeClaim) return;

    setLoading(true);
    try {
      await supabase
        .from('claims')
        .update({ reel_url: reelUrl })
        .eq('id', activeClaim.id);

      alert('Reel submitted successfully!');
      setReelUrl('');
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
            Your creator account is under review. You'll be notified once approved!
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
      <div className="max-w-md mx-auto">
        <div className="bg-white shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#1a1025' }}>
                {userProfile.name}
              </h1>
              <p className="text-sm text-gray-600">{userProfile.instagram_handle}</p>
              <p className="text-xs font-mono mt-1" style={{ color: '#5b3df5' }}>
                {userProfile.code}
              </p>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-xl hover:bg-gray-100"
            >
              <LogOut className="w-5 h-5" style={{ color: '#1a1025' }} />
            </button>
          </div>
        </div>

        <div className="flex bg-white border-b">
          <button
            onClick={() => setView('offers')}
            className={`flex-1 py-4 text-sm font-medium ${
              view === 'offers' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'offers' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            Available
          </button>
          <button
            onClick={() => setView('active')}
            className={`flex-1 py-4 text-sm font-medium ${
              view === 'active' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'active' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            Active Pass
          </button>
          <button
            onClick={() => setView('history')}
            className={`flex-1 py-4 text-sm font-medium ${
              view === 'history' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'history' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            History
          </button>
        </div>

        <div className="p-4 space-y-4">
          {view === 'offers' && (
            <>
              {offers.map((offer: any) => (
                <div key={offer.id} className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1025' }}>
                    {offer.businesses.name}
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">{offer.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {offer.slotsUsed}/{offer.monthly_cap} claimed this month
                    </span>
                    <button
                      onClick={() => handleClaim(offer)}
                      disabled={loading || offer.slotsUsed >= offer.monthly_cap}
                      className="px-6 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                      style={{ backgroundColor: '#5b3df5' }}
                    >
                      Claim
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {view === 'active' && activeClaim && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1025' }}>
                {activeClaim.businesses.name}
              </h3>
              <p className="text-gray-600 mb-4 text-sm">{activeClaim.offers.description}</p>

              <QRCodeDisplay token={activeClaim.qr_token} creatorCode={userProfile.code} />

              <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#f0eaff' }}>
                <p className="text-xs text-gray-600 mb-2">Visit deadline: 7 days</p>
                <p className="text-xs text-gray-600">Post deadline: 48hrs after visit</p>
              </div>

              {activeClaim.redeemed_at && !activeClaim.reel_url && (
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-medium" style={{ color: '#1a1025' }}>
                    Submit Your Reel
                  </label>
                  <input
                    type="url"
                    value={reelUrl}
                    onChange={(e) => setReelUrl(e.target.value)}
                    placeholder="https://instagram.com/reel/..."
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm"
                  />
                  <button
                    onClick={handleSubmitReel}
                    disabled={loading}
                    className="w-full py-2 rounded-xl text-white text-sm font-medium"
                    style={{ backgroundColor: '#5b3df5' }}
                  >
                    Submit Reel
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'history' && (
            <>
              {claims.map((claim) => (
                <div key={claim.id} className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold" style={{ color: '#1a1025' }}>
                        {claim.businesses.name}
                      </h3>
                      <p className="text-sm text-gray-600">{claim.offers.description}</p>
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${
                        claim.status === 'redeemed'
                          ? 'bg-green-100 text-green-700'
                          : claim.status === 'expired'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {claim.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-500">
                      {new Date(claim.claimed_at).toLocaleDateString()}
                    </span>
                    {claim.reel_url && (
                      <a
                        href={claim.reel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium"
                        style={{ color: '#5b3df5' }}
                      >
                        View Reel <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
