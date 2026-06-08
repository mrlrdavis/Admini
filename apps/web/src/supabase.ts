import { mapSupabaseError } from '@admini/shared';
import { createClient, type Provider, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Returns the OAuth redirect URL pointing to the app's root origin.
 * Used for auth callbacks (OAuth sign-in, password reset, etc.)
 */
export function getAuthRedirectTo(): string {
  return window.location.origin;
}

/**
 * Supabase client singleton.
 * Returns null if env vars are not configured (graceful degradation).
 */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'admini-web-auth',
      },
    })
  : null;

type DbProfile = {
  id: string;
  organization_id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'principal' | 'teacher' | 'staff';
};

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

export type AcceptInvitationResult = {
  success: boolean;
  organizationName?: string;
  role?: string;
  error?: string;
};

async function getRequiredCurrentUser(): Promise<User> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(mapSupabaseError(error));
  if (!data.user) throw new Error('You must be signed in.');
  return data.user;
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

export async function getOrCreateProfile(): Promise<DbProfile> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  await getRequiredCurrentUser();

  const profile = await supabase
    .rpc('ensure_user_profile')
    .single<DbProfile>();
  if (profile.error) throw new Error(mapSupabaseError(profile.error));
  return profile.data;
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

export async function signInWithOAuthProvider(provider: 'google'): Promise<void> {
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

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(mapSupabaseError(error));
}

export async function deleteAccount(): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  await getRequiredCurrentUser();

  const { error } = await supabase.rpc('delete_account');
  if (error) throw new Error(mapSupabaseError(error));

  await supabase.auth.signOut().catch(() => undefined);
}

export async function checkOnboardingComplete(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  return data.user.user_metadata?.onboarding_complete === true;
}

export async function markOnboardingComplete(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({
    data: { onboarding_complete: true }
  });
  if (error) throw new Error(mapSupabaseError(error));
}

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase is not configured for this environment.' };
  }

  try {
    const user = await getRequiredCurrentUser();

    const metadataUpdate: Record<string, string> = {};
    if (input.displayName !== undefined) {
      metadataUpdate.display_name = input.displayName;
    }
    if (input.schoolName !== undefined) {
      metadataUpdate.school_name = input.schoolName;
    }

    if (Object.keys(metadataUpdate).length > 0) {
      const { error: authError } = await supabase.auth.updateUser({
        data: metadataUpdate
      });
      if (authError) {
        return { success: false, error: mapSupabaseError(authError) };
      }
    }

    if (input.displayName !== undefined) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: input.displayName })
        .eq('id', user.id);
      if (profileError) {
        return { success: false, error: mapSupabaseError(profileError) };
      }
    }

    if (input.schoolName !== undefined) {
      const { data: membership, error: membershipFetchError } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('profile_id', user.id)
        .order('joined_at', { ascending: true })
        .limit(1)
        .single();
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

    const updatedProfile = await getOrCreateProfile();
    return { success: true, profile: updatedProfile };
  } catch (err) {
    return { success: false, error: mapSupabaseError(err) };
  }
}

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

export async function updateMembershipRole(wizardRole: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  const user = await getRequiredCurrentUser();
  const dbRole = mapWizardRoleToDbRole(wizardRole);

  const { data: membership, error: fetchError } = await supabase
    .from('organization_memberships')
    .select('id, organization_id')
    .eq('profile_id', user.id)
    .limit(1)
    .single();
  if (fetchError) throw new Error(mapSupabaseError(fetchError));
  if (!membership) throw new Error('No organization membership found for user.');

  const { error: updateError } = await supabase
    .from('organization_memberships')
    .update({ role: dbRole })
    .eq('id', membership.id);
  if (updateError) throw new Error(mapSupabaseError(updateError));
}

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
