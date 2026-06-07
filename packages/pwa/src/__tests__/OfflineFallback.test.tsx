import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineFallback } from '../components/OfflineFallback';

describe('OfflineFallback', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: vi.fn() },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('renders app name', () => {
    render(<OfflineFallback appName="AdminI Desktop" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AdminI Desktop');
  });

  it('retry button triggers window.location.reload()', () => {
    render(<OfflineFallback appName="AdminI Desktop" />);

    const retryButton = screen.getByRole('button', { name: /retry loading the page/i });
    fireEvent.click(retryButton);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
