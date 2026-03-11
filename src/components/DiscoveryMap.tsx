import { useState, useEffect } from 'react';
import { MapPin, Navigation, X } from 'lucide-react';
import { getCategoryEmoji } from '../lib/categories';

interface Business {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  offers: Array<{
    id: string;
    description: string;
    reward_value: string;
    monthly_cap: number;
    slotsUsed?: number;
  }>;
}

interface DiscoveryMapProps {
  businesses: Business[];
  onClaimOffer: (offerId: string) => void;
  userLocation: { lat: number; lng: number } | null;
}

export default function DiscoveryMap({ businesses, onClaimOffer, userLocation }: DiscoveryMapProps) {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [mapCenter, setMapCenter] = useState(userLocation || { lat: 40.7128, lng: -74.0060 });
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
    }
  }, [userLocation]);

  const requestLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCenter = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMapCenter(newCenter);
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
        }
      );
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const businessesWithDistance = businesses
    .filter(b => b.latitude && b.longitude)
    .map(b => ({
      ...b,
      distance: calculateDistance(mapCenter.lat, mapCenter.lng, b.latitude, b.longitude)
    }))
    .sort((a, b) => a.distance - b.distance);

  return (
    <div className="flex flex-col h-full">
      <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden" style={{ height: '400px' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-8">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-sm mb-4">Interactive map view</p>
            <button
              onClick={requestLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#5b3df5] text-white rounded-lg text-sm font-semibold hover:bg-[#4a2fcc] transition-colors disabled:opacity-50"
            >
              <Navigation className="w-4 h-4" />
              {isLocating ? 'Finding you...' : 'Use My Location'}
            </button>
          </div>
        </div>

        {businessesWithDistance.map((business) => {
          const x = 50 + (business.longitude - mapCenter.lng) * 100;
          const y = 50 - (business.latitude - mapCenter.lat) * 100;

          if (x < 0 || x > 100 || y < 0 || y > 100) return null;

          return (
            <button
              key={business.id}
              onClick={() => setSelectedBusiness(business)}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg border-2 border-[#5b3df5] flex items-center justify-center text-xl hover:scale-110 transition-transform z-10"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {getCategoryEmoji(business.category)}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 550px)' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm text-gray-900">Nearby Businesses</h3>
          <span className="text-xs text-gray-400">{businessesWithDistance.length} found</span>
        </div>

        {businessesWithDistance.map((business) => (
          <div
            key={business.id}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:border-[#5b3df5]/30 hover:shadow-md transition-all"
            onClick={() => setSelectedBusiness(business)}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50 flex items-center justify-center text-lg flex-shrink-0">
                {getCategoryEmoji(business.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm text-gray-900">{business.name}</h4>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {business.distance < 1
                      ? `${(business.distance * 5280).toFixed(0)} ft`
                      : `${business.distance.toFixed(1)} mi`
                    }
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{business.address}</p>
                {business.offers.length > 0 && (
                  <p className="text-xs text-[#5b3df5] font-medium mt-1">
                    {business.offers.length} offer{business.offers.length > 1 ? 's' : ''} available
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedBusiness && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100/50 flex items-center justify-center text-2xl flex-shrink-0">
                    {getCategoryEmoji(selectedBusiness.category)}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-gray-900">{selectedBusiness.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedBusiness.address}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedBusiness.distance < 1
                        ? `${(selectedBusiness.distance * 5280).toFixed(0)} feet away`
                        : `${selectedBusiness.distance.toFixed(1)} miles away`
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-gray-700">Available Offers</h4>
                {selectedBusiness.offers.map((offer) => {
                  const slotsUsed = offer.slotsUsed || 0;
                  const slotsLeft = Math.max(0, offer.monthly_cap - slotsUsed);
                  const full = slotsLeft === 0;

                  return (
                    <div key={offer.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-sm text-gray-700 mb-2">{offer.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600">{offer.reward_value}</span>
                        <button
                          onClick={() => {
                            onClaimOffer(offer.id);
                            setSelectedBusiness(null);
                          }}
                          disabled={full}
                          className="px-3 py-1.5 bg-[#5b3df5] text-white text-xs font-semibold rounded-lg hover:bg-[#4a2fcc] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {full ? 'Full' : 'Claim'}
                        </button>
                      </div>
                      {!full && (
                        <p className="text-[10px] text-gray-400 mt-2">
                          {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left this month
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
