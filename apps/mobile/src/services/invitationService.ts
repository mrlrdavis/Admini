import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase client (reuses the same singleton pattern as ../supabase.ts)
// ---------------------------------------------------------------------------

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'admini-mobile-auth' },
      })
    : null;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvitationRole = 'admin' | 'principal' | 'teacher' | 'staff';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface OrgInvitation {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}

type DbInvitation = {
  id: string;
  organization_id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapInvitation(row: DbInvitation): OrgInvitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function wrapError(message: string, cause: unknown): Error {
  const err = cause instanceof Error ? cause : new Error(String(cause));
  return new Error(`${message}: ${err.message}`, { cause: err });
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * List all invitations for an organization.
 */
export async function listInvitations(orgId: string): Promise<OrgInvitation[]> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  try {
    const { data, error } = await supabase
      .from('invitations')
      .select('id, organization_id, email, role, status, created_at, expires_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .returns<DbInvitation[]>();
    if (error) throw error;
    return (data ?? []).map(mapInvitation);
  } catch (err) {
    throw wrapError('Failed to list invitations', err);
  }
}

/**
 * Create a new invitation for a user to join an organization.
 */
export async function createInvitation(
  orgId: string,
  email: string,
  role: InvitationRole,
): Promise<OrgInvitation> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  try {
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        organization_id: orgId,
        email,
        role,
        status: 'pending' as InvitationStatus,
      })
      .select('id, organization_id, email, role, status, created_at, expires_at')
      .single<DbInvitation>();
    if (error) throw error;
    return mapInvitation(data);
  } catch (err) {
    throw wrapError('Failed to create invitation', err);
  }
}

/**
 * Revoke a pending invitation by setting its status to 'revoked'.
 */
export async function revokeInvitation(invitationId: string): Promise<OrgInvitation> {
  if (!supabase) throw new Error('Supabase is not configured for this environment.');
  try {
    const { data, error } = await supabase
      .from('invitations')
      .update({ status: 'revoked' as InvitationStatus })
      .eq('id', invitationId)
      .select('id, organization_id, email, role, status, created_at, expires_at')
      .single<DbInvitation>();
    if (error) throw error;
    return mapInvitation(data);
  } catch (err) {
    throw wrapError('Failed to revoke invitation', err);
  }
}