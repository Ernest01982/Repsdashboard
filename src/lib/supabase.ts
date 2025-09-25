import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Singleton pattern for Supabase client
let supabaseInstance: SupabaseClient<any, 'public'> | null = null;

export function getSupabase(): SupabaseClient<any, 'public'> {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
    }

    const options: SupabaseClientOptions<'public'> = {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Client-Info': 'wine-crm-rep'
        }
      }
    };

    supabaseInstance = createClient<any, 'public'>(supabaseUrl, supabaseAnonKey, options);
  }
  return supabaseInstance;
}

// Export singleton instance for backward compatibility
export const supabase = getSupabase();