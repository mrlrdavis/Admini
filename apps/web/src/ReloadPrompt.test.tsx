import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ReloadPrompt } from './ReloadPrompt';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const mockedUseRegisterSW = vi.mocked(useRegisterSW);

describe('ReloadPrompt', () => {
  const mockUpdateServiceWorker = vi.fn();
  const mockSetNeedRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMock(needRefresh: boolean) {
    mockedUseRegisterSW.mockReturnValue({
      needRefresh: [needRefresh, mockSetNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
    } as any);
  }

  it('renders nothing when needRefresh is false', () => {
    setupMock(false);

    const { container } = render(createElement(ReloadPrompt));

    expect(container.innerHTML).toBe('');
  });

  it('renders the update banner when needRefresh is true', () => {
    setupMock(true);

    const { getByRole, getByText } = render(createElement(ReloadPrompt));

    expect(getByRole('alert')).toBeDefined();
    expect(getByText('Update available')).toBeDefined();
  });

  it('renders Reload and Dismiss buttons when update is available', () => {
    setupMock(true);

    const { getByText, getByLabelText } = render(createElement(ReloadPrompt));

    expect(getByText('Reload')).toBeDefined();
    expect(getByLabelText('Dismiss update notification')).toBeDefined();
  });

  it('calls updateServiceWorker(true) when Reload is clicked', () => {
    setupMock(true);

    const { getByText } = render(createElement(ReloadPrompt));

    fireEvent.click(getByText('Reload'));

    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('calls setNeedRefresh(false) when Dismiss is clicked', () => {
    setupMock(true);

    const { getByLabelText } = render(createElement(ReloadPrompt));

    fireEvent.click(getByLabelText('Dismiss update notification'));

    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('has aria-live="polite" for accessibility', () => {
    setupMock(true);

    const { getByRole } = render(createElement(ReloadPrompt));

    const banner = getByRole('alert');
    expect(banner.getAttribute('aria-live')).toBe('polite');
  });
});
