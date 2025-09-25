import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { enqueue } from '../lib/queue';
import { uuid } from '../lib/ids';
import { TENANT_ID } from '../lib/env';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { loadGoogleMaps } from '../lib/loadGoogle';
import Button from '../components/Button';

type RetailerOption = {
  id: string;
  name: string | null;
};

type FormData = {
  name: string;
  retailer_id: string;
  address: string;
  city: string;
  region: string;
  postal_code: string;
  channel: string;
  store_code: string;
  call_cadence: string;
};

export default function AddClient() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      channel: 'On-premise',
      call_cadence: 'Weekly'
    }
  });

  const address = watch('address');
  const city = watch('city');

  // Load retailers for dropdown
  const { data: retailers } = useQuery<RetailerOption[]>({
    queryKey: ['retailers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retailers')
        .select('id, name')
        .eq('tenant_id', TENANT_ID)
        .order('name');

      if (error) throw error;
      return (data ?? []) as RetailerOption[];
    }
  });

  const geocodeLocation = async () => {
    const fullAddress = `${address}, ${city}`.trim();
    if (!fullAddress || fullAddress === ',') {
      toast({ kind: 'error', msg: 'Please enter address and city first' });
      return;
    }

    setGeocoding(true);
    try {
      const gm = await loadGoogleMaps(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY);
      
      if (!gm?.Geocoder) {
        throw new Error('Geocoding service not available');
      }
      
      const geocoder = new gm.Geocoder();
      
      const result = await new Promise<any>((resolve, reject) => {
        geocoder.geocode({ address: fullAddress }, (results: any[], status: string) => {
          if (status === gm.GeocoderStatus.OK && results?.[0]) {
            resolve(results[0]);
          } else if (status === gm.GeocoderStatus.ZERO_RESULTS) {
            reject(new Error('No results found for this address'));
          } else if (status === gm.GeocoderStatus.OVER_QUERY_LIMIT) {
            reject(new Error('Geocoding quota exceeded'));
          } else if (status === gm.GeocoderStatus.REQUEST_DENIED) {
            reject(new Error('Geocoding request denied - check API key permissions'));
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });
      
      const location = result.geometry.location;
      toast({ kind: 'success', msg: 'Location found and will be saved' });
      
      // Store geocoded data for form submission
      (window as any).geocodedLocation = {
        lat: location.lat(),
        lng: location.lng(),
        formatted_address: result.formatted_address
      };
    } catch (error: any) {
      console.error('Geocoding error:', error);
      toast({ kind: 'error', msg: `Geocoding failed: ${error.message}` });
    } finally {
      setGeocoding(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!data.name.trim()) {
      toast({ kind: 'error', msg: 'Client name is required' });
      return;
    }

    setLoading(true);
    try {
      const clientId = uuid();
      const geocoded = (window as any).geocodedLocation;

      await enqueue({
        kind: 'insert',
        table: 'clients',
        values: {
          id: clientId,
          name: data.name.trim(),
          retailer_id: data.retailer_id || null,
          address: data.address.trim() || null,
          city: data.city.trim() || null,
          region: data.region.trim() || null,
          postal_code: data.postal_code.trim() || null,
          channel: data.channel || null,
          store_code: data.store_code.trim() || null,
          call_cadence: data.call_cadence || null,
          latitude: geocoded?.lat || null,
          longitude: geocoded?.lng || null,
          is_active: true
        }
      });

      toast({ kind: 'success', msg: 'Client added and queued for sync' });
      navigate('/clients');
      
    } catch (error: any) {
      toast({ kind: 'error', msg: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Add New Client</h1>
        <p className="text-gray-600">Create a new client record</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client Name *
          </label>
          <input
            type="text"
            {...register('name', { required: 'Client name is required' })}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Enter client name"
          />
          {errors.name && (
            <p className="text-red-600 text-xs mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Retailer
          </label>
          <select
            {...register('retailer_id')}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Select retailer (optional)</option>
            {retailers?.map(retailer => (
              <option key={retailer.id} value={retailer.id}>
                {retailer.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address
          </label>
          <input
            type="text"
            {...register('address')}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Street address"
            ref={(el) => {
              if (el && !el.dataset.autocompleteSetup) {
                el.dataset.autocompleteSetup = 'true';
                handleAddressAutocomplete(el);
              }
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <input
              type="text"
              {...register('city')}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="City"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Region/State
            </label>
            <input
              type="text"
              {...register('region')}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Region"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Postal Code
          </label>
          <input
            type="text"
            {...register('postal_code')}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Postal code"
          />
        </div>

        {(address || city) && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <Button
              type="button"
              onClick={geocodeLocation}
              disabled={geocoding}
              className="text-sm bg-blue-600 hover:bg-blue-700"
            >
              {geocoding ? 'Finding Location...' : 'Get GPS Coordinates'}
            </Button>
            <p className="text-xs text-gray-600 mt-1">
              Optional: Get precise location for mapping
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel
            </label>
            <select
              {...register('channel')}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="On-premise">On-premise</option>
              <option value="Off-premise">Off-premise</option>
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Call Cadence
            </label>
            <select
              {...register('call_cadence')}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="Weekly">Weekly</option>
              <option value="Bi-weekly">Bi-weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Store Code
          </label>
          <input
            type="text"
            {...register('store_code')}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Internal store code (optional)"
          />
        </div>

        <div className="pt-4 space-y-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Adding Client...' : 'Add Client'}
          </Button>
          
          <Button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full bg-gray-600 hover:bg-gray-700"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}