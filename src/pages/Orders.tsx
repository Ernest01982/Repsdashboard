import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TENANT_ID } from '../lib/env';
import { useAuth } from '../contexts/AuthContext';

type OrderRecord = {
  id: string;
  order_date: string;
  status: string;
  total_cases: number;
  discount_total: number | null;
  notes: string | null;
  client: { name: string | null } | null;
};

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export default function Orders() {
  const { user } = useAuth();
  
  const repId = user?.id ?? null;

  const { data: orders, isLoading } = useQuery<OrderRecord[]>({
    queryKey: ['orders', repId],
    queryFn: async () => {
      if (!repId) {
        return [];
      }
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_date, status, total_cases, discount_total, notes,
          client:client_id(name)
        `)
        .eq('tenant_id', TENANT_ID)
        .eq('rep_id', repId)
        .order('order_date', { ascending: false })
        .limit(200);

      if (error) throw error;
      const normalized = (data ?? []).map((item: any) => ({
        ...item,
        client: pickFirst(item.client)
      }));
      return normalized as OrderRecord[];
    },
    enabled: !!repId
  });

  if (isLoading) return <div className="p-4">Loading orders...</div>;

  return (
    <div className="pb-20">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-600">Recent order history</p>
      </div>

      <div className="divide-y">
        {orders?.map(order => (
          <div key={order.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium text-gray-900">{order.client?.name}</h3>
                <p className="text-sm text-gray-600">
                  {new Date(order.order_date).toLocaleDateString()}
                </p>
              </div>
              
              <div className="text-right">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  order.status === 'queued' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {order.status}
                </span>
              </div>
            </div>
            
            <div className="flex justify-between text-sm text-gray-600">
              <span>{order.total_cases} cases</span>
              {order.discount_total && (
                <span>Discount: ${order.discount_total}</span>
              )}
            </div>
            
            {order.notes && (
              <p className="text-sm text-gray-600 mt-1">{order.notes}</p>
            )}
          </div>
        ))}
      </div>
      
      {orders?.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No orders found
        </div>
      )}
    </div>
  );
}