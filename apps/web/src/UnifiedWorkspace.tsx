import { useRef, useState, useEffect } from 'react';
import {
  SupabaseClientProvider,
  WorkspaceShell,
  PwaInstallModal,
  usePwaInstallModal,
} from '@admini/workspace';
import type { ProfileUpdatePayload } from '@admini/workspace';
import { CustomInstallButton } from './components/CustomInstallButton';
import type { LayoutMode } from '@admini/ui';
import { supabase } from './supabase';
import { NavigationRenderer } from './components/NavigationRenderer';

interface UnifiedWorkspaceProps {
  user: { id: string; email?: string | null; displayName?: string | null; schoolName?: string | null };
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

/**
 * Detects layout mode using a ResizeObserver on the workspace container,
 * matching LayoutShell's 768px breakpoint logic.
 */
function useLayoutMode(ref: React.RefObject<HTMLDivElement | null>): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>('mobile');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setMode(entry.contentRect.width > 768 ? 'desktop' : 'mobile');
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return mode;
}

export function UnifiedWorkspace({
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
}: UnifiedWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutMode = useLayoutMode(containerRef);
  const { showModal: showPwaModal, dismiss: dismissPwaModal, openModal: openPwaModal } = usePwaInstallModal();

  return (
    <SupabaseClientProvider client={supabase!}>
      <div ref={containerRef} className="unified-workspace">
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
          renderNavigation={({ activeTab, tabs, onTabChange, onSignOut: navSignOut, userId: navUserId, userName: navUser, userRole: navRole, schoolName: navSchool, unreadNotificationCount }) => (
            <NavigationRenderer
              layoutMode={layoutMode}
              activeTab={activeTab}
              tabs={tabs}
              onTabChange={onTabChange}
              onSignOut={navSignOut}
              onShowPwaInstall={openPwaModal}
              userId={navUserId}
              userName={navUser}
              userRole={navRole}
              schoolName={navSchool}
              unreadNotificationCount={unreadNotificationCount}
            />
          )}
        />
      </div>
      <CustomInstallButton />
      {showPwaModal && <PwaInstallModal onDismiss={dismissPwaModal} />}
    </SupabaseClientProvider>
  );
}