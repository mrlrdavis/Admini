import { useRegisterSW } from 'virtual:pwa-register/react';

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-banner" role="alert" aria-live="polite">
      <span className="pwa-update-message">Update available</span>
      <button
        className="pwa-update-reload"
        type="button"
        onClick={() => updateServiceWorker(true)}
      >
        Reload
      </button>
      <button
        className="pwa-update-dismiss"
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update notification"
      >
        &times;
      </button>
    </div>
  );
}