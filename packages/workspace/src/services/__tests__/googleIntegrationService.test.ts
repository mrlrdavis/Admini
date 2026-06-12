/**
 * Unit tests for googleIntegrationService
 *
 * Validates graceful degradation behavior:
 * - getTodayCalendarEvents() returns empty array on API failure
 * - getCalendarEvents() returns empty array on API failure
 * - Missing Google token returns empty array (no error thrown)
 * - Network failure returns empty array (no error blocking the view)
 * - getTodayMergedEvents() falls back to local events only on API failure
 * - getMergedCalendarEvents() falls back to local events only on API failure
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTodayCalendarEvents,
  getCalendarEvents,
  getGoogleToken,
  storeGoogleToken,
  getTodayMergedEvents,
  getMergedCalendarEvents,
} from '../googleIntegrationService';
import type { CalendarEvent } from '../googleIntegrationService';
import type { LocalEvent } from '../calendarMerge';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock getClient (Supabase)
vi.mock('../getClient', () => ({
  getClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
      }),
    },
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock fetch
const originalFetch = globalThis.fetch;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('googleIntegrationService - graceful degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getTodayCalendarEvents', () => {
    it('returns empty array when no Google token is available', async () => {
      // No token in session or localStorage
      const result = await getTodayCalendarEvents();
      expect(result).toEqual([]);
    });

    it('returns empty array when API returns non-OK response', async () => {
      // Set a token so the function attempts the API call
      localStorageMock.setItem('admini_google_provider_token', 'fake-token');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await getTodayCalendarEvents();
      expect(result).toEqual([]);
    });

    it('returns empty array when fetch throws a network error', async () => {
      localStorageMock.setItem('admini_google_provider_token', 'fake-token');

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await getTodayCalendarEvents();
      expect(result).toEqual([]);
    });

    it('returns CalendarEvent[] on successful API response', async () => {
      localStorageMock.setItem('admini_google_provider_token', 'fake-token');

      const mockEvents = {
        items: [
          {
            id: 'evt-1',
            summary: 'Team Standup',
            start: { dateTime: '2025-06-09T09:00:00-05:00' },
            end: { dateTime: '2025-06-09T09:30:00-05:00' },
            location: 'Room A',
          },
          {
            id: 'evt-2',
            summary: null, // missing summary
            start: { date: '2025-06-09' },
            end: { date: '2025-06-09' },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      const result = await getTodayCalendarEvents();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'evt-1',
        summary: 'Team Standup',
        start: '2025-06-09T09:00:00-05:00',
        end: '2025-06-09T09:30:00-05:00',
        location: 'Room A',
      });
      expect(result[1]).toEqual({
        id: 'evt-2',
        summary: '(No title)',
        start: '2025-06-09',
        end: '2025-06-09',
        location: undefined,
      });
    });

    it('handles API response with empty items array', async () => {
      localStorageMock.setItem('admini_google_provider_token', 'fake-token');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const result = await getTodayCalendarEvents();
      expect(result).toEqual([]);
    });

    it('handles API response with missing items field', async () => {
      localStorageMock.setItem('admini_google_provider_token', 'fake-token');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await getTodayCalendarEvents();
      expect(result).toEqual([]);
    });
  });

  describe('getCalendarEvents', () => {
    it('returns empty array when no Google token is available', async () => {
      const start = new Date('2025-06-01');
      const end = new Date('2025-06-30');

      const result = await getCalendarEvents(start, end);
      expect(result).toEqual([]);
    });

    it('returns empty array when API returns non-OK response', async () => {
      localStorageMock.setItem('admini_google_provider_token', 'fake-token');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const start = new Date('2025-06-01');
      const end = new Date('2025-06-30');

      const result = await getCalendarEvents(start, end);
      expect(result).toEqual([]);
    });

    it('returns empty array when fetch throws a network error', async () => {
      localStorageMock.setItem('admini_google_provider_token', 'fake-token');

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const start = new Date('2025-06-01');
      const end = new Date('2025-06-30');

      const result = await getCalendarEvents(start, end);
      expect(result).toEqual([]);
    });

    it('returns CalendarEvent[] on successful API response', async () => {
      localStorageMock.setItem('admini_google_provider_token', 'fake-token');

      const mockEvents = {
        items: [
          {
            id: 'evt-range-1',
            summary: 'All Day Event',
            start: { date: '2025-06-15' },
            end: { date: '2025-06-16' },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEvents),
      });

      const start = new Date('2025-06-01');
      const end = new Date('2025-06-30');

      const result = await getCalendarEvents(start, end);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'evt-range-1',
        summary: 'All Day Event',
        start: '2025-06-15',
        end: '2025-06-16',
        location: undefined,
      });
    });
  });

  describe('getTodayMergedEvents - graceful fallback', () => {
    it('returns only local events when Google API fails (no token)', async () => {
      const localEvents: LocalEvent[] = [
        { id: 'local-1', summary: 'Local Meeting', start: '2025-06-09T10:00:00', end: '2025-06-09T11:00:00' },
        { id: 'local-2', summary: 'Local Lunch', start: '2025-06-09T12:00:00', end: '2025-06-09T13:00:00' },
      ];

      const result = await getTodayMergedEvents(localEvents);

      // Should contain all local events with source='local'
      expect(result).toHaveLength(2);
      expect(result.every(e => e.source === 'local')).toBe(true);
      expect(result[0].summary).toBe('Local Meeting');
      expect(result[1].summary).toBe('Local Lunch');
    });

    it('returns only local events when Google API returns network error', async () => {
      localStorageMock.setItem('admini_google_provider_token', 'fake-token');
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const localEvents: LocalEvent[] = [
        { id: 'local-1', summary: 'Standup', start: '2025-06-09T09:00:00', end: '2025-06-09T09:15:00' },
      ];

      const result = await getTodayMergedEvents(localEvents);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('local');
      expect(result[0].summary).toBe('Standup');
    });
  });

  describe('getMergedCalendarEvents - graceful fallback', () => {
    it('returns only local events when Google API fails', async () => {
      const localEvents: LocalEvent[] = [
        { id: 'local-a', summary: 'Workshop', start: '2025-06-15T14:00:00', end: '2025-06-15T16:00:00' },
      ];

      const start = new Date('2025-06-01');
      const end = new Date('2025-06-30');

      const result = await getMergedCalendarEvents(start, end, localEvents);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('local');
      expect(result[0].summary).toBe('Workshop');
    });
  });

  describe('CalendarEvent type compatibility', () => {
    it('CalendarEvent type has required fields for calendarMerge', () => {
      // Type-level check: CalendarEvent should have id, summary, start, end
      const event: CalendarEvent = {
        id: 'test-id',
        summary: 'Test Event',
        start: '2025-06-09T10:00:00',
        end: '2025-06-09T11:00:00',
      };

      expect(event.id).toBe('test-id');
      expect(event.summary).toBe('Test Event');
      expect(event.start).toBe('2025-06-09T10:00:00');
      expect(event.end).toBe('2025-06-09T11:00:00');
    });

    it('CalendarEvent supports optional source field', () => {
      const event: CalendarEvent = {
        id: 'test-id',
        summary: 'Test Event',
        start: '2025-06-09T10:00:00',
        end: '2025-06-09T11:00:00',
        source: 'google',
      };

      expect(event.source).toBe('google');
    });
  });

  describe('storeGoogleToken', () => {
    it('stores token in localStorage without throwing', () => {
      storeGoogleToken('test-token-123');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'admini_google_provider_token',
        'test-token-123',
      );
    });

    it('does not throw if localStorage is unavailable', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('localStorage is not available');
      });

      // Should not throw
      expect(() => storeGoogleToken('test-token')).not.toThrow();
    });
  });
});