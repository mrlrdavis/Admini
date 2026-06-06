import { createIndexedDbStorage } from '@admini/shared';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

/**
 * Shared Supabase client singleton used by all service modules.
 * Returns null when environment variables are not configured (e.g. in tests).
 */
export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storageKey: 'admini-mobile-auth',
          storage: createIndexedDbStorage('auth'),
        },
      })
    : null;
