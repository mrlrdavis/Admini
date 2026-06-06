// ---------------------------------------------------------------------------
// PulseTab - Native React implementation of the Pulse view
// ---------------------------------------------------------------------------
// Daily pulse check-ins, stats, and timeline.

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PulseTabProps {}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PulseCheckpoint {
  id: string;
  time: string;
  label: string;
  status: 'responded' | 'skipped' | 'upcoming';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PulseTab(_props: PulseTabProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Placeholder data — will be replaced with real pulse service calls
  const stats = {
    responded: 0,
    skipped: 0,
    upcoming: 0,
  };

  const checkpoints: PulseCheckpoint[] = [];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="pulse-tab">
      {/* Header */}
      <header className="pulse-tab__header">
        <h1 className="pulse-tab__title">Today's Pulses</h1>
        <p className="pulse-tab__subtitle">Check in with your day</p>
      </header>

      {/* Stats Row */}
      <div className="pulse-tab__stats">
        <div className="pulse-tab__stat-card">
          <span className="pulse-tab__stat-value">{stats.responded}</span>
          <span className="pulse-tab__stat-label">Responded</span>
        </div>
        <div className="pulse-tab__stat-card">
          <span className="pulse-tab__stat-value">{stats.skipped}</span>
          <span className="pulse-tab__stat-label">Skipped</span>
        </div>
        <div className="pulse-tab__stat-card">
          <span className="pulse-tab__stat-value">{stats.upcoming}</span>
          <span className="pulse-tab__stat-label">Upcoming</span>
        </div>
      </div>

      {/* Pulse Timeline */}
      <section className="pulse-tab__timeline-section">
        <h2 className="pulse-tab__section-title">Timeline</h2>
        {checkpoints.length === 0 ? (
          <div className="pulse-tab__empty-state">
            <p className="pulse-tab__empty-title">No Pulse checkpoints yet</p>
            <p className="pulse-tab__empty-desc">
              Your scheduled pulse check-ins will appear here throughout the day.
            </p>
          </div>
        ) : (
          <ul className="pulse-tab__timeline">
            {checkpoints.map((cp) => (
              <li key={cp.id} className={`pulse-tab__checkpoint pulse-tab__checkpoint--${cp.status}`}>
                <span className="pulse-tab__checkpoint-time">{cp.time}</span>
                <span className="pulse-tab__checkpoint-dot" />
                <span className="pulse-tab__checkpoint-label">{cp.label}</span>
                <span className="pulse-tab__checkpoint-status">{cp.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Day Structure */}
      <section className="pulse-tab__day-structure">
        <h2 className="pulse-tab__section-title">Day Structure</h2>
        <div className="pulse-tab__day-card">
          <div className="pulse-tab__day-row">
            <span className="pulse-tab__day-period">Morning</span>
            <span className="pulse-tab__day-time">8:00 - 12:00</span>
          </div>
          <div className="pulse-tab__day-row">
            <span className="pulse-tab__day-period">Afternoon</span>
            <span className="pulse-tab__day-time">12:00 - 16:00</span>
          </div>
          <div className="pulse-tab__day-row">
            <span className="pulse-tab__day-period">End of Day</span>
            <span className="pulse-tab__day-time">16:00 - 17:00</span>
          </div>
        </div>
      </section>

      {/* Notifications Toggle */}
      <section className="pulse-tab__notifications">
        <div className="pulse-tab__notification-row">
          <div className="pulse-tab__notification-info">
            <span className="pulse-tab__notification-label">Pulse Notifications</span>
            <span className="pulse-tab__notification-desc">Get reminded for check-ins</span>
          </div>
          <label className="pulse-tab__toggle">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="pulse-tab__toggle-input"
            />
            <span className="pulse-tab__toggle-track" />
          </label>
        </div>
      </section>
    </div>
  );
}
