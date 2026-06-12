import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuickActionsBar } from '../QuickActionsBar';

// Mock the CSS import
vi.mock('../../styles/quick-actions-bar.css', () => ({}));

describe('QuickActionsBar', () => {
  it('renders all four quick action buttons', () => {
    render(<QuickActionsBar onTabChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Record a Capture' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Quick Tap Capture' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'See Task Calendar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Update Roster' })).toBeDefined();
  });

  it('has toolbar role with accessible label', () => {
    render(<QuickActionsBar onTabChange={() => {}} />);

    expect(screen.getByRole('toolbar', { name: 'Quick actions' })).toBeDefined();
  });

  it('calls onTabChange with capture tab and voice mode when "Record a Capture" is clicked', () => {
    const onTabChange = vi.fn();
    render(<QuickActionsBar onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Record a Capture' }));

    expect(onTabChange).toHaveBeenCalledWith('capture', { mode: 'voice' });
  });

  it('calls onTabChange with capture tab and tap mode when "Quick Tap Capture" is clicked', () => {
    const onTabChange = vi.fn();
    render(<QuickActionsBar onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick Tap Capture' }));

    expect(onTabChange).toHaveBeenCalledWith('capture', { mode: 'tap' });
  });

  it('calls onTabChange with tasks tab and calendar view when "See Task Calendar" is clicked', () => {
    const onTabChange = vi.fn();
    render(<QuickActionsBar onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'See Task Calendar' }));

    expect(onTabChange).toHaveBeenCalledWith('tasks', { view: 'calendar' });
  });

  it('calls onTabChange with admin tab (no options) when "Update Roster" is clicked', () => {
    const onTabChange = vi.fn();
    render(<QuickActionsBar onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Update Roster' }));

    expect(onTabChange).toHaveBeenCalledWith('admin');
  });

  it('renders buttons with pill styling class', () => {
    render(<QuickActionsBar onTabChange={() => {}} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button.className).toContain('quick-actions-bar__pill');
    });
  });
});
