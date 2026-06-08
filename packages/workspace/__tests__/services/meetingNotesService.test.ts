import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureClient, resetClient } from '../../src/services/getClient';
import {
  listMeetingNotes,
  createMeetingNote,
  updateMeetingNote,
  deleteMeetingNote,
} from '../../src/services/meetingNotesService';
import type { SupabaseClient } from '@supabase/supabase-js';

function createMockClient() {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {};

  chainable.from = vi.fn(() => chainable);
  chainable.select = vi.fn(() => chainable);
  chainable.insert = vi.fn(() => chainable);
  chainable.update = vi.fn(() => chainable);
  chainable.delete = vi.fn(() => chainable);
  chainable.eq = vi.fn(() => chainable);
  chainable.order = vi.fn(() => chainable);
  chainable.ilike = vi.fn(() => chainable);
  chainable.limit = vi.fn(() => chainable);
  chainable.range = vi.fn(() => chainable);
  chainable.single = vi.fn(() => chainable);

  // Default resolve with empty data
  chainable.then = vi.fn((resolve) =>
    resolve({ data: null, error: null })
  );

  return chainable;
}

function makeDbNote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'note-1',
    organization_id: 'org-1',
    created_by: 'user-1',
    title: 'Standup',
    body: 'Discussed blockers',
    attendees: ['Alice', 'Bob'],
    created_at: '2024-06-01T10:00:00Z',
    updated_at: '2024-06-01T10:00:00Z',
    ...overrides,
  };
}

describe('meetingNotesService', () => {
  let mock: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    resetClient();
    mock = createMockClient();
    configureClient(mock as unknown as SupabaseClient);
  });

  describe('listMeetingNotes', () => {
    it('queries meeting_notes filtered by organization_id and ordered by created_at desc', async () => {
      const row = makeDbNote();
      mock.order.mockReturnValueOnce({ data: [row], error: null });

      const result = await listMeetingNotes('org-1');

      expect(mock.from).toHaveBeenCalledWith('meeting_notes');
      expect(mock.select).toHaveBeenCalledWith('*');
      expect(mock.eq).toHaveBeenCalledWith('organization_id', 'org-1');
      expect(mock.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual([
        {
          id: 'note-1',
          title: 'Standup',
          body: 'Discussed blockers',
          attendees: ['Alice', 'Bob'],
          createdAt: '2024-06-01T10:00:00Z',
          updatedAt: '2024-06-01T10:00:00Z',
          createdBy: 'user-1',
        },
      ]);
    });

    it('applies ilike filter when search option is provided', async () => {
      mock.ilike.mockReturnValueOnce({ data: [], error: null });

      await listMeetingNotes('org-1', { search: 'standup' });

      expect(mock.ilike).toHaveBeenCalledWith('title', '%standup%');
    });

    it('applies limit when provided', async () => {
      mock.limit.mockReturnValueOnce({ data: [], error: null });

      await listMeetingNotes('org-1', { limit: 10 });

      expect(mock.limit).toHaveBeenCalledWith(10);
    });

    it('applies range when offset is provided', async () => {
      mock.range.mockReturnValueOnce({ data: [], error: null });

      await listMeetingNotes('org-1', { limit: 10, offset: 20 });

      expect(mock.range).toHaveBeenCalledWith(20, 29);
    });

    it('uses default limit of 20 when offset is provided without limit', async () => {
      mock.range.mockReturnValueOnce({ data: [], error: null });

      await listMeetingNotes('org-1', { offset: 5 });

      expect(mock.range).toHaveBeenCalledWith(5, 24);
    });

    it('throws a mapped error when the query fails', async () => {
      mock.order.mockReturnValueOnce({
        data: null,
        error: { message: 'permission denied for table meeting_notes', code: '42501' },
      });

      await expect(listMeetingNotes('org-1')).rejects.toThrow();
    });

    it('maps null body and attendees to defaults', async () => {
      const row = makeDbNote({ body: null, attendees: null });
      mock.order.mockReturnValueOnce({ data: [row], error: null });

      const [note] = await listMeetingNotes('org-1');

      expect(note.body).toBe('');
      expect(note.attendees).toEqual([]);
    });
  });

  describe('createMeetingNote', () => {
    it('inserts a new note with correct payload', async () => {
      const row = makeDbNote();
      mock.single.mockReturnValueOnce({ data: row, error: null });

      const result = await createMeetingNote({
        organizationId: 'org-1',
        userId: 'user-1',
        title: 'Standup',
        body: 'Discussed blockers',
        attendees: ['Alice', 'Bob'],
      });

      expect(mock.from).toHaveBeenCalledWith('meeting_notes');
      expect(mock.insert).toHaveBeenCalledWith({
        organization_id: 'org-1',
        created_by: 'user-1',
        title: 'Standup',
        body: 'Discussed blockers',
        attendees: ['Alice', 'Bob'],
      });
      expect(mock.select).toHaveBeenCalled();
      expect(mock.single).toHaveBeenCalled();
      expect(result.id).toBe('note-1');
      expect(result.title).toBe('Standup');
    });

    it('defaults body to empty string and attendees to empty array when not provided', async () => {
      const row = makeDbNote({ body: '', attendees: [] });
      mock.single.mockReturnValueOnce({ data: row, error: null });

      await createMeetingNote({
        organizationId: 'org-1',
        userId: 'user-1',
        title: 'Quick sync',
      });

      expect(mock.insert).toHaveBeenCalledWith(
        expect.objectContaining({ body: '', attendees: [] })
      );
    });

    it('throws a mapped error when insert fails', async () => {
      mock.single.mockReturnValueOnce({
        data: null,
        error: { message: 'null value in column violates not-null constraint', code: '23502' },
      });

      await expect(
        createMeetingNote({ organizationId: 'org-1', userId: 'user-1', title: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('updateMeetingNote', () => {
    it('updates only provided fields', async () => {
      const row = makeDbNote({ title: 'Updated' });
      mock.single.mockReturnValueOnce({ data: row, error: null });

      await updateMeetingNote('note-1', { title: 'Updated' });

      expect(mock.from).toHaveBeenCalledWith('meeting_notes');
      expect(mock.update).toHaveBeenCalledWith({ title: 'Updated' });
      expect(mock.eq).toHaveBeenCalledWith('id', 'note-1');
    });

    it('includes body and attendees in payload when provided', async () => {
      const row = makeDbNote({ body: 'New body', attendees: ['Charlie'] });
      mock.single.mockReturnValueOnce({ data: row, error: null });

      await updateMeetingNote('note-1', {
        title: 'Updated',
        body: 'New body',
        attendees: ['Charlie'],
      });

      expect(mock.update).toHaveBeenCalledWith({
        title: 'Updated',
        body: 'New body',
        attendees: ['Charlie'],
      });
    });

    it('sends empty payload when no fields are provided', async () => {
      const row = makeDbNote();
      mock.single.mockReturnValueOnce({ data: row, error: null });

      await updateMeetingNote('note-1', {});

      expect(mock.update).toHaveBeenCalledWith({});
    });

    it('throws a mapped error when update fails', async () => {
      mock.single.mockReturnValueOnce({
        data: null,
        error: { message: 'new row violates row-level security policy' },
      });

      await expect(
        updateMeetingNote('note-1', { title: 'Hack' })
      ).rejects.toThrow();
    });
  });

  describe('deleteMeetingNote', () => {
    it('deletes the note by id', async () => {
      mock.eq.mockReturnValueOnce({ error: null });

      await deleteMeetingNote('note-1');

      expect(mock.from).toHaveBeenCalledWith('meeting_notes');
      expect(mock.delete).toHaveBeenCalled();
      expect(mock.eq).toHaveBeenCalledWith('id', 'note-1');
    });

    it('throws a mapped error when delete fails', async () => {
      mock.eq.mockReturnValueOnce({
        error: { code: '42501', message: 'permission denied' },
      });

      await expect(deleteMeetingNote('note-1')).rejects.toThrow();
    });
  });
});
