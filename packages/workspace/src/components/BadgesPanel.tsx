import { useState, useEffect } from 'react';

interface Badge {
  id: string;
  emoji: string;
  label: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
}

const BADGE_DEFINITIONS: Omit<Badge, 'unlocked' | 'unlockedAt'>[] = [
  { id: 'first-task', emoji: '\u2B50', label: 'First Step', description: 'Created your first task' },
  { id: 'five-tasks', emoji: '\uD83C\uDF1F', label: 'Getting Going', description: 'Completed 5 tasks' },
  { id: 'ten-tasks', emoji: '\uD83D\uDD25', label: 'On Fire', description: 'Completed 10 tasks' },
  { id: 'twenty-five', emoji: '\uD83C\uDFC6', label: 'Champion', description: 'Completed 25 tasks' },
  { id: 'first-capture', emoji: '\uD83D\uDCF8', label: 'Observer', description: 'Saved your first capture' },
  { id: 'first-note', emoji: '\uD83D\uDCDD', label: 'Note Taker', description: 'Created your first meeting note' },
  { id: 'streak-3', emoji: '\u26A1', label: '3-Day Streak', description: 'Used AdminI 3 days in a row' },
  { id: 'streak-7', emoji: '\uD83D\uDCAA', label: 'Week Warrior', description: 'Used AdminI 7 days in a row' },
];

function loadUnlockedBadges(): Record<string, string> {
  try {
    const raw = localStorage.getItem('admini_badges');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveBadge(badgeId: string) {
  const badges = loadUnlockedBadges();
  if (!badges[badgeId]) {
    badges[badgeId] = new Date().toISOString();
    localStorage.setItem('admini_badges', JSON.stringify(badges));
  }
}

export function unlockBadge(badgeId: string): boolean {
  const badges = loadUnlockedBadges();
  if (badges[badgeId]) return false; // Already unlocked
  saveBadge(badgeId);
  return true; // Newly unlocked
}

export function BadgesPanel() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  useEffect(() => {
    // Track daily usage for streaks
    try {
      const today = new Date().toISOString().split('T')[0] ?? '';
      const streakRaw = localStorage.getItem('admini_streak_days');
      const days: string[] = streakRaw ? JSON.parse(streakRaw) : [];
      if (!days.includes(today)) {
        days.push(today);
        // Keep only last 30 days
        const recent = days.slice(-30);
        localStorage.setItem('admini_streak_days', JSON.stringify(recent));
      }
      // Check consecutive days from today backwards
      let streak = 0;
      const sorted = days.sort().reverse();
      for (let i = 0; i < sorted.length; i++) {
        const expected = new Date();
        expected.setDate(expected.getDate() - i);
        if (sorted[i] === (expected.toISOString().split('T')[0] ?? '')) {
          streak++;
        } else break;
      }
      if (streak >= 3) unlockBadge('streak-3');
      if (streak >= 7) unlockBadge('streak-7');
    } catch {}

    const unlocked = loadUnlockedBadges();
    setBadges(BADGE_DEFINITIONS.map(def => ({
      ...def,
      unlocked: !!unlocked[def.id],
      unlockedAt: unlocked[def.id] || undefined,
    })));
  }, []);

  const unlockedCount = badges.filter(b => b.unlocked).length;

  return (
    <div className="badges-panel">
      <div className="badges-panel__header">
        <h3 className="badges-panel__title">Achievements</h3>
        <span className="badges-panel__count">{unlockedCount}/{badges.length}</span>
      </div>
      <div className="badges-panel__grid">
        {badges.map(badge => (
          <div
            key={badge.id}
            className={'badges-panel__badge' + (badge.unlocked ? ' badges-panel__badge--unlocked' : '')}
            onMouseEnter={() => setHoveredBadge(badge.id)}
            onMouseLeave={() => setHoveredBadge(null)}
            onClick={() => setHoveredBadge(hoveredBadge === badge.id ? null : badge.id)}
          >
            <span className="badges-panel__emoji">{badge.emoji}</span>
            <span className="badges-panel__label">{badge.label}</span>
            {badge.unlocked && <span className="badges-panel__check">{'\u2713'}</span>}
            <button type="button" className="badges-panel__info-icon" aria-label={'Info about ' + badge.label} onClick={(e) => { e.stopPropagation(); setHoveredBadge(hoveredBadge === badge.id ? null : badge.id); }}>
              {'\u24D8'}
            </button>
            {hoveredBadge === badge.id && (
              <div className="badges-panel__tooltip">
                <span className="badges-panel__tooltip-text">{badge.description}</span>
                {badge.unlockedAt && <span className="badges-panel__tooltip-date">Unlocked {new Date(badge.unlockedAt).toLocaleDateString()}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}