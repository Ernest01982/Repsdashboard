import { supabase } from './supabase';

type LatLng = { lat: number; lng: number };

export async function geocodeAddress(address: string) {
  const { data, error } = await supabase.functions.invoke('maps', { 
    body: { action: 'geocode', payload: { address } } 
  });
  if (error || !data?.ok) throw new Error(data?.error ?? error?.message);
  return data.result as { 
    formatted_address: string; 
    lat: number; 
    lng: number; 
    place_id: string 
  };
}

export async function placesSearch(query: string, center?: LatLng, radiusMeters = 5000) {
  const { data, error } = await supabase.functions.invoke('maps', { 
    body: { 
      action: 'places.searchText', 
      payload: center ? { 
        query, 
        locationBias: { 
          lat: center.lat, 
          lng: center.lng, 
          radiusMeters 
        } 
      } : { query } 
    } 
  });
  if (error || !data?.ok) throw new Error(data?.error ?? error?.message);
  return data.result as Array<{ 
    place_id: string; 
    name: string; 
    address: string; 
    lat: number; 
    lng: number; 
    types: string[] 
  }>;
}

export async function optimizeRoute(origin: LatLng, waypoints: LatLng[], destination?: LatLng) {
  const { data, error } = await supabase.functions.invoke('maps', { 
    body: { 
      action: 'route.optimize', 
      payload: { origin, waypoints, destination } 
    } 
  });
  if (error || !data?.ok) throw new Error(data?.error ?? error?.message);
  return data.result as { 
    distanceMeters: number; 
    duration: string; 
    waypointOrder: number[]; 
    encodedPolyline: string 
  };
}

export function decodePolyline(str: string): [number, number][] {
  let index = 0, lat = 0, lng = 0; 
  const coords: [number, number][] = [];
  
  while (index < str.length) { 
    let b, shift = 0, result = 0;
    do { 
      b = str.charCodeAt(index++) - 63; 
      result |= (b & 0x1f) << shift; 
      shift += 5; 
    } while (b >= 0x20);
    
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1); 
    lat += dlat;
    shift = 0; result = 0;
    
    do { 
      b = str.charCodeAt(index++) - 63; 
      result |= (b & 0x1f) << shift; 
      shift += 5; 
    } while (b >= 0x20);
    
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1); 
    lng += dlng;
    coords.push([lat / 1e5, lng / 1e5]);
  } 
  
  return coords;
}