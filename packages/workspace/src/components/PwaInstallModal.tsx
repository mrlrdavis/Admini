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
  steps: string[];
  note?: string;
}

const BROWSERS: BrowserInfo[] = [
  {
    id: 'chrome',
    name: 'Chrome',
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
            <h3 className="pwa-install-modal__browser-name">{currentBrowser.name}</h3>

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

        {/* Browser selector - text only */}
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
              >
                {browser.name}
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