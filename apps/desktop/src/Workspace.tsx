import {
  SupabaseClientProvider,
  WorkspaceShell,
} from '@admini/workspace';
import type { ProfileUpdatePayload } from '@admini/workspace';
import { supabase } from './supabase';
import { DesktopSidebar } from './components/DesktopSidebar';
import type { AuthUser } from './supabase';

interface DesktopWorkspaceProps {
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
}

export function DesktopWorkspace({
  user,
  userRole,
  organizationId,
  userName,
  schoolName,
  prototypePath,
  onSignOut,
  onDeleteAccount,
  onResetUserData,
  onProfileUpdated,
}: DesktopWorkspaceProps) {
  return (
    <SupabaseClientProvider client={supabase!}>
      <WorkspaceShell
        user={user}
        userRole={userRole}
        organizationId={organizationId}
        userName={userName}
        schoolName={schoolName}
        prototypePath={prototypePath}
        onSignOut={onSignOut}
        onDeleteAccount={onDeleteAccount}
        onResetUserData={onResetUserData}
        onProfileUpdated={onProfileUpdated}
        renderNavigation={({ activeTab, tabs, onTabChange }) => (
          <DesktopSidebar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
        )}
      />
    </SupabaseClientProvider>
  );
}
