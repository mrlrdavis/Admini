/**
 * Date utility functions for the AdminI application.
 * All date parsing uses local-date semantics to prevent timezone offset issues.
 */

import type { CalendarEvent } from './types';

/**
 * Parse a date string as a LOCAL date (ignoring timezone offset).
 * Splits on 'T' and uses only the date portion to prevent the "day before" bug
 * when UTC dates are displayed in local time.
 *
 * @param dateStr - ISO date string (e.g. "2025-06-09" or "2025-06-09T00:00:00.000Z")
 * @returns Date object representing the local calendar day
 */
export function parseLocalDate(dateStr: string): Date {
  const datePart = dateStr.split('T')[0] ?? dateStr;
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * Compare two date strings using local date comparison (year, month, day)
 * without UTC conversion.
 *
 * @param a - First date string
 * @param b - Second date string
 * @returns true if both strings represent the same calendar day
 */
export function isLocalDate(a: string, b: string): boolean {
  const dateA = parseLocalDate(a);
  const dateB = parseLocalDate(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

/**
 * Filter calendar events to only those occurring on the current local date.
 * Excludes future-dated and past-dated events.
 *
 * @param events - Array of calendar events
 * @returns Events occurring today (local date comparison)
 */
export function filterTodayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return events.filter(event => {
    const eventDate = event.start.split('T')[0] ?? event.start;
    return eventDate === todayStr;
  });
}