import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BadgesSection } from './BadgesSection';

describe('BadgesSection', () => {
  it('renders nothing when completedCount is 0 and there is a next badge', () => {
    // With 0 completed, earnedBadges is empty but nextBadge exists (threshold 1)
    // The component should still render since nextBadge is defined
    const { container } = render(<BadgesSection completedCount={0} />);
    expect(container.querySelector('.badges-section')).not.toBeNull();
  });

  it('shows the Achievements heading', () => {
    render(<BadgesSection completedCount={1} />);
    expect(screen.getByText('Achievements')).toBeDefined();
  });

  it('shows only the first badge when completedCount is 1', () => {
    render(<BadgesSection completedCount={1} />);
    expect(screen.getByText('First Task')).toBeDefined();
    // Next badge should be "High Five" (threshold 5)
    expect(screen.getByText('High Five')).toBeDefined();
    expect(screen.getByText('1/5')).toBeDefined();
  });

  it('shows earned badges for completedCount of 5', () => {
    render(<BadgesSection completedCount={5} />);
    expect(screen.getByText('First Task')).toBeDefined();
    expect(screen.getByText('High Five')).toBeDefined();
    // Next badge should be "Momentum" (threshold 10)
    expect(screen.getByText('Momentum')).toBeDefined();
    expect(screen.getByText('5/10')).toBeDefined();
  });

  it('shows all badges as earned when completedCount is 50', () => {
    render(<BadgesSection completedCount={50} />);
    expect(screen.getByText('First Task')).toBeDefined();
    expect(screen.getByText('High Five')).toBeDefined();
    expect(screen.getByText('Momentum')).toBeDefined();
    expect(screen.getByText('Quarter Century')).toBeDefined();
    expect(screen.getByText('Unstoppable')).toBeDefined();
  });

  it('shows locked next badge with progress indicator', () => {
    render(<BadgesSection completedCount={3} />);
    expect(screen.getByText('3/5')).toBeDefined();
  });

  it('does not show a locked badge when all badges are earned', () => {
    const { container } = render(<BadgesSection completedCount={100} />);
    const locked = container.querySelectorAll('.badges-section__badge--locked');
    expect(locked.length).toBe(0);
  });

  it('renders earned badges with the --earned modifier class', () => {
    const { container } = render(<BadgesSection completedCount={1} />);
    const earned = container.querySelectorAll('.badges-section__badge--earned');
    expect(earned.length).toBe(1);
  });

  it('renders locked badge with the --locked modifier class', () => {
    const { container } = render(<BadgesSection completedCount={1} />);
    const locked = container.querySelectorAll('.badges-section__badge--locked');
    expect(locked.length).toBe(1);
  });

  it('renders correct number of earned badges at threshold 25', () => {
    const { container } = render(<BadgesSection completedCount={25} />);
    const earned = container.querySelectorAll('.badges-section__badge--earned');
    // First Task (1), High Five (5), Momentum (10), Quarter Century (25)
    expect(earned.length).toBe(4);
  });

  it('renders the section when all badges are earned', () => {
    const { container } = render(<BadgesSection completedCount={50} />);
    expect(container.querySelector('.badges-section')).not.toBeNull();
  });
});
