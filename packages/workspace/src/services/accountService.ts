import { mapSupabaseError } from '@admini/shared';
import { getClient } from './getClient';

// ---------------------------------------------------------------------------
// Account Service
// ---------------------------------------------------------------------------
// Provides account management operations (delete account, etc.)
// Used by both Desktop and Mobile apps via the workspace package.
// ---------------------------------------------------------------------------

/**
 * Deletes the current user's account.
 *
 * Flow:
 * 1. Calls the Supabase 'delete-account' edge function (preferred) or
 *    falls back to the 'delete_account' RPC function.
 * 2. The server-side function handles cascading deletion of profile,
 *    memberships, tasks, and other user data, then removes the auth.users entry.
 * 3. Signs out locally to clear any remaining session/token state.
 *
 * After this resolves the caller should clear local state and redirect to auth.
 */
export async function deleteAccount(): Promise<void> {
  const client = getClient();

  // Verify user is authenticated before attempting deletion
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error(
      mapSupabaseError(userError ?? { message: 'You must be signed in to delete your account.' }),
    );
  }

  // Attempt deletion via Supabase edge function first (preferred path)
  let deleted = false;

  try {
    const { error: fnError } = await client.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (!fnError) {
      deleted = true;
    }
  } catch {
    // Edge function not deployed or network issue - fall through to RPC fallback
  }

  // Fallback: use the delete_account RPC function
  if (!deleted) {
    const { error: rpcError } = await client.rpc('delete_account');
    if (rpcError) {
      throw new Error(mapSupabaseError(rpcError));
    }
  }

  // Sign out locally to clear session/token state
  await client.auth.signOut().catch(() => undefined);
}
