import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Users, Store, FileText, TrendingUp } from 'lucide-react';

interface Creator {
  id: string;
  name: string;
  instagram_handle: string;
  email: string;
  code: string;
  approved: boolean;
  created_at: string;
}

interface Business {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  approved: boolean;
  created_at: string;
}

interface OfferWithBusiness {
  id: string;
  description: string;
  monthly_cap: number;
  is_live: boolean;
  businesses: {
    name: string;
  };
}

interface ClaimWithDetails {
  id: string;
  status: string;
  claimed_at: string;
  creators: {
    name: string;
  };
  businesses: {
    name: string;
  };
}

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [view, setView] = useState<'stats' | 'creators' | 'businesses' | 'offers' | 'claims'>('stats');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [offers, setOffers] = useState<OfferWithBusiness[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [stats, setStats] = useState({
    totalCreators: 0,
    totalBusinesses: 0,
    totalClaims: 0,
    totalReels: 0
  });

  useEffect(() => {
    fetchAll();
  }, []);

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
    if (offersData.data) setOffers(offersData.data as any);
    if (claimsData.data) {
      setClaims(claimsData.data as any);
      const thisMonthClaims = claimsData.data.filter((c: any) => c.claimed_at.startsWith(currentMonth));
      const reelsPosted = claimsData.data.filter((c: any) => c.reel_url).length;
      setStats({
        totalCreators: creatorsData.data?.length || 0,
        totalBusinesses: businessesData.data?.length || 0,
        totalClaims: thisMonthClaims.length,
        totalReels: reelsPosted
      });
    }
  };

  const handleApproveCreator = async (id: string, approved: boolean) => {
    await supabase.from('creators').update({ approved }).eq('id', id);
    fetchAll();
  };

  const handleApproveBusiness = async (id: string, approved: boolean) => {
    await supabase.from('businesses').update({ approved }).eq('id', id);
    fetchAll();
  };

  const handleUpdateClaimStatus = async (id: string, status: string) => {
    await supabase.from('claims').update({ status }).eq('id', id);
    fetchAll();
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0eaff' }}>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#1a1025' }}>
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-600">Juice Creators Platform</p>
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
            onClick={() => setView('stats')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
              view === 'stats' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'stats' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            Overview
          </button>
          <button
            onClick={() => setView('creators')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
              view === 'creators' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'creators' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            Creators
          </button>
          <button
            onClick={() => setView('businesses')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
              view === 'businesses' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'businesses' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            Businesses
          </button>
          <button
            onClick={() => setView('offers')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${
              view === 'offers' ? 'border-b-2' : 'text-gray-500'
            }`}
            style={view === 'offers' ? { borderColor: '#5b3df5', color: '#5b3df5' } : {}}
          >
            All Offers
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
        </div>

        <div className="p-6">
          {view === 'stats' && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <Users className="w-10 h-10 mb-4" style={{ color: '#5b3df5' }} />
                <p className="text-3xl font-bold mb-1" style={{ color: '#1a1025' }}>
                  {stats.totalCreators}
                </p>
                <p className="text-sm text-gray-600">Total Creators</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <Store className="w-10 h-10 mb-4" style={{ color: '#5b3df5' }} />
                <p className="text-3xl font-bold mb-1" style={{ color: '#1a1025' }}>
                  {stats.totalBusinesses}
                </p>
                <p className="text-sm text-gray-600">Total Businesses</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <FileText className="w-10 h-10 mb-4" style={{ color: '#5b3df5' }} />
                <p className="text-3xl font-bold mb-1" style={{ color: '#1a1025' }}>
                  {stats.totalClaims}
                </p>
                <p className="text-sm text-gray-600">Claims This Month</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <TrendingUp className="w-10 h-10 mb-4" style={{ color: '#5b3df5' }} />
                <p className="text-3xl font-bold mb-1" style={{ color: '#1a1025' }}>
                  {stats.totalReels}
                </p>
                <p className="text-sm text-gray-600">Total Reels Posted</p>
              </div>
            </div>
          )}

          {view === 'creators' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Handle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {creators.map((creator) => (
                      <tr key={creator.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#1a1025' }}>
                          {creator.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {creator.instagram_handle}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: '#5b3df5' }}>
                          {creator.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {creator.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              creator.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {creator.approved ? 'Approved' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {!creator.approved && (
                            <button
                              onClick={() => handleApproveCreator(creator.id, true)}
                              className="px-4 py-1 rounded-lg text-white font-medium text-xs"
                              style={{ backgroundColor: '#5b3df5' }}
                            >
                              Approve
                            </button>
                          )}
                          {creator.approved && (
                            <button
                              onClick={() => handleApproveCreator(creator.id, false)}
                              className="px-4 py-1 rounded-lg bg-red-500 text-white font-medium text-xs"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'businesses' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {businesses.map((business) => (
                      <tr key={business.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#1a1025' }}>
                          {business.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {business.slug}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {business.owner_email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              business.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {business.approved ? 'Approved' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {!business.approved && (
                            <button
                              onClick={() => handleApproveBusiness(business.id, true)}
                              className="px-4 py-1 rounded-lg text-white font-medium text-xs"
                              style={{ backgroundColor: '#5b3df5' }}
                            >
                              Approve
                            </button>
                          )}
                          {business.approved && (
                            <button
                              onClick={() => handleApproveBusiness(business.id, false)}
                              className="px-4 py-1 rounded-lg bg-red-500 text-white font-medium text-xs"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'offers' && (
            <div className="grid gap-4 md:grid-cols-2">
              {offers.map((offer) => (
                <div key={offer.id} className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1" style={{ color: '#1a1025' }}>
                        {offer.businesses.name}
                      </h3>
                      <p className="text-gray-600 text-sm mb-2">{offer.description}</p>
                      <p className="text-xs text-gray-500">Cap: {offer.monthly_cap}/month</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        offer.is_live ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {offer.is_live ? 'Live' : 'Paused'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'claims' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creator</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claimed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {claims.map((claim) => (
                      <tr key={claim.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: '#1a1025' }}>
                          {claim.creators.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {claim.businesses.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(claim.claimed_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={claim.status}
                            onChange={(e) => handleUpdateClaimStatus(claim.id, e.target.value)}
                            className="px-3 py-1 rounded-lg text-xs font-medium border"
                            style={{ borderColor: '#5b3df5', color: '#5b3df5' }}
                          >
                            <option value="active">Active</option>
                            <option value="redeemed">Redeemed</option>
                            <option value="expired">Expired</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleUpdateClaimStatus(claim.id, 'expired')}
                            className="px-4 py-1 rounded-lg bg-red-500 text-white font-medium text-xs"
                          >
                            Expire
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
