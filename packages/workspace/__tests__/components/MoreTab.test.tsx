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

// ---------------------------------------------------------------------------
// Tests: School name edit restricted to admin/principal roles (REQ-16)
// ---------------------------------------------------------------------------

describe('MoreTab - School name edit restriction (REQ-16)', () => {
  it('shows "Admin only" notice for non-admin/non-principal users', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'staff' })));

    const notice = screen.getByRole('note');
    expect(notice).toBeDefined();
    expect(notice.textContent).toContain('Admin only');
    expect(notice.textContent).toContain('only administrators or principals can change the school name');
  });

  it('disables the school name Edit button for staff role', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'staff' })));

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    const schoolEditBtn = editButtons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    expect(schoolEditBtn).toBeDefined();
    expect(schoolEditBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('disables the school name Edit button for teacher role', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'teacher' })));

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    const schoolEditBtn = editButtons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    expect(schoolEditBtn).toBeDefined();
    expect(schoolEditBtn!.hasAttribute('disabled')).toBe(true);
  });

  it('enables the school name Edit button for admin role', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'admin' })));

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    const schoolEditBtn = editButtons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    expect(schoolEditBtn).toBeDefined();
    expect(schoolEditBtn!.hasAttribute('disabled')).toBe(false);
  });

  it('enables the school name Edit button for principal role', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'principal' })));

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    const schoolEditBtn = editButtons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    expect(schoolEditBtn).toBeDefined();
    expect(schoolEditBtn!.hasAttribute('disabled')).toBe(false);
  });

  it('does not show "Admin only" notice for admin users', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'admin' })));

    const notice = screen.queryByRole('note');
    expect(notice).toBeNull();
  });

  it('does not show "Admin only" notice for principal users', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'principal' })));

    const notice = screen.queryByRole('note');
    expect(notice).toBeNull();
  });

  it('clicking Edit on school name as admin opens the editing input', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'admin' })));

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    const schoolEditBtn = editButtons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    fireEvent.click(schoolEditBtn!);

    const input = screen.getByLabelText('School name');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('Lincoln Elementary');
  });

  it('clicking Edit on school name as staff does NOT open the editing input', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'staff' })));

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    const schoolEditBtn = editButtons.find(
      (btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('school')
    );
    fireEvent.click(schoolEditBtn!);

    const input = screen.queryByLabelText('School name');
    expect(input).toBeNull();
  });

  it('has descriptive aria-label on disabled school Edit button', () => {
    render(createElement(MoreTab, defaultProps({ userRole: 'teacher' })));

    const editButtons = screen.getAllByRole('button', { name: /school/i });
    const schoolEditBtn = editButtons.find(
      (btn) => btn.getAttribute('aria-label')?.includes('restricted')
    );
    expect(schoolEditBtn).toBeDefined();
    expect(schoolEditBtn!.getAttribute('aria-label')).toContain('restricted to admin or principal');
  });
});

// ---------------------------------------------------------------------------
// Tests: Delete Account returns to auth screen (REQ-1)
// ---------------------------------------------------------------------------

describe('MoreTab - Delete Account flow (REQ-1)', () => {
  it('does not render Delete Account button when onDeleteAccount is not provided', () => {
    render(createElement(MoreTab, defaultProps()));

    const deleteBtn = screen.queryByRole('button', { name: /delete account/i });
    expect(deleteBtn).toBeNull();
  });

  it('renders Delete Account button when onDeleteAccount is provided', () => {
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);
    render(createElement(MoreTab, defaultProps({ onDeleteAccount })));

    const deleteBtn = screen.getByRole('button', { name: /delete account/i });
    expect(deleteBtn).toBeDefined();
  });

  it('clicking Delete Account shows confirmation dialog', () => {
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);
    render(createElement(MoreTab, defaultProps({ onDeleteAccount })));

    const deleteBtn = screen.getByRole('button', { name: /delete account/i });
    fireEvent.click(deleteBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.textContent).toContain('permanently delete your account');
    expect(dialog.textContent).toContain('cannot be undone');
  });

  it('Cancel in confirmation dialog closes it without calling onDeleteAccount', () => {
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);
    render(createElement(MoreTab, defaultProps({ onDeleteAccount })));

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByRole('dialog')).toBeDefined();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    // Dialog should be gone
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDeleteAccount).not.toHaveBeenCalled();
  });

  it('confirming deletion calls onDeleteAccount', async () => {
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);
    render(createElement(MoreTab, defaultProps({ onDeleteAccount })));

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /yes, delete my account/i });
    fireEvent.click(confirmBtn);

    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it('shows loading state while deletion is in progress', async () => {
    // Create a promise that we control to simulate async deletion
    let resolveDelete;
    const deletePromise = new Promise((resolve) => { resolveDelete = resolve; });
    const onDeleteAccount = vi.fn().mockReturnValue(deletePromise);
    render(createElement(MoreTab, defaultProps({ onDeleteAccount })));

    // Open dialog and confirm
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete my account/i }));

    // Should show loading text on both the button and confirm button
    const deletingElements = screen.getAllByText(/deleting.../i);
    expect(deletingElements.length).toBeGreaterThanOrEqual(1);

    // Resolve the promise
    resolveDelete();
  });

  it('shows error message when deletion fails', async () => {
    const onDeleteAccount = vi.fn().mockRejectedValue(new Error('Network error'));
    render(createElement(MoreTab, defaultProps({ onDeleteAccount })));

    // Open dialog and confirm
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete my account/i }));

    // Wait for the rejection to be handled
    await vi.waitFor(() => {
      const errorMsg = screen.getByRole('alert');
      expect(errorMsg.textContent).toContain('Network error');
    });
  });
});
