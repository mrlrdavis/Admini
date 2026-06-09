import { useState } from 'react';

// ---------------------------------------------------------------------------
// AppPreferences - App-level preference controls.
// Renders theme selection (light/dark/system), default tab selector,
// compact mode toggle, and task recommendations toggle.
// ---------------------------------------------------------------------------

export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Represents the full set of app-level preferences.
 */
export interface AppPreferencesData {
  theme: ThemePreference;
  defaultTab: string;
  compactMode: boolean;
  taskRecommendationsEnabled: boolean;
}

export interface AppPreferencesProps {
  /** Initial theme selection. Defaults to 'system'. */
  theme?: ThemePreference;
  /** Initial tab that opens on launch. Defaults to 'dashboard'. */
  defaultTab?: string;
  /** Initial compact mode state. Defaults to false. */
  compactMode?: boolean;
  /** Initial task recommendations enabled state. Defaults to true. */
  taskRecommendationsEnabled?: boolean;
  /** Called when any preference changes. */
  onChange: (key: string, value: string | boolean) => void;
}

const TAB_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'capture', label: 'Capture' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'more', label: 'More' },
];


export function AppPreferences({
  defaultTab: initialDefaultTab = 'dashboard',
  compactMode: initialCompactMode = false,
  taskRecommendationsEnabled: initialTaskRecommendationsEnabled = true,
  onChange,
}: AppPreferencesProps) {
  const [defaultTab, setDefaultTab] = useState<string>(initialDefaultTab);
  const [compactMode, setCompactMode] = useState<boolean>(initialCompactMode);
  const [taskRecommendationsEnabled, setTaskRecommendationsEnabled] = useState<boolean>(initialTaskRecommendationsEnabled);
  function handleDefaultTabChange(value: string) {
    setDefaultTab(value);
    onChange('defaultTab', value);
  }

  function handleCompactModeChange() {
    const newValue = !compactMode;
    setCompactMode(newValue);
    onChange('compactMode', newValue);
  }

  function handleTaskRecommendationsChange() {
    const newValue = !taskRecommendationsEnabled;
    setTaskRecommendationsEnabled(newValue);
    onChange('taskRecommendationsEnabled', newValue);
  }

  return (
    <div className="app-preferences" role="region" aria-label="App preferences">

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

      {/* Task Recommendations Toggle */}
      <div className="app-preferences__row">
        <div className="app-preferences__row-text">
          <label className="app-preferences__title" htmlFor="app-preferences-task-recommendations">
            Task Recommendations
          </label>
          <span className="app-preferences__description" id="app-preferences-task-recommendations-desc">
            Show AI-generated task suggestions on the Dashboard based on your captures and notes.
          </span>
        </div>
        <button
          id="app-preferences-task-recommendations"
          type="button"
          role="switch"
          className={`app-preferences__toggle${taskRecommendationsEnabled ? ' app-preferences__toggle--active' : ''}`}
          aria-checked={taskRecommendationsEnabled}
          aria-describedby="app-preferences-task-recommendations-desc"
          onClick={handleTaskRecommendationsChange}
        >
          <span className="app-preferences__toggle-thumb" />
        </button>
      </div>
    </div>
  );
}