import { describe, it, expect, beforeEach } from 'vitest';
import { configureClient, getClient, resetClient } from '../../src/services/getClient';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('getClient', () => {
  beforeEach(() => {
    resetClient();
  });

  it('throws descriptive error when called without configuration', () => {
    expect(() => getClient()).toThrowError('not configured');
  });

  it('returns the configured client after configureClient is called', () => {
    const mockClient = { auth: {} } as unknown as SupabaseClient;
    configureClient(mockClient);
    expect(getClient()).toBe(mockClient);
  });

  it('returns new client after reconfiguration', () => {
    const client1 = { auth: { v: 1 } } as unknown as SupabaseClient;
    const client2 = { auth: { v: 2 } } as unknown as SupabaseClient;

    configureClient(client1);
    expect(getClient()).toBe(client1);

    configureClient(client2);
    expect(getClient()).toBe(client2);
  });

  it('throws after resetClient is called', () => {
    const mockClient = { auth: {} } as unknown as SupabaseClient;
    configureClient(mockClient);
    expect(getClient()).toBe(mockClient);

    resetClient();
    expect(() => getClient()).toThrowError('not configured');
  });
});
