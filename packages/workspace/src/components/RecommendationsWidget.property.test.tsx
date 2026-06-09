/**
 * Property-based test: Accept Creates Matching Task
 *
 * Property 7: For any recommendation that is accepted, the resulting task SHALL
 * have a title equal to the recommendation title and a priority equal to the
 * recommendation's suggested priority.
 *
 * **Validates: Requirements 4.1**
 */

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { Recommendation, RecommendationSource, TaskPriority } from '@admini/shared';
import { RecommendationsWidget } from './RecommendationsWidget';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock getClient to capture insert payloads
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('../services/getClient', () => ({
  getClient: () => ({
    from: mockFrom,
  }),
}));

// Mock recommendationEngine to return controlled recommendations
const mockGetRecommendations = vi.fn();
const mockMarkHandled = vi.fn();

vi.mock('../services/recommendationEngine', () => ({
  recommendationEngine: {
    getRecommendations: (...args: unknown[]) => mockGetRecommendations(...args),
    markHandled: (...args: unknown[]) => mockMarkHandled(...args),
  },
}));

// Mock appPreferencesStorage to return enabled
vi.mock('../services/appPreferencesStorage', () => ({
  getAppPreferences: () =>
    Promise.resolve({
      theme: 'system',
      defaultTab: 'capture',
      compactMode: false,
      taskRecommendationsEnabled: true,
    }),
}));

// Mock Toast to avoid side effects
vi.mock('./Toast', () => ({
  showToast: vi.fn(),
}));

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

// Generate recommendation titles: alphanumeric with single spaces, no leading/trailing whitespace.
// This avoids testing-library text normalization issues while still exercising diverse inputs.
const titleArb = fc
  .array(fc.stringMatching(/^[A-Za-z0-9]+$/), { minLength: 1, maxLength: 8 })
  .map((parts) => parts.join(' '))
  .filter((s) => s.length >= 1 && s.length <= 200);

const recommendationArb: fc.Arbitrary<Recommendation> = fc.record({
  id: fc.uuid(),
  title: titleArb,
  sourceType: sourceTypeArb,
  sourceId: fc.uuid(),
  sourceExcerpt: fc.string({ minLength: 1, maxLength: 50 }),
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
  suggestedPriority: taskPriorityArb,
  createdAt: fc.date().map((d) => d.toISOString()),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 7: Accept Creates Matching Task', () => {
  beforeEach(() => {
    mockFrom.mockReturnValue({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle.mockResolvedValue({ data: { id: 'new-task-id' }, error: null }),
        }),
      }),
    });
    mockMarkHandled.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('accepted recommendation creates task with matching title and priority', async () => {
    await fc.assert(
      fc.asyncProperty(recommendationArb, async (recommendation) => {
        // Cleanup DOM between property test iterations
        cleanup();

        // Reset mocks for each iteration
        mockInsert.mockClear();
        mockFrom.mockClear();
        mockSelect.mockClear();
        mockSingle.mockClear();
        mockMarkHandled.mockClear();
        mockGetRecommendations.mockClear();

        // Setup: return this recommendation from the engine
        mockGetRecommendations.mockResolvedValue([recommendation]);

        // Re-setup the Supabase mock chain for each iteration
        mockFrom.mockReturnValue({
          insert: mockInsert.mockReturnValue({
            select: mockSelect.mockReturnValue({
              single: mockSingle.mockResolvedValue({ data: { id: 'new-task-id' }, error: null }),
            }),
          }),
        });

        render(
          <RecommendationsWidget userId="user-1" organizationId="org-1" />,
        );

        // Wait for the Accept button to appear.
        // Since we render exactly one recommendation, there is exactly one Accept button.
        const acceptBtn = await waitFor(() =>
          screen.getByRole('button', { name: /^Accept/ }),
        );

        fireEvent.click(acceptBtn);

        // Wait for the insert to be called
        await waitFor(() => {
          expect(mockInsert).toHaveBeenCalled();
        });

        // Verify the insert payload matches the recommendation
        const insertPayload = mockInsert.mock.calls[0][0] as Record<string, unknown>;
        expect(insertPayload.title).toBe(recommendation.title);
        expect(insertPayload.priority).toBe(recommendation.suggestedPriority);

        // Verify table was 'tasks'
        expect(mockFrom).toHaveBeenCalledWith('tasks');
      }),
      { numRuns: 25 },
    );
  }, 60000);
});
