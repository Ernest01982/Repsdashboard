import { set, get } from 'idb-keyval';
import { supabase } from './supabase';
import { ENABLE_WRITES, TENANT_ID } from './env';

export type Op =
  | { kind: 'insert'; table: string; values: any }
  | { kind: 'update'; table: string; where: { id: string }; values: any }
  | { kind: 'bundle'; ops: Op[] };

export type Task = { 
  id: string; 
  createdAt: number; 
  status: 'pending'|'done'|'error'; 
  attempt: number; 
  op: Op; 
  error?: string 
};

const KEY = 'mutation-queue';

export async function getQueue(): Promise<Task[]> { 
  return (await get<Task[]>(KEY)) ?? []; 
}

async function saveQueue(q: Task[]) { 
  await set(KEY, q); 
}

export async function enqueue(op: Op) {
  const q = await getQueue();
  q.push({ 
    id: crypto.randomUUID(), 
    createdAt: Date.now(), 
    status: 'pending', 
    attempt: 0, 
    op 
  });
  await saveQueue(q);
}

export async function clearDone() {
  const q = await getQueue();
  await saveQueue(q.filter(t => t.status !== 'done'));
}

async function runOp(op: Op) {
  if (!ENABLE_WRITES) throw new Error('Writes disabled');
  
  if ('ops' in op && op.kind === 'bundle') {
    for (const sub of op.ops) await runOp(sub);
    return;
  }
  
  if (op.kind === 'insert') {
    const { error } = await supabase
      .from(op.table)
      .insert({ ...op.values, tenant_id: TENANT_ID });
    if (error) throw error;
  } else if (op.kind === 'update') {
    const { error } = await supabase
      .from(op.table)
      .update(op.values)
      .eq('id', op.where.id)
      .eq('tenant_id', TENANT_ID);
    if (error) throw error;
  }
}

export async function processQueue(onProgress?: (done: number, total: number) => void) {
  const q = await getQueue();
  const pendingTasks = q.filter(t => t.status === 'pending' || t.status === 'error');
  
  if (pendingTasks.length === 0) {
    return q;
  }
  
  let done = 0;
  
  for (const t of q) {
    if (t.status === 'done') { 
      done++; 
      onProgress?.(done, q.length); 
      continue; 
    }
    
    try {
      await runOp(t.op);
      t.status = 'done'; 
      t.error = undefined;
    } catch (e: any) {
      t.attempt++; 
      t.status = 'error'; 
      t.error = e?.message ?? 'Error';
    }
    
    done++; 
    onProgress?.(done, q.length);
    await saveQueue(q);
  }
  
  return q;
}

export function hasPending(q: Task[]) { 
  return q.some(t => t.status === 'pending' || t.status === 'error'); 
}