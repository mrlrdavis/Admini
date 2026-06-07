// ---------------------------------------------------------------------------
// AppPreferences - App-level preference controls.
// Renders theme selection (light/dark/system), default tab selector,
// and compact mode toggle.
// ---------------------------------------------------------------------------

export type ThemePreference = 'light' | 'dark' | 'system';

export interface AppPreferencesProps {
  /** Current theme selection. Defaults to 'system'. */
  theme?: ThemePreference;
  /** Which tab opens on launch. Defaults to 'dashboard'. */
  defaultTab?: string;
  /** Whether compact mode (reduced spacing) is enabled. Defaults to false. */
  compactMode?: boolean;
  /** Called when any preference changes. */
  onChange: (key: string, value: string | boolean) => void;
}

const TAB_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'capture', label: 'Capture' },
  { value: 'more', label: 'More' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function AppPreferences({
  theme = 'system',
  defaultTab = 'dashboard',
  compactMode = false,
  onChange,
}: AppPreferencesProps) {
  return (
    <div className="app-preferences" aria-label="App preferences">
      {/* Theme Selection */}
      <fieldset className="app-preferences__row">
        <legend className="app-preferences__label">Theme</legend>
        <div className="app-preferences__theme-group" role="radiogroup" aria-label="Theme selection">
          {THEME_OPTIONS.map((option) => (
            <label key={option.value} className="app-preferences__theme-option">
              <input
                type="radio"
                className="app-preferences__radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={() => onChange('theme', option.value)}
                aria-label={`${option.label} theme`}
              />
              <span className="app-preferences__theme-label">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Default Tab Selection */}
      <div className="app-preferences__row">
        <label className="app-preferences__label" htmlFor="app-preferences-default-tab">
          Default Tab
        </label>
        <select
          id="app-preferences-default-tab"
          className="app-preferences__select"
          value={defaultTab}
          onChange={(e) => onChange('defaultTab', e.target.value)}
          aria-label="Default tab on launch"
        >
          {TAB_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Compact Mode Toggle */}
      <div className="app-preferences__row">
        <label className="app-preferences__label" htmlFor="app-preferences-compact-mode">
          Compact Mode
        </label>
        <button
          id="app-preferences-compact-mode"
          type="button"
          role="switch"
          className={`app-preferences__toggle ${compactMode ? 'app-preferences__toggle--active' : ''}`}
          aria-checked={compactMode}
          onClick={() => onChange('compactMode', !compactMode)}
        >
          <span className="app-preferences__toggle-track">
            <span className="app-preferences__toggle-thumb" />
          </span>
          <span className="app-preferences__toggle-text">
            {compactMode ? 'On' : 'Off'}
          </span>
        </button>
      </div>
    </div>
  );
}
