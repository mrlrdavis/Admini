import type { ReactNode } from 'react';

export interface LayoutShellProps {
  children: ReactNode;
  bottomBar: ReactNode;
}

export function LayoutShell({ children, bottomBar }: LayoutShellProps): JSX.Element {
  return (
    <div
      className="layout-shell"
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="layout-shell__content" style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
      <div className="layout-shell__bottom-bar">
        {bottomBar}
      </div>
    </div>
  );
}
