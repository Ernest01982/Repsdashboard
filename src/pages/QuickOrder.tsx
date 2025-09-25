import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TENANT_ID, ENABLE_WRITES } from '../lib/env';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import { enqueue } from '../lib/queue';
import { uuid } from '../lib/ids';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';

type ProductMini = { id: string; brand: string | null; name: string | null; sku_code: string | null; case_price: number | null };
type Line = { product_id: string; qty: number; price: number | null; brand?: string | null; name?: string | null; sku?: string | null; reason?: string | null };

export default function QuickOrder(){
  const { clientId } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  const productsQ = useQuery({
    queryKey: ['rep-products-mini', TENANT_ID],
    queryFn: async (): Promise<ProductMini[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, brand, name, sku_code, case_price')
        .eq('tenant_id', TENANT_ID)
        .eq('is_active', true)
        .order('brand')
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ProductMini[];
    }
  });

  const [query, setQuery] = React.useState('');
  const [lines, setLines] = React.useState<Line[]>([]);
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const filtered = React.useMemo(()=>{
    const q = query.trim().toLowerCase();
    if(!q) return productsQ.data ?? [];
    return (productsQ.data ?? []).filter(p =>
      [p.brand ?? '', p.name ?? '', p.sku_code ?? ''].some(x => x.toLowerCase().includes(q))
    );
  }, [productsQ.data, query]);

  function addProduct(p: ProductMini){
    setLines(prev => {
      const exists = prev.find(l => l.product_id === p.id);
      if (exists) return prev.map(l => l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { product_id: p.id, qty: 1, price: p.case_price ?? null, brand: p.brand, name: p.name, sku: p.sku_code }];
    });
    setQuery('');
  }

  function updateQty(id: string, qty: number){
    setLines(prev => prev.map(l => l.product_id === id ? { ...l, qty: Math.max(0, Math.floor(qty || 0)) } : l));
  }
  function updatePrice(id: string, price: number | null){
    setLines(prev => prev.map(l => l.product_id === id ? { ...l, price } : l));
  }
  function removeLine(id: string){
    setLines(prev => prev.filter(l => l.product_id !== id));
  }

  const orderTotal = React.useMemo(()=> lines.reduce((acc, l) => acc + (l.qty || 0) * (l.price ?? 0), 0), [lines]);
  const totalCases = React.useMemo(()=> lines.reduce((acc, l) => acc + (l.qty || 0), 0), [lines]);

  async function submit(){
    if (!clientId) { toast({ kind: 'error', msg: 'Missing client' }); return; }
    if (lines.length === 0) { toast({ kind: 'error', msg: 'Add at least one product' }); return; }
    const orderId = uuid();

    // Build bundle: order + items
    const orderInsert = {
      kind: 'insert' as const,
      table: 'orders',
      values: {
        id: orderId,
        client_id: clientId,
        rep_id: user?.id ?? null,
        order_date: new Date().toISOString(),
        status: 'queued',
        notes,
        total_cases: totalCases
      }
    };
    const itemsOps = lines.map(l => ({
      kind: 'insert' as const,
      table: 'order_items',
      values: {
        id: uuid(),
        order_id: orderId,
        product_id: l.product_id,
        qty_cases: l.qty,
        unit_price: l.price ?? null,
        discount_reason_id: null
      }
    }));

    try {
      setSaving(true);
      await enqueue({ kind: 'bundle', ops: [orderInsert, ...itemsOps] });
      toast({ kind: 'success', msg: ENABLE_WRITES ? 'Order submitted' : 'Order queued (writes disabled)' });
      nav(-1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-3 text-lg font-semibold">Quick Order</h1>

      <div className="mb-3 rounded-xl border bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium text-gray-700">Find product</div>
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Search by brand / name / SKU"
          className="h-10 w-full rounded-lg border px-3"
        />
        {!!query && (
          <div className="mt-2 max-h-56 overflow-auto rounded-lg border">
            {(filtered ?? []).slice(0, 20).map(p => (
              <button
                key={p.id}
                onClick={()=>addProduct(p)}
                className="flex w-full items-center justify-between border-b px-3 py-2 text-left hover:bg-gray-50"
              >
                <div className="truncate">
                  <div className="font-medium">{p.brand} {p.name}</div>
                  <div className="text-xs text-gray-600">{p.sku_code}</div>
                </div>
                <div className="whitespace-nowrap text-right text-sm text-gray-700">
                  {p.case_price != null ? `R ${p.case_price.toFixed(2)}` : '—'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium text-gray-700">Order lines</div>
        {lines.length === 0 && <div className="text-sm text-gray-500">No products yet.</div>}
        <ul className="divide-y">
          {lines.map(l => (
            <li key={l.product_id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{l.brand} {l.name}</div>
                <div className="text-xs text-gray-500">{l.sku}</div>
              </div>
              <input
                type="number"
                min={0}
                value={l.qty}
                onChange={e=>updateQty(l.product_id, Number(e.target.value))}
                className="h-9 w-16 rounded border px-2 text-right"
                title="Qty (cases)"
              />
              <input
                type="number"
                step="0.01"
                min={0}
                value={l.price ?? ''}
                onChange={e=>updatePrice(l.product_id, e.target.value === '' ? null : Number(e.target.value))}
                className="h-9 w-28 rounded border px-2 text-right"
                title="Unit price (per case)"
                placeholder="Price"
              />
              <div className="w-28 text-right text-sm font-medium">
                {`R ${((l.qty || 0) * (l.price ?? 0)).toFixed(2)}`}
              </div>
              <button className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" onClick={()=>removeLine(l.product_id)}>Remove</button>
            </li>
          ))}
        </ul>

        <div className="mt-3 border-t pt-3 text-right text-sm">
          <div>Cases: <span className="font-semibold">{totalCases}</span></div>
          <div>Total: <span className="font-semibold">{`R ${orderTotal.toFixed(2)}`}</span></div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium text-gray-700">Notes</div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="min-h-24 w-full rounded-lg border p-2" placeholder="Optional order notes…" />
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-3">
        {!ENABLE_WRITES && <div className="mb-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">Writes disabled — order will be queued until auth/RLS is enabled.</div>}
        <div className="mx-auto max-w-md">
          <Button onClick={submit} disabled={saving || lines.length === 0}>{saving ? 'Saving…' : 'Submit Order'}</Button>
          <Button onClick={() => nav(-1)} className="mt-2 bg-gray-600 hover:bg-gray-700">{saving ? 'Cancel' : 'Back'}</Button>
        </div>
      </div>
    </div>
  );
}