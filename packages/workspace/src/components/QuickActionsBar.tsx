// ---------------------------------------------------------------------------
// QuickActionsBar - Pill-shaped shortcut buttons for common workflows
// ---------------------------------------------------------------------------
// Pure presentational component. Renders four quick-action pill buttons that
// navigate to specific tab + mode combinations.
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5

import type { WorkspaceTab } from '../types';
import '../styles/quick-actions-bar.css';

export interface QuickActionsBarProps {
  onTabChange: (tabId: WorkspaceTab, options?: { mode?: string; view?: string }) => void;
}

/**
 * QuickActionsBar renders four pill-shaped buttons that provide one-click
 * shortcuts to common workflows:
 * - "Record a Capture" -> Capture tab in voice mode
 * - "Quick Tap Capture" -> Capture tab in tap mode
 * - "See Task Calendar" -> Tasks tab in calendar view
 * - "Update Roster" -> Admin tab
 */
export function QuickActionsBar({ onTabChange }: QuickActionsBarProps) {
  return (
    <div className="quick-actions-bar" role="toolbar" aria-label="Quick actions">
      <button
        type="button"
        className="quick-actions-bar__pill"
        onClick={() => onTabChange('capture', { mode: 'voice' })}
      >
        Record a Capture
      </button>
      <button
        type="button"
        className="quick-actions-bar__pill"
        onClick={() => onTabChange('capture', { mode: 'tap' })}
      >
        Quick Tap Capture
      </button>
      <button
        type="button"
        className="quick-actions-bar__pill"
        onClick={() => onTabChange('tasks', { view: 'calendar' })}
      >
        See Task Calendar
      </button>
      <button
        type="button"
        className="quick-actions-bar__pill"
        onClick={() => onTabChange('admin')}
      >
        Update Roster
      </button>
    </div>
  );
}
