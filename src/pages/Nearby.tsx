import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TENANT_ID } from '../lib/env';
import { loadGoogleMaps } from '../lib/loadGoogle';
import { enqueue } from '../lib/queue';
import { uuid } from '../lib/ids';
import { useToast } from '../components/Toast';
import Button from '../components/Button';
import Modal from '../components/Modal';
import 'leaflet/dist/leaflet.css';

type NearbyClient = {
  id: string;
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
  last_visit_at: string | null;
  last_order_at: string | null;
  retailer: { name: string | null } | null;
};

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export default function Nearby() {
  const navigate = useNavigate();
  const toast = useToast();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [prospects, setProspects] = useState<any[]>([]);
  const [showProspects, setShowProspects] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);

  const { data: clients } = useQuery<NearbyClient[]>({
    queryKey: ['nearby-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id, name, city, latitude, longitude, last_visit_at, last_order_at,
          retailer:retailer_id(name)
        `)
        .eq('tenant_id', TENANT_ID)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(1000);

      if (error) throw error;
      const normalized = (data ?? []).map((item: any) => ({
        ...item,
        retailer: pickFirst(item.retailer)
      }));
      return normalized as NearbyClient[];
    }
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        () => {
          toast({ kind: 'error', msg: 'Could not get your location' });
        }
      );
    }
  }, [toast]);

  const findProspects = async () => {
    if (!userLocation) {
      toast({ kind: 'error', msg: 'Location required' });
      return;
    }

    try {
      const gm = await loadGoogleMaps(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY);
      const service = new gm.places.PlacesService(document.createElement('div'));
      
      const request = {
        location: new gm.LatLng(userLocation.lat, userLocation.lng),
        radius: 8000,
        keyword: 'wine store bottle shop liquor store',
        type: 'store'
      };
      
      const results = await new Promise<any[]>((resolve, reject) => {
        service.nearbySearch(request, (results: any[], status: string) => {
          if (status === gm.places.PlacesServiceStatus.OK) {
            resolve(results || []);
          } else {
            reject(new Error(`Places search failed: ${status}`));
          }
        });
      });
      
      const prospects = results.map((place: any) => ({
        place_id: place.place_id,
        name: place.name,
        address: place.vicinity || place.formatted_address || '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        types: place.types || []
      }));
      
      setProspects(prospects);
      setShowProspects(true);
      toast({ kind: 'success', msg: `Found ${prospects.length} prospects` });
    } catch (error: any) {
      toast({ kind: 'error', msg: error.message });
    }
  };

  const addProspect = async (prospect: any) => {
    try {
      await enqueue({
        kind: 'insert',
        table: 'clients',
        values: {
          id: uuid(),
          tenant_id: TENANT_ID,
          name: prospect.name,
          address: prospect.address,
          latitude: prospect.lat,
          longitude: prospect.lng,
          channel: 'Prospect',
          is_active: true
        }
      });

      toast({ kind: 'success', msg: 'Prospect added to queue' });
      setSelectedProspect(null);
    } catch (error: any) {
      toast({ kind: 'error', msg: error.message });
    }
  };

  if (!userLocation) {
    return (
      <div className="p-4 text-center">
        <p>Getting your location...</p>
      </div>
    );
  }

  return (
    <div className="h-screen relative">
      <div className="absolute inset-0">
        {/* Back button */}
        <div className="absolute top-20 left-4 z-[1000]">
          <button
            onClick={() => navigate(-1)}
            className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 border"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          
          {/* User location */}
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>Your Location</Popup>
          </Marker>
          
          {/* Client locations */}
          {clients?.map((client: NearbyClient) => (
            client.latitude && client.longitude && (
              <Marker
                key={client.id}
                position={[client.latitude, client.longitude]}
              >
                <Popup>
                  <div className="text-sm">
                    <h3 className="font-semibold">{client.name}</h3>
                    <p>{client.retailer?.name}</p>
                    <p>{client.city}</p>
                    <div className="mt-2 text-xs text-gray-600">
                      Last visit: {client.last_visit_at ? 
                        new Date(client.last_visit_at).toLocaleDateString() : 
                        'Never'
                      }
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>

        <div className="absolute bottom-4 right-4 z-[1000] space-y-2">
          <Button onClick={findProspects}>
            Find Prospects
          </Button>
          
          {prospects.length > 0 && (
            <Button 
              onClick={() => setShowProspects(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              View Prospects ({prospects.length})
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={showProspects}
        onClose={() => setShowProspects(false)}
        title="Prospects Found"
      >
        <div className="max-h-96 overflow-y-auto">
          {prospects.map((prospect, index) => (
            <div 
              key={index} 
              className="p-3 border-b last:border-b-0 hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{prospect.name}</h4>
                  <p className="text-sm text-gray-600">{prospect.address}</p>
                  <p className="text-xs text-gray-500">
                    {prospect.types.join(', ')}
                  </p>
                </div>
                <Button
                  onClick={() => setSelectedProspect(prospect)}
                  className="text-xs py-1 px-2"
                >
                  Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={!!selectedProspect}
        onClose={() => setSelectedProspect(null)}
        title="Add Prospect"
      >
        {selectedProspect && (
          <div>
            <h4 className="font-medium mb-2">{selectedProspect.name}</h4>
            <p className="text-sm text-gray-600 mb-4">{selectedProspect.address}</p>
            
            <div className="flex gap-2">
              <Button
                onClick={() => addProspect(selectedProspect)}
                className="flex-1"
              >
                Add as Prospect
              </Button>
              
              <Button
                onClick={() => setSelectedProspect(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-700"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}