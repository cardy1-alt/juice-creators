import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, X, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CategoryIcon, getCategorySolidColor } from '../lib/categories';

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
    monthly_cap: number | null;
    slotsUsed?: number;
  }>;
}

interface DiscoveryMapProps {
  businesses: Business[];
  onClaimOffer: (offerId: string) => void;
  userLocation: { lat: number; lng: number } | null;
}

function createMarkerIcon(name: string) {
  const initials = name ? name.charAt(0).toUpperCase() : '?';
  return L.divIcon({
    html: `<div style="
      font-size: 14px;
      font-weight: 800;
      color: white;
      background: var(--terra);
      border: 2px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(34,34,34,0.2);
      font-family: 'Plus Jakarta Sans', sans-serif;
    ">${initials}</div>`,
    className: 'marker-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

function MapUpdater({ center, onMapClick }: { center: [number, number]; onMapClick: () => void }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  useEffect(() => {
    const handleClick = () => {
      onMapClick();
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);

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
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
    }
  }, [userLocation]);

  const searchLocation = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=gb`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    }
  }, []);

  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    setGeocodeError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocation(value), 400);
  };

  const selectSearchResult = (result: NominatimResult) => {
    setMapCenter([parseFloat(result.lat), parseFloat(result.lon)]);
    setSearchResults([]);
    setShowLocationInput(false);
    setLocationInput('');
  };

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
          setGeocodeError('Location access denied — enter manually');
        }
      );
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const businessesWithCoords = businesses.filter(b => b.latitude && b.longitude);

  const businessesWithDistance = businessesWithCoords
    .map(b => ({
      ...b,
      distance: calculateDistance(mapCenter[0], mapCenter[1], b.latitude, b.longitude)
    }))
    .sort((a, b) => a.distance - b.distance);

  return (
    <div className="flex flex-col h-full">
      {/* Location buttons — mt-4 for spacing below header */}
      <div className="mb-3 mt-4 flex gap-2">
        <button
          onClick={requestLocation}
          disabled={isLocating}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-[#222222] rounded-full text-[13px] font-semibold hover:bg-[#F7F7F7] transition-colors disabled:opacity-50 min-h-[44px]"
          style={{ border: '1px solid rgba(34,34,34,0.15)' }}
        >
          <Navigation className="w-4 h-4" />
          {isLocating ? 'Finding...' : 'My Location'}
        </button>
        <button
          onClick={() => setShowLocationInput(!showLocationInput)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-[#222222] rounded-full text-[13px] font-semibold hover:bg-[#F7F7F7] transition-colors min-h-[44px]"
          style={{ border: '1px solid rgba(34,34,34,0.15)' }}
        >
          <Search className="w-4 h-4" />
          Enter Location
        </button>
      </div>

      {geocodeError && (
        <p className="text-[13px] text-rose-600 mb-2 px-1">{geocodeError}</p>
      )}

      {showLocationInput && (
        <div className="mb-3 bg-white rounded-xl p-4 border border-[rgba(34,34,34,0.1)] shadow-[0_1px_4px_rgba(34,34,34,0.06)] relative">
          <label className="block text-[13px] font-semibold text-[#222222] tracking-[0.2px] mb-2">
            Enter address or postcode
          </label>
          <input
            type="text"
            value={locationInput}
            onChange={(e) => handleLocationInputChange(e.target.value)}
            placeholder="e.g., London SW1A 1AA"
            className="w-full px-4 py-[14px] rounded-[12px] bg-[#F7F7F7] text-[15px] text-[#222222] placeholder:text-[rgba(34,34,34,0.28)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] min-h-[52px]"
          />
          {/* Autocomplete dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-[rgba(34,34,34,0.1)] shadow-lg z-20 overflow-hidden">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => selectSearchResult(result)}
                  className="w-full text-left px-4 py-3 text-[14px] text-[#222222] hover:bg-[#F7F7F7] transition-colors border-b border-[rgba(34,34,34,0.06)] last:border-0"
                >
                  {result.display_name.length > 60 ? result.display_name.slice(0, 60) + '...' : result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative bg-[#F7F7F7] rounded-2xl overflow-hidden" style={{ height: '400px' }}>
        {businessesWithCoords.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-[0_2px_8px_rgba(34,34,34,0.1)] border border-[rgba(34,34,34,0.1)]">
              <MapPin className="w-12 h-12 text-[rgba(34,34,34,0.28)] mx-auto mb-2" />
              <p className="text-[rgba(34,34,34,0.5)] text-[15px] font-semibold">No businesses near you yet</p>
              <p className="text-[rgba(34,34,34,0.28)] text-[13px] mt-1">Check back soon!</p>
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <MapUpdater center={mapCenter} onMapClick={() => setSelectedBusiness(null)} />

          {businessesWithDistance.map((business) => (
            <Marker
              key={business.id}
              position={[business.latitude, business.longitude]}
              icon={createMarkerIcon(business.name)}
              eventHandlers={{
                click: () => setSelectedBusiness(business),
              }}
            >
              <Popup closeButton={true}>
                <div className="min-w-[180px]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  <h4 className="font-bold text-[14px] text-[#222222] mb-1">{business.name}</h4>
                  <p className="text-[13px] text-[rgba(34,34,34,0.5)] mb-2">{business.category}</p>
                  {business.offers.length > 0 && (
                    <p className="text-[13px] text-[var(--terra)] font-semibold mb-2">
                      {business.offers.length} offer{business.offers.length > 1 ? 's' : ''} available
                    </p>
                  )}
                  <button
                    onClick={() => setSelectedBusiness(business)}
                    className="w-full mt-2 px-3 py-2 bg-[var(--terra)] text-white text-[13px] font-semibold rounded-full hover:bg-[var(--terra-hover)] transition-colors"
                  >
                    View Offers
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="mt-4 space-y-[14px] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 550px)' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-extrabold text-[15px] text-[#222222]">Nearby Businesses</h3>
          <span className="text-[13px] text-[rgba(34,34,34,0.28)]">{businessesWithDistance.length} found</span>
        </div>

        {businessesWithDistance.map((business) => (
          <div
            key={business.id}
            className="bg-white rounded-[14px] p-[16px] border border-[rgba(34,34,34,0.1)] shadow-[0_1px_4px_rgba(34,34,34,0.06)] cursor-pointer hover:shadow-[0_1px_4px_rgba(34,34,34,0.06),0_4px_16px_rgba(34,34,34,0.04)] transition-all"
            onClick={() => setSelectedBusiness(business)}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#F7F7F7] flex items-center justify-center flex-shrink-0">
                <CategoryIcon category={business.category} className="w-5 h-5 text-[rgba(34,34,34,0.5)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-[15px] text-[#222222]">{business.name}</h4>
                  <span className="text-[13px] text-[rgba(34,34,34,0.5)] whitespace-nowrap">
                    {business.distance < 1
                      ? `${(business.distance * 1000).toFixed(0)} m`
                      : `${business.distance.toFixed(1)} km`
                    }
                  </span>
                </div>
                <p className="text-[13px] text-[rgba(34,34,34,0.5)] mt-0.5">{business.address}</p>
                {business.offers.length > 0 && (
                  <p className="text-[13px] text-[var(--terra)] font-medium mt-1">
                    {business.offers.length} offer{business.offers.length > 1 ? 's' : ''} available
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedBusiness && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4"
          onClick={() => setSelectedBusiness(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-[0_4px_24px_rgba(34,34,34,0.12)] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-[12px] bg-[#F7F7F7] flex items-center justify-center flex-shrink-0">
                    <CategoryIcon category={selectedBusiness.category} className="w-6 h-6 text-[rgba(34,34,34,0.5)]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[16px] text-[#222222]">{selectedBusiness.name}</h3>
                    <p className="text-[13px] text-[rgba(34,34,34,0.5)] mt-0.5">{selectedBusiness.address}</p>
                    <p className="text-[13px] text-[rgba(34,34,34,0.28)] mt-1">
                      {selectedBusiness.distance < 1
                        ? `${(selectedBusiness.distance * 1000).toFixed(0)} metres away`
                        : `${selectedBusiness.distance.toFixed(1)} km away`
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="text-[rgba(34,34,34,0.28)] hover:text-[rgba(34,34,34,0.5)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-[14px] text-[rgba(34,34,34,0.5)]">Available Offers</h4>
                {selectedBusiness.offers && selectedBusiness.offers.length > 0 ? (
                  selectedBusiness.offers.map((offer) => {
                  const isUnlimited = offer.monthly_cap === null;
                  const slotsUsed = offer.slotsUsed || 0;
                  const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                  const full = !isUnlimited && slotsLeft === 0;

                  return (
                    <div key={offer.id} className="bg-[#F7F7F7] rounded-[12px] p-3">
                      <p className="text-[14px] text-[rgba(34,34,34,0.5)] mb-2">{offer.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-emerald-600">{offer.reward_value}</span>
                        <button
                          onClick={() => {
                            onClaimOffer(offer.id);
                            setSelectedBusiness(null);
                          }}
                          disabled={full}
                          className="px-3 py-2 bg-[var(--terra)] text-white text-[13px] font-semibold rounded-full hover:bg-[var(--terra-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px]"
                        >
                          {full ? 'Full' : 'Claim'}
                        </button>
                      </div>
                      {isUnlimited ? (
                        <p className="text-[12px] text-[rgba(34,34,34,0.28)] mt-2">Unlimited slots</p>
                      ) : !full && (
                        <p className="text-[12px] text-[rgba(34,34,34,0.28)] mt-2">
                          {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left this month
                        </p>
                      )}
                    </div>
                  );
                })
                ) : (
                  <p className="text-[14px] text-[rgba(34,34,34,0.5)] text-center py-4">No offers available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
