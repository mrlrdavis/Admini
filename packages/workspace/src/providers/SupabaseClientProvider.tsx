import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { configureClient, resetClient } from '../services/getClient';

const SupabaseClientContext = createContext<SupabaseClient | null>(null);

export interface SupabaseClientProviderProps {
  client: SupabaseClient;
  children: ReactNode;
}

export function SupabaseClientProvider({ client, children }: SupabaseClientProviderProps) {
  // Always configure synchronously so services work during first render cycle.
  // This is safe to call on every render (idempotent when client is the same).
  configureClient(client);

  // Re-configure if client changes; clean up on unmount
  useEffect(() => {
    configureClient(client);
    return () => resetClient();
  }, [client]);

  return (
    <SupabaseClientContext.Provider value={client}>
      {children}
    </SupabaseClientContext.Provider>
  );
}

export function useSupabaseClient(): SupabaseClient {
  const client = useContext(SupabaseClientContext);
  if (!client) {
    throw new Error(
      '@admini/workspace: Supabase client is not configured. ' +
      'Wrap your app in <SupabaseClientProvider client={...}>.'
    );
  }
  return client;
}
