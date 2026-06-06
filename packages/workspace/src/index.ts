// Components
export { WorkspaceShell, NATIVE_TABS } from './components/WorkspaceShell';
export { DashboardTab } from './components/DashboardTab';
export { AdminTab } from './components/AdminTab';
export { CaptureTab } from './components/CaptureTab';
export { TasksTab } from './components/TasksTab';
export { PulseTab } from './components/PulseTab';
export { MoreTab } from './components/MoreTab';
export { IframeFallback } from './components/IframeFallback';

// Hooks
export { useOrgData } from './hooks/useOrgData';

// Services
export * as dashboardService from './services/dashboardService';
export * as organizationService from './services/organizationService';
export * as invitationService from './services/invitationService';

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
  WorkspaceShellProps,
} from './types';
