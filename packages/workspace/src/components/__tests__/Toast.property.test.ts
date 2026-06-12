import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ToastManager } from '../Toast';

// Feature: app-ui-overhaul, Property 12: Toast deduplication

/**
 * Property 12: Toast deduplication
 *
 * For any sequence of rapid undo action triggers, the number of simultaneously
 * visible toast notifications SHALL never exceed one.
 *
 * **Validates: Requirements 17.1, 17.2, 17.3**
 */

describe('Toast Property Tests', () => {
  let manager: ToastManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new ToastManager();
  });

  afterEach(() => {
    manager.reset();
    vi.useRealTimers();
  });

  // Feature: app-ui-overhaul, Property 12: Toast deduplication
  describe('Property 12: Toast deduplication', () => {
    it('the number of simultaneously visible toasts never exceeds one for any sequence of rapid show calls', () => {
      fc.assert(
        fc.property(
          // Generate a random sequence of show/dismiss actions
          fc.array(
            fc.oneof(
              // Show action with random message text
              fc.record({
                type: fc.constant('show' as const),
                message: fc.string({ minLength: 1, maxLength: 50 }),
              }),
              // Dismiss action
              fc.record({
                type: fc.constant('dismiss' as const),
              })
            ),
            { minLength: 1, maxLength: 50 }
          ),
          (actions) => {
            // Reset state for each run
            manager.reset();

            for (const action of actions) {
              if (action.type === 'show') {
                manager.show(action.message);
              } else {
                // Dismiss the current toast if any
                const currentId = manager.getCurrentToastId();
                if (currentId) {
                  manager.dismiss(currentId);
                }
              }

              // PROPERTY: visible count must NEVER exceed 1
              const visibleCount = manager.getVisibleCount();
              expect(visibleCount).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rapid show calls with the same message always result in exactly one visible toast', () => {
      fc.assert(
        fc.property(
          // Generate a random number of rapid calls (simulating undo spam)
          fc.integer({ min: 2, max: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (callCount, message) => {
            manager.reset();

            // Simulate rapid-fire toast triggers with the same message
            for (let i = 0; i < callCount; i++) {
              manager.show(message);
            }

            // PROPERTY: only 1 toast is ever tracked as visible
            expect(manager.getVisibleCount()).toBe(1);
            expect(manager.isVisible()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('after dismiss, visible count returns to zero regardless of prior show history', () => {
      fc.assert(
        fc.property(
          // Generate random number of rapid show calls followed by a dismiss
          fc.integer({ min: 1, max: 50 }),
          fc.string({ minLength: 1, maxLength: 30 }),
          (showCount, message) => {
            manager.reset();

            // Show several toasts rapidly
            let lastId = '';
            for (let i = 0; i < showCount; i++) {
              lastId = manager.show(message);
            }

            // Verify only 1 is visible
            expect(manager.getVisibleCount()).toBe(1);

            // Dismiss the current toast
            manager.dismiss(lastId);

            // PROPERTY: after dismiss, nothing is visible
            expect(manager.getVisibleCount()).toBe(0);
            expect(manager.isVisible()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('auto-dismiss timeout clears the toast and visible count returns to zero', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.integer({ min: 100, max: 10000 }),
          (message, duration) => {
            manager.reset();

            manager.show(message, { duration });

            // Before timeout: 1 visible
            expect(manager.getVisibleCount()).toBe(1);

            // Advance time past the duration
            vi.advanceTimersByTime(duration + 1);

            // PROPERTY: after auto-dismiss, nothing is visible
            expect(manager.getVisibleCount()).toBe(0);
            expect(manager.isVisible()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('interleaved show and dismiss actions never produce more than 1 visible toast', () => {
      fc.assert(
        fc.property(
          // Generate random interleaved sequence of actions
          fc.array(
            fc.oneof(
              { weight: 3, arbitrary: fc.record({ type: fc.constant('show' as const), message: fc.constantFrom('Undo', 'Task deleted', 'Item removed', 'Action undone') }) },
              { weight: 1, arbitrary: fc.record({ type: fc.constant('dismiss' as const) }) },
              { weight: 1, arbitrary: fc.record({ type: fc.constant('tick' as const), ms: fc.integer({ min: 100, max: 5000 }) }) }
            ),
            { minLength: 5, maxLength: 30 }
          ),
          (actions) => {
            manager.reset();
            let maxVisible = 0;

            for (const action of actions) {
              if (action.type === 'show') {
                manager.show((action as { type: 'show'; message: string }).message);
              } else if (action.type === 'dismiss') {
                const currentId = manager.getCurrentToastId();
                if (currentId) {
                  manager.dismiss(currentId);
                }
              } else if (action.type === 'tick') {
                vi.advanceTimersByTime((action as { type: 'tick'; ms: number }).ms);
              }

              const count = manager.getVisibleCount();
              if (count > maxVisible) maxVisible = count;
            }

            // PROPERTY: max visible toasts at any point was never > 1
            expect(maxVisible).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
