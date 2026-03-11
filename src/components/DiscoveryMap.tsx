import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, X, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCategoryEmoji } from '../lib/categories';

const DEFAULT_CENTER: [number, number] = [52.2465, 0.7135];

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

function createEmojiIcon(emoji: string) {
  return L.divIcon({
    html: `<div style="
      font-size: 24px;
      background: white;
      border: 3px solid #5b3df5;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    ">${emoji}</div>`,
    className: 'emoji-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function DiscoveryMap({ businesses, onClaimOffer, userLocation }: DiscoveryMapProps) {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER
  );
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
    }
  }, [userLocation]);

  const requestLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter([position.coords.latitude, position.coords.longitude]);
          setIsLocating(false);
        },
        () => {
          setIsLocating(false);
        }
      );
    }
  };

  const geocodeLocation = async () => {
    if (!locationInput.trim()) return;

    setGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationInput)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setShowLocationInput(false);
        setLocationInput('');
      } else {
        alert('Location not found. Try a different search term.');
      }
    } catch (error) {
      alert('Failed to find location. Please try again.');
    } finally {
      setGeocoding(false);
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

  // TODO: Remove these fallback coordinates once businesses have real coordinates from address autocomplete
  const FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
    'Midgar Coffee': { lat: 52.2462, lng: 0.7142 },
    'Loyal Wolf Barbershop': { lat: 52.2458, lng: 0.7138 },
    'Yes You Can Fitness': { lat: 52.2470, lng: 0.7155 },
  };

  const businessesWithCoords = businesses.map(b => {
    if (b.latitude && b.longitude) {
      return b;
    }
    const fallback = FALLBACK_COORDS[b.name];
    if (fallback) {
      return { ...b, latitude: fallback.lat, longitude: fallback.lng };
    }
    return b;
  }).filter(b => b.latitude && b.longitude);

  const businessesWithDistance = businessesWithCoords
    .map(b => ({
      ...b,
      distance: calculateDistance(mapCenter[0], mapCenter[1], b.latitude, b.longitude)
    }))
    .sort((a, b) => a.distance - b.distance);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex gap-2">
        <button
          onClick={requestLocation}
          disabled={isLocating}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5b3df5] text-white rounded-xl text-sm font-semibold hover:bg-[#4a2fcc] transition-colors disabled:opacity-50"
        >
          <Navigation className="w-4 h-4" />
          {isLocating ? 'Finding...' : 'My Location'}
        </button>
        <button
          onClick={() => setShowLocationInput(!showLocationInput)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:border-[#5b3df5] hover:text-[#5b3df5] transition-colors"
        >
          <Search className="w-4 h-4" />
          Enter Location
        </button>
      </div>

      {showLocationInput && (
        <div className="mb-3 bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Enter address or postcode
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && geocodeLocation()}
              placeholder="e.g., London SW1A 1AA"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5b3df5] focus:border-transparent"
            />
            <button
              onClick={geocodeLocation}
              disabled={geocoding || !locationInput.trim()}
              className="px-4 py-2 bg-[#5b3df5] text-white rounded-lg text-sm font-semibold hover:bg-[#4a2fcc] transition-colors disabled:opacity-40"
            >
              {geocoding ? 'Searching...' : 'Go'}
            </button>
          </div>
        </div>
      )}

      <div className="relative bg-gray-100 rounded-2xl overflow-hidden" style={{ height: '400px' }}>
        {businessesWithCoords.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm font-semibold">No businesses near you yet</p>
              <p className="text-gray-400 text-xs mt-1">Check back soon!</p>
            </div>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={mapCenter} />

          {businessesWithDistance.map((business) => (
            <Marker
              key={business.id}
              position={[business.latitude, business.longitude]}
              icon={createEmojiIcon(getCategoryEmoji(business.category))}
              eventHandlers={{
                click: () => setSelectedBusiness(business),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <h4 className="font-bold text-gray-900">{business.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{business.category}</p>
                  {business.offers.length > 0 && (
                    <p className="text-xs text-[#5b3df5] font-semibold mt-1">
                      {business.offers.length} offer{business.offers.length > 1 ? 's' : ''} available
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
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
                {selectedBusiness.offers && selectedBusiness.offers.length > 0 ? (
                  selectedBusiness.offers.map((offer) => {
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
                })
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No offers available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
