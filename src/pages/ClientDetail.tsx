import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TENANT_ID } from '../lib/env';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';

type ClientRecord = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
  last_visit_at: string | null;
  last_order_at: string | null;
  retailer: { name: string | null } | null;
};

type ClientListing = {
  id: string;
  status: string;
  facings: number;
  shelf_price: number | null;
  promo_flag: boolean | null;
  last_checked_at: string | null;
  product: {
    brand: string | null;
    name: string | null;
    sku_code: string | null;
  } | null;
};

type ClientVisit = {
  id: string;
  start_at: string;
  end_at: string | null;
  duration_min: number | null;
  outcome: string | null;
  notes: string | null;
};

type ClientTask = {
  id: string;
  due_at: string;
  status: string;
  notes: string | null;
};

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: client } = useQuery<ClientRecord | null>({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id, name, city, address, is_active, last_visit_at, last_order_at,
          retailer:retailer_id(name)
        `)
        .eq('tenant_id', TENANT_ID)
        .eq('id', id!)
        .single();

      if (error) throw error;
      const normalized = data
        ? { ...data, retailer: pickFirst(data.retailer) }
        : null;
      return (normalized ?? null) as ClientRecord | null;
    },
    enabled: !!id
  });

  const { data: listings } = useQuery<ClientListing[]>({
    queryKey: ['client-products', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_products')
        .select(`
          id, status, facings, shelf_price, promo_flag, last_checked_at,
          product:product_id(brand, name, sku_code)
        `)
        .eq('tenant_id', TENANT_ID)
        .eq('client_id', id!)
        .order('last_checked_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      const normalized = (data ?? []).map((item: any) => ({
        ...item,
        product: pickFirst(item.product)
      }));
      return normalized as ClientListing[];
    },
    enabled: !!id
  });

  const { data: visits } = useQuery<ClientVisit[]>({
    queryKey: ['client-visits', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('id, start_at, end_at, duration_min, outcome, notes')
        .eq('tenant_id', TENANT_ID)
        .eq('client_id', id!)
        .order('start_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data ?? []) as ClientVisit[];
    },
    enabled: !!id
  });

  const { data: tasks } = useQuery<ClientTask[]>({
    queryKey: ['client-tasks', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rep_tasks')
        .select('id, due_at, status, notes')
        .eq('tenant_id', TENANT_ID)
        .eq('client_id', id!)
        .eq('status', 'open')
        .order('due_at');

      if (error) throw error;
      const normalized = (data ?? []).map((item: any) => ({
        ...item,
        client: pickFirst(item.client)
      }));
      return normalized as ClientTask[];
    },
    enabled: !!id
  });

  if (!client) return <div className="p-4">Loading...</div>;

  return (
    <div className="pb-20">
      <div className="bg-white p-4 border-b">
        <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
        <p className="text-gray-600">{client.retailer?.name}</p>
        <p className="text-sm text-gray-500">{client.city}</p>
        
        <div className="mt-3 flex gap-2 text-xs">
          <span>Last visit: {client.last_visit_at ? 
            new Date(client.last_visit_at).toLocaleDateString() : 'Never'}</span>
          <span>•</span>
          <span>Last order: {client.last_order_at ? 
            new Date(client.last_order_at).toLocaleDateString() : 'Never'}</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <Button 
          onClick={() => navigate(`/visit/start/${id}`)}
          className="w-full"
        >
          Start Visit
        </Button>
        
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={() => navigate(`/order/quick/${id}`)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Quick Order
          </Button>
          
          <Button 
            onClick={() => navigate(`/notes/${id}`)}
            className="bg-green-600 hover:bg-green-700"
          >
            Notes
          </Button>
        </div>
        
        <Button 
          onClick={() => navigate('/route', { state: { selectedClients: [client] } })}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          Route
        </Button>
      </div>

      <div className="p-4">
        <h2 className="text-lg font-semibold mb-3">Product Listings</h2>
        <div className="bg-white rounded-lg shadow-sm">
          {listings?.map(listing => (
            <div key={listing.id} className="p-3 border-b last:border-b-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">
                    {listing.product?.brand} {listing.product?.name}
                  </p>
                  <p className="text-xs text-gray-500">{listing.product?.sku_code}</p>
                </div>
                <div className="text-right text-sm">
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      listing.status === 'listed' ? 'bg-green-100 text-green-700' :
                      listing.status === 'unlisted' ? 'bg-red-100 text-red-700' :
                      listing.status === 'temp_oos' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {listing.status}
                    </span>
                  </div>
                  {(listing.facings > 0 || listing.shelf_price) && (
                    <p className="text-xs text-gray-600 mt-1">
                      {listing.facings > 0 && `${listing.facings} faces`}
                      {listing.facings > 0 && listing.shelf_price && ' • '}
                      {listing.shelf_price && `$${listing.shelf_price}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {listings?.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No listings found
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        <h2 className="text-lg font-semibold mb-3">Recent Visits</h2>
        <div className="bg-white rounded-lg shadow-sm">
          {visits?.map(visit => (
            <div key={visit.id} className="p-3 border-b last:border-b-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(visit.start_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {visit.duration_min}min • {visit.outcome}
                  </p>
                  {visit.notes && (
                    <p className="text-xs text-gray-600 mt-1">{visit.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {visits?.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No recent visits
            </div>
          )}
        </div>
      </div>

      {tasks && tasks.length > 0 && (
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-3">Open Tasks</h2>
          <div className="bg-white rounded-lg shadow-sm">
            {tasks.map(task => (
              <div key={task.id} className="p-3 border-b last:border-b-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">
                      Due: {new Date(task.due_at).toLocaleDateString()}
                    </p>
                    {task.notes && (
                      <p className="text-xs text-gray-600 mt-1">{task.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}