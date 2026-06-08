import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgesPanel, unlockBadge } from './BadgesPanel';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('unlockBadge', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns true when unlocking a badge for the first time', () => {
    const result = unlockBadge('first-task');
    expect(result).toBe(true);
  });

  it('returns false when badge is already unlocked', () => {
    // Pre-seed localStorage
    localStorageMock.setItem(
      'admini_badges',
      JSON.stringify({ 'first-task': '2025-01-01T00:00:00.000Z' })
    );

    const result = unlockBadge('first-task');
    expect(result).toBe(false);
  });

  it('persists the badge to localStorage', () => {
    unlockBadge('five-tasks');

    const stored = JSON.parse(localStorageMock.getItem('admini_badges')!);
    expect(stored['five-tasks']).toBeDefined();
    expect(new Date(stored['five-tasks']).toISOString()).toBe(stored['five-tasks']);
  });

  it('does not overwrite existing badges when unlocking a new one', () => {
    localStorageMock.setItem(
      'admini_badges',
      JSON.stringify({ 'first-task': '2025-01-01T00:00:00.000Z' })
    );

    unlockBadge('five-tasks');

    const stored = JSON.parse(localStorageMock.getItem('admini_badges')!);
    expect(stored['first-task']).toBe('2025-01-01T00:00:00.000Z');
    expect(stored['five-tasks']).toBeDefined();
  });
});

describe('BadgesPanel', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders all 8 badge definitions', () => {
    render(<BadgesPanel />);

    expect(screen.getByText('First Step')).toBeDefined();
    expect(screen.getByText('Getting Going')).toBeDefined();
    expect(screen.getByText('On Fire')).toBeDefined();
    expect(screen.getByText('Champion')).toBeDefined();
    expect(screen.getByText('Observer')).toBeDefined();
    expect(screen.getByText('Note Taker')).toBeDefined();
    expect(screen.getByText('3-Day Streak')).toBeDefined();
    expect(screen.getByText('Week Warrior')).toBeDefined();
  });

  it('shows 0/8 count when no badges are unlocked', () => {
    render(<BadgesPanel />);
    expect(screen.getByText('0/8')).toBeDefined();
  });

  it('shows correct count when some badges are unlocked', () => {
    localStorageMock.setItem(
      'admini_badges',
      JSON.stringify({
        'first-task': '2025-01-01T00:00:00.000Z',
        'five-tasks': '2025-01-02T00:00:00.000Z',
      })
    );

    render(<BadgesPanel />);
    expect(screen.getByText('2/8')).toBeDefined();
  });

  it('applies unlocked class to unlocked badges', () => {
    localStorageMock.setItem(
      'admini_badges',
      JSON.stringify({ 'first-task': '2025-01-01T00:00:00.000Z' })
    );

    render(<BadgesPanel />);

    const badgeElements = document.querySelectorAll('.badges-panel__badge');
    const firstBadge = Array.from(badgeElements).find(el =>
      el.querySelector('.badges-panel__label')?.textContent === 'First Step'
    );

    expect(firstBadge?.classList.contains('badges-panel__badge--unlocked')).toBe(true);
  });

  it('shows checkmark only for unlocked badges', () => {
    localStorageMock.setItem(
      'admini_badges',
      JSON.stringify({ 'first-task': '2025-01-01T00:00:00.000Z' })
    );

    render(<BadgesPanel />);

    const checks = document.querySelectorAll('.badges-panel__check');
    expect(checks.length).toBe(1);
    expect(checks[0].textContent).toBe('\u2713');
  });

  it('renders the Achievements title', () => {
    render(<BadgesPanel />);
    expect(screen.getByText('Achievements')).toBeDefined();
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorageMock.setItem('admini_badges', 'not valid json{{{');

    // Should not throw
    render(<BadgesPanel />);
    expect(screen.getByText('0/8')).toBeDefined();
  });
});
