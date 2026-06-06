import { useRef, useState, useEffect, Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import type { TabItem } from './TabBar';
import { SkeletonCard } from './Skeleton';

export type LayoutMode = 'mobile' | 'desktop';

export interface LayoutShellProps {
  children: ReactNode;
  /** @deprecated Use renderNavigation instead */
  bottomBar?: ReactNode;
  mode?: 'auto' | 'mobile' | 'desktop';
  renderNavigation?: (props: {
    layoutMode: LayoutMode;
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
  }) => ReactNode;
  tabs?: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  loading?: boolean;
}

// Error boundary for lazy-loaded content
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ContentErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Intentional: error boundaries should report caught errors for debugging
    console.error('[LayoutShell] Content error:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="layout-shell__error" role="alert">
            <p>Something went wrong loading this content.</p>
            <button
              type="button"
              className="admini-button primary"
              onClick={() => this.setState({ hasError: false })}
            >
              Retry
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// Skeleton fallback for Suspense and loading states
function SkeletonContent() {
  return (
    <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <SkeletonCard height={80} />
      <SkeletonCard height={160} />
      <SkeletonCard height={120} />
    </div>
  );
}

export function LayoutShell({
  children,
  bottomBar,
  mode = 'auto',
  renderNavigation,
  tabs = [],
  activeTab = '',
  onTabChange,
  loading,
}: LayoutShellProps): JSX.Element {
  const shellRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('mobile');

  useEffect(() => {
    if (mode !== 'auto') {
      setLayoutMode(mode === 'desktop' ? 'desktop' : 'mobile');
      return;
    }
    const el = shellRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const width = entry.contentRect.width;
        setLayoutMode(width > 768 ? 'desktop' : 'mobile');
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);

  // Determine navigation content
  const navElement = renderNavigation
    ? renderNavigation({ layoutMode, tabs, activeTab, onTabChange: onTabChange ?? (() => {}) })
    : bottomBar;

  return (
    <div
      ref={shellRef}
      className={`layout-shell layout-shell--${layoutMode}`}
    >
      {layoutMode === 'desktop' && navElement && (
        <aside className="layout-shell__sidebar">{navElement}</aside>
      )}
      <main className="layout-shell__content">
        {loading ? (
          <SkeletonContent />
        ) : (
          <ContentErrorBoundary>
            <Suspense fallback={<SkeletonContent />}>
              {children}
            </Suspense>
          </ContentErrorBoundary>
        )}
      </main>
      {layoutMode === 'mobile' && navElement && (
        <div className="layout-shell__bottom-bar">{navElement}</div>
      )}
    </div>
  );
}
