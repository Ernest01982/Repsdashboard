import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';
import { TENANT_ID } from '../lib/env';
import { insertRow, updateRow, deleteRow, WriteDisabledError } from '../lib/mutations';
import { useForm } from 'react-hook-form';
import { useToast } from '../components/Toast';
import { loadGoogleMaps } from '../lib/loadGoogle';

export type ClientRow = {
  id: string;
  name: string;
  channel: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  last_visit_at: string | null;
  last_order_at: string | null;
  retailer_id: string | null;
  territory_id: string | null;
  retailer: { name: string | null } | null;
};

export default function Clients() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ClientRow | null>(null);

  const retailersQ = useQuery({
    queryKey: ['retailers', TENANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retailers')
        .select('id, name')
        .eq('tenant_id', TENANT_ID)
        .order('name');
      if (error) throw error;
      return data ?? [];
    }
  });

  const territoriesQ = useQuery({
    queryKey: ['territories', TENANT_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territories')
        .select('id, name')
        .eq('tenant_id', TENANT_ID)
        .order('name');
      if (error) throw error;
      return data ?? [];
    }
  });

  const clients = useQuery({
    queryKey: ['clients', TENANT_ID],
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id, name, channel, address, city, region, country, postal_code,
          latitude, longitude,
          is_active, last_visit_at, last_order_at, retailer_id, territory_id
        `)
        .eq('tenant_id', TENANT_ID)
        .order('name')
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    }
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clients.data;
    return clients.data?.filter(r =>
      [r.name, r.city ?? '', r.retailer?.name ?? ''].some(x =>
        (x || '').toLowerCase().includes(term)
      )
    );
  }, [clients.data, q]);

  const upsert = useMutation({
    mutationFn: async (values: Partial<ClientRow>) => {
      // Save basic fields first
      if (edit) return updateRow('clients', edit.id, values);
      return insertRow('clients', values);
    },
    onSuccess: () => {
      toast({ kind: 'success', msg: 'Saved' });
      setOpen(false);
      setEdit(null);
      qc.invalidateQueries({ queryKey: ['clients', TENANT_ID] });
    },
    onError: (e: any) =>
      toast({
        kind: 'error',
        msg:
          e instanceof WriteDisabledError ? e.message : e?.message ?? 'Error'
      })
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRow('clients', id),
    onSuccess: () => {
      toast({ kind: 'success', msg: 'Deleted' });
      qc.invalidateQueries({ queryKey: ['clients', TENANT_ID] });
    },
    onError: (e: any) =>
      toast({
        kind: 'error',
        msg:
          e instanceof WriteDisabledError ? e.message : e?.message ?? 'Error'
      })
  });

  function ClientForm({ initial }: { initial?: Partial<ClientRow> }) {
    const {
      register,
      handleSubmit,
      setValue,
      getValues,
      formState: { isSubmitting }
    } = useForm<Partial<ClientRow>>({
      defaultValues: {
        is_active: true,
        ...(initial as any)
      }
    });

    async function handleGeocode() {
      const v = getValues();
      const addressLine = [
        v.address,
        v.city,
        v.region,
        v.postal_code,
        v.country
      ]
        .filter(Boolean)
        .join(', ');
      if (!addressLine) {
        toast({ kind: 'info', msg: 'Enter address/city/region first' });
        return;
      }
      try {
        const gm = await loadGoogleMaps(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY);
        const geocoder = new gm.Geocoder();
        
        const result = await new Promise<any>((resolve, reject) => {
          geocoder.geocode({ address: addressLine }, (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              resolve(results[0]);
            } else {
              reject(new Error(`Geocoding failed: ${status}`));
            }
          });
        });
        
        const location = result.geometry.location;
        setValue('latitude', location.lat());
        setValue('longitude', location.lng());
        toast({
          kind: 'success',
          msg: `Geocoded ✓ (${location.lat().toFixed(5)}, ${location.lng().toFixed(5)})`
        });
      } catch (e: any) {
        toast({ kind: 'error', msg: e?.message ?? 'Geocode failed' });
      }
    }

    async function handleAddressAutocomplete(inputElement: HTMLInputElement) {
      try {
        const gm = await loadGoogleMaps(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY);
        const autocomplete = new gm.places.Autocomplete(inputElement, {
          types: ['establishment', 'geocode'],
          fields: ['formatted_address', 'geometry', 'address_components']
        });
        
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            // Parse address components
            const components = place.address_components || [];
            const getComponent = (type: string) => 
              components.find((c: any) => c.types.includes(type))?.long_name || '';
            
            setValue('address', getComponent('street_number') + ' ' + getComponent('route'));
            setValue('city', getComponent('locality') || getComponent('administrative_area_level_2'));
            setValue('region', getComponent('administrative_area_level_1'));
            setValue('postal_code', getComponent('postal_code'));
            setValue('country', getComponent('country'));
            setValue('latitude', place.geometry.location.lat());
            setValue('longitude', place.geometry.location.lng());
          toast({
            kind: 'success',
            msg: 'Address autocompleted and geocoded'
          });
          }
        });
      } catch (e: any) {
        console.warn('Autocomplete setup failed:', e);
      }
    }

    async function onSubmit(values: Partial<ClientRow>) {
      // Convert empty strings to null for UUID fields to prevent validation errors
      const cleanedValues = {
        ...values,
        retailer_id: values.retailer_id === '' ? null : values.retailer_id,
        territory_id: values.territory_id === '' ? null : values.territory_id,
      };

      // Persist core fields (address + lat/lng included)
      const saved = await upsert.mutateAsync(cleanedValues);

      // Optionally keep PostGIS geography in-sync via RPC (safe if missing)
      try {
        if (cleanedValues.latitude != null && cleanedValues.longitude != null) {
          await supabase.rpc('app.set_client_location', {
            p_tenant_id: TENANT_ID,
            p_client_id: edit?.id ?? (saved as any)?.id,
            p_lat: Number(cleanedValues.latitude),
            p_lon: Number(cleanedValues.longitude)
          });
        }
      } catch {
        // ignore if function not installed
      }
    }

    return (
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={handleSubmit(onSubmit)}
      >
        <input
          {...register('name', { required: true })}
          placeholder="Store name"
          className="col-span-2 h-9 rounded border px-3"
        />
        <input
          {...register('channel')}
          placeholder="Channel (On/Off-Trade)"
          className="h-9 rounded border px-3"
        />
        <input
          {...register('address')}
          placeholder="Street address"
          className="col-span-2 h-9 rounded border px-3"
          ref={(el) => {
            if (el && !el.dataset.autocompleteSetup) {
              el.dataset.autocompleteSetup = 'true';
              handleAddressAutocomplete(el);
            }
          }}
        />
        <input
          {...register('city')}
          placeholder="City"
          className="h-9 rounded border px-3"
        />
        <input
          {...register('region')}
          placeholder="Region/Province"
          className="h-9 rounded border px-3"
        />
        <input
          {...register('postal_code')}
          placeholder="Postal code"
          className="h-9 rounded border px-3"
        />
        <input
          {...register('country')}
          placeholder="Country (e.g. ZA)"
          className="h-9 rounded border px-3"
        />

        <div className="col-span-2 flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('is_active')} /> Active
          </label>
          <Button
            type="button"
            className="bg-gray-200 text-gray-900 hover:bg-gray-300"
            onClick={handleGeocode}
          >
            Geocode address
          </Button>
          <input
            {...register('latitude', { valueAsNumber: true })}
            placeholder="Lat"
            className="h-9 w-40 rounded border px-3"
          />
          <input
            {...register('longitude', { valueAsNumber: true })}
            placeholder="Lng"
            className="h-9 w-40 rounded border px-3"
          />
        </div>

        <select
          {...register('retailer_id')}
          className="h-9 rounded border px-3"
        >
          <option value="">Retailer…</option>
          {retailersQ.data?.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          {...register('territory_id')}
          className="h-9 rounded border px-3"
        >
          <option value="">Territory…</option>
          {territoriesQ.data?.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button
            type="button"
            className="bg-gray-200 text-gray-900 hover:bg-gray-300"
            onClick={() => {
              setOpen(false);
              setEdit(null);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            Save
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 pb-20">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clients</h1>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name/city/retailer…"
            className="h-9 w-72 rounded-lg border px-3 text-sm"
          />
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            Add Client
          </Button>
        </div>
      </div>
      <DataTable<ClientRow>
        isLoading={clients.isLoading}
        rows={filtered}
        columns={[
          { key: 'name', header: 'Store' },
          { key: 'retailer', header: 'Retailer', render: (r) => {
            const retailer = retailersQ.data?.find(ret => ret.id === r.retailer_id);
            return retailer?.name ?? '—';
          }},
          { key: 'channel', header: 'Channel' },
          { key: 'city', header: 'City' },
          { key: 'last_visit_at', header: 'Last Visit', render: (r) => (r.last_visit_at ? new Date(r.last_visit_at).toLocaleDateString() : '—') },
          { key: 'last_order_at', header: 'Last Order', render: (r) => (r.last_order_at ? new Date(r.last_order_at).toLocaleDateString() : '—') },
          { key: 'is_active', header: 'Active', render: (r) => (r.is_active ? 'Yes' : 'No') },
          { key: 'actions', header: '', render: (r) => (
            <div className="flex justify-end gap-2">
              <Button className="bg-gray-200 text-gray-900 hover:bg-gray-300" onClick={() => { setEdit(r); setOpen(true); }}>Edit</Button>
              <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => del.mutate(r.id)}>Delete</Button>
            </div>
          ), className: 'text-right w-56' }
        ]}
      />
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEdit(null);
        }}
        title={edit ? 'Edit Client' : 'Add Client'}
      >
        <ClientForm initial={edit ?? undefined} />
      </Modal>
    </div>
  );
}