import { readFileSync, writeFileSync } from 'fs';

const file = 'packages/workspace/src/components/DashboardTab.tsx';
let content = readFileSync(file, 'utf8');

// 1. Replace topbar: remove quick actions, add trophy icon
const oldTopbar = `      {/* Top Bar */}
      <header className="dashboard-tab__topbar">
        <h1 className="dashboard-tab__greeting-text">{getTimeGreeting()}, <strong>{userName}</strong></h1>
        <div className="dashboard-tab__quick-actions-bar">
          <span className="dashboard-tab__qa-label">QUICK ACTIONS</span>
          <button type="button" className="dashboard-tab__qa-pill" onClick={() => onTabChange?.('capture')}>\u{1F3A4} Record a Capture</button>
          <button type="button" className="dashboard-tab__qa-pill" onClick={() => { localStorage.setItem('admini_capture_mode', 'tap'); onTabChange?.('capture'); }}>\u{1F446} Quick Tap Capture</button>
          <button type="button" className="dashboard-tab__qa-pill" onClick={() => { localStorage.setItem('admini_tasks_view', 'calendar'); onTabChange?.('tasks'); }}>\u{1F4C5} See Task Calendar</button>
          <button type="button" className="dashboard-tab__qa-pill" onClick={() => onTabChange?.('admin')}>\u{1F4CB} Update Roster</button>
        </div>
        <div className="dashboard-tab__level-badge" onClick={() => setShowAchievements(true)}>
          <span className="dashboard-tab__level-num">Level {Math.floor(unlockedCount / 2) + 1}</span>
          <span className="dashboard-tab__level-sub">{unlockedCount}/{totalBadges} badges</span>
        </div>
      </header>`;

const newTopbar = `      {/* Top Bar */}
      <header className="dashboard-tab__topbar">
        <h1 className="dashboard-tab__greeting-text">{getTimeGreeting()}, <strong>{userName}</strong></h1>
        <div className="dashboard-tab__level-badge" onClick={() => setShowAchievements(true)}>
          <span className="dashboard-tab__level-icon">\u{1F3C6}</span>
          <span className="dashboard-tab__level-num">Level {Math.floor(unlockedCount / 2) + 1}</span>
          <span className="dashboard-tab__level-sub">{unlockedCount}/{totalBadges} badges</span>
        </div>
      </header>`;

if (content.includes(oldTopbar)) {
  content = content.replace(oldTopbar, newTopbar);
  console.log('1. Topbar updated');
} else {
  console.log('1. FAIL Topbar not found');
}

writeFileSync(file, content, 'utf8');
console.log('Saved after step 1');
