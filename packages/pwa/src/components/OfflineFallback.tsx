import React from 'react';

export interface OfflineFallbackProps {
  /** Application name to display */
  appName: string;
}

/**
 * A minimal offline screen component that displays app branding and a retry button.
 *
 * This is a UI-only component. It does NOT:
 * - Listen for network events (PWAProvider handles that)
 * - Interact with the service worker
 * - Replace the static offline.html fallback served by Workbox
 */
export function OfflineFallback(props: OfflineFallbackProps): React.ReactElement {
  const { appName } = props;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h1 aria-label={`${appName} is offline`}>
        {appName}
      </h1>
      <p>You are currently offline. Please check your connection and try again.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        aria-label="Retry loading the page"
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          cursor: 'pointer',
          borderRadius: '4px',
          border: '1px solid currentColor',
          background: 'transparent',
          color: 'inherit',
        }}
      >
        Retry
      </button>
    </div>
  );
}
