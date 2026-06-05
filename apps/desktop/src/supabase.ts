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
        storageKey: 'admini-desktop-auth',
        storage: createIndexedDbStorage('auth')
      }
    })
  : null;

type DbTask = {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'completed' | 'archived';
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbProfile = {
  id: string;
  organization_id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'principal' | 'teacher' | 'staff';
};

export type PersistedTask = {
  id: string;
  organizationId: string;
  createdBy: string;
  title: string;
  description?: string;
  priority: DbTask['priority'];
  status: DbTask['status'];
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  priority?: DbTask['priority'];
  dueAt?: string;
};

function mapTask(row: DbTask): PersistedTask {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority,
    status: row.status,
    dueAt: row.due_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export type AuthUser = Pick<User, 'id' | 'email'> & {
  displayName?: string | null;
  schoolName?: string | null;
};

async function getRequiredCurrentUser(): Promise<User> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('You must be signed in to manage tasks.');
  return data.user;
}

export async function getOrCreateProfile(): Promise<DbProfile> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const user = await getRequiredCurrentUser();
  const existing = await supabase
    .from('profiles')
    .select('id, organization_id, email, display_name, role')
    .eq('id', user.id)
    .maybeSingle<DbProfile>();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const profile = await supabase
    .rpc('ensure_user_profile')
    .single<DbProfile>();
  if (profile.error) throw profile.error;
  return profile.data;
}

export async function listTasks(): Promise<PersistedTask[]> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  await getOrCreateProfile();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, organization_id, created_by, title, description, priority, status, due_at, created_at, updated_at')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .returns<DbTask[]>();
  if (error) throw error;
  return (data ?? []).map(mapTask);
}

export async function createTask(input: CreateTaskInput): Promise<PersistedTask> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const profile = await getOrCreateProfile();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      organization_id: profile.organization_id,
      created_by: profile.id,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 'normal',
      status: 'open',
      due_at: input.dueAt ?? null
    })
    .select('id, organization_id, created_by, title, description, priority, status, due_at, created_at, updated_at')
    .single<DbTask>();
  if (error) throw error;
  return mapTask(data);
}

export async function updateTaskStatus(id: string, status: DbTask['status']): Promise<PersistedTask> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  await getOrCreateProfile();
  const { data, error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, organization_id, created_by, title, description, priority, status, due_at, created_at, updated_at')
    .single<DbTask>();
  if (error) throw error;
  return mapTask(data);
}

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

export async function signInWithOAuthProvider(provider: Extract<Provider, 'google'>): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthRedirectTo(),
      scopes: undefined
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
