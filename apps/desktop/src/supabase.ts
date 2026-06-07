import { createIndexedDbStorage, mapSupabaseError } from '@admini/shared';
import { createClient, type Provider, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

function getAuthRedirectTo(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

export const supabase = supabaseUrl && supabaseKey
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

export type UpdateProfileInput = {
  displayName?: string;
  schoolName?: string;
};

export type UpdateProfileResult = {
  success: boolean;
  error?: string;
  profile?: DbProfile;
};

async function getRequiredCurrentUser(): Promise<User> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(mapSupabaseError(error));
  if (!data.user) throw new Error('You must be signed in to manage tasks.');
  return data.user;
}

export async function getOrCreateProfile(): Promise<DbProfile> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  await getRequiredCurrentUser();

  // Always use the ensure_user_profile RPC which joins profiles with
  // organization_memberships to return the authoritative role. The profiles
  // table itself does not store role or organization_id ï¿½ those live on
  // organization_memberships and are returned via the RPC join.
  const profile = await supabase
    .rpc('ensure_user_profile')
    .single<DbProfile>();
  if (profile.error) throw new Error(mapSupabaseError(profile.error));
  return profile.data;
}

export async function listTasks(): Promise<PersistedTask[]> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  await getOrCreateProfile();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, organization_id, created_by, title, description, priority, status, due_at, created_at, updated_at')
    .neq('status', 'archived')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .returns<DbTask[]>();
  if (error) throw new Error(mapSupabaseError(error));
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
  if (error) throw new Error(mapSupabaseError(error));
  return mapTask(data);
}

export async function updateTaskStatus(id: string, status: DbTask['status'], expectedUpdatedAt?: string): Promise<PersistedTask> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  await getOrCreateProfile();

  // Use optimistic locking: if expectedUpdatedAt is provided, only update if
  // the row hasn't been modified since the client last fetched it (REQ-17).
  let query = supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (expectedUpdatedAt) {
    query = query.eq('updated_at', expectedUpdatedAt);
  }

  const { data, error } = await query
    .select('id, organization_id, created_by, title, description, priority, status, due_at, created_at, updated_at')
    .single<DbTask>();
  if (error) throw new Error(mapSupabaseError(error));
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
    displayName: data.user.user_metadata?.display_name
      ?? data.user.user_metadata?.full_name
      ?? data.user.user_metadata?.name
      ?? null,
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
  if (error) throw new Error(mapSupabaseError(error));
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
  if (error) throw new Error(mapSupabaseError(error));
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
  if (error) throw new Error(mapSupabaseError(error));

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
  if (error) throw new Error(mapSupabaseError(error));
  if (data.url) window.location.assign(data.url);
}

/**
 * Updates the user's profile in both the profiles table and auth.users metadata.
 * - display_name updates profiles.display_name AND auth.users.raw_user_meta_data
 * - school_name updates organizations.name for all org members AND auth.users.raw_user_meta_data
 */
export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured for this environment.' };
  }

  try {
    const user = await getRequiredCurrentUser();

    // Build the metadata update payload
    const metadataUpdate: Record<string, string> = {};
    if (input.displayName !== undefined) {
      metadataUpdate.display_name = input.displayName;
    }
    if (input.schoolName !== undefined) {
      metadataUpdate.school_name = input.schoolName;
    }

    // 1. Update auth.users.raw_user_meta_data
    if (Object.keys(metadataUpdate).length > 0) {
      const { error: authError } = await supabase.auth.updateUser({
        data: metadataUpdate
      });
      if (authError) {
        return { success: false, error: mapSupabaseError(authError) };
      }
    }

    // 2. Update the profiles table (display_name)
    if (input.displayName !== undefined) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: input.displayName })
        .eq('id', user.id);
      if (profileError) {
        return { success: false, error: mapSupabaseError(profileError) };
      }
    }

    // 3. Update organization name if school_name changed
    if (input.schoolName !== undefined) {
      const { data: membership, error: membershipFetchError } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('profile_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .single();
      // If no membership rows returned (user has no org), skip org update without error
      if (!membershipFetchError && membership?.organization_id) {
        const { error: orgError } = await supabase
          .from('organizations')
          .update({ name: input.schoolName })
          .eq('id', membership.organization_id);
        if (orgError) {
          return { success: false, error: mapSupabaseError(orgError) };
        }
      }
    }

    // 4. Fetch and return the updated profile
    const updatedProfile = await getOrCreateProfile();
    return { success: true, profile: updatedProfile };
  } catch (err) {
    return { success: false, error: mapSupabaseError(err) };
  }
}


/**
 * Maps a friendly wizard role label to the database admini_role enum value.
 */
function mapWizardRoleToDbRole(wizardRole: string): 'admin' | 'principal' | 'teacher' | 'staff' {
  switch (wizardRole) {
    case 'School leader':
      return 'principal';
    case 'Operations leader':
      return 'admin';
    case 'Instructional coach':
      return 'teacher';
    case 'Campus support':
    case 'District staff':
    default:
      return 'staff';
  }
}

/**
 * Updates the current user's role in the organization_memberships table.
 * Maps the wizard-friendly role label to the database enum value.
 */
export async function updateMembershipRole(wizardRole: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const user = await getRequiredCurrentUser();
  const dbRole = mapWizardRoleToDbRole(wizardRole);

  // Find the user's membership record
  const { data: membership, error: fetchError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id')
    .eq('profile_id', user.id)
    .limit(1)
    .single();
  if (fetchError) throw new Error(mapSupabaseError(fetchError));
  if (!membership) throw new Error('No organization membership found for user.');

  // Update the role
  const { error: updateError } = await supabase
    .from('organization_memberships')
    .update({ role: dbRole })
    .eq('id', membership.id);
  if (updateError) throw new Error(mapSupabaseError(updateError));
}

/**
 * Checks whether the user has completed onboarding by reading auth.users metadata.
 * Returns true if onboarding_complete is set in the user's metadata on the server.
 * This is the server-side source of truth, not IndexedDB.
 */
export async function checkOnboardingComplete(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  return data.user.user_metadata?.onboarding_complete === true;
}

/**
 * Marks onboarding as complete in the user's auth metadata (server-side).
 * This ensures the flag persists across devices and browser data clears.
 */
export async function markOnboardingComplete(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({
    data: { onboarding_complete: true }
  });
  if (error) throw new Error(mapSupabaseError(error));
}

/**
 * Persists the user's onboarding preferences (focus and systems) to auth.users metadata.
 * These are stored as user_metadata so they survive across devices and browser data clears.
 * - focus: stored as a string (the selected focus area)
 * - systems: stored as a string array (selected integration providers)
 */
export async function persistOnboardingPreferences(input: { focus: string; systems: string[] }): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({
    data: {
      onboarding_focus: input.focus,
      onboarding_systems: input.systems
    }
  });
  if (error) throw new Error(mapSupabaseError(error));
}

export type AcceptInvitationResult = {
  success: boolean;
  organizationName?: string;
  role?: string;
  error?: string;
};

/**
 * Accepts a pending invitation by calling the accept_invitation RPC function.
 * The server-side function validates the token, adds the user to the organization,
 * and returns the invitation details (org name, assigned role).
 */
export async function acceptInvitation(token: string): Promise<AcceptInvitationResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured for this environment.' };
  }

  try {
    const { data, error } = await supabase.rpc('accept_invitation', {
      invitation_token: token
    });

    if (error) {
      return { success: false, error: mapSupabaseError(error) };
    }

    // The RPC returns the organization name and role assigned
    const result = data as { organization_name?: string; role?: string } | null;
    return {
      success: true,
      organizationName: result?.organization_name ?? undefined,
      role: result?.role ?? undefined
    };
  } catch (err) {
    return { success: false, error: mapSupabaseError(err) };
  }
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(mapSupabaseError(error));
}
/**
 * Deletes the current user's account by calling the delete_account RPC function.
 * The server-side function handles cascading deletion of profile, memberships,
 * tasks, and other user data, then deletes the auth.users entry.
 * After deletion, the client signs out locally to clear session state.
 */
export async function deleteAccount(): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  await getRequiredCurrentUser();

  const { error } = await supabase.rpc('delete_account');
  if (error) throw new Error(mapSupabaseError(error));

  // Sign out locally to clear any remaining session/token state
  await supabase.auth.signOut().catch(() => undefined);
}
