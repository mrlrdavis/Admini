// ---------------------------------------------------------------------------
// PulseTab - Native React implementation of the Pulse view
// ---------------------------------------------------------------------------
// Daily pulse check-ins, stats, and timeline.

import { useState } from 'react';
import { SkeletonCard } from '@admini/ui';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PulseTabProps {
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PulseCheckpoint {
  id: string;
  time: string;
  label: string;
  status: 'responded' | 'skipped' | 'upcoming';
}

interface DayBlock {
  period: string;
  time: string;
  activities: { label: string; type: 'focus' | 'meetings' | 'wrap-up' | 'default' }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PulseTab({ loading }: PulseTabProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Placeholder data - will be replaced with real pulse service calls
  const stats = {
    tasksDone: 0,
    focusHours: 0,
    streak: 0,
  };

  const checkpoints: PulseCheckpoint[] = [];

  const dayBlocks: DayBlock[] = [
    {
      period: 'Morning',
      time: '8:00 AM - 12:00 PM',
      activities: [
        { label: 'Deep work', type: 'focus' },
        { label: 'Review PRs', type: 'default' },
      ],
    },
    {
      period: 'Afternoon',
      time: '12:00 PM - 4:00 PM',
      activities: [
        { label: 'Team sync', type: 'meetings' },
        { label: 'Feature dev', type: 'focus' },
      ],
    },
    {
      period: 'End of Day',
      time: '4:00 PM - 5:00 PM',
      activities: [
        { label: 'Wrap-up', type: 'wrap-up' },
      ],
    },
  ];

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="pulse-tab pulse-tab--loading" aria-busy="true">
        <SkeletonCard height={60} />
        <SkeletonCard height={100} />
        <SkeletonCard height={140} />
        <SkeletonCard height={120} />
      </div>
    );
  }

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
          <span className="pulse-tab__stat-value">{stats.tasksDone}</span>
          <span className="pulse-tab__stat-label">Tasks Done</span>
        </div>
        <div className="pulse-tab__stat-card">
          <span className="pulse-tab__stat-value">{stats.focusHours}</span>
          <span className="pulse-tab__stat-label">Focus Hours</span>
        </div>
        <div className="pulse-tab__stat-card">
          <span className="pulse-tab__stat-value">{stats.streak}</span>
          <span className="pulse-tab__stat-label">Streak</span>
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
          {dayBlocks.map((block) => (
            <div key={block.period} className="pulse-tab__day-row">
              <span className="pulse-tab__day-period">{block.period}</span>
              <span className="pulse-tab__day-time">{block.time}</span>
              <div className="pulse-tab__day-activity">
                {block.activities.map((activity) => (
                  <span
                    key={activity.label}
                    className={`pulse-tab__activity-block${
                      activity.type !== 'default'
                        ? ` pulse-tab__activity-block--${activity.type}`
                        : ''
                    }`}
                  >
                    {activity.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
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