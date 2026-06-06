import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { SupabaseClientProvider, useSupabaseClient } from '../../src/providers/SupabaseClientProvider';
import { getClient, resetClient } from '../../src/services/getClient';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('SupabaseClientProvider', () => {
  const mockClient = { auth: {}, from: () => ({}) } as unknown as SupabaseClient;

  afterEach(() => {
    resetClient();
  });

  it('configures the client so getClient() works during first render', () => {
    let clientDuringRender: SupabaseClient | null = null;

    function TestChild() {
      clientDuringRender = getClient();
      return null;
    }

    render(
      createElement(SupabaseClientProvider, { client: mockClient },
        createElement(TestChild)
      )
    );

    expect(clientDuringRender).toBe(mockClient);
  });

  it('useSupabaseClient returns the provided client inside provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(SupabaseClientProvider, { client: mockClient }, children);

    const { result } = renderHook(() => useSupabaseClient(), { wrapper });
    expect(result.current).toBe(mockClient);
  });

  it('useSupabaseClient throws when called outside provider', () => {
    expect(() => {
      renderHook(() => useSupabaseClient());
    }).toThrow('not configured');
  });
});
