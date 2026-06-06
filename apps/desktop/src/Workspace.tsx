import {
  SupabaseClientProvider,
  WorkspaceShell,
} from '@admini/workspace';
import { supabase } from './supabase';
import { DesktopSidebar } from './components/DesktopSidebar';
import type { AuthUser } from './supabase';

interface DesktopWorkspaceProps {
  user: AuthUser;
  userRole: string;
  userName: string;
  schoolName: string;
  prototypePath: string;
  onSignOut: () => void;
  onResetUserData: () => void;
}

export function DesktopWorkspace({
  user,
  userRole,
  userName,
  schoolName,
  prototypePath,
  onSignOut,
  onResetUserData,
}: DesktopWorkspaceProps) {
  return (
    <SupabaseClientProvider client={supabase!}>
      <WorkspaceShell
        user={user}
        userRole={userRole}
        userName={userName}
        schoolName={schoolName}
        prototypePath={prototypePath}
        onSignOut={onSignOut}
        onResetUserData={onResetUserData}
        renderNavigation={({ activeTab, tabs, onTabChange }) => (
          <DesktopSidebar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
        )}
      />
    </SupabaseClientProvider>
  );
}
