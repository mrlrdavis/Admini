import { useState, useEffect, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

/**
 * Toast manager handles deduplication logic.
 * Only one toast is visible at a time — duplicate or rapid triggers
 * replace the current toast rather than stacking.
 */
export class ToastManager {
  private currentToastId: string | null = null;
  private listener: ((msg: ToastMessage | null) => void) | null = null;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  setListener(listener: ((msg: ToastMessage | null) => void) | null) {
    this.listener = listener;
  }

  /**
   * Show a toast. If a toast is already visible, it is replaced (deduplication).
   * Returns the toast ID.
   */
  show(text: string, options?: { action?: { label: string; onClick: () => void }; duration?: number }): string {
    // Clear any pending dismiss timer for the previous toast
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }

    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    const msg: ToastMessage = {
      id,
      text,
      action: options?.action,
      duration: options?.duration ?? 4000,
    };

    // Deduplication: replace any currently visible toast
    this.currentToastId = id;
    this.listener?.(msg);

    // Auto-dismiss after timeout
    this.dismissTimer = setTimeout(() => {
      this.dismiss(id);
    }, msg.duration ?? 4000);

    return id;
  }

  /**
   * Dismiss the toast with the given ID (only if it's the current one).
   */
  dismiss(id: string) {
    if (this.currentToastId === id) {
      this.currentToastId = null;
      if (this.dismissTimer !== null) {
        clearTimeout(this.dismissTimer);
        this.dismissTimer = null;
      }
      this.listener?.(null);
    }
  }

  /**
   * Get the current visible toast ID (for testing/inspection).
   */
  getCurrentToastId(): string | null {
    return this.currentToastId;
  }

  /**
   * Returns whether a toast is currently visible.
   */
  isVisible(): boolean {
    return this.currentToastId !== null;
  }

  /**
   * Count of visible toasts (always 0 or 1 due to deduplication).
   */
  getVisibleCount(): number {
    return this.currentToastId !== null ? 1 : 0;
  }

  /**
   * Reset internal state (useful for testing).
   */
  reset() {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    this.currentToastId = null;
    this.listener?.(null);
  }
}

// Singleton toast manager instance
export const toastManager = new ToastManager();

/**
 * Show a toast notification. If one is already visible, it is replaced (not stacked).
 * Deduplication: the number of simultaneously visible toasts never exceeds one.
 */
export function showToast(text: string, options?: { action?: { label: string; onClick: () => void }; duration?: number }): string {
  return toastManager.show(text, options);
}

export function ToastContainer() {
  const [currentToast, setCurrentToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    toastManager.setListener((msg) => {
      setCurrentToast(msg);
    });
    return () => {
      toastManager.setListener(null);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    if (currentToast) {
      toastManager.dismiss(currentToast.id);
    }
  }, [currentToast]);

  if (!currentToast) return null;

  return (
    <div
      className="toast-container"
      aria-live="polite"
      style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999, pointerEvents: 'none' }}
    >
      <div className="toast" style={{ pointerEvents: 'auto' }}>
        <span className="toast__text">{currentToast.text}</span>
        {currentToast.action && (
          <button type="button" className="toast__action" onClick={currentToast.action.onClick}>
            {currentToast.action.label}
          </button>
        )}
        <button
          type="button"
          className="toast__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        >
          &times;
        </button>
      </div>
    </div>
  );
}
