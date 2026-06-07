import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { MoreTab, type MoreTabProps } from '../../src/components/MoreTab';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides?: Partial<MoreTabProps>): MoreTabProps {
  return {
    onSignOut: vi.fn(),
    userRole: 'staff',
    userName: 'Jane Doe',
    schoolName: 'Lincoln Elementary',
    email: 'jane@example.com',
    ...overrides,
  };
}

function clickProfileSettingsButton() {
  const settingsSection = screen.getByRole('heading', { name: /^Settings$/i, level: 2 }).closest('section');
  const profileBtn = Array.from(settingsSection!.querySelectorAll('button')).find(
    (btn) => btn.textContent?.includes('Profile')
  );
  fireEvent.click(profileBtn!);
}

// ---------------------------------------------------------------------------
// Tests: Profile button navigation (Task 11 - REQ-5, REQ-16)
// ---------------------------------------------------------------------------

describe('MoreTab - Profile button navigation', () => {
  it('renders a Profile button in the Settings section', () => {
    render(createElement(MoreTab, defaultProps()));

    const settingsSection = screen.getByRole('heading', { name: /^Settings$/i, level: 2 }).closest('section');
    expect(settingsSection).toBeDefined();

    const profileBtn = Array.from(settingsSection!.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Profile')
    );
    expect(profileBtn).toBeDefined();
  });

  it('clicking Profile button in Settings navigates to profile sub-view', () => {
    render(createElement(MoreTab, defaultProps()));

    clickProfileSettingsButton();

    // Should show the profile sub-view with "Edit Profile" heading
    const editProfileHeading = screen.getByText('Edit Profile');
    expect(editProfileHeading).toBeDefined();
  });

  it('profile sub-view shows a Back button', () => {
    render(createElement(MoreTab, defaultProps()));

    clickProfileSettingsButton();

    // Should have a back button
    const backBtn = screen.getByRole('button', { name: /back to settings menu/i });
    expect(backBtn).toBeDefined();
  });

  it('clicking Back button returns to the main settings menu', () => {
    render(createElement(MoreTab, defaultProps()));

    clickProfileSettingsButton();

    // Verify we're in the profile view
    expect(screen.getByText('Edit Profile')).toBeDefined();

    // Click back
    const backBtn = screen.getByRole('button', { name: /back to settings menu/i });
    fireEvent.click(backBtn);

    // Should be back on the main menu (Settings heading visible as h1)
    const mainTitle = screen.getByRole('heading', { level: 1 });
    expect(mainTitle.textContent).toBe('Settings');
  });

  it('profile sub-view shows profile fields (display name, school, email, role)', () => {
    render(createElement(MoreTab, defaultProps({ userName: 'Jane Doe', schoolName: 'Lincoln Elementary', email: 'jane@example.com', userRole: 'staff' })));

    clickProfileSettingsButton();

    // Verify profile fields are shown
    expect(screen.getByText('Jane Doe')).toBeDefined();
    expect(screen.getByText('Lincoln Elementary')).toBeDefined();
    expect(screen.getByText('jane@example.com')).toBeDefined();
    expect(screen.getByText('staff')).toBeDefined();
  });

  it('profile sub-view has title "Profile" as h1', () => {
    render(createElement(MoreTab, defaultProps()));

    clickProfileSettingsButton();

    const title = screen.getByRole('heading', { level: 1 });
    expect(title.textContent).toBe('Profile');
  });

  it('main menu still shows existing Profile section with inline editing', () => {
    render(createElement(MoreTab, defaultProps()));

    // The main menu should still have both the Profile section (inline editing)
    // AND the Profile button in Settings for navigation
    const profileSectionHeading = screen.getByRole('heading', { name: /^Profile$/i, level: 2 });
    expect(profileSectionHeading).toBeDefined();

    // And the Settings section with Profile button
    const settingsHeading = screen.getByRole('heading', { name: /^Settings$/i, level: 2 });
    expect(settingsHeading).toBeDefined();
  });
});
