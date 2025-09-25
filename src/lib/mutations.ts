import { supabase } from './supabase';
import { TENANT_ID, ENABLE_WRITES } from './env';

export class WriteDisabledError extends Error {
  constructor() {
    super('Writes are disabled in demo mode');
    this.name = 'WriteDisabledError';
  }
}

export async function insertRow(table: string, values: any) {
  if (!ENABLE_WRITES) {
    throw new WriteDisabledError();
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ ...values, tenant_id: TENANT_ID })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRow(table: string, id: string, values: any) {
  if (!ENABLE_WRITES) {
    throw new WriteDisabledError();
  }

  const { data, error } = await supabase
    .from(table)
    .update(values)
    .eq('id', id)
    .eq('tenant_id', TENANT_ID)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRow(table: string, id: string) {
  if (!ENABLE_WRITES) {
    throw new WriteDisabledError();
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('tenant_id', TENANT_ID);

  if (error) throw error;
}