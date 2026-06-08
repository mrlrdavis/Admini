import { useState, useEffect } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

let toastListener: ((msg: ToastMessage) => void) | null = null;

export function showToast(text: string, options?: { action?: { label: string; onClick: () => void }; duration?: number }) {
  const msg: ToastMessage = {
    id: Date.now().toString(),
    text,
    action: options?.action,
    duration: options?.duration ?? 4000,
  };
  toastListener?.(msg);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    toastListener = (msg) => {
      setToasts(prev => [...prev, msg]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== msg.id));
      }, msg.duration ?? 4000);
    };
    return () => { toastListener = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className="toast">
          <span className="toast__text">{toast.text}</span>
          {toast.action && (
            <button type="button" className="toast__action" onClick={toast.action.onClick}>
              {toast.action.label}
            </button>
          )}
          <button type="button" className="toast__dismiss" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
