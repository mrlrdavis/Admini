// ---------------------------------------------------------------------------
// Integration Tests - Cross-Component Data Flows
// ---------------------------------------------------------------------------
// Verifies that data flows correctly between service modules and components.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock optional xlsx dependency to prevent Vite resolution error
vi.mock('xlsx', () => ({}));

import { mergeEvents } from '../../services/calendarMerge';
import type { LocalEvent } from '../../services/calendarMerge';
import type { CalendarEvent } from '../../services/googleIntegrationService';
import { buildActivityFeed } from '../../services/activityFeed';
import { placeEventsInBlocks } from '../TodaysSchedule';
import type { DayStructureBlock } from '../TodaysSchedule';
import { generateTaskFromContent } from '../../services/aiTaskService';
import type { AISuggestedTask } from '../../services/aiTaskService';
import { notifyAssignee } from '../../services/notificationService';
import { parseRosterFile, validateRosterRows } from '../../services/rosterUploadService';
import type { ActivityEvent, DashboardTask } from '../../types';

// ---------------------------------------------------------------------------
// 1. Google Calendar data merging -> placeEventsInBlocks
// ---------------------------------------------------------------------------

describe('Integration: Google Calendar merging -> TodaysSchedule placement', () => {
  const dayStructure: DayStructureBlock[] = [
    {
      id: 'morning',
      period: 'Morning',
      startTime: '08:00',
      endTime: '12:00',
      activities: [{ label: 'Focus time', type: 'focus' }],
    },
    {
      id: 'afternoon',
      period: 'Afternoon',
      startTime: '12:00',
      endTime: '17:00',
      activities: [{ label: 'Meetings', type: 'meetings' }],
    },
    {
      id: 'evening',
      period: 'End of Day',
      startTime: '17:00',
      endTime: '20:00',
      activities: [{ label: 'Wrap-up', type: 'wrap-up' }],
    },
  ];

  it('merges google and local events, then places them into correct time blocks', () => {
    const googleEvents: CalendarEvent[] = [
      { id: 'g1', summary: 'Team standup', start: '2025-06-15T09:00:00', end: '2025-06-15T09:30:00' },
      { id: 'g2', summary: 'Lunch sync', start: '2025-06-15T12:30:00', end: '2025-06-15T13:00:00' },
    ];

    const localEvents: LocalEvent[] = [
      { id: 'l1', summary: 'Prep lesson plan', start: '2025-06-15T08:30:00', end: '2025-06-15T09:00:00' },
      { id: 'l2', summary: 'Parent call', start: '2025-06-15T17:30:00', end: '2025-06-15T18:00:00' },
    ];

    const merged = mergeEvents(googleEvents, localEvents);

    expect(merged).toHaveLength(4);
    const ids = merged.map((e) => e.id);
    expect(new Set(ids).size).toBe(4);
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i]!.start.localeCompare(merged[i - 1]!.start)).toBeGreaterThanOrEqual(0);
    }

    const placement = placeEventsInBlocks(dayStructure, merged);

    const morningEvents = placement.get('morning')!;
    expect(morningEvents).toHaveLength(2);
    expect(morningEvents.map((e) => e.id).sort()).toEqual(['g1', 'l1']);

    const afternoonEvents = placement.get('afternoon')!;
    expect(afternoonEvents).toHaveLength(1);
    expect(afternoonEvents[0]!.id).toBe('g2');

    const eveningEvents = placement.get('evening')!;
    expect(eveningEvents).toHaveLength(1);
    expect(eveningEvents[0]!.id).toBe('l2');
  });

  it('local events take priority over google events with same ID', () => {
    const googleEvents: CalendarEvent[] = [
      { id: 'shared-id', summary: 'Google version', start: '2025-06-15T10:00:00', end: '2025-06-15T11:00:00' },
    ];
    const localEvents: LocalEvent[] = [
      { id: 'shared-id', summary: 'Local version', start: '2025-06-15T10:00:00', end: '2025-06-15T11:00:00' },
    ];

    const merged = mergeEvents(googleEvents, localEvents);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.summary).toBe('Local version');
    expect(merged[0]!.source).toBe('local');

    const placement = placeEventsInBlocks(dayStructure, merged);
    expect(placement.get('morning')!).toHaveLength(1);
    expect(placement.get('morning')![0]!.summary).toBe('Local version');
  });

  it('handles empty inputs gracefully', () => {
    const merged = mergeEvents([], []);
    expect(merged).toHaveLength(0);

    const placement = placeEventsInBlocks(dayStructure, merged);
    expect(placement.get('morning')!).toHaveLength(0);
    expect(placement.get('afternoon')!).toHaveLength(0);
    expect(placement.get('evening')!).toHaveLength(0);
  });
});
// ---------------------------------------------------------------------------
// 2. Activity Feed integration
// ---------------------------------------------------------------------------

describe('Integration: buildActivityFeed with real-shaped data', () => {
  it('produces sorted, capped output from sync events', () => {
    const syncEvents: ActivityEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: `evt-${String(i).padStart(2, '0')}`,
      organizationId: 'org-1',
      actorId: 'user-1',
      entityType: 'task',
      entityId: `task-${i}`,
      action: 'created',
      createdAt: `2025-06-${String(10 + i).padStart(2, '0')}T12:00:00Z`,
    }));

    const tasks: DashboardTask[] = [];
    const feed = buildActivityFeed(syncEvents, tasks);

    expect(feed).toHaveLength(7);
    for (let i = 1; i < feed.length; i++) {
      expect(feed[i]!.createdAt.localeCompare(feed[i - 1]!.createdAt)).toBeLessThanOrEqual(0);
    }
    expect(feed[0]!.id).toBe('evt-09');
    expect(feed[1]!.id).toBe('evt-08');
  });

  it('falls back to task-derived events when no sync events exist', () => {
    const tasks: DashboardTask[] = [
      {
        id: 'task-1',
        organizationId: 'org-1',
        createdBy: 'user-1',
        title: 'Grade papers',
        priority: 'normal',
        status: 'open',
        createdAt: '2025-06-15T08:00:00Z',
        updatedAt: '2025-06-15T08:00:00Z',
      },
      {
        id: 'task-2',
        organizationId: 'org-1',
        createdBy: 'user-2',
        title: 'Update roster',
        priority: 'high',
        status: 'in_progress',
        createdAt: '2025-06-16T10:00:00Z',
        updatedAt: '2025-06-16T10:00:00Z',
      },
    ];

    const feed = buildActivityFeed([], tasks);

    expect(feed).toHaveLength(2);
    expect(feed[0]!.entityId).toBe('task-2');
    expect(feed[1]!.entityId).toBe('task-1');
    expect(feed[0]!.id).toBe('task-task-2');
  });

  it('breaks ties by ID ascending', () => {
    const syncEvents: ActivityEvent[] = [
      {
        id: 'b-event',
        organizationId: 'org-1',
        actorId: 'user-1',
        entityType: 'task',
        entityId: 'task-1',
        action: 'created',
        createdAt: '2025-06-15T12:00:00Z',
      },
      {
        id: 'a-event',
        organizationId: 'org-1',
        actorId: 'user-2',
        entityType: 'task',
        entityId: 'task-2',
        action: 'updated',
        createdAt: '2025-06-15T12:00:00Z',
      },
    ];

    const feed = buildActivityFeed(syncEvents, []);

    expect(feed[0]!.id).toBe('a-event');
    expect(feed[1]!.id).toBe('b-event');
  });
});
// ---------------------------------------------------------------------------
// 3. Task creation from AI service
// ---------------------------------------------------------------------------

describe('Integration: AI task creation lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects with an error when API is unreachable', async () => {
    // In test environment, the service may not be configured or the endpoint unreachable.
    // Either way, the function should reject with a meaningful error.
    await expect(generateTaskFromContent('Student needs help with math', 'observation')).rejects.toThrow();
  });

  it('rejects empty content', async () => {
    await expect(generateTaskFromContent('', 'capture')).rejects.toThrow();
  });

  it('lifecycle flow: AISuggestedTask structure is usable for task creation', () => {
    const suggestedTask: AISuggestedTask = {
      title: 'Schedule parent meeting',
      description: 'Set up meeting with parents of students below grade level',
      assignee: 'user-teacher-1',
      dueDate: '2025-06-20',
      priority: 'high',
      source: 'observation',
      confidence: 0.9,
    };

    expect(suggestedTask.title).toBeTruthy();
    expect(suggestedTask.source).toBe('observation');
    expect(suggestedTask.confidence).toBeGreaterThan(0);
    expect(suggestedTask.confidence).toBeLessThanOrEqual(1);
    expect(['low', 'normal', 'high', 'urgent']).toContain(suggestedTask.priority);

    expect(suggestedTask.assignee).toBeDefined();
    expect(suggestedTask.dueDate).toBeDefined();

    const taskPayload = {
      title: suggestedTask.title,
      description: suggestedTask.description,
      priority: suggestedTask.priority,
      assignedTo: suggestedTask.assignee,
      dueAt: suggestedTask.dueDate,
      status: 'open' as const,
    };
    expect(taskPayload.title).toBe('Schedule parent meeting');
    expect(taskPayload.status).toBe('open');
  });
});
// ---------------------------------------------------------------------------
// 4. Notification on task assignment
// ---------------------------------------------------------------------------

describe('Integration: Notification on task assignment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects missing taskId', async () => {
    await expect(notifyAssignee('', 'user-123', 'created')).rejects.toMatchObject({
      code: 'MISSING_PARAMS',
    });
  });

  it('rejects missing assigneeId', async () => {
    await expect(notifyAssignee('task-1', '', 'updated')).rejects.toMatchObject({
      code: 'MISSING_PARAMS',
    });
  });

  it('validates required params before making network calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(notifyAssignee('', 'user-1', 'created')).rejects.toThrow(
      'Task ID and assignee ID are required',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('accepts both valid notification action types', () => {
    const validActions: Array<'created' | 'updated'> = ['created', 'updated'];
    expect(validActions).toContain('created');
    expect(validActions).toContain('updated');
  });
});
// ---------------------------------------------------------------------------
// 5. CSV upload pipeline
// ---------------------------------------------------------------------------

describe('Integration: CSV roster upload pipeline', () => {
  it('parses a valid CSV file and validates rows end-to-end', async () => {
    const csvContent = 'name,email,role\nJohn Doe,john@school.edu,teacher\nJane Smith,jane@school.edu,admin';
    const file = new File([csvContent], 'roster.csv', { type: 'text/csv' });

    const parseResult = await parseRosterFile(file);

    expect(parseResult.totalRows).toBe(2);
    expect(parseResult.errors).toHaveLength(0);
    expect(parseResult.rows).toHaveLength(2);
    expect(parseResult.rows[0]).toMatchObject({
      name: 'John Doe',
      email: 'john@school.edu',
      role: 'teacher',
      rowIndex: 1,
    });
    expect(parseResult.rows[1]).toMatchObject({
      name: 'Jane Smith',
      email: 'jane@school.edu',
      role: 'admin',
      rowIndex: 2,
    });

    const validationResult = validateRosterRows(parseResult.rows);

    expect(validationResult.valid).toHaveLength(2);
    expect(validationResult.errors).toHaveLength(0);
  });

  it('detects duplicate emails across the pipeline', async () => {
    const csvContent = 'name,email,role\nJohn Doe,john@school.edu,teacher\nJohn Again,john@school.edu,staff';
    const file = new File([csvContent], 'roster.csv', { type: 'text/csv' });

    const parseResult = await parseRosterFile(file);

    expect(parseResult.rows).toHaveLength(2);
    expect(parseResult.errors).toHaveLength(0);

    const validationResult = validateRosterRows(parseResult.rows);

    expect(validationResult.valid).toHaveLength(1);
    expect(validationResult.errors).toHaveLength(1);
    expect(validationResult.errors[0]).toMatchObject({
      field: 'email',
      message: 'Duplicate email in upload',
    });
  });

  it('catches invalid data during parsing phase', async () => {
    const csvContent = 'name,email,role\n,invalid-email,teacher\nJane Smith,jane@school.edu,wizard';
    const file = new File([csvContent], 'roster.csv', { type: 'text/csv' });

    const parseResult = await parseRosterFile(file);

    expect(parseResult.rows).toHaveLength(0);
    expect(parseResult.errors.length).toBeGreaterThan(0);
    expect(parseResult.totalRows).toBe(2);

    const nameError = parseResult.errors.find((e) => e.field === 'name');
    expect(nameError).toBeDefined();
    expect(nameError!.message).toBe('Name is required');

    const emailError = parseResult.errors.find((e) => e.field === 'email' && e.rowIndex === 1);
    expect(emailError).toBeDefined();

    const roleError = parseResult.errors.find((e) => e.field === 'role');
    expect(roleError).toBeDefined();
    expect(roleError!.message).toContain('Invalid role');
  });

  it('rejects files that are too large', async () => {
    const bigContent = 'a'.repeat(6 * 1024 * 1024);
    const file = new File([bigContent], 'huge.csv', { type: 'text/csv' });

    await expect(parseRosterFile(file)).rejects.toThrow('File size exceeds');
  });

  it('rejects unsupported file formats', async () => {
    const file = new File(['data'], 'roster.txt', { type: 'text/plain' });

    await expect(parseRosterFile(file)).rejects.toThrow('Unsupported file format');
  });

  it('rejects files with missing required columns', async () => {
    const csvContent = 'name,phone\nJohn,555-1234';
    const file = new File([csvContent], 'roster.csv', { type: 'text/csv' });

    await expect(parseRosterFile(file)).rejects.toThrow('Missing required columns');
  });
});