// ---------------------------------------------------------------------------
// Workspace Type Definitions
// ---------------------------------------------------------------------------
// Shared types for the native workspace components.
// Requirements: 6.1, 6.4, 6.6, 6.8

/**
 * Roles available within an Admini organization.
 */
export type AdminiRole = 'admin' | 'principal' | 'teacher' | 'staff';

/**
 * Organization details as surfaced in the Admin tab.
 */
export interface OrgDetails {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

/**
 * Editable subset of organization details used in the update form.
 */
export interface OrgDetailsForm {
  name?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/**
 * A member of an organization with profile and role info.
 */
export interface OrgMember {
  profileId: string;
  email: string;
  displayName: string;
  role: AdminiRole;
  joinedAt: string;
}

/**
 * An invitation to join an organization.
 */
export interface OrgInvitation {
  id: string;
  email: string;
  role: AdminiRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
}

/**
 * A per-organization feature flag controlling feature access.
 */
export interface OrgFeatureFlag {
  id: string;
  flagKey: string;
  enabled: boolean;
}

/**
 * A workspace activity event for the dashboard feed.
 */
export interface ActivityEvent {
  id: string;
  entityType: string;
  action: string;
  createdAt: string;
}

/**
 * Identifiers for each workspace tab.
 */
export type WorkspaceTab = 'capture' | 'dashboard' | 'tasks' | 'pulse' | 'more' | 'admin';
