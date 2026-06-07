import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';
import { ProfileSettings, type ProfileSettingsProps } from '../../src/components/ProfileSettings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides?: Partial<ProfileSettingsProps>): ProfileSettingsProps {
  return {
    userName: 'Jane Doe',
    schoolName: 'Lincoln Elementary',
    email: 'jane@example.com',
    userRole: 'staff',
    onSave: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: Display Name field
// ---------------------------------------------------------------------------

describe('ProfileSettings - Display Name', () => {
  it('renders current display name value', () => {
    render(createElement(ProfileSettings, defaultProps()));
    expect(screen.getByText('Jane Doe')).toBeDefined();
  });

  it('shows "Not provided" when userName is undefined', () => {
    render(createElement(ProfileSettings, defaultProps({ userName: undefined })));
    const values = screen.getAllByText('Not provided');
    expect(values.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Edit button for display name', () => {
    render(createElement(ProfileSettings, defaultProps()));
    const editBtn = screen.getByRole('button', { name: 'Edit display name' });
    expect(editBtn).toBeDefined();
  });

  it('clicking Edit opens inline input with current value pre-filled', () => {
    render(createElement(ProfileSettings, defaultProps()));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('Jane Doe');
  });

  it('shows Save and Cancel buttons when editing', () => {
    render(createElement(ProfileSettings, defaultProps()));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    expect(screen.getByText('Save')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('Cancel button closes the editing input', () => {
    render(createElement(ProfileSettings, defaultProps()));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByLabelText('Display name')).toBeNull();
    expect(screen.getByText('Jane Doe')).toBeDefined();
  });

  it('shows validation error for empty display name', () => {
    render(createElement(ProfileSettings, defaultProps()));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(screen.getByRole('alert').textContent).toContain('Display name cannot be empty');
  });

  it('calls onSave with field and value on Save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(createElement(ProfileSettings, defaultProps({ onSave })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ field: 'display-name', value: 'New Name' });
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Email field (read-only)
// ---------------------------------------------------------------------------

describe('ProfileSettings - Email (read-only)', () => {
  it('renders current email value', () => {
    render(createElement(ProfileSettings, defaultProps()));
    expect(screen.getByText('jane@example.com')).toBeDefined();
  });

  it('does not render an Edit button for email', () => {
    render(createElement(ProfileSettings, defaultProps()));
    const buttons = screen.getAllByRole('button');
    const emailEditBtn = buttons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('email')
    );
    expect(emailEditBtn).toBeUndefined();
  });

  it('shows "Not provided" when email is undefined', () => {
    render(createElement(ProfileSettings, defaultProps({ email: undefined })));
    const values = screen.getAllByText('Not provided');
    expect(values.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: School Name field (admin-only editing)
// ---------------------------------------------------------------------------

describe('ProfileSettings - School Name (admin-only)', () => {
  it('renders current school name value', () => {
    render(createElement(ProfileSettings, defaultProps()));
    expect(screen.getByText('Lincoln Elementary')).toBeDefined();
  });

  it('disables school Edit button for non-admin roles', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'staff' })));
    const buttons = screen.getAllByRole('button');
    const schoolBtn = buttons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    expect(schoolBtn).toBeDefined();
    expect(schoolBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('shows "Admin only" notice for non-admin users', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'staff' })));
    const notice = screen.getByRole('note');
    expect(notice).toBeDefined();
    expect(notice.textContent).toContain('Admin only');
  });

  it('enables school Edit button for admin role', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'admin' })));
    const buttons = screen.getAllByRole('button');
    const schoolBtn = buttons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    expect(schoolBtn).toBeDefined();
    expect(schoolBtn!.hasAttribute('disabled')).toBe(false);
  });

  it('enables school Edit button for principal role', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'principal' })));
    const buttons = screen.getAllByRole('button');
    const schoolBtn = buttons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    expect(schoolBtn).toBeDefined();
    expect(schoolBtn!.hasAttribute('disabled')).toBe(false);
  });

  it('does not show "Admin only" notice for admin users', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'admin' })));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('clicking Edit as admin opens inline input with school name pre-filled', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'admin' })));
    const buttons = screen.getAllByRole('button');
    const schoolBtn = buttons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    fireEvent.click(schoolBtn!);

    const input = screen.getByLabelText('School name') as HTMLInputElement;
    expect(input.value).toBe('Lincoln Elementary');
  });

  it('clicking Edit as staff does NOT open the editing input', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'staff' })));
    const buttons = screen.getAllByRole('button');
    const schoolBtn = buttons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    fireEvent.click(schoolBtn!);
    expect(screen.queryByLabelText('School name')).toBeNull();
  });

  it('has descriptive aria-label on disabled school Edit button', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'teacher' })));
    const buttons = screen.getAllByRole('button');
    const schoolBtn = buttons.find(
      (btn) => btn.getAttribute('aria-label')?.includes('restricted')
    );
    expect(schoolBtn).toBeDefined();
    expect(schoolBtn!.getAttribute('aria-label')).toContain('restricted to admin or principal');
  });
});

// ---------------------------------------------------------------------------
// Tests: Role field (read-only)
// ---------------------------------------------------------------------------

describe('ProfileSettings - Role (read-only)', () => {
  it('renders current role value', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'staff' })));
    expect(screen.getByText('staff')).toBeDefined();
  });

  it('shows "Not provided" when role is undefined', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: undefined })));
    const values = screen.getAllByText('Not provided');
    expect(values.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: Saving state and error handling
// ---------------------------------------------------------------------------

describe('ProfileSettings - Saving and error states', () => {
  it('disables input and Save button when external saving prop is true', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'admin', saving: true })));
    // Open editing
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('shows error when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network failure'));
    render(createElement(ProfileSettings, defaultProps({ onSave })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Network failure');
    });
  });

  it('closes editing input after successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(createElement(ProfileSettings, defaultProps({ onSave })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.queryByLabelText('Display name')).toBeNull();
    });
  });

  it('shows "Saving..." text on Save button during async save', async () => {
    let resolveSave: () => void;
    const onSave = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveSave = resolve; })
    );
    render(createElement(ProfileSettings, defaultProps({ onSave })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByText('Save'));

    // While the save is in flight, button should show "Saving..."
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeDefined();
    });

    // Save button should be disabled during save
    const saveBtn = screen.getByText('Saving...').closest('button')!;
    expect(saveBtn.disabled).toBe(true);

    // Resolve the save to clean up
    resolveSave!();
    await waitFor(() => {
      expect(screen.queryByText('Saving...')).toBeNull();
    });
  });

  it('disables Save button when input is whitespace-only', () => {
    render(createElement(ProfileSettings, defaultProps()));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn.hasAttribute('disabled')).toBe(true);
  });

  it('shows inline validation error when saving empty school name', () => {
    render(createElement(ProfileSettings, defaultProps({ userRole: 'admin' })));
    const schoolEditBtn = screen.getAllByRole('button').find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('edit school')
    );
    fireEvent.click(schoolEditBtn!);

    const input = screen.getByLabelText('School name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(screen.getByRole('alert').textContent).toContain('School name cannot be empty');
  });

  it('clears validation error when user types valid input', () => {
    render(createElement(ProfileSettings, defaultProps()));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    // Trigger error by clearing input and blurring
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toBeDefined();

    // Type valid content - error should clear
    fireEvent.change(input, { target: { value: 'Valid Name' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Cancel button clears both editing state and validation error', () => {
    render(createElement(ProfileSettings, defaultProps()));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    // Produce a validation error
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toBeDefined();

    // Click cancel
    fireEvent.click(screen.getByText('Cancel'));

    // Should return to view mode with no error
    expect(screen.queryByLabelText('Display name')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Jane Doe')).toBeDefined();
  });

  it('does not call onSave when Save is clicked with empty input', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(createElement(ProfileSettings, defaultProps({ onSave })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    // Save button should be disabled, verify onSave is not called
    fireEvent.blur(input);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn.hasAttribute('disabled')).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Pre-fill fields from server profile data (REQ-5, REQ-11)
// Validates that ProfileSettings displays all fields with server-sourced data
// ---------------------------------------------------------------------------

describe('ProfileSettings - Pre-fill from server profile data', () => {
  it('renders all profile fields pre-filled with server data', () => {
    render(
      createElement(ProfileSettings, {
        userName: 'Dr. Smith',
        schoolName: 'Westfield Academy',
        email: 'smith@westfield.edu',
        userRole: 'principal',
        onSave: vi.fn(),
      })
    );

    expect(screen.getByText('Dr. Smith')).toBeDefined();
    expect(screen.getByText('Westfield Academy')).toBeDefined();
    expect(screen.getByText('smith@westfield.edu')).toBeDefined();
    expect(screen.getByText('principal')).toBeDefined();
  });

  it('pre-fills display name input with server value when Edit is clicked', () => {
    render(
      createElement(ProfileSettings, {
        userName: 'Server Display Name',
        schoolName: 'Server School',
        email: 'user@school.org',
        userRole: 'admin',
        onSave: vi.fn(),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));
    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    expect(input.value).toBe('Server Display Name');
  });

  it('pre-fills school name input with server value when admin clicks Edit', () => {
    render(
      createElement(ProfileSettings, {
        userName: 'Admin User',
        schoolName: 'Server School Name',
        email: 'admin@school.org',
        userRole: 'admin',
        onSave: vi.fn(),
      })
    );

    const schoolEditBtn = screen.getAllByRole('button').find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('edit school')
    );
    fireEvent.click(schoolEditBtn!);
    const input = screen.getByLabelText('School name') as HTMLInputElement;
    expect(input.value).toBe('Server School Name');
  });
});

// ---------------------------------------------------------------------------
// Tests: Success feedback after save (REQ-5, Task 11)
// ---------------------------------------------------------------------------

describe('ProfileSettings - Success feedback after save', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "? Updated" message after successful display name save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(createElement(ProfileSettings, defaultProps({ onSave })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByRole('status').textContent).toContain('Updated');
  });

  it('shows "? Updated" message after successful school name save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(createElement(ProfileSettings, defaultProps({ onSave, userRole: 'admin' })));

    const schoolEditBtn = screen.getAllByRole('button').find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('edit school')
    );
    fireEvent.click(schoolEditBtn!);

    const input = screen.getByLabelText('School name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New School' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByRole('status').textContent).toContain('Updated');
  });

  it('success message has role="status" for accessibility', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(createElement(ProfileSettings, defaultProps({ onSave })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Accessible Name' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
      await vi.advanceTimersByTimeAsync(100);
    });

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeDefined();
    expect(statusEl.textContent).toContain('Updated');
  });

  it('success message auto-dismisses after ~2.5 seconds', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(createElement(ProfileSettings, defaultProps({ onSave })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Temp Name' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
      await vi.advanceTimersByTimeAsync(100);
    });

    // Toast should be visible
    expect(screen.getByRole('status')).toBeDefined();

    // Advance past the 2.5s auto-dismiss timeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Toast should be gone
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not show success message when save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
    render(createElement(ProfileSettings, defaultProps({ onSave })));
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));

    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Fail Name' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByRole('alert').textContent).toContain('Save failed');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('starting a new edit clears the previous success message', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(createElement(ProfileSettings, defaultProps({ onSave })));

    // First save
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));
    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'First Save' } });

    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByRole('status')).toBeDefined();

    // Start editing again - success message should clear
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
