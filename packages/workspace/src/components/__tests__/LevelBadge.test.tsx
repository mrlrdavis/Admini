import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LevelBadge } from '../LevelBadge';

// Mock the CSS import
vi.mock('../../styles/level-badge.css', () => ({}));

describe('LevelBadge', () => {
  it('renders level number', () => {
    render(<LevelBadge level={3} badgeCount={5} onClick={() => {}} />);
    expect(screen.getByText('Level 3')).toBeDefined();
  });

  it('renders badge count', () => {
    render(<LevelBadge level={2} badgeCount={7} onClick={() => {}} />);
    expect(screen.getByText('7 badges')).toBeDefined();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<LevelBadge level={1} badgeCount={3} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as a button element for accessibility', () => {
    render(<LevelBadge level={1} badgeCount={2} onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toBeDefined();
    expect(button.tagName).toBe('BUTTON');
  });

  it('has an accessible aria-label with level and badge count', () => {
    render(<LevelBadge level={4} badgeCount={10} onClick={() => {}} />);
    const button = screen.getByRole('button', { name: /Level 4, 10 badges/i });
    expect(button).toBeDefined();
  });

  it('applies the level-badge class', () => {
    render(<LevelBadge level={1} badgeCount={1} onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('level-badge');
  });

  it('displays correct values for zero badges', () => {
    render(<LevelBadge level={1} badgeCount={0} onClick={() => {}} />);
    expect(screen.getByText('Level 1')).toBeDefined();
    expect(screen.getByText('0 badges')).toBeDefined();
  });

  it('has type="button" to prevent form submission', () => {
    render(<LevelBadge level={1} badgeCount={1} onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.getAttribute('type')).toBe('button');
  });
});
