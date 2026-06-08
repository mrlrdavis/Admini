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
export type { AppPreferencesProps, AppPreferencesData, ThemePreference } from './components/AppPreferences';
export { ConnectedIntegrations } from './components/ConnectedIntegrations';
export type { ConnectedIntegrationsProps } from './components/ConnectedIntegrations';
export { IntegrationCatalog } from './components/IntegrationCatalog';
export type { IntegrationCatalogProps } from './components/IntegrationCatalog';
export { IframeFallback } from './components/IframeFallback';

// Hooks
export { useDebouncedSave } from './hooks/useDebouncedSave';
export { useOrgData } from './hooks/useOrgData';
export { useCompactMode } from './hooks/useCompactMode';
export type { UseCompactModeReturn } from './hooks/useCompactMode';
export { useThemePreference } from './hooks/useThemePreference';
export type { UseThemePreferenceReturn } from './hooks/useThemePreference';

// Services
export * as accountService from './services/accountService';
export { deleteAccount } from './services/accountService';
export * as dashboardService from './services/dashboardService';
export * as organizationService from './services/organizationService';
export * as invitationService from './services/invitationService';
export * as notificationPreferencesService from './services/notificationPreferences';
export { loadNotificationPreferences, saveNotificationPreferences } from './services/notificationPreferences';
export type { NotificationPreferences } from './services/notificationPreferences';
export * as appPreferencesStorage from './services/appPreferencesStorage';
export { getAppPreferences, saveAppPreferences, DEFAULT_PREFERENCES } from './services/appPreferencesStorage';
export type { AppPreferencesData as AppPreferencesStorageData } from './services/appPreferencesStorage';
export * as integrationStatusStorage from './services/integrationStatusStorage';
export * as captureService from './services/captureService';
export { saveCapture, loadCaptures } from './services/captureService';
export type { Capture } from './services/captureService';
export { loadIntegrationStatuses, saveIntegrationStatus, removeIntegrationStatus } from './services/integrationStatusStorage';
export type { IntegrationConnectionStatus } from './services/integrationStatusStorage';

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

