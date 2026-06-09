/**
 * Property-based tests for RecommendationEngine
 *
 * Property 3: For any input context regardless of the number of matching captures
 * and meeting notes, the Recommendation_Engine SHALL return at most 5 recommendations.
 * **Validates: Requirements 1.5**
 *
 * Property 4: For any context containing more than 50 captures, only the 50 most recent
 * (by createdAt) SHALL be processed. For any context containing more than 20 meeting notes,
 * only the 20 most recent SHALL be processed. Adding older items beyond these limits SHALL
 * not change the output.
 * **Validates: Requirements 1.6**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type {
  Recommendation,
  RecommendationContext,
  RecommendationSource,
  TaskPriority,
} from '@admini/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock getClient - returns empty data for captures, meeting notes, and tasks
const mockFrom = vi.fn();

vi.mock('./getClient', () => ({
  getClient: () => ({
    from: mockFrom,
  }),
}));

// We will dynamically set the mock provider before importing the engine
let mockProviderResults: Recommendation[] = [];
let capturedContext: RecommendationContext | null = null;

vi.mock('./ruleBasedProvider', () => ({
  ruleBasedProvider: {
    generateRecommendations: (ctx: RecommendationContext) => {
      capturedContext = ctx;
      return Promise.resolve(mockProviderResults);
    },
  },
  RuleBasedProvider: class {
    async generateRecommendations(ctx: RecommendationContext) {
      capturedContext = ctx;
      return mockProviderResults;
    }
  },
}));

// Mock indexedDB for the handled recommendations store
const mockIDBRequest = {
  result: [] as unknown[],
  onsuccess: null as (() => void) | null,
  onerror: null as (() => void) | null,
};

const mockObjectStore = {
  getAll: () => {
    const req = { ...mockIDBRequest, result: [] };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  },
  put: () => {
    const req = { ...mockIDBRequest };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  },
};

const mockTransaction = {
  objectStore: () => mockObjectStore,
  oncomplete: null as (() => void) | null,
  onerror: null as (() => void) | null,
};

const mockDb = {
  transaction: () => {
    const tx = { ...mockTransaction };
    setTimeout(() => tx.oncomplete?.(), 0);
    return tx;
  },
  close: vi.fn(),
  objectStoreNames: { contains: () => true },
  createObjectStore: vi.fn(),
};

const mockOpenRequest = {
  result: mockDb,
  onsuccess: null as (() => void) | null,
  onerror: null as (() => void) | null,
  onupgradeneeded: null as (() => void) | null,
};

// Mock global indexedDB
vi.stubGlobal('indexedDB', {
  open: () => {
    const req = { ...mockOpenRequest };
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  },
});

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const sourceTypeArb: fc.Arbitrary<RecommendationSource> = fc.constantFrom(
  'capture',
  'meeting_note',
  'calendar_event',
  'pulse',
);

const taskPriorityArb: fc.Arbitrary<TaskPriority> = fc.constantFrom(
  'low',
  'normal',
  'high',
  'urgent',
);

/**
 * Generate a valid Recommendation object with unique ID and title.
 * Titles are unique alphanumeric strings that won't collide with empty
 * existing task titles (since we mock tasks as empty).
 */
const recommendationArb: fc.Arbitrary<Recommendation> = fc.record({
  id: fc.uuid(),
  title: fc
    .array(fc.stringMatching(/^[A-Za-z0-9]+$/), { minLength: 1, maxLength: 5 })
    .map((parts) => parts.join(' '))
    .filter((s) => s.length >= 1 && s.length <= 200),
  sourceType: sourceTypeArb,
  sourceId: fc.uuid(),
  sourceExcerpt: fc.string({ minLength: 1, maxLength: 100 }),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  suggestedPriority: taskPriorityArb,
  createdAt: fc.date().map((d) => d.toISOString()),
});

/**
 * Generate a list of 0 to 50 recommendations to simulate a provider
 * that returns an arbitrary number of results (potentially exceeding the cap).
 */
const recommendationListArb: fc.Arbitrary<Recommendation[]> = fc.array(
  recommendationArb,
  { minLength: 0, maxLength: 50 },
);

// ---------------------------------------------------------------------------
// Supabase mock helper
// ---------------------------------------------------------------------------

function setupSupabaseMock() {
  const createChain = (data: unknown[] = []) => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.neq = () => chain;
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.returns = () => Promise.resolve({ data, error: null });
    return chain;
  };

  mockFrom.mockImplementation(() => createChain([]));
}

/**
 * Setup Supabase mock that returns variable-length capture and meeting note data,
 * but respects the .limit() calls by truncating data to the limit value.
 * This simulates real Supabase behavior where .limit(N) returns at most N rows.
 */
function setupSupabaseMockWithData(
  captureRows: unknown[],
  meetingNoteRows: unknown[],
) {
  mockFrom.mockImplementation((table: string) => {
    let limitValue: number | undefined;
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.neq = () => chain;
    chain.order = () => chain;
    chain.limit = (n: number) => {
      limitValue = n;
      return chain;
    };
    chain.returns = () => {
      if (table === 'captures') {
        const data = limitValue !== undefined
          ? captureRows.slice(0, limitValue)
          : captureRows;
        return Promise.resolve({ data, error: null });
      }
      if (table === 'meeting_notes') {
        const data = limitValue !== undefined
          ? meetingNoteRows.slice(0, limitValue)
          : meetingNoteRows;
        return Promise.resolve({ data, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    };
    return chain;
  });
}

// ---------------------------------------------------------------------------
// Arbitraries for Property 4
// ---------------------------------------------------------------------------

/**
 * Generate a DB capture row with a controlled created_at timestamp.
 */
const dbCaptureRowArb = (index: number): fc.Arbitrary<Record<string, unknown>> =>
  fc.record({
    id: fc.uuid(),
    redacted_text: fc.string({ minLength: 1, maxLength: 50 }),
    mode: fc.constantFrom('voice', 'tap', 'typed'),
    status: fc.constantFrom('active', 'processed'),
    created_at: fc.constant(new Date(Date.now() - index * 60_000).toISOString()),
  });

/**
 * Generate a DB meeting note row with a controlled created_at timestamp.
 */
const dbMeetingNoteRowArb = (index: number): fc.Arbitrary<Record<string, unknown>> =>
  fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    body: fc.string({ minLength: 0, maxLength: 100 }),
    attendees: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
    created_at: fc.constant(new Date(Date.now() - index * 60_000).toISOString()),
    updated_at: fc.constant(new Date(Date.now() - index * 60_000).toISOString()),
    created_by: fc.uuid(),
  });

/**
 * Generate an array of capture rows with a size between 0 and 100.
 */
const captureRowsArb: fc.Arbitrary<Record<string, unknown>[]> = fc
  .integer({ min: 0, max: 100 })
  .chain((count) =>
    fc.tuple(...Array.from({ length: count }, (_, i) => dbCaptureRowArb(i))),
  );

/**
 * Generate an array of meeting note rows with a size between 0 and 50.
 */
const meetingNoteRowsArb: fc.Arbitrary<Record<string, unknown>[]> = fc
  .integer({ min: 0, max: 50 })
  .chain((count) =>
    fc.tuple(...Array.from({ length: count }, (_, i) => dbMeetingNoteRowArb(i))),
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 3: Result Count Cap', () => {
  beforeEach(() => {
    setupSupabaseMock();
    mockProviderResults = [];
    capturedContext = null;
  });

  it('recommendation engine returns at most 5 results regardless of provider output size', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(recommendationListArb, async (recommendations) => {
        mockProviderResults = recommendations;

        const results = await recommendationEngine.refreshRecommendations(
          'test-user',
          'test-org',
        );

        expect(results.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 100 },
    );
  }, 30000);
});

describe('Property 4: Input Limiting', () => {
  beforeEach(() => {
    mockProviderResults = [];
    capturedContext = null;
  });

  it('provider context receives at most 50 captures regardless of DB size', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(captureRowsArb, async (captureRows) => {
        setupSupabaseMockWithData(captureRows, []);
        mockProviderResults = [];
        capturedContext = null;

        await recommendationEngine.refreshRecommendations('test-user', 'test-org');

        expect(capturedContext).not.toBeNull();
        expect(capturedContext!.recentCaptures.length).toBeLessThanOrEqual(50);
      }),
      { numRuns: 100 },
    );
  }, 30000);

  it('provider context receives at most 20 meeting notes regardless of DB size', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(meetingNoteRowsArb, async (meetingNoteRows) => {
        setupSupabaseMockWithData([], meetingNoteRows);
        mockProviderResults = [];
        capturedContext = null;

        await recommendationEngine.refreshRecommendations('test-user', 'test-org');

        expect(capturedContext).not.toBeNull();
        expect(capturedContext!.recentMeetingNotes.length).toBeLessThanOrEqual(20);
      }),
      { numRuns: 100 },
    );
  }, 30000);

  it('adding older items beyond the limits does not change the output', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(
        captureRowsArb,
        meetingNoteRowsArb,
        async (captureRows, meetingNoteRows) => {
          // First run: with the given data
          setupSupabaseMockWithData(captureRows, meetingNoteRows);
          mockProviderResults = [];
          capturedContext = null;

          const firstResults = await recommendationEngine.refreshRecommendations(
            'test-user',
            'test-org',
          );

          // Second run: add older items beyond limits
          const olderCaptures = Array.from({ length: 30 }, (_, i) => ({
            id: `old-capture-${i}`,
            redacted_text: `old capture text ${i}`,
            mode: 'typed',
            status: 'active',
            created_at: new Date(Date.now() - (captureRows.length + i + 100) * 60_000).toISOString(),
          }));
          const olderNotes = Array.from({ length: 15 }, (_, i) => ({
            id: `old-note-${i}`,
            title: `old note ${i}`,
            body: `old body ${i}`,
            attendees: [],
            created_at: new Date(Date.now() - (meetingNoteRows.length + i + 100) * 60_000).toISOString(),
            updated_at: new Date(Date.now() - (meetingNoteRows.length + i + 100) * 60_000).toISOString(),
            created_by: `user-${i}`,
          }));

          const extendedCaptures = [...captureRows, ...olderCaptures];
          const extendedNotes = [...meetingNoteRows, ...olderNotes];

          setupSupabaseMockWithData(extendedCaptures, extendedNotes);
          mockProviderResults = [];
          capturedContext = null;

          const secondResults = await recommendationEngine.refreshRecommendations(
            'test-user',
            'test-org',
          );

          // Both should produce the same results since older items are beyond the limit
          expect(secondResults).toEqual(firstResults);

          // Context captures and meeting notes should be bounded
          if (capturedContext) {
            expect(capturedContext.recentCaptures.length).toBeLessThanOrEqual(50);
            expect(capturedContext.recentMeetingNotes.length).toBeLessThanOrEqual(20);
          }
        },
      ),
      { numRuns: 50 },
    );
  }, 60000);
});

// ---------------------------------------------------------------------------
// Supabase mock helper for Property 5 (tasks table)
// ---------------------------------------------------------------------------

/**
 * Setup Supabase mock that returns specific task titles from the 'tasks' table,
 * while returning empty arrays for captures and meeting_notes tables.
 */
function setupSupabaseMockWithTasks(taskTitles: string[]) {
  mockFrom.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.neq = () => chain;
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.returns = () => {
      if (table === 'tasks') {
        const data = taskTitles.map((title) => ({ title }));
        return Promise.resolve({ data, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    };
    return chain;
  });
}

// ---------------------------------------------------------------------------
// Arbitraries for Property 5
// ---------------------------------------------------------------------------

/**
 * Generate a non-empty task title string (lowercase alphanumeric with spaces).
 * We keep titles simple to ensure meaningful substring matching tests.
 */
const taskTitleArb: fc.Arbitrary<string> = fc
  .array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 4 })
  .map((parts) => parts.join(' '))
  .filter((s) => s.length >= 2 && s.length <= 100);

/**
 * Generate a recommendation with a specific title.
 */
function recommendationWithTitle(title: string): fc.Arbitrary<Recommendation> {
  return fc.record({
    id: fc.uuid(),
    title: fc.constant(title),
    sourceType: sourceTypeArb,
    sourceId: fc.uuid(),
    sourceExcerpt: fc.string({ minLength: 1, maxLength: 100 }),
    confidence: fc.double({ min: 0, max: 1, noNaN: true }),
    suggestedPriority: taskPriorityArb,
    createdAt: fc.date().map((d) => d.toISOString()),
  });
}

// ---------------------------------------------------------------------------
// Property 5 Tests
// ---------------------------------------------------------------------------

describe('Property 5: Deduplication Exclusion', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any set of existing task titles and candidate recommendations,
   * if a candidate recommendation title closely matches an existing task title,
   * that candidate SHALL be excluded from the final results.
   *
   * The deduplication logic uses case-insensitive substring matching:
   * - If the recommendation title (lowercased) contains an existing task title (lowercased), OR
   * - If an existing task title (lowercased) contains the recommendation title (lowercased)
   * Then the recommendation is excluded.
   */

  beforeEach(() => {
    mockProviderResults = [];
    capturedContext = null;
  });

  it('recommendations whose titles contain an existing task title (case-insensitive) are excluded', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(
        // Generate 1-5 existing task titles
        fc.array(taskTitleArb, { minLength: 1, maxLength: 5 }),
        // Generate a random prefix and suffix to wrap around the task title
        fc.string({ minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 20 }),
        // Pick which task title to embed
        fc.nat(),
        async (existingTitles, prefix, suffix, titleIndex) => {
          const chosenTitle = existingTitles[titleIndex % existingTitles.length];
          // Create a recommendation title that CONTAINS the existing task title
          const duplicateTitle = `${prefix}${chosenTitle}${suffix}`;

          // Set up mock with these task titles
          setupSupabaseMockWithTasks(existingTitles);

          // Create a recommendation with the duplicate title
          const dupRec: Recommendation = {
            id: crypto.randomUUID(),
            title: duplicateTitle,
            sourceType: 'capture',
            sourceId: crypto.randomUUID(),
            sourceExcerpt: 'some excerpt',
            confidence: 0.8,
            suggestedPriority: 'normal',
            createdAt: new Date().toISOString(),
          };

          mockProviderResults = [dupRec];

          const results = await recommendationEngine.refreshRecommendations(
            'test-user',
            'test-org',
          );

          // The duplicate recommendation should be excluded
          const found = results.find((r) => r.id === dupRec.id);
          expect(found).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('recommendations whose titles are contained within an existing task title (case-insensitive) are excluded', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(
        // Generate a short recommendation title
        taskTitleArb,
        // Generate a prefix and suffix to create a longer existing task title containing it
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (recTitle, prefix, suffix) => {
          // Create an existing task title that CONTAINS the recommendation title
          const existingTitle = `${prefix}${recTitle}${suffix}`;

          setupSupabaseMockWithTasks([existingTitle]);

          const dupRec: Recommendation = {
            id: crypto.randomUUID(),
            title: recTitle,
            sourceType: 'meeting_note',
            sourceId: crypto.randomUUID(),
            sourceExcerpt: 'excerpt text',
            confidence: 0.7,
            suggestedPriority: 'high',
            createdAt: new Date().toISOString(),
          };

          mockProviderResults = [dupRec];

          const results = await recommendationEngine.refreshRecommendations(
            'test-user',
            'test-org',
          );

          // The recommendation should be excluded since its title is contained in an existing task
          const found = results.find((r) => r.id === dupRec.id);
          expect(found).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('recommendations whose titles do NOT match any existing task title are included', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(
        // Generate 1-5 existing task titles
        fc.array(taskTitleArb, { minLength: 1, maxLength: 5 }),
        // Generate a unique recommendation title that won't match any existing title
        fc.uuid(),
        async (existingTitles, uniqueId) => {
          // Use a UUID-based title that won't match any task title via substring
          const nonMatchingTitle = `unique-rec-${uniqueId}`;

          setupSupabaseMockWithTasks(existingTitles);

          const rec: Recommendation = {
            id: crypto.randomUUID(),
            title: nonMatchingTitle,
            sourceType: 'capture',
            sourceId: crypto.randomUUID(),
            sourceExcerpt: 'some excerpt',
            confidence: 0.9,
            suggestedPriority: 'normal',
            createdAt: new Date().toISOString(),
          };

          mockProviderResults = [rec];

          const results = await recommendationEngine.refreshRecommendations(
            'test-user',
            'test-org',
          );

          // The non-matching recommendation should be included
          const found = results.find((r) => r.id === rec.id);
          expect(found).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('deduplication is case-insensitive (mixed case titles still match)', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(
        taskTitleArb,
        fc.constantFrom('upper', 'lower', 'mixed') as fc.Arbitrary<'upper' | 'lower' | 'mixed'>,
        async (baseTitle, caseVariant) => {
          // Transform the recommendation title to a different case
          let transformedTitle: string;
          switch (caseVariant) {
            case 'upper':
              transformedTitle = baseTitle.toUpperCase();
              break;
            case 'lower':
              transformedTitle = baseTitle.toLowerCase();
              break;
            case 'mixed':
              transformedTitle = baseTitle
                .split('')
                .map((ch, i) => (i % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase()))
                .join('');
              break;
          }

          // Existing task has the base title, recommendation has the case-variant
          setupSupabaseMockWithTasks([baseTitle]);

          const rec: Recommendation = {
            id: crypto.randomUUID(),
            title: transformedTitle,
            sourceType: 'capture',
            sourceId: crypto.randomUUID(),
            sourceExcerpt: 'excerpt',
            confidence: 0.6,
            suggestedPriority: 'low',
            createdAt: new Date().toISOString(),
          };

          mockProviderResults = [rec];

          const results = await recommendationEngine.refreshRecommendations(
            'test-user',
            'test-org',
          );

          // Case-insensitive match: the recommendation should be excluded
          const found = results.find((r) => r.id === rec.id);
          expect(found).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// Property 6 Tests
// ---------------------------------------------------------------------------

describe('Property 6: Dismiss Cooldown Filtering', () => {
  /**
   * **Validates: Requirements 2.3**
   *
   * For any previously dismissed recommendation, if the dismissal occurred within
   * 7 days of the current generation time, that recommendation SHALL be excluded
   * from results. If the dismissal occurred more than 7 days ago, the recommendation
   * MAY reappear.
   */

  beforeEach(() => {
    setupSupabaseMock();
    mockProviderResults = [];
    capturedContext = null;
  });

  it('dismissed recommendations within 7-day cooldown are excluded from results', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(
        // Generate 1-5 recommendation IDs to dismiss
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
        async (recIds) => {
          // markHandled records the current real time as handledAt
          // Then immediately refreshing means the dismissal is within the cooldown window
          for (const id of recIds) {
            await recommendationEngine.markHandled(id, 'dismissed');
          }

          // Set up provider to return recommendations with these same IDs
          mockProviderResults = recIds.map((id) => ({
            id,
            title: `unique-task-${id}`,
            sourceType: 'capture' as const,
            sourceId: crypto.randomUUID(),
            sourceExcerpt: 'test excerpt',
            confidence: 0.8,
            suggestedPriority: 'normal' as const,
            createdAt: new Date().toISOString(),
          }));

          const results = await recommendationEngine.refreshRecommendations(
            'test-user',
            'test-org',
          );

          // All recently dismissed recommendations should be excluded
          for (const id of recIds) {
            const found = results.find((r) => r.id === id);
            expect(found).toBeUndefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('dismissed recommendations after 7-day cooldown may reappear in results', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(
        // Generate 1-3 recommendation IDs
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
        // Generate days beyond cooldown (8 to 30 days)
        fc.integer({ min: 8, max: 30 }),
        async (recIds, daysAfter) => {
          // Mark recommendations as dismissed at the real current time
          for (const id of recIds) {
            await recommendationEngine.markHandled(id, 'dismissed');
          }

          // Advance Date.now() beyond the 7-day cooldown window
          const realNow = Date.now();
          const futureTime = realNow + daysAfter * 24 * 60 * 60 * 1000;
          const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(futureTime);

          try {
            // Provider returns recommendations with these IDs
            mockProviderResults = recIds.map((id) => ({
              id,
              title: `unique-task-${id}`,
              sourceType: 'capture' as const,
              sourceId: crypto.randomUUID(),
              sourceExcerpt: 'test excerpt',
              confidence: 0.8,
              suggestedPriority: 'normal' as const,
              createdAt: new Date().toISOString(),
            }));

            const results = await recommendationEngine.refreshRecommendations(
              'test-user',
              'test-org',
            );

            // After cooldown, dismissed recommendations should reappear
            for (const id of recIds) {
              const found = results.find((r) => r.id === id);
              expect(found).toBeDefined();
            }
          } finally {
            dateNowSpy.mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);

  it('accepted recommendations are always excluded regardless of time elapsed', async () => {
    const { recommendationEngine } = await import('./recommendationEngine');

    await fc.assert(
      fc.asyncProperty(
        // Generate 1-3 recommendation IDs
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
        // Generate days ago - even well beyond the 7-day cooldown
        fc.integer({ min: 8, max: 60 }),
        async (recIds, daysAfter) => {
          // Mark each recommendation as accepted at the current real time
          for (const id of recIds) {
            await recommendationEngine.markHandled(id, 'accepted');
          }

          // Advance Date.now() well beyond the 7-day cooldown
          const realNow = Date.now();
          const futureTime = realNow + daysAfter * 24 * 60 * 60 * 1000;
          const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(futureTime);

          try {
            // Provider returns recommendations with these IDs
            mockProviderResults = recIds.map((id) => ({
              id,
              title: `unique-task-${id}`,
              sourceType: 'capture' as const,
              sourceId: crypto.randomUUID(),
              sourceExcerpt: 'test excerpt',
              confidence: 0.9,
              suggestedPriority: 'high' as const,
              createdAt: new Date().toISOString(),
            }));

            const results = await recommendationEngine.refreshRecommendations(
              'test-user',
              'test-org',
            );

            // Accepted recommendations should ALWAYS be excluded, no cooldown expiry
            for (const id of recIds) {
              const found = results.find((r) => r.id === id);
              expect(found).toBeUndefined();
            }
          } finally {
            dateNowSpy.mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});