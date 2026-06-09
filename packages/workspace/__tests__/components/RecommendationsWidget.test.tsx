import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';
import type { Recommendation } from '@admini/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetRecommendations = vi.fn();
const mockMarkHandled = vi.fn();

vi.mock('../../src/services/recommendationEngine', () => ({
  recommendationEngine: {
    getRecommendations: (...args: unknown[]) => mockGetRecommendations(...args),
    markHandled: (...args: unknown[]) => mockMarkHandled(...args),
  },
}));

const mockGetAppPreferences = vi.fn();

vi.mock('../../src/services/appPreferencesStorage', () => ({
  getAppPreferences: (...args: unknown[]) => mockGetAppPreferences(...args),
}));

const mockGetClient = vi.fn();

vi.mock('../../src/services/getClient', () => ({
  getClient: (...args: unknown[]) => mockGetClient(...args),
}));

const mockShowToast = vi.fn();

vi.mock('../../src/components/Toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

// Import AFTER mocks are declared
import { RecommendationsWidget } from '../../src/components/RecommendationsWidget';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function createRecommendation(overrides?: Partial<Recommendation>): Recommendation {
  return {
    id: 'rec-1',
    title: 'Follow up with client',
    description: 'Based on a capture from today',
    sourceType: 'capture',
    sourceId: 'cap-123',
    sourceExcerpt: 'I need to follow up with the client about pricing',
    confidence: 0.85,
    suggestedPriority: 'high',
    createdAt: '2024-06-01T12:00:00Z',
    ...overrides,
  };
}

function defaultPrefs(overrides?: Record<string, unknown>) {
  return {
    theme: 'system',
    defaultTab: 'capture',
    compactMode: false,
    taskRecommendationsEnabled: true,
    ...overrides,
  };
}

function mockClientSuccess() {
  mockGetClient.mockReturnValue({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'task-1' }, error: null }),
        }),
      }),
    }),
  });
}

function mockClientFailure(errorMessage: string) {
  mockGetClient.mockReturnValue({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { message: errorMessage } }),
        }),
      }),
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecommendationsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClientSuccess();
  });

  // -------------------------------------------------------------------------
  // Requirement 3.3: Empty state
  // -------------------------------------------------------------------------

  describe('empty state (Requirement 3.3)', () => {
    it('shows empty state message when no recommendations are returned', async () => {
      mockGetAppPreferences.mockResolvedValue(defaultPrefs());
      mockGetRecommendations.mockResolvedValue([]);

      await act(async () => {
        render(createElement(RecommendationsWidget, { userId: 'user-1', organizationId: 'org-1' }));
      });

      expect(screen.getByText('Start capturing notes to get task suggestions')).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 8.1: Error state with retry
  // -------------------------------------------------------------------------

  describe('error state with retry (Requirement 8.1)', () => {
    it('shows error message with retry button when engine throws', async () => {
      mockGetAppPreferences.mockResolvedValue(defaultPrefs());
      mockGetRecommendations.mockRejectedValue(new Error('Unable to load suggestions'));

      await act(async () => {
        render(createElement(RecommendationsWidget, { userId: 'user-1', organizationId: 'org-1' }));
      });

      expect(screen.getByText('Unable to load suggestions')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    });

    it('retries fetching recommendations when retry button is clicked', async () => {
      mockGetAppPreferences.mockResolvedValue(defaultPrefs());
      mockGetRecommendations
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([]);

      await act(async () => {
        render(createElement(RecommendationsWidget, { userId: 'user-1', organizationId: 'org-1' }));
      });

      expect(screen.getByText('Network error')).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Start capturing notes to get task suggestions')).toBeDefined();
      });

      expect(mockGetRecommendations).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 3.2: Card rendering
  // -------------------------------------------------------------------------

  describe('card rendering (Requirement 3.2)', () => {
    it('renders recommendation cards with title, source excerpt, source type badge, and confidence level', async () => {
      const rec = createRecommendation({
        title: 'Schedule team meeting',
        sourceExcerpt: 'We should schedule a meeting to discuss Q3 plans',
        sourceType: 'meeting_note',
        confidence: 0.72,
      });

      mockGetAppPreferences.mockResolvedValue(defaultPrefs());
      mockGetRecommendations.mockResolvedValue([rec]);

      await act(async () => {
        render(createElement(RecommendationsWidget, { userId: 'user-1', organizationId: 'org-1' }));
      });

      // Title
      expect(screen.getByText('Schedule team meeting')).toBeDefined();
      // Source excerpt
      expect(screen.getByText('We should schedule a meeting to discuss Q3 plans')).toBeDefined();
      // Source type badge
      expect(screen.getByText('Meeting Note')).toBeDefined();
      // Confidence level
      expect(screen.getByText('Medium confidence')).toBeDefined();
    });

    it('renders high confidence label for confidence >= 0.8', async () => {
      const rec = createRecommendation({ confidence: 0.9 });

      mockGetAppPreferences.mockResolvedValue(defaultPrefs());
      mockGetRecommendations.mockResolvedValue([rec]);

      await act(async () => {
        render(createElement(RecommendationsWidget, { userId: 'user-1', organizationId: 'org-1' }));
      });

      expect(screen.getByText('High confidence')).toBeDefined();
    });

    it('renders low confidence label for confidence < 0.5', async () => {
      const rec = createRecommendation({ confidence: 0.3 });

      mockGetAppPreferences.mockResolvedValue(defaultPrefs());
      mockGetRecommendations.mockResolvedValue([rec]);

      await act(async () => {
        render(createElement(RecommendationsWidget, { userId: 'user-1', organizationId: 'org-1' }));
      });

      expect(screen.getByText('Low confidence')).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 3.4: Preference disabled hides widget
  // -------------------------------------------------------------------------

  describe('preference disabled (Requirement 3.4)', () => {
    it('returns null when taskRecommendationsEnabled is false', async () => {
      mockGetAppPreferences.mockResolvedValue(defaultPrefs({ taskRecommendationsEnabled: false }));

      let container: HTMLElement;
      await act(async () => {
        const result = render(createElement(RecommendationsWidget, { userId: 'user-1', organizationId: 'org-1' }));
        container = result.container;
      });

      // Widget should not render any content
      expect(container!.innerHTML).toBe('');
      // Should never call getRecommendations when disabled
      expect(mockGetRecommendations).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 4.4: Error on accept keeps card visible
  // -------------------------------------------------------------------------

  describe('accept error handling (Requirement 4.4)', () => {
    it('shows error toast and keeps card visible when task creation fails', async () => {
      const rec = createRecommendation();

      mockGetAppPreferences.mockResolvedValue(defaultPrefs());
      mockGetRecommendations.mockResolvedValue([rec]);
      mockClientFailure('Insert failed');

      await act(async () => {
        render(createElement(RecommendationsWidget, { userId: 'user-1', organizationId: 'org-1' }));
      });

      const acceptBtn = screen.getByRole('button', { name: `Accept recommendation: ${rec.title}` });

      await act(async () => {
        fireEvent.click(acceptBtn);
      });

      // Card should still be visible
      expect(screen.getByText(rec.title)).toBeDefined();
      // Error toast should have been shown
      expect(mockShowToast).toHaveBeenCalledWith('Insert failed');
    });
  });
});

