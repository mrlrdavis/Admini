/**
 * Greeting utility functions for the AdminI application.
 */

/**
 * Returns a time-appropriate greeting based on the current hour.
 *
 * Hour ranges:
 * - 5-11: Good morning
 * - 12-17: Good afternoon
 * - 18-4: Good evening
 *
 * @returns "Good morning" | "Good afternoon" | "Good evening"
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 11) return 'Good morning';
  if (hour >= 12 && hour <= 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Internal helper for property testing - accepts an explicit hour value.
 * This allows testing without mocking Date.
 *
 * @param hour - Hour value 0-23
 * @returns "Good morning" | "Good afternoon" | "Good evening"
 */
export function getTimeGreetingForHour(hour: number): string {
  if (hour >= 5 && hour <= 11) return 'Good morning';
  if (hour >= 12 && hour <= 17) return 'Good afternoon';
  return 'Good evening';
}
