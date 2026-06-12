// ---------------------------------------------------------------------------
// TodaysSchedule - Day Structure time blocks with inline calendar events
// ---------------------------------------------------------------------------
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5

import { useMemo } from 'react';
import type { MergedEvent } from '../services/calendarMerge';
import '../styles/todays-schedule.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DayActivity {
  label: string;
  type: 'focus' | 'meetings' | 'wrap-up' | 'custom';
}

export interface DayStructureBlock {
  id: string;
  period: string; // "Morning", "Afternoon", "End of Day"
  startTime: string; // "08:00"
  endTime: string; // "12:00"
  activities: DayActivity[];
}

export interface TodaysScheduleProps {
  dayStructure: DayStructureBlock[];
  mergedEvents: MergedEvent[]; // output of Algorithm 1
  onDeleteEvent?: (eventId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract hour from event start time string.
 * Handles ISO datetime ("2025-06-15T09:30:00") and time-only ("09:30").
 */
function extractHour(start: string): number {
  const timePart = start.includes('T') ? start.split('T')[1]! : start;
  const hourStr = timePart.split(':')[0];
  return parseInt(hourStr!, 10);
}

/**
 * Parse a time string like "08:00" into an hour number.
 */
function parseTimeHour(time: string): number {
  return parseInt(time.split(':')[0]!, 10);
}

/**
 * Format event start time for display.
 * Returns a human-readable time string like "9:30 AM".
 */
function formatEventTime(start: string): string {
  const timePart = start.includes('T') ? start.split('T')[1]! : start;
  const [hourStr, minStr] = timePart.split(':');
  const hour = parseInt(hourStr!, 10);
  const min = minStr || '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${min} ${period}`;
}

/**
 * Place events into their corresponding time blocks.
 * An event is placed in a block if its start hour >= block startTime hour
 * and start hour < block endTime hour.
 */
export function placeEventsInBlocks(
  blocks: DayStructureBlock[],
  events: MergedEvent[],
): Map<string, MergedEvent[]> {
  const placement = new Map<string, MergedEvent[]>();

  // Initialize all blocks with empty arrays
  for (const block of blocks) {
    placement.set(block.id, []);
  }

  for (const event of events) {
    const eventHour = extractHour(event.start);

    for (const block of blocks) {
      const blockStart = parseTimeHour(block.startTime);
      const blockEnd = parseTimeHour(block.endTime);

      if (eventHour >= blockStart && eventHour < blockEnd) {
        placement.get(block.id)!.push(event);
        break;
      }
    }
  }

  return placement;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TodaysSchedule({ dayStructure, mergedEvents, onDeleteEvent }: TodaysScheduleProps) {
  // Place events into blocks by start hour
  const eventsByBlock = useMemo(
    () => placeEventsInBlocks(dayStructure, mergedEvents),
    [dayStructure, mergedEvents],
  );

  if (dayStructure.length === 0) {
    return (
      <div className="todays-schedule" role="region" aria-label="Today's schedule">
        <p className="todays-schedule__empty">No day structure configured</p>
      </div>
    );
  }

  return (
    <div className="todays-schedule" role="region" aria-label="Today's schedule">
      {dayStructure.map((block) => {
        const blockEvents = eventsByBlock.get(block.id) || [];

        return (
          <div key={block.id} className="todays-schedule__block">
            {/* Block header */}
            <div className="todays-schedule__block-header">
              <span className="todays-schedule__period">{block.period}</span>
              <span className="todays-schedule__time-range">
                {block.startTime} – {block.endTime}
              </span>
            </div>

            {/* Activities */}
            {block.activities.length > 0 && (
              <div className="todays-schedule__activities">
                {block.activities.map((activity) => (
                  <span
                    key={activity.label}
                    className={`todays-schedule__activity-chip todays-schedule__activity-chip--${activity.type}`}
                  >
                    {activity.label}
                  </span>
                ))}
              </div>
            )}

            {/* Events in this block */}
            {blockEvents.length > 0 && (
              <ul className="todays-schedule__events" aria-label={`Events in ${block.period}`}>
                {blockEvents.map((event) => (
                  <li key={event.id} className="todays-schedule__event">
                    <span className="todays-schedule__event-circle" aria-hidden="true" />
                    <span className="todays-schedule__event-time">
                      {formatEventTime(event.start)}
                    </span>
                    <span className="todays-schedule__event-summary">{event.summary}</span>
                    {event.source === 'local' && onDeleteEvent && (
                      <button
                        type="button"
                        className="todays-schedule__delete-btn"
                        onClick={() => onDeleteEvent(event.id)}
                        aria-label={`Delete event ${event.summary}`}
                      >
                        &#x2715;
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}