import { useRef, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// useDebouncedSave - Debounces save operations to avoid excessive writes.
//
// Usage:
//   const debouncedSave = useDebouncedSave(saveFn, 800);
//   // Call debouncedSave(data) on each change - it will batch rapid changes
//   // and only call saveFn once the user stops changing for 800ms.
//   // Pending saves are flushed automatically on unmount.
// ---------------------------------------------------------------------------

/**
 * A hook that debounces a save function. Rapid calls within the delay window
 * are batched: only the last call's data is saved after the delay elapses.
 * On unmount, any pending save is flushed immediately so data is never lost.
 *
 * @param saveFn - The async save function to debounce.
 * @param delay - Debounce delay in milliseconds (default: 800ms).
 * @returns A stable callback that schedules (or reschedules) the debounced save.
 */
export function useDebouncedSave<T>(
  saveFn: (data: T) => Promise<void> | void,
  delay = 800,
): (data: T) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<T | null>(null);
  const saveFnRef = useRef(saveFn);

  // Keep saveFn ref up-to-date without re-creating the callback
  saveFnRef.current = saveFn;

  const flush = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (latestDataRef.current !== null) {
      const data = latestDataRef.current;
      latestDataRef.current = null;
      saveFnRef.current(data);
    }
  }, []);

  const schedule = useCallback(
    (data: T) => {
      latestDataRef.current = data;

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (latestDataRef.current !== null) {
          const d = latestDataRef.current;
          latestDataRef.current = null;
          saveFnRef.current(d);
        }
      }, delay);
    },
    [delay],
  );

  // Flush pending save on unmount so we never lose data
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  return schedule;
}
