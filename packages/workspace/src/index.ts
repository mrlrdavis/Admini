// Components
export { WorkspaceShell, NATIVE_TABS } from './components/WorkspaceShell';
export { DashboardTab } from './components/DashboardTab';
export { AdminTab } from './components/AdminTab';
export { CaptureTab } from './components/CaptureTab';
export { TasksTab } from './components/TasksTab';
export { PulseTab } from './components/PulseTab';
export { MoreTab } from './components/MoreTab';
export type { MoreTabSubView, MoreTabProps } from './components/MoreTab';
export { ProfileSettings } from './components/ProfileSettings';
export type { ProfileSettingsProps } from './components/ProfileSettings';
export { NotificationSettings } from './components/NotificationSettings';
export type { NotificationSettingsProps } from './components/NotificationSettings';
export { AppPreferences } from './components/AppPreferences';
export type { AppPreferencesProps, ThemePreference } from './components/AppPreferences';
export { IframeFallback } from './components/IframeFallback';

// Hooks
export { useOrgData } from './hooks/useOrgData';

// Services
export * as dashboardService from './services/dashboardService';
export * as organizationService from './services/organizationService';
export * as invitationService from './services/invitationService';
export * as notificationPreferencesService from './services/notificationPreferences';
export type { NotificationPreferences } from './services/notificationPreferences';

// Provider
export { SupabaseClientProvider, useSupabaseClient } from './providers/SupabaseClientProvider';

// Types
export type {
  WorkspaceTab,
  AdminiRole,
  OrgDetails,
  OrgDetailsForm,
  OrgMember,
  OrgInvitation,
  OrgFeatureFlag,
  ActivityEvent,
  DashboardTask,
  DashboardKPIs,
  NavigationAdapterProps,
  ProfileUpdatePayload,
  WorkspaceShellProps,
} from './types';