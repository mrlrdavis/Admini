import { getClient } from './getClient';
import type { AdminiRole, OrgInvitation } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SEND_RETRIES = 3;

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
// Errors
// ---------------------------------------------------------------------------

export class InvitationServiceError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(message: string, code = 'INVITATION_ERROR', retryable = false) {
    super(message);
    this.name = 'InvitationServiceError';
    this.code = code;
    this.retryable = retryable;
  }
}

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

function getApiBase(): string {
  return (
    (typeof import.meta !== 'undefined' &&
      (import.meta as any).env?.VITE_CLOUDFLARE_API_BASE_URL) ||
    ''
  );
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
 * Get only the pending invitations for an organization.
 */
export async function getPendingInvitations(organizationId: string): Promise<OrgInvitation[]> {
  const client = getClient();
  try {
    const { data, error } = await client
      .from('invitations')
      .select('id, organization_id, email, role, status, created_at, expires_at')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .returns<DbInvitation[]>();
    if (error) throw error;
    return (data ?? []).map(mapInvitation);
  } catch (err) {
    throw wrapError('Failed to fetch pending invitations', err);
  }
}

/**
 * Send an invitation email via Cloudflare Worker (Resend API).
 * Retries up to MAX_SEND_RETRIES times before throwing a "Contact support" error.
 *
 * Staff Invitation Lifecycle:
 *  1. Creates the invitation record in Supabase
 *  2. Sends email via Cloudflare Worker endpoint
 *  3. Retries on transient failure (max 3 attempts)
 */
export async function sendInvitation(
  email: string,
  role: AdminiRole,
  message?: string,
): Promise<OrgInvitation> {
  const client = getClient();

  // Resolve current user + org context
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) {
    throw new InvitationServiceError('Authentication required to send invitations.', 'AUTH_REQUIRED');
  }

  // Get the user's organization from memberships
  const { data: membership, error: memberError } = await client
    .from('organization_memberships')
    .select('organization_id')
    .eq('profile_id', userData.user.id)
    .single();
  if (memberError || !membership) {
    throw new InvitationServiceError('Could not determine organization.', 'NO_ORG');
  }
  const orgId = membership.organization_id;

  // Create the invitation record via RPC
  const { data, error } = await client.rpc('create_invitation', {
    target_organization_id: orgId,
    invite_email: email,
    invite_role: role,
  });
  if (error) {
    throw new InvitationServiceError(
      `Failed to create invitation: ${error.message}`,
      'CREATE_FAILED',
    );
  }

  const result = Array.isArray(data) ? data[0] : data;
  const invitationToken = result?.invitation_token || '';

  // Resolve display names for the email
  const inviterName =
    userData.user.user_metadata?.display_name || userData.user.email || 'A team member';
  const { data: orgData } = await client
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();
  const schoolName = orgData?.name || 'your school';

  // Send the email via Cloudflare Worker with retry logic
  const apiBase = getApiBase();
  if (apiBase) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_SEND_RETRIES; attempt++) {
      try {
        const response = await fetch(`${apiBase}/api/invitations/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            inviterName,
            schoolName,
            role,
            token: invitationToken,
            message,
          }),
        });
        if (response.ok) {
          break; // success
        }
        lastError = new Error(`Email API returned ${response.status}: ${response.statusText}`);
      } catch (err) {
        lastError = err;
      }

      // If we've exhausted retries, throw contact-support error
      if (attempt === MAX_SEND_RETRIES) {
        throw new InvitationServiceError(
          'Unable to send invitation email after multiple attempts. Please contact support.',
          'EMAIL_SEND_EXHAUSTED',
          false,
        );
      }
    }
  }

  return {
    id: result?.invitation_id || '',
    email,
    role,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Create a new invitation for a user to join an organization.
 * (Legacy function - retained for backward compatibility. Prefer sendInvitation.)
 */
export async function createInvitation(
  orgId: string,
  email: string,
  role: AdminiRole,
): Promise<OrgInvitation> {
  const client = getClient();
  try {
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
      const apiBase = getApiBase();
      if (apiBase) {
        const { data: userData } = await client.auth.getUser();
        const inviterName =
          userData?.user?.user_metadata?.display_name ||
          userData?.user?.email ||
          'A team member';
        const { data: orgData } = await client
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .single();
        const schoolName = orgData?.name || 'your school';
        fetch(apiBase + '/api/invitations/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            inviterName,
            schoolName,
            role,
            token: invitationToken,
          }),
        }).catch(() => {});
      }
    } catch {
      /* best-effort */
    }

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
export async function revokeInvitation(invitationId: string): Promise<void> {
  const client = getClient();
  try {
    const { error } = await client
      .from('invitations')
      .update({ status: 'revoked' as InvitationStatus })
      .eq('id', invitationId);
    if (error) throw error;
  } catch (err) {
    throw wrapError('Failed to revoke invitation', err);
  }
}