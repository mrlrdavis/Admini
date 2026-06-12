import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AchievementsModal } from '../AchievementsModal';
import type { Badge } from '../AchievementsModal';

// Mock the CSS import
vi.mock('../../styles/achievements-modal.css', () => ({}));

const mockBadges: Badge[] = [
  { id: 'first-task', icon: '\u2B50', label: 'First Step', description: 'Created your first task', earnedAt: '2024-01-15T10:00:00Z' },
  { id: 'five-tasks', icon: '\uD83C\uDF1F', label: 'Getting Going', description: 'Completed 5 tasks', earnedAt: '2024-02-20T14:30:00Z' },
  { id: 'ten-tasks', icon: '\uD83D\uDD25', label: 'On Fire', description: 'Completed 10 tasks' },
  { id: 'twenty-five', icon: '\uD83C\uDFC6', label: 'Champion', description: 'Completed 25 tasks' },
];

describe('AchievementsModal', () => {
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onClose = vi.fn();
    // Mock requestAnimationFrame for state transitions
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AchievementsModal isOpen={false} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when isOpen is true', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('displays the Achievements title', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    expect(screen.getByText('Achievements')).toBeDefined();
  });

  it('has aria-modal and aria-labelledby attributes', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('achievements-modal-title');
  });

  it('displays earned badges with icon, name, description, and date', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    expect(screen.getByText('First Step')).toBeDefined();
    expect(screen.getByText('Created your first task')).toBeDefined();
    expect(screen.getByText('Getting Going')).toBeDefined();
    expect(screen.getByText('Completed 5 tasks')).toBeDefined();
  });

  it('displays locked badges greyed out', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    expect(screen.getByText('On Fire')).toBeDefined();
    expect(screen.getByText('Champion')).toBeDefined();
    // Locked badges should have the locked class
    const onFireBadge = screen.getByText('On Fire').closest('.achievements-modal__badge');
    expect(onFireBadge?.className).toContain('achievements-modal__badge--locked');
  });

  it('displays gold progress bar with earned/total fraction', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    expect(screen.getByText('2 / 9')).toBeDefined();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeDefined();
    expect(progressBar.getAttribute('aria-valuenow')).toBe('2');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('9');
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    const closeButton = screen.getByLabelText('Close achievements modal');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking the backdrop (outside modal)', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when clicking inside the modal', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on ESC key press', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on admini:dismiss-modals custom event', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    window.dispatchEvent(new CustomEvent('admini:dismiss-modals'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('displays Earned and Locked section headings', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={9} />
    );
    expect(screen.getByText('Earned')).toBeDefined();
    expect(screen.getByText('Locked')).toBeDefined();
  });

  it('shows correct progress percentage width', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={mockBadges} totalBadges={4} />
    );
    // 2 earned out of 4 total = 50%
    const progressBar = screen.getByRole('progressbar');
    const fill = progressBar.querySelector('.achievements-modal__progress-fill') as HTMLElement;
    expect(fill?.style.width).toBe('50%');
  });

  it('handles zero totalBadges without division error', () => {
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={[]} totalBadges={0} />
    );
    const progressBar = screen.getByRole('progressbar');
    const fill = progressBar.querySelector('.achievements-modal__progress-fill') as HTMLElement;
    expect(fill?.style.width).toBe('0%');
  });

  it('does not show Earned section when no badges are earned', () => {
    const lockedOnly: Badge[] = [
      { id: 'a', icon: 'X', label: 'Test', description: 'Desc' },
    ];
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={lockedOnly} totalBadges={5} />
    );
    expect(screen.queryByText('Earned')).toBeNull();
    expect(screen.getByText('Locked')).toBeDefined();
  });

  it('does not show Locked section when all badges are earned', () => {
    const allEarned: Badge[] = [
      { id: 'a', icon: 'X', label: 'Test', description: 'Desc', earnedAt: '2024-01-01T00:00:00Z' },
    ];
    render(
      <AchievementsModal isOpen={true} onClose={onClose} badges={allEarned} totalBadges={1} />
    );
    expect(screen.getByText('Earned')).toBeDefined();
    expect(screen.queryByText('Locked')).toBeNull();
  });
});