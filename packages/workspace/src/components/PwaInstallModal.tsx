// ---------------------------------------------------------------------------
// PwaInstallModal - Browser-specific PWA installation instructions
// ---------------------------------------------------------------------------
// Shows a dismissable modal after login with installation steps for each browser.
// Features:
import '../styles/pwa-install-modal.css';
//   - Auto-rotating carousel through browser tabs
//   - User can click to select a specific browser and stop animation
//   - Remembers dismissal in localStorage to show only once
//   - Accurate, verified installation steps for each major browser

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PwaInstallModalProps {
  /** Called when the modal should close */
  onDismiss: () => void;
}

type BrowserId = 'chrome' | 'edge' | 'firefox' | 'safari' | 'brave' | 'opera';

interface BrowserInfo {
  id: BrowserId;
  name: string;
  icon: string;
  steps: string[];
  note?: string;
}

const BROWSERS: BrowserInfo[] = [
  {
    id: 'chrome',
    name: 'Chrome',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="22" fill="%234285F4"/%3E%3Cpath fill="%2334A853" d="M24 13.5c5.8 0 10.5 4.7 10.5 10.5 0 1.9-.5 3.6-1.3 5.1l-9.2 15.9C13.3 44.4 5 35.2 5 24c0-5.8 4.7-10.5 10.5-10.5h8.5z"/%3E%3Cpath fill="%23FBBC05" d="M24 13.5H15.5C9.7 13.5 5 18.2 5 24c0 3.9 2.1 7.3 5.3 9.1l9.2-15.9c.8-1.5 2.2-2.6 3.9-3.2l.6-0.5z"/%3E%3Cpath fill="%23EA4335" d="M24 34.5c-5.8 0-10.5-4.7-10.5-10.5 0-1.9.5-3.6 1.3-5.1l9.2-15.9C34.7 3.6 43 12.8 43 24c0 5.8-4.7 10.5-10.5 10.5H24z"/%3E%3Ccircle cx="24" cy="24" r="8" fill="%23fff"/%3E%3Ccircle cx="24" cy="24" r="4" fill="%234285F4"/%3E%3C/svg%3E',
    steps: [
      'Click the three-dot menu (⋮) in the top-right corner',
      'Select "Cast, save, and share"',
      'Click "Install page as app..."',
      'Confirm by clicking "Install"'
    ],
    note: 'The app will open in its own window and be available from your desktop/Start menu.'
  },
  {
    id: 'edge',
    name: 'Edge',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Cpath fill="%230078D4" d="M42 24c0 9.9-8.1 18-18 18S6 33.9 6 24 14.1 6 24 6s18 8.1 18 18z"/%3E%3Cpath fill="%2350E6FF" d="M24 8c-8.8 0-16 7.2-16 16 0 5.5 2.8 10.4 7 13.3 0-4.4 3.6-8 8-8h9c0-4.4-3.6-8-8-8h-4c-2.2 0-4-1.8-4-4s1.8-4 4-4h12c2.2 0 4 1.8 4 4 0 8.8-7.2 16-16 16"/%3E%3C/svg%3E',
    steps: [
      'Click the three-dot menu (⋯) in the top-right corner',
      'Select "Apps"',
      'Click "Install this site as an app"',
      'Optionally customize the name, then click "Install"'
    ],
    note: 'Edge will add the app to your Start menu and taskbar.'
  },
  {
    id: 'firefox',
    name: 'Firefox',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="22" fill="%23FF7139"/%3E%3Cpath fill="%23FFBD4F" d="M36 18c-1-4-4-7-8-8 2 2 3 5 2 8-1-2-3-3-5-3 3 2 4 6 2 9-1 2-3 3-5 3 0 0 1 1 2 1 4 0 7-3 7-7 0-1 0-2-1-3h1c3 0 5 2 5 5v1c0 6-5 11-11 11s-11-5-11-11 5-11 11-11c2 0 4 1 6 2-1-1-2-2-4-2-5 0-9 4-9 9s4 9 9 9c4 0 8-3 9-7 0-1 0-2 0-3 0-1-1-2-1-3z"/%3E%3C/svg%3E',
    steps: [
      'Firefox does not fully support installing PWAs natively',
      'Use an extension like "PWA for Firefox" from Add-ons',
      'Or bookmark the site for quick access',
      'Consider using Chrome or Edge for the best experience'
    ],
    note: 'Firefox has limited PWA support. For the full app experience, we recommend Chrome or Edge.'
  },
  {
    id: 'safari',
    name: 'Safari',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="22" fill="%23006CFF"/%3E%3Cpath fill="%23fff" d="M24 8c-8.8 0-16 7.2-16 16s7.2 16 16 16 16-7.2 16-16S32.8 8 24 8zm0 30c-7.7 0-14-6.3-14-14s6.3-14 14-14 14 6.3 14 14-6.3 14-14 14z"/%3E%3Cpath fill="%23FF3B30" d="M24 12l-8 16 16-8z"/%3E%3Cpath fill="%23fff" d="M24 28l8-16-16 8z"/%3E%3C/svg%3E',
    steps: [
      'Click the Share button in the toolbar (square with up arrow)',
      'Scroll down and select "Add to Dock"',
      'Optionally edit the name',
      'Click "Add"'
    ],
    note: 'On macOS Sonoma and later, Safari fully supports PWAs with "Add to Dock".'
  },
  {
    id: 'brave',
    name: 'Brave',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Cpath fill="%23FB542B" d="M40 14l-4-6-4 2H16l-4-2-4 6 2 4-2 8 6 14 8 4h4l8-4 6-14-2-8z"/%3E%3Cpath fill="%23fff" d="M24 16l-6 4v8l6 6 6-6v-8z"/%3E%3C/svg%3E',
    steps: [
      'Click the three-line menu (≡) in the top-right corner',
      'Hover over "More tools"',
      'Click "Install page as app..."',
      'Click "Install" to confirm'
    ],
    note: 'Brave uses Chromium, so installation works similarly to Chrome.'
  },
  {
    id: 'opera',
    name: 'Opera',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Ccircle cx="24" cy="24" r="22" fill="%23FF1B2D"/%3E%3Cellipse cx="24" cy="24" rx="10" ry="14" fill="%23fff"/%3E%3C/svg%3E',
    steps: [
      'Click the Easy Setup button (three horizontal lines) in the sidebar',
      'Or press Ctrl+Shift+B to show the bookmarks bar',
      'Click "Install" in the address bar if the prompt appears',
      'Or bookmark for quick access'
    ],
    note: 'Opera supports PWA installation when a web app manifest is detected.'
  }
];

const CAROUSEL_INTERVAL = 4000; // 4 seconds per browser

export function PwaInstallModal({ onDismiss }: PwaInstallModalProps) {
  const [selectedBrowser, setSelectedBrowser] = useState<BrowserId>('chrome');
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-rotate through browsers
  useEffect(() => {
    if (!isAutoPlaying) return;

    intervalRef.current = window.setInterval(() => {
      setSelectedBrowser((current) => {
        const currentIndex = BROWSERS.findIndex((b) => b.id === current);
        const nextIndex = (currentIndex + 1) % BROWSERS.length;
        return BROWSERS[nextIndex]!.id;
      });
    }, CAROUSEL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoPlaying]);

  // Handle browser selection (stops auto-play)
  const handleSelectBrowser = useCallback((browserId: BrowserId) => {
    setIsAutoPlaying(false);
    setSelectedBrowser(browserId);
  }, []);

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onDismiss();
    }, 200);
  }, [onDismiss]);

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Click outside to close
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const currentBrowser = BROWSERS.find((b) => b.id === selectedBrowser) || BROWSERS[0]!;

  return (
    <div
      className={`pwa-install-modal__backdrop ${isClosing ? 'pwa-install-modal__backdrop--closing' : ''}`}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={`pwa-install-modal ${isClosing ? 'pwa-install-modal--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
      >
        {/* Close button */}
        <button
          type="button"
          className="pwa-install-modal__close"
          onClick={handleClose}
          aria-label="Close install instructions"
        >
          ×
        </button>

        {/* Header */}
        <div className="pwa-install-modal__header">
          <h2 id="pwa-install-title" className="pwa-install-modal__title">
            Install Admini for Quick Access
          </h2>
          <p className="pwa-install-modal__subtitle">
            Add Admini to your device for a native app experience
          </p>
        </div>

        {/* Instructions area */}
        <div className="pwa-install-modal__content">
          <div className="pwa-install-modal__instructions" key={currentBrowser.id}>
            <div className="pwa-install-modal__browser-header">
              <img
                src={currentBrowser.icon}
                alt=""
                className="pwa-install-modal__browser-icon-large"
              />
              <h3 className="pwa-install-modal__browser-name">{currentBrowser.name}</h3>
            </div>

            <ol className="pwa-install-modal__steps">
              {currentBrowser.steps.map((step, index) => (
                <li key={index} className="pwa-install-modal__step">
                  <span className="pwa-install-modal__step-number">{index + 1}</span>
                  <span className="pwa-install-modal__step-text">{step}</span>
                </li>
              ))}
            </ol>

            {currentBrowser.note && (
              <p className="pwa-install-modal__note">
                <strong>Tip:</strong> {currentBrowser.note}
              </p>
            )}
          </div>
        </div>

        {/* Browser selector */}
        <div className="pwa-install-modal__browsers">
          {BROWSERS.map((browser) => {
            const isSelected = browser.id === selectedBrowser;
            return (
              <button
                key={browser.id}
                type="button"
                className={`pwa-install-modal__browser-btn ${isSelected ? 'pwa-install-modal__browser-btn--active' : ''}`}
                onClick={() => handleSelectBrowser(browser.id)}
                aria-pressed={isSelected}
                title={browser.name}
              >
                <img
                  src={browser.icon}
                  alt={browser.name}
                  className="pwa-install-modal__browser-icon"
                />
                <span className="pwa-install-modal__browser-label">{browser.name}</span>
              </button>
            );
          })}
        </div>

        {/* Progress indicator for auto-play */}
        {isAutoPlaying && (
          <div className="pwa-install-modal__progress">
            <div
              className="pwa-install-modal__progress-bar"
              style={{ animationDuration: `${CAROUSEL_INTERVAL}ms` }}
              key={selectedBrowser}
            />
          </div>
        )}

        {/* Footer */}
        <div className="pwa-install-modal__footer">
          <button
            type="button"
            className="pwa-install-modal__dismiss-btn"
            onClick={handleClose}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

// Storage key for remembering dismissal
const DISMISS_KEY = 'admini_pwa_install_dismissed';

/**
 * Hook to manage PWA install modal visibility.
 * Shows only once after first login, then remembers dismissal.
 */
export function usePwaInstallModal() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === 'true') {
      return;
    }

    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;

    if (isStandalone) {
      // Already installed, don't show
      localStorage.setItem(DISMISS_KEY, 'true');
      return;
    }

    // Show modal after a brief delay for better UX
    const timer = setTimeout(() => {
      setShowModal(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    setShowModal(false);
    localStorage.setItem(DISMISS_KEY, 'true');
  }, []);

  return { showModal, dismiss };
}