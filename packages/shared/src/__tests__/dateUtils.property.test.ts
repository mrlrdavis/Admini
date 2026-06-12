import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getTimeGreetingForHour } from '../greetingUtils';
import { parseLocalDate } from '../dateUtils';

/**
 * Property-based tests for shared utility functions.
 *
 * These tests verify universal correctness properties that must hold
 * across all valid inputs, as specified in the design document.
 */

describe('Shared Utilities Property Tests', () => {
  // Feature: app-ui-overhaul, Property 1: Time greeting correctness
  /**
   * Property 1: Time greeting correctness
   * For any hour value (0-23), getTimeGreetingForHour returns the correct greeting
   * with no gaps or overlaps in the hour ranges:
   * - 5-11: Good morning
   * - 12-17: Good afternoon
   * - 18-4: Good evening (wraps around midnight)
   *
   * **Validates: Requirements 1.1**
   */
  it('Property 1: for any hour 0-23, getTimeGreetingForHour returns correct greeting with no gaps/overlaps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        (hour) => {
          const greeting = getTimeGreetingForHour(hour);

          // Verify the greeting is one of the three valid values
          expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(greeting);

          // Verify correct greeting for the hour range
          if (hour >= 5 && hour <= 11) {
            expect(greeting).toBe('Good morning');
          } else if (hour >= 12 && hour <= 17) {
            expect(greeting).toBe('Good afternoon');
          } else {
            // hours 18-23 and 0-4
            expect(greeting).toBe('Good evening');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: app-ui-overhaul, Property 13: Local date parsing preserves calendar day
  /**
   * Property 13: Local date parsing preserves calendar day
   * For any valid date string in ISO format (with or without a time component),
   * parseLocalDate produces a Date object whose getFullYear(), getMonth(), and
   * getDate() match the year, month, and day digits in the original string,
   * regardless of the runtime timezone offset.
   *
   * **Validates: Requirements 18.1, 18.2**
   */
  it('Property 13: parseLocalDate preserves calendar day regardless of timezone', () => {
    // Generate valid date components
    const dateArbitrary = fc.record({
      year: fc.integer({ min: 2000, max: 2099 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid day-of-month
    });

    fc.assert(
      fc.property(
        dateArbitrary,
        fc.boolean(), // whether to include a time component
        fc.integer({ min: 0, max: 23 }), // hour for time component
        fc.integer({ min: 0, max: 59 }), // minute for time component
        ({ year, month, day }, includeTime, hour, minute) => {
          const dateStr = includeTime
            ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`
            : `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          const result = parseLocalDate(dateStr);

          // The parsed Date must match the original string's year, month, and day
          expect(result.getFullYear()).toBe(year);
          expect(result.getMonth()).toBe(month - 1); // JS months are 0-indexed
          expect(result.getDate()).toBe(day);
        }
      ),
      { numRuns: 100 }
    );
  });
});