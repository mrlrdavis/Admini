import { getClient } from './getClient';
import type { AdminiRole, OrgDetails, OrgDetailsForm, OrgMember, OrgFeatureFlag } from '../types';

// ---------------------------------------------------------------------------
// Internal DB row types
// ---------------------------------------------------------------------------

type DbOrganization = {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type DbMembership = {
  profile_id: string;
  role: AdminiRole;
  created_at: string;
  profiles: {
    email: string;
    display_name: string;
  };
};

type DbFeatureFlag = {
  id: string;
  flag_key: string;
  enabled: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class ServiceError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'OrganizationServiceError';
  }
}

function wrapError(error: unknown, fallbackMessage: string): never {
  if (error instanceof Error) {
    throw new ServiceError(error.message, (error as { code?: string }).code);
  }
  throw new ServiceError(fallbackMessage);
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Fetch organization details by ID.
 */
export async function getOrgDetails(orgId: string): Promise<OrgDetails> {
  const client = getClient();
  const { data, error } = await client
    .from('organizations')
    .select('id, name, slug, address, contact_email, contact_phone')
    .eq('id', orgId)
    .single<DbOrganization>();

  if (error) wrapError(error, 'Failed to fetch organization details.');
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    address: data.address,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
  };
}

/**
 * Update organization details (partial update).
 */
export async function updateOrgDetails(orgId: string, form: OrgDetailsForm): Promise<OrgDetails> {
  const client = getClient();
  const updatePayload: Record<string, unknown> = {};
  if (form.name !== undefined) updatePayload.name = form.name;
  if (form.address !== undefined) updatePayload.address = form.address;
  if (form.contactEmail !== undefined) updatePayload.contact_email = form.contactEmail;
  if (form.contactPhone !== undefined) updatePayload.contact_phone = form.contactPhone;

  const { data, error } = await client
    .from('organizations')
    .update(updatePayload)
    .eq('id', orgId)
    .select('id, name, slug, address, contact_email, contact_phone')
    .single<DbOrganization>();

  if (error) wrapError(error, 'Failed to update organization details.');
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    address: data.address,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
  };
}

/**
 * List all members of an organization with their profile info.
 */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const client = getClient();
  const { data, error } = await client
    .from('organization_memberships')
    .select('profile_id, role, created_at, profiles(email, display_name)')
    .eq('organization_id', orgId)
    .returns<DbMembership[]>();

  if (error) wrapError(error, 'Failed to fetch organization members.');
  return (data ?? []).map((row) => ({
    profileId: row.profile_id,
    email: row.profiles.email,
    displayName: row.profiles.display_name,
    role: row.role,
    joinedAt: row.created_at,
  }));
}

/**
 * Update a member's role within the organization.
 */
export async function updateMemberRole(
  orgId: string,
  profileId: string,
  role: AdminiRole,
): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from('organization_memberships')
    .update({ role })
    .eq('organization_id', orgId)
    .eq('profile_id', profileId);

  if (error) wrapError(error, 'Failed to update member role.');
}

/**
 * List all feature flags for an organization.
 */
export async function listFeatureFlags(orgId: string): Promise<OrgFeatureFlag[]> {
  const client = getClient();
  const { data, error } = await client
    .from('organization_feature_flags')
    .select('id, flag_key, enabled')
    .eq('organization_id', orgId)
    .returns<DbFeatureFlag[]>();

  if (error) wrapError(error, 'Failed to fetch feature flags.');
  return (data ?? []).map((row) => ({
    id: row.id,
    flagKey: row.flag_key,
    enabled: row.enabled,
  }));
}

/**
 * Toggle a feature flag's enabled state.
 */
export async function toggleFeatureFlag(
  orgId: string,
  flagId: string,
  enabled: boolean,
): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from('organization_feature_flags')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', flagId)
    .eq('organization_id', orgId);

  if (error) wrapError(error, 'Failed to toggle feature flag.');
}
