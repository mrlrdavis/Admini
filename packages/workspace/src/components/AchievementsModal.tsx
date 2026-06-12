// ---------------------------------------------------------------------------
// AchievementsModal - Overlay showing earned/locked badges with progress bar
// ---------------------------------------------------------------------------
// Implements the Modal Open/Close state machine:
//   closed + TRIGGER_OPEN -> opening -> open
//   open + (TRIGGER_CLOSE | OUTSIDE_CLICK | ESC_KEY | TAB_SWITCH) -> closing -> closed
// Side effects:
//   opening: trap focus, add backdrop
//   closing: restore focus to trigger element, remove backdrop
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5

import { useEffect, useRef, useCallback, useState } from 'react';
import '../styles/achievements-modal.css';

export interface Badge {
  id: string;
  icon: string;
  label: string;
  description: string;
  earnedAt?: string; // undefined = locked
}

export interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  badges: Badge[];
  totalBadges: number;
}

type ModalState = 'closed' | 'opening' | 'open' | 'closing';

/**
 * AchievementsModal displays earned and locked badges with a gold progress bar.
 * Implements focus trap, ESC dismiss, outside click dismiss, and listens
 * for 'admini:dismiss-modals' custom event from NavigationRenderer.
 */
export function AchievementsModal({
  isOpen,
  onClose,
  badges,
  totalBadges,
}: AchievementsModalProps) {
  const [modalState, setModalState] = useState<ModalState>('closed');
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const earnedBadges = badges.filter((b) => b.earnedAt !== undefined);
  const lockedBadges = badges.filter((b) => b.earnedAt === undefined);
  const earnedCount = earnedBadges.length;
  const progressPercent = totalBadges > 0 ? (earnedCount / totalBadges) * 100 : 0;

  // Handle state machine transitions for open/close
  useEffect(() => {
    if (isOpen && modalState === 'closed') {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setModalState('opening');
    } else if (!isOpen && (modalState === 'open' || modalState === 'opening')) {
      setModalState('closing');
    }
  }, [isOpen, modalState]);

  // Handle animation end transitions
  useEffect(() => {
    if (modalState === 'opening') {
      const timer = requestAnimationFrame(() => {
        setModalState('open');
      });
      return () => cancelAnimationFrame(timer);
    }
    if (modalState === 'closing') {
      const timer = requestAnimationFrame(() => {
        setModalState('closed');
        if (previousFocusRef.current && previousFocusRef.current.focus) {
          previousFocusRef.current.focus();
        }
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [modalState]);

  // Focus trap: when modal opens, focus the modal container
  useEffect(() => {
    if (modalState === 'open' && modalRef.current) {
      modalRef.current.focus();
    }
  }, [modalState]);

  // ESC key handler and focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (modalState === 'open' || modalState === 'opening')) {
        e.preventDefault();
        onClose();
      }

      if (e.key === 'Tab' && modalState === 'open' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstFocusable = focusableElements[0]!;
        const lastFocusable = focusableElements[focusableElements.length - 1]!;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    },
    [modalState, onClose]
  );

  useEffect(() => {
    if (modalState === 'open' || modalState === 'opening') {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [modalState, handleKeyDown]);

  // Listen for 'admini:dismiss-modals' custom event (from NavigationRenderer)
  useEffect(() => {
    const handleDismiss = () => {
      if (modalState === 'open' || modalState === 'opening') {
        onClose();
      }
    };
    window.addEventListener('admini:dismiss-modals', handleDismiss);
    return () => window.removeEventListener('admini:dismiss-modals', handleDismiss);
  }, [modalState, onClose]);

  // Outside click handler
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (modalState === 'closed') return null;

  const backdropClass = `achievements-modal__backdrop achievements-modal__backdrop--${modalState}`;
  const modalClass = `achievements-modal achievements-modal--${modalState}`;
  const progressLabel = `${earnedCount} of ${totalBadges} badges earned`;
  const progressWidth = `${progressPercent}%`;

  return (
    <div
      className={backdropClass}
      onClick={handleBackdropClick}

    >
      <div
        ref={modalRef}
        className={modalClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievements-modal-title"
        tabIndex={-1}
      >
        <div className="achievements-modal__header">
          <div>
            <h2 id="achievements-modal-title" className="achievements-modal__title">
              Achievements
            </h2>
            <p className="achievements-modal__subtitle">
              Track your progress and unlock badges
            </p>
          </div>
          <button
            type="button"
            className="achievements-modal__close"
            onClick={onClose}
            aria-label="Close achievements modal"
          >
            {'\u00D7'}
          </button>
        </div>

        <div className="achievements-modal__progress">
          <div className="achievements-modal__progress-labels">
            <span className="achievements-modal__progress-text">Progress</span>
            <span className="achievements-modal__progress-fraction">
              {earnedCount} / {totalBadges}
            </span>
          </div>
          <div
            className="achievements-modal__progress-bar"
            role="progressbar"
            aria-valuenow={earnedCount}
            aria-valuemin={0}
            aria-valuemax={totalBadges}
            aria-label={progressLabel}
          >
            <div
              className="achievements-modal__progress-fill"
              style={{ width: progressWidth }}
            />
          </div>
        </div>

        {earnedBadges.length > 0 && (
          <section className="achievements-modal__section">
            <h3 className="achievements-modal__section-title">Earned</h3>
            <div className="achievements-modal__list">
              {earnedBadges.map((badge) => (
                <div key={badge.id} className="achievements-modal__badge achievements-modal__badge--earned">
                  <span className="achievements-modal__badge-icon">{badge.icon}</span>
                  <div className="achievements-modal__badge-info">
                    <strong className="achievements-modal__badge-name">{badge.label}</strong>
                    <span className="achievements-modal__badge-desc">{badge.description}</span>
                  </div>
                  {badge.earnedAt && (
                    <span className="achievements-modal__badge-date">
                      {new Date(badge.earnedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {lockedBadges.length > 0 && (
          <section className="achievements-modal__section">
            <h3 className="achievements-modal__section-title">Locked</h3>
            <div className="achievements-modal__list">
              {lockedBadges.map((badge) => (
                <div key={badge.id} className="achievements-modal__badge achievements-modal__badge--locked">
                  <span className="achievements-modal__badge-icon">{badge.icon}</span>
                  <div className="achievements-modal__badge-info">
                    <strong className="achievements-modal__badge-name">{badge.label}</strong>
                    <span className="achievements-modal__badge-desc">{badge.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}