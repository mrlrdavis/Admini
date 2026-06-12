// ---------------------------------------------------------------------------
// LevelBadge - Clickable badge element displaying level and badge count
// ---------------------------------------------------------------------------
// Pure presentational component. Triggers AchievementsModal on click.
// Requirements: 3.1

import '../styles/level-badge.css';

export interface LevelBadgeProps {
  level: number;
  badgeCount: number;
  onClick: () => void;
}

/**
 * LevelBadge displays the user's gamification level and badge count.
 * Clicking it opens the AchievementsModal.
 */
export function LevelBadge({ level, badgeCount, onClick }: LevelBadgeProps) {
  return (
    <button
      type="button"
      className="level-badge"
      onClick={onClick}
      aria-label={`Level ${level}, ${badgeCount} badges`}
    >
      <span className="level-badge__level">Level {level}</span>
      <span className="level-badge__count">{badgeCount} badges</span>
    </button>
  );
}
