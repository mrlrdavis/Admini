import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedSave } from '../../src/hooks/useDebouncedSave';

describe('useDebouncedSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call saveFn immediately on schedule', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn, 800));

    act(() => {
      result.current({ value: 'test' });
    });

    expect(saveFn).not.toHaveBeenCalled();
  });

  it('calls saveFn after the delay elapses', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn, 800));

    act(() => {
      result.current({ value: 'test' });
    });

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith({ value: 'test' });
  });

  it('batches rapid calls and only saves the latest value', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn, 800));

    act(() => {
      result.current({ value: 'first' });
      result.current({ value: 'second' });
      result.current({ value: 'third' });
    });

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith({ value: 'third' });
  });

  it('resets the timer on each new call', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn, 800));

    act(() => {
      result.current({ value: 'first' });
    });

    // Advance 500ms (not yet fired)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(saveFn).not.toHaveBeenCalled();

    // Schedule again - resets timer
    act(() => {
      result.current({ value: 'second' });
    });

    // Advance another 500ms (total 1000ms from first, 500ms from second)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(saveFn).not.toHaveBeenCalled();

    // Advance remaining 300ms
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith({ value: 'second' });
  });

  it('flushes pending save on unmount', () => {
    const saveFn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedSave(saveFn, 800));

    act(() => {
      result.current({ value: 'pending' });
    });

    // Unmount before timer fires
    unmount();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith({ value: 'pending' });
  });

  it('does not call saveFn on unmount if nothing is pending', () => {
    const saveFn = vi.fn();
    const { unmount } = renderHook(() => useDebouncedSave(saveFn, 800));

    unmount();

    expect(saveFn).not.toHaveBeenCalled();
  });

  it('uses default delay of 800ms when not specified', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useDebouncedSave(saveFn));

    act(() => {
      result.current('data');
    });

    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(saveFn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(saveFn).toHaveBeenCalledTimes(1);
  });
});