import React from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

/**
 * A reusable install button that renders only when the app is installable
 * (i.e., the `beforeinstallprompt` event has been received).
 *
 * After `promptInstall()` is called, the hook sets `isInstallable` to false,
 * hiding the button for the remainder of the session.
 *
 * Uses `useInstallPrompt` exclusively - does NOT derive installability
 * from `isStandalone` directly.
 */
export function InstallButton(): React.ReactElement | null {
  const { isInstallable, promptInstall } = useInstallPrompt();

  if (!isInstallable) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Install application"
      onClick={() => { promptInstall(); }}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.625rem 1rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
        backgroundColor: '#1a1a2e',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 2v8M5 7l3 3 3-3M3 12h10" />
      </svg>
      Install
    </button>
  );
}
