import { getClient } from './getClient';
import type { AdminiRole, OrgInvitation } from '../types';

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

type DbInvitation = {
  id: string;
  organization_id: string;
  email: string;
  role: AdminiRole;
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
  let errMsg: string;
  if (cause instanceof Error) {
    errMsg = cause.message;
  } else if (cause && typeof cause === 'object' && 'message' in cause) {
    errMsg = String((cause as any).message);
  } else {
    errMsg = String(cause);
  }
  return new Error(`${message}: ${errMsg}`);
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * List all invitations for an organization.
 */
export async function listInvitations(orgId: string): Promise<OrgInvitation[]> {
  const client = getClient();
  try {
    const { data, error } = await client
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
/**
 * Generate a unique token hash for invitation links.
 */
function generateTokenHash(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export async function createInvitation(
  orgId: string,
  email: string,
  role: AdminiRole,
): Promise<OrgInvitation> {
  const client = getClient();
  try {
    // Use the security-definer RPC function which bypasses RLS
    const { data, error } = await client.rpc('create_invitation', {
      target_organization_id: orgId,
      invite_email: email,
      invite_role: role,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    const invitationToken = result?.invitation_token || '';

    // Fire-and-forget: send invitation email via API worker
    try {
      const apiBase = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLOUDFLARE_API_BASE_URL) || '';
      if (apiBase) {
        const { data: userData } = await client.auth.getUser();
        const inviterName = userData?.user?.user_metadata?.display_name || userData?.user?.email || 'A team member';
        const { data: orgData } = await client.from('organizations').select('name').eq('id', orgId).single();
        const schoolName = orgData?.name || 'your school';
        fetch(apiBase + '/api/invitations/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, inviterName, schoolName, role, token: invitationToken }),
        }).catch(() => {});
      }
    } catch { /* best-effort */ }

    // Return a minimal OrgInvitation from the RPC result
    return {
      id: result?.invitation_id || '',
      email,
      role,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  } catch (err) {
    throw wrapError('Failed to create invitation', err);
  }
}

/**
 * Revoke a pending invitation by setting its status to 'revoked'.
 */
export async function revokeInvitation(invitationId: string): Promise<OrgInvitation> {
  const client = getClient();
  try {
    const { data, error } = await client
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
