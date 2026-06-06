// ---------------------------------------------------------------------------
// MoreTab - Settings, integrations access, and account actions.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MoreTabProps {
  onSignOut: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MoreTab({ onSignOut }: MoreTabProps) {
  return (
    <div className="more-tab">
      {/* Header */}
      <header className="more-tab__header">
        <h1 className="more-tab__title">Settings</h1>
      </header>

      {/* Settings Section */}
      <section className="more-tab__section" aria-labelledby="more-tab-settings-heading">
        <h2 id="more-tab-settings-heading" className="more-tab__section-title">Settings</h2>
        <ul className="more-tab__list" role="list">
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn">
              <span className="more-tab__link-icon" aria-hidden="true">👤</span>
              <span className="more-tab__link-label">Profile</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn">
              <span className="more-tab__link-icon" aria-hidden="true">🔔</span>
              <span className="more-tab__link-label">Notifications</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn">
              <span className="more-tab__link-icon" aria-hidden="true">⚙️</span>
              <span className="more-tab__link-label">Preferences</span>
            </button>
          </li>
        </ul>
      </section>

      {/* Integrations Section */}
      <section className="more-tab__section" aria-labelledby="more-tab-integrations-heading">
        <h2 id="more-tab-integrations-heading" className="more-tab__section-title">Integrations</h2>
        <ul className="more-tab__list" role="list">
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn">
              <span className="more-tab__link-icon" aria-hidden="true">🔗</span>
              <span className="more-tab__link-label">Connected Apps</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn">
              <span className="more-tab__link-icon" aria-hidden="true">➕</span>
              <span className="more-tab__link-label">Add Integration</span>
            </button>
          </li>
        </ul>
      </section>

      {/* Account Actions Section */}
      <section className="more-tab__section" aria-labelledby="more-tab-account-heading">
        <h2 id="more-tab-account-heading" className="more-tab__section-title">Account</h2>
        <div className="more-tab__actions">
          <button
            type="button"
            className="more-tab__sign-out-btn"
            onClick={onSignOut}
          >
            Sign Out
          </button>
        </div>
      </section>
    </div>
  );
}
