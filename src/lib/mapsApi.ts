import { supabase } from './supabase';
import { TENANT_ID } from './env';

export async function geocodeAddress(address: string, region?: string) {
  const { data, error } = await supabase.functions.invoke('maps', {
    body: { action: 'geocode', payload: { address: address } }
  });
  if (error) throw error;
  return data as {
    formatted_address: string | null;
    place_id: string | null;
    location: { lat: number; lng: number } | null;
  };
}