import { useMemo } from 'react';

interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  threshold: number;
}

const BADGES: Badge[] = [
  { id: 'first-task', emoji: '\u2B50', label: 'First Task', description: 'Complete your first task', threshold: 1 },
  { id: 'high-five', emoji: '\uD83D\uDD25', label: 'High Five', description: 'Complete 5 tasks', threshold: 5 },
  { id: 'ten-streak', emoji: '\uD83D\uDCAA', label: 'Momentum', description: 'Complete 10 tasks', threshold: 10 },
  { id: 'quarter-century', emoji: '\uD83C\uDFC6', label: 'Quarter Century', description: 'Complete 25 tasks', threshold: 25 },
  { id: 'half-century', emoji: '\uD83D\uDE80', label: 'Unstoppable', description: 'Complete 50 tasks', threshold: 50 },
];

export interface BadgesSectionProps {
  completedCount: number;
}

export function BadgesSection({ completedCount }: BadgesSectionProps) {
  const earnedBadges = useMemo(
    () => BADGES.filter(b => completedCount >= b.threshold),
    [completedCount]
  );

  const nextBadge = BADGES.find(b => completedCount < b.threshold);

  if (earnedBadges.length === 0 && !nextBadge) return null;

  return (
    <section className="badges-section">
      <h3 className="badges-section__title">Achievements</h3>
      <div className="badges-section__grid">
        {earnedBadges.map(badge => (
          <div key={badge.id} className="badges-section__badge badges-section__badge--earned">
            <span className="badges-section__emoji">{badge.emoji}</span>
            <span className="badges-section__label">{badge.label}</span>
          </div>
        ))}
        {nextBadge && (
          <div className="badges-section__badge badges-section__badge--locked">
            <span className="badges-section__emoji">🔒</span>
            <span className="badges-section__label">{nextBadge.label}</span>
            <span className="badges-section__progress">{completedCount}/{nextBadge.threshold}</span>
          </div>
        )}
      </div>
    </section>
  );
}
