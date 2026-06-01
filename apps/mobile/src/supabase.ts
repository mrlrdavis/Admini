import { createIndexedDbStorage } from '@admini/shared';
import { createClient, type Provider, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

function getAuthRedirectTo(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'admini-mobile-auth',
        storage: createIndexedDbStorage('auth')
      }
    })
  : null;

export type AuthUser = Pick<User, 'id' | 'email'> & {
  displayName?: string | null;
  schoolName?: string | null;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    displayName: data.user.user_metadata?.display_name ?? null,
    schoolName: data.user.user_metadata?.school_name ?? null
  };
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  return (await supabase.auth.getSession()).data.session?.access_token ?? null;
}

export async function signInWithPassword(input: { email: string; password: string }): Promise<AuthUser> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password
  });
  if (error) throw error;
  if (!data.user) throw new Error('Sign in did not return a user.');
  return {
    id: data.user.id,
    email: data.user.email,
    displayName: data.user.user_metadata?.display_name ?? null,
    schoolName: data.user.user_metadata?.school_name ?? null
  };
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectTo()
  });
  if (error) throw error;
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  displayName: string;
  schoolName: string;
}): Promise<{ user: AuthUser | null; needsEmailConfirmation: boolean }> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        display_name: input.displayName,
        school_name: input.schoolName
      }
    }
  });
  if (error) throw error;

  return {
    user: data.user ? {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.display_name ?? input.displayName,
      schoolName: data.user.user_metadata?.school_name ?? input.schoolName
    } : null,
    needsEmailConfirmation: Boolean(data.user && !data.session)
  };
}

export async function signInWithOAuthProvider(provider: Extract<Provider, 'google' | 'apple' | 'azure'>): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthRedirectTo(),
      scopes: provider === 'azure' ? 'email openid profile' : undefined
    }
  });
  if (error) throw error;
  if (data.url) window.location.assign(data.url);
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
