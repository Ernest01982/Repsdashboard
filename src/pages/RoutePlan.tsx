import { useEffect, useState } from 'react';
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { supabase } from '../lib/supabase';
import { TENANT_ID } from '../lib/env';
import { loadGoogleMaps } from '../lib/loadGoogle';
import { useToast } from '../components/Toast';
import Button from '../components/Button';
import Modal from '../components/Modal';

type RouteClient = {
  id: string;
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
  retailer: { name: string | null } | null;
};

type RouteState = {
  selectedClients?: RouteClient[];
};

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export default function RoutePlan() {
  const routerLocation = useRouterLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const locationState = routerLocation.state as RouteState | null;

  const [selectedClients, setSelectedClients] = useState<RouteClient[]>(
    locationState?.selectedClients ?? []
  );
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<{
    distanceMeters: number;
    duration: string;
    waypointOrder: number[];
    encodedPolyline: string;
  } | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);

  const { data: clients } = useQuery<RouteClient[]>({
    queryKey: ['route-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, city, latitude, longitude, retailer:retailer_id(name)')
        .eq('tenant_id', TENANT_ID)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .eq('is_active', true)
        .order('name')
        .limit(500);

      if (error) throw error;
      const normalized = (data ?? []).map((item: any) => ({
        ...item,
        retailer: pickFirst(item.retailer)
      }));
      return normalized as RouteClient[];
    }
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

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
  }, [toast]);

  const toggleClient = (client: RouteClient) => {
    const isSelected = selectedClients.some(c => c.id === client.id);
    if (isSelected) {
      setSelectedClients(prev => prev.filter(c => c.id !== client.id));
    } else {
      setSelectedClients(prev => [...prev, client]);
    }
  };

  const optimizeRouteHandler = async () => {
    if (!userLocation) {
      toast({ kind: 'error', msg: 'Your location is required' });
      return;
    }

    if (selectedClients.length < 2) {
      toast({ kind: 'error', msg: 'Select at least 2 clients' });
      return;
    }

    try {
      const gm = await loadGoogleMaps(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY);
      
      if (!gm.DirectionsService) {
        throw new Error('Directions API not available');
      }
      
      const directionsService = new gm.DirectionsService();
      
      const waypoints = selectedClients.slice(0, -1).map(c => ({
        location: new gm.LatLng(c.latitude, c.longitude),
        stopover: true
      }));
      
      const destination = selectedClients[selectedClients.length - 1];
      
      const result = await new Promise<any>((resolve, reject) => {
        directionsService.route({
          origin: new gm.LatLng(userLocation.lat, userLocation.lng),
          destination: new gm.LatLng(destination.latitude, destination.longitude),
          waypoints: waypoints,
          optimizeWaypoints: true,
          travelMode: gm.TravelMode.DRIVING
        }, (result: any, status: string) => {
          if (status === 'OK') {
            resolve(result);
          } else {
            reject(new Error(`Route optimization failed: ${status}`));
          }
        });
      });
      
      const route = result.routes[0];
      const leg = route.legs[0];
      
      setOptimizedRoute({
        distanceMeters: route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0),
        duration: route.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0) + 's',
        waypointOrder: result.routes[0].waypoint_order || [],
        encodedPolyline: route.overview_polyline.points
      });
      
      // Convert Google Maps path to Leaflet format
      const path = route.overview_path.map((point: any) => [point.lat(), point.lng()]);
      setRoutePolyline(path);
      
      toast({ 
        kind: 'success', 
        msg: `Route optimized: ${Math.round(route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0) / 1000)}km` 
      });
      
    } catch (error: any) {
      toast({ kind: 'error', msg: `Route optimization unavailable: ${error.message}` });
    }
  };

  const openInGoogleMaps = () => {
    if (selectedClients.length === 0) return;
    
    const waypoints = selectedClients
      .map(c => `${c.latitude},${c.longitude}`)
      .join('|');
    
    const url = `https://www.google.com/maps/dir/?api=1&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const mapCenter = userLocation || { lat: 40.7128, lng: -74.0060 };

  return (
    <div className="pb-20 h-screen">
      <div className="h-full relative">
        {/* Back button */}
        <div className="absolute top-20 left-4 z-10">
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
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={13}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          
          {/* User location */}
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]}>
              <Popup>Your Location (Start)</Popup>
            </Marker>
          )}
          
          {/* Selected clients */}
          {selectedClients.map((client, index) => (
            <Marker
              key={client.id}
              position={[client.latitude, client.longitude]}
            >
              <Popup>
                <div className="text-sm">
                  <h3 className="font-semibold">{client.name}</h3>
                  <p>{client.retailer?.name}</p>
                  <p>{client.city}</p>
                  {optimizedRoute && (
                    <p className="text-xs text-blue-600">
                      Stop #{optimizedRoute.waypointOrder[index] + 1}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Route polyline */}
          {routePolyline.length > 0 && (
            <Polyline 
              positions={routePolyline}
              color="blue"
              weight={4}
              opacity={0.7}
            />
          )}
        </MapContainer>

        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
          <h3 className="font-semibold mb-2">Route Plan</h3>
          <p className="text-sm text-gray-600 mb-2">
            {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''} selected
          </p>
          
          {optimizedRoute && (
            <div className="text-xs text-gray-600">
              <p>Distance: {(optimizedRoute.distanceMeters / 1000).toFixed(1)}km</p>
              <p>Duration: {optimizedRoute.duration}</p>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 right-4 space-y-2">
          <Button onClick={() => setShowClientPicker(true)}>
            Select Clients ({selectedClients.length})
          </Button>
          
          {selectedClients.length >= 2 && (
            <>
              <Button 
                onClick={optimizeRouteHandler}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Optimize Route
              </Button>
              
              <Button 
                onClick={openInGoogleMaps}
                className="bg-green-600 hover:bg-green-700"
              >
                Open in Google Maps
              </Button>
            </>
          )}
        </div>
      </div>

      <Modal
        open={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        title="Select Clients for Route"
      >
        <div className="max-h-96 overflow-y-auto">
          {clients?.map((client: RouteClient) => {
            const isSelected = selectedClients.some(c => c.id === client.id);
            return (
              <div
                key={client.id} 
                onClick={() => toggleClient(client)}
                className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${
                  isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{client.name}</h4>
                    <p className="text-sm text-gray-600">{client.retailer?.name}</p>
                    <p className="text-xs text-gray-500">{client.city}</p>
                  </div>
                  {isSelected && (
                    <span className="text-blue-600 text-sm">✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}