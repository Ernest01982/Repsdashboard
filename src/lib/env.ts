export const TENANT_ID =
  ((import.meta.env.VITE_TENANT_ID as string) ?? '').trim() || '00000000-0000-0000-0000-000000000000';
export const ENABLE_WRITES =
  String(import.meta.env.VITE_ENABLE_WRITES || 'false').trim() === 'true';