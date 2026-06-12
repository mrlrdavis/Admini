import type { ReactNode } from 'react';

// Tab identification
export type WorkspaceTab = 'capture' | 'dashboard' | 'tasks' | 'notes' | 'pulse' | 'more' | 'admin' | 'observations';

// Roles
export type AdminiRole = 'admin' | 'principal' | 'teacher' | 'staff';

// Organization
export interface OrgDetails {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface OrgDetailsForm {
  name?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface OrgMember {
  profileId: string;
  email: string;
  displayName: string;
  role: AdminiRole;
  joinedAt: string;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: AdminiRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface OrgFeatureFlag {
  id: string;
  flagKey: string;
  enabled: boolean;
}

// Dashboard
export interface DashboardTask {
  id: string;
  organizationId: string;
  createdBy: string;
  title: string;
  description?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'completed' | 'archived';
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  category?: string;
}

export interface DashboardKPIs {
  openTasks: number;
  completedThisWeek: number;
  overdueTasks: number;
  nextPulseAt: string | null;
}

export interface ActivityEvent {
  id: string;
  organizationId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
}

// Navigation adapter contract
export interface TabItem {
  id: string;
  label: string;
}

export interface NavigationAdapterProps {
  activeTab: WorkspaceTab;
  tabs: TabItem[];
  onTabChange: (tabId: WorkspaceTab) => void;
  onSignOut?: () => void;
  userName?: string;
  userRole?: string;
  schoolName?: string;
}

// Auth user (minimal shape expected by workspace)
export interface AuthUser {
  id: string;
  email?: string | null;
  displayName?: string | null;
  schoolName?: string | null;
}

// Profile update callback shape
export interface ProfileUpdatePayload {
  field: 'display-name' | 'school';
  value: string;
}

// WorkspaceShell props
export interface WorkspaceShellProps {
  user: AuthUser;
  userRole: string;
  organizationId?: string;
  userName: string;
  schoolName: string;
  prototypePath: string;
  onSignOut: () => void;
  onDeleteAccount?: () => Promise<void>;
  onResetUserData: () => void;
  onProfileUpdated?: (payload: ProfileUpdatePayload) => void;
  renderNavigation: (props: NavigationAdapterProps) => ReactNode;
}
