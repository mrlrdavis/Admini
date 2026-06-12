import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getLocalEvents,
  createLocalEvent,
  updateLocalEvent,
  deleteLocalEvent,
  getAll,
  create,
  update,
  deleteEvent,
  LOCAL_EVENTS_STORAGE_KEY,
} from './localEventService';

// ---------------------------------------------------------------------------
// Setup: clear localStorage before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

describe('localEventService', () => {
  // =========================================================================
  // Primary API (data contract functions)
  // =========================================================================

  describe('getLocalEvents', () => {
    it('returns an empty array when no events are stored', () => {
      expect(getLocalEvents()).toEqual([]);
    });

    it('returns stored events', () => {
      const events = [
        { id: 'e1', summary: 'Meeting', start: '2024-06-01T09:00', end: '2024-06-01T10:00' },
      ];
      localStorage.setItem(LOCAL_EVENTS_STORAGE_KEY, JSON.stringify(events));

      expect(getLocalEvents()).toEqual(events);
    });

    it('returns an empty array when localStorage contains invalid JSON', () => {
      localStorage.setItem(LOCAL_EVENTS_STORAGE_KEY, 'not valid json');
      expect(getLocalEvents()).toEqual([]);
    });

    it('returns an empty array when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Access denied');
      });

      expect(getLocalEvents()).toEqual([]);
      vi.restoreAllMocks();
    });
  });

  describe('createLocalEvent', () => {
    it('creates an event with a generated UUID', () => {
      const result = createLocalEvent({ summary: 'Team sync', start: '2024-06-01T14:00', end: '2024-06-01T15:00' });

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.summary).toBe('Team sync');
      expect(result.start).toBe('2024-06-01T14:00');
      expect(result.end).toBe('2024-06-01T15:00');
    });

    it('persists the created event to localStorage', () => {
      createLocalEvent({ summary: 'Standup', start: '2024-06-01T09:00', end: '2024-06-01T09:15' });

      const stored = JSON.parse(localStorage.getItem(LOCAL_EVENTS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].summary).toBe('Standup');
    });

    it('appends to existing events', () => {
      createLocalEvent({ summary: 'Event 1', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      createLocalEvent({ summary: 'Event 2', start: '2024-06-01T10:00', end: '2024-06-01T11:00' });

      expect(getLocalEvents()).toHaveLength(2);
    });

    it('generates unique IDs for each event', () => {
      const e1 = createLocalEvent({ summary: 'A', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      const e2 = createLocalEvent({ summary: 'B', start: '2024-06-01T10:00', end: '2024-06-01T11:00' });

      expect(e1.id).not.toBe(e2.id);
    });

    it('does not throw when localStorage is unavailable', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

      const result = createLocalEvent({ summary: 'Offline', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      expect(result.summary).toBe('Offline');
      expect(result.id).toBeDefined();

      vi.restoreAllMocks();
    });
  });

  describe('updateLocalEvent', () => {
    it('updates an existing event and returns the updated version', () => {
      const original = createLocalEvent({ summary: 'Draft', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });

      const updatedEvent = { ...original, summary: 'Final' };
      const result = updateLocalEvent(updatedEvent);

      expect(result.id).toBe(original.id);
      expect(result.summary).toBe('Final');
      expect(result.start).toBe('2024-06-01T08:00');
    });

    it('persists the update to localStorage', () => {
      const original = createLocalEvent({ summary: 'Old', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      updateLocalEvent({ ...original, summary: 'New' });

      const stored = getLocalEvents();
      expect(stored[0].summary).toBe('New');
    });

    it('throws when the event ID does not exist', () => {
      expect(() => updateLocalEvent({
        id: 'non-existent-id',
        summary: 'Ghost',
        start: '2024-06-01T08:00',
        end: '2024-06-01T09:00',
      })).toThrow('Local event not found: non-existent-id');
    });

    it('replaces the entire event data', () => {
      const original = createLocalEvent({ summary: 'Keep', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      const result = updateLocalEvent({ ...original, summary: 'Changed', end: '2024-06-01T10:00' });

      expect(result.summary).toBe('Changed');
      expect(result.start).toBe('2024-06-01T08:00');
      expect(result.end).toBe('2024-06-01T10:00');
    });

    it('does not affect other events', () => {
      const e1 = createLocalEvent({ summary: 'First', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      const e2 = createLocalEvent({ summary: 'Second', start: '2024-06-01T10:00', end: '2024-06-01T11:00' });

      updateLocalEvent({ ...e1, summary: 'Updated First' });

      const all = getLocalEvents();
      expect(all.find((e) => e.id === e2.id)!.summary).toBe('Second');
    });
  });

  describe('deleteLocalEvent', () => {
    it('removes an existing event', () => {
      const event = createLocalEvent({ summary: 'To delete', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });

      deleteLocalEvent(event.id);

      expect(getLocalEvents()).toHaveLength(0);
    });

    it('is a no-op when the event ID does not exist', () => {
      createLocalEvent({ summary: 'Keep', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });

      deleteLocalEvent('non-existent-id');

      expect(getLocalEvents()).toHaveLength(1);
    });

    it('does not affect other events', () => {
      const e1 = createLocalEvent({ summary: 'Keep', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      const e2 = createLocalEvent({ summary: 'Remove', start: '2024-06-01T10:00', end: '2024-06-01T11:00' });

      deleteLocalEvent(e2.id);

      const remaining = getLocalEvents();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(e1.id);
    });

    it('persists the deletion to localStorage', () => {
      const event = createLocalEvent({ summary: 'Gone', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      deleteLocalEvent(event.id);

      const stored = JSON.parse(localStorage.getItem(LOCAL_EVENTS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(0);
    });

    it('returns void (no return value)', () => {
      const event = createLocalEvent({ summary: 'Test', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      const result = deleteLocalEvent(event.id);
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // Legacy API (backward compatibility aliases)
  // =========================================================================

  describe('legacy aliases', () => {
    it('getAll is an alias for getLocalEvents', () => {
      expect(getAll).toBe(getLocalEvents);
    });

    it('create is an alias for createLocalEvent', () => {
      expect(create).toBe(createLocalEvent);
    });

    it('deleteEvent removes an event and returns true', () => {
      const event = createLocalEvent({ summary: 'To delete', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      const result = deleteEvent(event.id);
      expect(result).toBe(true);
      expect(getLocalEvents()).toHaveLength(0);
    });

    it('deleteEvent returns false for non-existent ID', () => {
      const result = deleteEvent('non-existent-id');
      expect(result).toBe(false);
    });

    it('update patches fields and returns updated event', () => {
      const original = createLocalEvent({ summary: 'Old', start: '2024-06-01T08:00', end: '2024-06-01T09:00' });
      const result = update(original.id, { summary: 'New' });
      expect(result).not.toBeNull();
      expect(result!.summary).toBe('New');
      expect(result!.start).toBe('2024-06-01T08:00');
    });

    it('update returns null for non-existent ID', () => {
      const result = update('non-existent-id', { summary: 'Ghost' });
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Constants
  // =========================================================================

  describe('LOCAL_EVENTS_STORAGE_KEY', () => {
    it('uses the expected key', () => {
      expect(LOCAL_EVENTS_STORAGE_KEY).toBe('admini:local-events');
    });
  });
});