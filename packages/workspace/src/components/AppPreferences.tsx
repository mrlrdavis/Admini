import { useState } from 'react';

// ---------------------------------------------------------------------------
// AppPreferences - App-level preference controls.
// Renders theme selection (light/dark/system), default tab selector,
// and compact mode toggle. Uses local React state until IndexedDB persistence
// is wired in task 13.3.
// ---------------------------------------------------------------------------

export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Represents the full set of app-level preferences.
 */
export interface AppPreferencesData {
  theme: ThemePreference;
  defaultTab: string;
  compactMode: boolean;
}

export interface AppPreferencesProps {
  /** Initial theme selection. Defaults to 'system'. */
  theme?: ThemePreference;
  /** Initial tab that opens on launch. Defaults to 'dashboard'. */
  defaultTab?: string;
  /** Initial compact mode state. Defaults to false. */
  compactMode?: boolean;
  /** Called when any preference changes. */
  onChange: (key: string, value: string | boolean) => void;
}

const TAB_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'capture', label: 'Capture' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'more', label: 'More' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function AppPreferences({
  theme: initialTheme = 'system',
  defaultTab: initialDefaultTab = 'dashboard',
  compactMode: initialCompactMode = false,
  onChange,
}: AppPreferencesProps) {
  const [theme, setTheme] = useState<ThemePreference>(initialTheme);
  const [defaultTab, setDefaultTab] = useState<string>(initialDefaultTab);
  const [compactMode, setCompactMode] = useState<boolean>(initialCompactMode);

  function handleThemeChange(value: ThemePreference) {
    setTheme(value);
    onChange('theme', value);
  }

  function handleDefaultTabChange(value: string) {
    setDefaultTab(value);
    onChange('defaultTab', value);
  }

  function handleCompactModeChange() {
    const newValue = !compactMode;
    setCompactMode(newValue);
    onChange('compactMode', newValue);
  }

  return (
    <div className="app-preferences" role="region" aria-label="App preferences">
      {/* Theme Selection */}
      <fieldset className="app-preferences__fieldset">
        <legend className="app-preferences__legend">
          <span className="app-preferences__title">Theme</span>
          <span className="app-preferences__description">
            Choose how the app looks. System matches your device setting.
          </span>
        </legend>
        <div className="app-preferences__theme-group" role="radiogroup" aria-label="Theme selection">
          {THEME_OPTIONS.map((option) => (
            <label key={option.value} className="app-preferences__theme-option">
              <input
                type="radio"
                className="app-preferences__radio"
                name="theme"
                value={option.value}
                checked={theme === option.value}
                onChange={() => handleThemeChange(option.value)}
              />
              <span className="app-preferences__theme-label">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Default Tab Selection */}
      <div className="app-preferences__row">
        <div className="app-preferences__row-text">
          <label className="app-preferences__title" htmlFor="app-preferences-default-tab">
            Default Tab
          </label>
          <span className="app-preferences__description" id="app-preferences-default-tab-desc">
            The tab shown when you open the app.
          </span>
        </div>
        <select
          id="app-preferences-default-tab"
          className="app-preferences__select"
          value={defaultTab}
          onChange={(e) => handleDefaultTabChange(e.target.value)}
          aria-describedby="app-preferences-default-tab-desc"
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
        <div className="app-preferences__row-text">
          <label className="app-preferences__title" htmlFor="app-preferences-compact-mode">
            Compact Mode
          </label>
          <span className="app-preferences__description" id="app-preferences-compact-mode-desc">
            Reduce spacing and padding for a denser layout.
          </span>
        </div>
        <button
          id="app-preferences-compact-mode"
          type="button"
          role="switch"
          className={`app-preferences__toggle${compactMode ? ' app-preferences__toggle--active' : ''}`}
          aria-checked={compactMode}
          aria-describedby="app-preferences-compact-mode-desc"
          onClick={handleCompactModeChange}
        >
          <span className="app-preferences__toggle-thumb" />
        </button>
      </div>
    </div>
  );
}