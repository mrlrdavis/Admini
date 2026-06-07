import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { NotificationSettings, type NotificationSettingsProps } from '../../src/components/NotificationSettings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides?: Partial<NotificationSettingsProps>): NotificationSettingsProps {
  return {
    emailNotifications: false,
    pushNotifications: false,
    activityDigest: false,
    onChange: vi.fn(),
    saving: false,
    error: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: Rendering
// ---------------------------------------------------------------------------

describe('NotificationSettings - Rendering', () => {
  it('renders all three toggle rows', () => {
    render(createElement(NotificationSettings, defaultProps()));

    expect(screen.getByText('Email Notifications')).toBeDefined();
    expect(screen.getByText('Push Notifications')).toBeDefined();
    expect(screen.getByText('Activity Digest')).toBeDefined();
  });

  it('renders descriptions for each toggle', () => {
    render(createElement(NotificationSettings, defaultProps()));

    expect(screen.getByText('Receive email alerts for important updates')).toBeDefined();
    expect(screen.getByText('Get real-time push notifications on your device')).toBeDefined();
    expect(screen.getByText('Weekly summary of workspace activity')).toBeDefined();
  });

  it('has an accessible aria-label on the container', () => {
    render(createElement(NotificationSettings, defaultProps()));

    const container = screen.getByLabelText('Notification settings');
    expect(container).toBeDefined();
  });

  it('renders toggle buttons with role="switch"', () => {
    render(createElement(NotificationSettings, defaultProps()));

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: Toggle state (aria-checked)
// ---------------------------------------------------------------------------

describe('NotificationSettings - Toggle state', () => {
  it('sets aria-checked="false" when all preferences are off', () => {
    render(createElement(NotificationSettings, defaultProps()));

    const switches = screen.getAllByRole('switch');
    switches.forEach((sw) => {
      expect(sw.getAttribute('aria-checked')).toBe('false');
    });
  });

  it('sets aria-checked="true" on email toggle when emailNotifications is true', () => {
    render(createElement(NotificationSettings, defaultProps({ emailNotifications: true })));

    const toggle = screen.getByRole('switch', { name: /email notifications/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('sets aria-checked="true" on push toggle when pushNotifications is true', () => {
    render(createElement(NotificationSettings, defaultProps({ pushNotifications: true })));

    const toggle = screen.getByRole('switch', { name: /push notifications/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('sets aria-checked="true" on digest toggle when activityDigest is true', () => {
    render(createElement(NotificationSettings, defaultProps({ activityDigest: true })));

    const toggle = screen.getByRole('switch', { name: /activity digest/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('applies --active class when toggle is on', () => {
    render(createElement(NotificationSettings, defaultProps({ emailNotifications: true })));

    const toggle = screen.getByRole('switch', { name: /email notifications/i });
    expect(toggle.className).toContain('notification-settings__toggle--active');
  });

  it('does not apply --active class when toggle is off', () => {
    render(createElement(NotificationSettings, defaultProps({ emailNotifications: false })));

    const toggle = screen.getByRole('switch', { name: /email notifications/i });
    expect(toggle.className).not.toContain('notification-settings__toggle--active');
  });
});

// ---------------------------------------------------------------------------
// Tests: onChange callbacks
// ---------------------------------------------------------------------------

describe('NotificationSettings - onChange callbacks', () => {
  it('calls onChange with ("emailNotifications", true) when email toggle is clicked while off', () => {
    const onChange = vi.fn();
    render(createElement(NotificationSettings, defaultProps({ onChange, emailNotifications: false })));

    fireEvent.click(screen.getByRole('switch', { name: /email notifications/i }));
    expect(onChange).toHaveBeenCalledWith('emailNotifications', true);
  });

  it('calls onChange with ("emailNotifications", false) when email toggle is clicked while on', () => {
    const onChange = vi.fn();
    render(createElement(NotificationSettings, defaultProps({ onChange, emailNotifications: true })));

    fireEvent.click(screen.getByRole('switch', { name: /email notifications/i }));
    expect(onChange).toHaveBeenCalledWith('emailNotifications', false);
  });

  it('calls onChange with ("pushNotifications", true) when push toggle is clicked while off', () => {
    const onChange = vi.fn();
    render(createElement(NotificationSettings, defaultProps({ onChange, pushNotifications: false })));

    fireEvent.click(screen.getByRole('switch', { name: /push notifications/i }));
    expect(onChange).toHaveBeenCalledWith('pushNotifications', true);
  });

  it('calls onChange with ("pushNotifications", false) when push toggle is clicked while on', () => {
    const onChange = vi.fn();
    render(createElement(NotificationSettings, defaultProps({ onChange, pushNotifications: true })));

    fireEvent.click(screen.getByRole('switch', { name: /push notifications/i }));
    expect(onChange).toHaveBeenCalledWith('pushNotifications', false);
  });

  it('calls onChange with ("activityDigest", true) when digest toggle is clicked while off', () => {
    const onChange = vi.fn();
    render(createElement(NotificationSettings, defaultProps({ onChange, activityDigest: false })));

    fireEvent.click(screen.getByRole('switch', { name: /activity digest/i }));
    expect(onChange).toHaveBeenCalledWith('activityDigest', true);
  });

  it('calls onChange with ("activityDigest", false) when digest toggle is clicked while on', () => {
    const onChange = vi.fn();
    render(createElement(NotificationSettings, defaultProps({ onChange, activityDigest: true })));

    fireEvent.click(screen.getByRole('switch', { name: /activity digest/i }));
    expect(onChange).toHaveBeenCalledWith('activityDigest', false);
  });
});

// ---------------------------------------------------------------------------
// Tests: Saving state (disabled)
// ---------------------------------------------------------------------------

describe('NotificationSettings - Saving state', () => {
  it('disables all toggles when saving is true', () => {
    render(createElement(NotificationSettings, defaultProps({ saving: true })));

    const switches = screen.getAllByRole('switch');
    switches.forEach((sw) => {
      expect((sw as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('does not call onChange when a disabled toggle is clicked', () => {
    const onChange = vi.fn();
    render(createElement(NotificationSettings, defaultProps({ onChange, saving: true })));

    fireEvent.click(screen.getByRole('switch', { name: /email notifications/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('enables all toggles when saving is false', () => {
    render(createElement(NotificationSettings, defaultProps({ saving: false })));

    const switches = screen.getAllByRole('switch');
    switches.forEach((sw) => {
      expect((sw as HTMLButtonElement).disabled).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Error display
// ---------------------------------------------------------------------------

describe('NotificationSettings - Error display', () => {
  it('renders error message when error prop is provided', () => {
    render(createElement(NotificationSettings, defaultProps({ error: 'Failed to save preferences' })));

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('Failed to save preferences');
  });

  it('does not render error element when error is null', () => {
    render(createElement(NotificationSettings, defaultProps({ error: null })));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not render error element when error is undefined', () => {
    render(createElement(NotificationSettings, defaultProps({ error: undefined })));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('updates error message when error prop changes', () => {
    const { rerender } = render(
      createElement(NotificationSettings, defaultProps({ error: 'First error' }))
    );

    expect(screen.getByRole('alert').textContent).toContain('First error');

    rerender(createElement(NotificationSettings, defaultProps({ error: 'Second error' })));

    expect(screen.getByRole('alert').textContent).toContain('Second error');
  });
});
