// ---------------------------------------------------------------------------
// NotificationSettings - Toggle switches for notification preferences.
// Renders email notifications, push notifications, and activity digest toggles.
// ---------------------------------------------------------------------------

export interface NotificationSettingsProps {
  /** Whether email notifications are enabled */
  emailNotifications?: boolean;
  /** Whether push notifications are enabled */
  pushNotifications?: boolean;
  /** Whether the weekly activity digest is enabled */
  activityDigest?: boolean;
  /** Called when a toggle changes. Receives the preference key and new value. */
  onChange: (key: string, value: boolean) => void;
  /** When true, disables all toggles during a save operation. */
  saving?: boolean;
  /** Error message to display. */
  error?: string | null;
  /** Called when the user clicks the Retry button after a save failure. */
  onRetry?: () => void;
}

export function NotificationSettings({
  emailNotifications = false,
  pushNotifications = false,
  activityDigest = false,
  onChange,
  saving,
  error,
  onRetry,
}: NotificationSettingsProps) {
  return (
    <div className="notification-settings" role="region" aria-label="Notification settings">
      {error && (
        <div className="notification-settings__error-container" role="alert">
          <p className="notification-settings__error">
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              className="notification-settings__retry-btn"
              onClick={onRetry}
              disabled={saving}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Email Notifications */}
      <div className="notification-settings__row">
        <label
          className="notification-settings__label"
          htmlFor="toggle-email-notifications"
        >
          <span className="notification-settings__title">Email Notifications</span>
          <span className="notification-settings__description">
            Receive email alerts for important updates
          </span>
        </label>
        <button
          id="toggle-email-notifications"
          type="button"
          role="switch"
          aria-checked={emailNotifications}
          className={`notification-settings__toggle${emailNotifications ? ' notification-settings__toggle--active' : ''}`}
          onClick={() => onChange('emailNotifications', !emailNotifications)}
          disabled={saving}
        >
          <span className="notification-settings__toggle-thumb" />
        </button>
      </div>

      {/* Push Notifications */}
      <div className="notification-settings__row">
        <label
          className="notification-settings__label"
          htmlFor="toggle-push-notifications"
        >
          <span className="notification-settings__title">Push Notifications</span>
          <span className="notification-settings__description">
            Get real-time push notifications on your device
          </span>
        </label>
        <button
          id="toggle-push-notifications"
          type="button"
          role="switch"
          aria-checked={pushNotifications}
          className={`notification-settings__toggle${pushNotifications ? ' notification-settings__toggle--active' : ''}`}
          onClick={() => onChange('pushNotifications', !pushNotifications)}
          disabled={saving}
        >
          <span className="notification-settings__toggle-thumb" />
        </button>
      </div>

      {/* Activity Digest */}
      <div className="notification-settings__row">
        <label
          className="notification-settings__label"
          htmlFor="toggle-activity-digest"
        >
          <span className="notification-settings__title">Activity Digest</span>
          <span className="notification-settings__description">
            Weekly summary of workspace activity
          </span>
        </label>
        <button
          id="toggle-activity-digest"
          type="button"
          role="switch"
          aria-checked={activityDigest}
          className={`notification-settings__toggle${activityDigest ? ' notification-settings__toggle--active' : ''}`}
          onClick={() => onChange('activityDigest', !activityDigest)}
          disabled={saving}
        >
          <span className="notification-settings__toggle-thumb" />
        </button>
      </div>
    </div>
  );
}