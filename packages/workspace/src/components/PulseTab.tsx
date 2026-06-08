// ---------------------------------------------------------------------------
// PulseTab - Native React implementation of the Pulse view
// ---------------------------------------------------------------------------
// Daily pulse check-ins, stats, and timeline.

import { useState, useEffect } from 'react';
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
// Constants
// ---------------------------------------------------------------------------

const DAY_STRUCTURE_KEY = 'admini_day_structure';

const DEFAULT_DAY_BLOCKS: DayBlock[] = [
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PulseTab({ loading }: PulseTabProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>(DEFAULT_DAY_BLOCKS);
  const [editingDay, setEditingDay] = useState(false);
  const [editForm, setEditForm] = useState<DayBlock[]>([]);
  const [addingActivityIndex, setAddingActivityIndex] = useState<number | null>(null);
  const [newActivityLabel, setNewActivityLabel] = useState('');

  // Load saved day structure from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DAY_STRUCTURE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DayBlock[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDayBlocks(parsed);
        }
      }
    } catch {
      // Ignore parse errors, use defaults
    }
  }, []);



  const checkpoints: PulseCheckpoint[] = [];

  // -------------------------------------------------------------------------
  // Day Structure Edit Handlers
  // -------------------------------------------------------------------------

  function handleEditDayStructure() {
    setEditForm(JSON.parse(JSON.stringify(dayBlocks)));
    setEditingDay(true);
    setAddingActivityIndex(null);
    setNewActivityLabel('');
  }

  function handleCancelEdit() {
    setEditingDay(false);
    setEditForm([]);
    setAddingActivityIndex(null);
    setNewActivityLabel('');
  }

  function handleSaveEdit() {
    setDayBlocks(editForm);
    localStorage.setItem(DAY_STRUCTURE_KEY, JSON.stringify(editForm));
    setEditingDay(false);
    setEditForm([]);
    setAddingActivityIndex(null);
    setNewActivityLabel('');
  }

  function handleEditPeriodTime(index: number, field: 'start' | 'end', value: string) {
    setEditForm((prev) => {
      const updated: DayBlock[] = prev.map((b, i) => {
        if (i !== index) return b;
        const [start, end] = b.time.split(' - ');
        const newTime = field === 'start' ? `${value} - ${end}` : `${start} - ${value}`;
        return { ...b, period: b.period, time: newTime, activities: b.activities };
      });
      return updated;
    });
  }

  function handleEditPeriodName(index: number, value: string) {
    setEditForm((prev) => prev.map((b, i) =>
      i === index ? { period: value, time: b.time, activities: b.activities } : b
    ));
  }

  function handleRemoveActivity(blockIndex: number, actIndex: number) {
    setEditForm((prev) => prev.map((b, i) =>
      i === blockIndex
        ? { period: b.period, time: b.time, activities: b.activities.filter((_, ai) => ai !== actIndex) }
        : b
    ));
  }

  function handleAddActivity(blockIndex: number) {
    if (!newActivityLabel.trim()) return;
    setEditForm((prev) => prev.map((b, i) =>
      i === blockIndex
        ? { period: b.period, time: b.time, activities: [...b.activities, { label: newActivityLabel.trim(), type: 'default' as const }] }
        : b
    ));
    setNewActivityLabel('');
    setAddingActivityIndex(null);
  }

  function handleAddPeriod() {
    setEditForm((prev) => [
      ...prev,
      { period: 'New Period', time: '9:00 AM - 10:00 AM', activities: [] },
    ]);
  }

  function handleRemovePeriod(index: number) {
    setEditForm((prev) => prev.filter((_, i) => i !== index));
  }

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
        <div className="pulse-tab__section-header">
          <h2 className="pulse-tab__section-title" style={{ margin: 0 }}>Day Structure</h2>
          {!editingDay && (
            <button
              type="button"
              className="pulse-tab__day-edit-btn"
              onClick={handleEditDayStructure}
              aria-label="Edit day structure"
            >
              Edit
            </button>
          )}
        </div>

        {editingDay ? (
          <div className="pulse-tab__day-edit-form">
            {editForm.map((block, blockIdx) => (
              <div key={blockIdx} className="pulse-tab__day-edit-row">
                <div className="pulse-tab__day-edit-period">
                  <input
                    type="text"
                    className="pulse-tab__day-edit-input"
                    value={block.period}
                    onChange={(e) => handleEditPeriodName(blockIdx, e.target.value)}
                    aria-label={`Period name for block ${blockIdx + 1}`}
                  />
                  <input
                    type="text"
                    className="pulse-tab__day-edit-input"
                    value={block.time.split(' - ')[0]}
                    onChange={(e) => handleEditPeriodTime(blockIdx, 'start', e.target.value)}
                    aria-label={`Start time for ${block.period}`}
                    placeholder="Start time"
                  />
                  <span>{'\u2013'}</span>
                  <input
                    type="text"
                    className="pulse-tab__day-edit-input"
                    value={block.time.split(' - ')[1] || ''}
                    onChange={(e) => handleEditPeriodTime(blockIdx, 'end', e.target.value)}
                    aria-label={`End time for ${block.period}`}
                    placeholder="End time"
                  />
                  <button
                    type="button"
                    className="pulse-tab__day-edit-chip-remove"
                    onClick={() => handleRemovePeriod(blockIdx)}
                    aria-label={`Remove ${block.period} period`}
                    title="Remove period"
                  >
                    {'\u00d7'}
                  </button>
                </div>
                <div className="pulse-tab__day-edit-activities">
                  {block.activities.map((activity, actIdx) => (
                    <span key={actIdx} className="pulse-tab__day-edit-chip">
                      {activity.label}
                      <button
                        type="button"
                        className="pulse-tab__day-edit-chip-remove"
                        onClick={() => handleRemoveActivity(blockIdx, actIdx)}
                        aria-label={`Remove ${activity.label}`}
                      >
                        {'\u00d7'}
                      </button>
                    </span>
                  ))}
                  {addingActivityIndex === blockIdx ? (
                    <span className="pulse-tab__day-edit-chip">
                      <input
                        type="text"
                        className="pulse-tab__day-edit-input"
                        style={{ maxWidth: '100px', padding: '2px 4px' }}
                        value={newActivityLabel}
                        onChange={(e) => setNewActivityLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddActivity(blockIdx);
                          if (e.key === 'Escape') { setAddingActivityIndex(null); setNewActivityLabel(''); }
                        }}
                        placeholder="Activity"
                        autoFocus
                        aria-label="New activity name"
                      />
                      <button
                        type="button"
                        className="pulse-tab__day-edit-chip-remove"
                        onClick={() => { setAddingActivityIndex(null); setNewActivityLabel(''); }}
                        aria-label="Cancel adding activity"
                        style={{ color: 'var(--ws-color-text-muted)' }}
                      >
                        {'\u00d7'}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="pulse-tab__day-edit-add"
                      onClick={() => { setAddingActivityIndex(blockIdx); setNewActivityLabel(''); }}
                      aria-label={`Add activity to ${block.period}`}
                    >
                      + Add activity
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="pulse-tab__day-add-period"
              onClick={handleAddPeriod}
            >
              + Add Period
            </button>
            <div className="pulse-tab__day-edit-actions">
              <button type="button" className="pulse-tab__day-cancel-btn" onClick={handleCancelEdit}>
                Cancel
              </button>
              <button type="button" className="pulse-tab__day-save-btn" onClick={handleSaveEdit}>
                Save
              </button>
            </div>
          </div>
        ) : (
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
        )}
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
