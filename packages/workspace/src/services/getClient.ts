import type { SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Configure the service-layer Supabase client.
 * Called by SupabaseClientProvider on mount.
 */
export function configureClient(client: SupabaseClient): void {
  _client = client;
}

/**
 * Retrieve the configured client, or throw if missing.
 */
export function getClient(): SupabaseClient {
  if (!_client) {
    throw new Error(
      '@admini/workspace: Supabase client is not configured. ' +
      'Wrap your app in <SupabaseClientProvider client={...}>.'
    );
  }
  return _client;
}

/**
 * Reset client reference (for testing teardown).
 */
export function resetClient(): void {
  _client = null;
}
