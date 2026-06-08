import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js before importing the module under test
// ---------------------------------------------------------------------------

const mockClient = { auth: { getUser: vi.fn() } };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}));

vi.mock('@admini/shared', () => ({
  mapSupabaseError: vi.fn((e: unknown) => String(e)),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('supabase module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('isSupabaseConfigured', () => {
    it('is true when both env vars are set', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

      const mod = await import('./supabase');

      expect(mod.isSupabaseConfigured).toBe(true);

      vi.unstubAllEnvs();
    });

    it('is false when VITE_SUPABASE_URL is missing', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

      const mod = await import('./supabase');

      expect(mod.isSupabaseConfigured).toBe(false);

      vi.unstubAllEnvs();
    });

    it('is false when VITE_SUPABASE_ANON_KEY is missing', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

      const mod = await import('./supabase');

      expect(mod.isSupabaseConfigured).toBe(false);

      vi.unstubAllEnvs();
    });
  });

  describe('supabase client', () => {
    it('creates a client when env vars are configured', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

      const mod = await import('./supabase');
      const { createClient } = await import('@supabase/supabase-js');

      expect(mod.supabase).not.toBeNull();
      expect(createClient).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
            storageKey: 'admini-web-auth',
          }),
        })
      );

      vi.unstubAllEnvs();
    });

    it('returns null when env vars are not configured', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

      const mod = await import('./supabase');

      expect(mod.supabase).toBeNull();

      vi.unstubAllEnvs();
    });
  });

  describe('getAuthRedirectTo', () => {
    it('returns the current window origin', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

      const mod = await import('./supabase');

      expect(mod.getAuthRedirectTo()).toBe(window.location.origin);

      vi.unstubAllEnvs();
    });
  });
});
