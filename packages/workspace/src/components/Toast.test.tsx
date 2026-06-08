import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastContainer, showToast } from './Toast';

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('displays a toast when showToast is called', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Hello world');
    });

    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('removes toast after default duration (4000ms)', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Temporary message');
    });

    expect(screen.getByText('Temporary message')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Temporary message')).toBeNull();
  });

  it('removes toast after custom duration', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Quick toast', { duration: 2000 });
    });

    expect(screen.getByText('Quick toast')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText('Quick toast')).toBeNull();
  });

  it('renders an action button when action is provided', () => {
    const onClick = vi.fn();
    render(<ToastContainer />);

    act(() => {
      showToast('With action', { action: { label: 'Undo', onClick } });
    });

    const btn = screen.getByRole('button', { name: 'Undo' });
    expect(btn).toBeDefined();

    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('dismisses toast when dismiss button is clicked', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Dismissable');
    });

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('Dismissable')).toBeNull();
  });

  it('displays multiple toasts simultaneously', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('First');
      showToast('Second');
    });

    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
  });

  it('has aria-live polite for accessibility', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Accessible toast');
    });

    const container = screen.getByText('Accessible toast').closest('[aria-live]');
    expect(container).not.toBeNull();
    expect(container!.getAttribute('aria-live')).toBe('polite');
  });

  it('does not fire showToast when no ToastContainer is mounted', () => {
    // showToast before mount should not throw
    expect(() => showToast('No container')).not.toThrow();
  });
});
