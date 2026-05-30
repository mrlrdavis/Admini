/* app.js — AdminI Desktop App */
(function () {
  'use strict';

  /* ============================================
     THEME TOGGLE
     ============================================ */
  const root = document.documentElement;
  let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);

  const themeToggle = document.querySelector('[data-theme-toggle]');
  function updateThemeIcon() {
    if (!themeToggle) return;
    themeToggle.innerHTML = theme === 'dark'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      updateThemeIcon();
      updateThemeButtons();
    });
  }
  updateThemeIcon();

  function updateThemeButtons() {
    const lb = document.getElementById('themeLightBtn');
    const db = document.getElementById('themeDarkBtn');
    if (lb && db) {
      if (theme === 'light') {
        lb.className = 'btn btn-sm btn-secondary';
        db.className = 'btn btn-sm btn-ghost';
      } else {
        lb.className = 'btn btn-sm btn-ghost';
        db.className = 'btn btn-sm btn-secondary';
      }
    }
  }

  const tl = document.getElementById('themeLightBtn');
  const td = document.getElementById('themeDarkBtn');
  if (tl) tl.addEventListener('click', () => { theme = 'light'; root.setAttribute('data-theme', theme); updateThemeIcon(); updateThemeButtons(); });
  if (td) td.addEventListener('click', () => { theme = 'dark'; root.setAttribute('data-theme', theme); updateThemeIcon(); updateThemeButtons(); });
  updateThemeButtons();

  /* ============================================
     SIDEBAR COLLAPSE
     ============================================ */
  const app = document.getElementById('app');
  const collapseBtn = document.getElementById('collapseBtn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      app.classList.toggle('sidebar-collapsed');
    });
  }

  /* ============================================
     TOGGLE SWITCHES
     ============================================ */
  document.querySelectorAll('.toggle-switch').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('on');
    });
  });

  /* ============================================
     NAV ROUTING
     ============================================ */
  const viewTitles = {
    dashboard: 'School at a Glance',
    tasks: 'Tasks',
    capture: 'Capture',
    pulse: 'Pulse',
    observations: 'Observations & Walkthroughs',
    integrations: 'Integrations',
    settings: 'Settings'
  };

  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');
  const headerTitle = document.getElementById('headerTitle');

  function navigateTo(viewId) {
    views.forEach(v => v.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    const target = document.getElementById('view-' + viewId);
    const nav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
    if (target) {
      target.classList.add('active');
      target.style.animation = 'none';
      target.offsetHeight; // reflow
      target.style.animation = '';
    }
    if (nav) nav.classList.add('active');
    if (headerTitle) headerTitle.textContent = viewTitles[viewId] || viewId;
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.view);
    });
  });

  /* ============================================
     ANIMATED NUMBER COUNTER
     ============================================ */
  function animateValue(el, start, end, duration, suffix) {
    suffix = suffix || '';
    const range = end - start;
    const startTime = performance.now();
    const isFloat = String(end).includes('.');

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + range * eased;
      el.textContent = (isFloat ? current.toFixed(1) : Math.round(current)) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ============================================
     SPARKLINE SVG GENERATOR
     ============================================ */
  function sparklineSVG(data) {
    const w = 64, h = 24, pad = 2;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(' ');
    return `<svg class="sparkline" viewBox="0 0 ${w} ${h}"><polyline points="${points}"/></svg>`;
  }

  /* ============================================
     SAMPLE DATA
     ============================================ */

  // KPIs
  const kpis = [
    { label: 'Tasks Today', value: 9, suffix: '', delta: '+2', direction: 'up', data: [4, 6, 5, 8, 7, 7, 9] },
    { label: 'Unresolved Items', value: 4, suffix: '', delta: '-1', direction: 'down', data: [8, 7, 6, 5, 5, 5, 4] },
    { label: 'Meetings Today', value: 5, suffix: '', delta: '+1', direction: 'up', data: [3, 4, 3, 5, 4, 4, 5] },
    { label: 'Staff Coverage', value: 97, suffix: '%', delta: '+2.1%', direction: 'up', data: [93, 91, 95, 94, 96, 95, 97] },
    { label: 'Attendance', value: 94.8, suffix: '%', delta: '+0.3%', direction: 'up', data: [93.5, 94.0, 93.8, 94.2, 94.5, 94.6, 94.8] }
  ];

  // Priority Queue tasks
  const priorityTasks = [
    { title: 'Bus 47 late again — email transportation dept', category: 'Compliance', pill: 'pill-compliance', source: 'voice', due: '7:30 AM', sourceIcon: 'mic', priority: 'urgent' },
    { title: 'Parent Tanya Webb called — wants conference re: son\'s progress', category: 'Student', pill: 'pill-student', source: 'voice', due: '11:45 AM', sourceIcon: 'mic', priority: 'high' },
    { title: 'Ms. Vega needs sub coverage Thursday — dentist appt', category: 'Staff', pill: 'pill-staff', source: 'email', due: 'Today', sourceIcon: 'email', priority: 'high' },
    { title: 'Regional accreditation evidence binder — due Friday', category: 'Compliance', pill: 'pill-compliance', source: 'pulse', due: 'Friday', sourceIcon: 'pulse', priority: 'high' },
    { title: 'Follow up with Dana on 4th grade reading data', category: 'Instructional', pill: 'pill-instructional', source: 'tap', due: '9:00 AM', sourceIcon: 'tap', priority: 'normal' },
    { title: 'Ceiling tile loose near Room 108 — maintenance request', category: 'Facilities', pill: 'pill-facilities', source: 'voice', due: 'Today', sourceIcon: 'mic', priority: 'normal' },
    { title: 'Budget request: manipulatives for K-2 math', category: 'Budget', pill: 'pill-budget', source: 'email', due: 'Tomorrow', sourceIcon: 'email', priority: 'normal' },
    { title: 'Special ed compliance — IEP reviews due this week', category: 'Student', pill: 'pill-student', source: 'email', due: 'This Week', sourceIcon: 'email', priority: 'normal' }
  ];

  // Timeline events
  const timelineEvents = [
    { time: '7:15', event: 'Morning Arrival Walkthrough', desc: 'Bus loop, carline, front entrance', dot: '' },
    { time: '7:45', event: 'Grade-Level PLC — 3rd Grade Math', desc: 'Data review with Ms. Drake & Mr. Watts', dot: '' },
    { time: '8:15', event: 'Pulse: Morning arrival smooth?', desc: '', dot: 'pulse-dot' },
    { time: '8:30', event: 'Classroom Walkthrough — 1st Grade ELA', desc: 'Ms. Cho\'s guided reading block', dot: 'current' },
    { time: '9:00', event: 'Meeting with Dana Lewis', desc: 'AIG program review & screening data', dot: '' },
    { time: '9:45', event: 'Observation — 2nd Grade Math', desc: 'Ms. Nash — number bonds lesson', dot: '' },
    { time: '10:30', event: 'Leadership Team Huddle', desc: 'Weekly check-in with Dana', dot: '' },
    { time: '11:00', event: 'Lunch Duty', desc: 'Cafeteria supervision', dot: '' },
    { time: '11:30', event: 'Pulse: Walkthrough follow-up notes?', desc: '', dot: 'pulse-dot' },
    { time: '11:45', event: 'Parent Conference — Tanya Webb', desc: 'Room 204 — re: son\'s progress', dot: '' },
    { time: '12:30', event: 'Classroom Walkthrough — K Reading', desc: 'Ms. Lawson — center rotations', dot: '' },
    { time: '1:15', event: 'Staff PD Planning Meeting', desc: 'Data-driven instruction workshop prep', dot: '' },
    { time: '2:00', event: 'Dismissal Walkthrough', desc: 'Bus loop & carline', dot: '' },
    { time: '2:30', event: 'Debrief with Dana', desc: 'Observation feedback prep', dot: '' },
    { time: '2:45', event: 'Pulse: Specials rotation running on time?', desc: '', dot: 'pulse-dot' }
  ];

  // Recent Captures
  const captures = [
    { type: 'Voice', time: '9:30 AM', text: '"Ceiling tile loose near Room 108 — submit maintenance request before students return from specials."', icon: 'mic' },
    { type: 'Tap', time: '8:45 AM', text: 'Staff → Sub Request → Thursday — "Ms. Vega dentist appointment"', icon: 'tap' },
    { type: 'Voice', time: '8:12 AM', text: '"Follow up with Dana on 4th grade reading data. EOG benchmarks coming up — need intervention plan."', icon: 'mic' }
  ];

  // Insights
  const insightsData = [
    { text: 'Bus 47 has been late 3 times this week — pattern flagged', meta: 'Consider follow-up with CMS transportation', type: 'warning' },
    { text: '4th grade reading benchmark scores dropped 4% — review with Dana', meta: 'Correlates with staffing changes in January', type: 'warning' },
    { text: '97% staff coverage — highest this semester', meta: 'Sub requests down 20% vs last month', type: 'success' },
    { text: '4 Pulse checkpoints completed today (90% response rate)', meta: 'Above your 80% weekly average', type: 'info' }
  ];

  // Full task list
  const allTasks = [
    { task: 'Bus 47 late again — email transportation', category: 'Compliance', priority: 'urgent', source: 'Voice', due: 'Today 7:30 AM', assignedTo: 'Mr. Mitchell', status: 'open' },
    { task: 'Parent conference — Tanya Webb', category: 'Student', priority: 'high', source: 'Voice', due: 'Today 11:45 AM', assignedTo: 'Mr. Mitchell', status: 'open' },
    { task: 'Ms. Vega sub coverage Thursday', category: 'Staff', priority: 'high', source: 'Email', due: 'Today', assignedTo: 'Mr. Mitchell', status: 'open' },
    { task: 'Accreditation evidence binder — due Friday', category: 'Compliance', priority: 'high', source: 'Pulse', due: 'Friday', assignedTo: 'Dana Lewis', status: 'in-progress' },
    { task: 'Follow up with Dana — 4th grade reading data', category: 'Instructional', priority: 'normal', source: 'Tap', due: 'Today 9:00 AM', assignedTo: 'Mr. Mitchell', status: 'open' },
    { task: 'Ceiling tile loose — Room 108', category: 'Facilities', priority: 'normal', source: 'Voice', due: 'Today', assignedTo: 'Maintenance', status: 'delegated' },
    { task: 'Budget request: K-2 math manipulatives', category: 'Budget', priority: 'normal', source: 'Email', due: 'Tomorrow', assignedTo: 'Mr. Mitchell', status: 'open' },
    { task: 'IEP reviews — compliance deadline', category: 'Student', priority: 'normal', source: 'Email', due: 'This Week', assignedTo: 'EC Team', status: 'in-progress' },
    { task: 'Staff PD planning — data-driven instruction', category: 'Instructional', priority: 'normal', source: 'Calendar', due: 'Today 1:15 PM', assignedTo: 'Mr. Mitchell', status: 'open' },
    { task: 'Update specials rotation schedule', category: 'Staff', priority: 'low', source: 'Email', due: 'This Week', assignedTo: 'Dana Lewis', status: 'delegated' },
    { task: 'Technology lab Chromebook inventory', category: 'Facilities', priority: 'low', source: 'Tap', due: 'This Week', assignedTo: 'Tech Coordinator', status: 'in-progress' },
    { task: '2nd grade cohort field trip forms collected', category: 'Student', priority: 'low', source: 'Email', due: 'Friday', assignedTo: 'Ms. Nash', status: 'completed' },
    { task: 'Morning arrival safety audit — bus loop', category: 'Compliance', priority: 'normal', source: 'Voice', due: 'Last Week', assignedTo: 'Mr. Mitchell', status: 'completed' },
    { task: 'Teacher eval — Ms. Cho observation', category: 'Instructional', priority: 'high', source: 'Calendar', due: 'Last Week', assignedTo: 'Mr. Mitchell', status: 'completed' }
  ];

  // Staff Coverage data
  const staffCoverage = [
    { name: 'Ms. Vega', position: 'ELA, Grade 3', status: 'absent', reason: 'Personal Day', sub: 'Mrs. Doyle', covered: true },
    { name: 'Ms. Cho', position: 'General, Grade 1', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Mr. Watts', position: 'ELA, Grade 3', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Ms. Drake', position: 'Math, Grade 3', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Ms. Lawson', position: 'General, K', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Mr. Diaz', position: 'General, K', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Ms. Nash', position: 'General, Grade 2', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Mr. Quinn', position: 'Math, Grade 4', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Ms. Pratt', position: 'Math, Grade 4', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Dana Lewis', position: 'Asst. Principal', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Ms. Perry', position: 'General, Grade 1', status: 'present', reason: '', sub: '', covered: true },
    { name: 'Mr. Kemp', position: 'ELA, Grade 4', status: 'present', reason: '', sub: '', covered: true }
  ];

  const attendanceData = {
    enrolled: 435,
    present: 412,
    absent: 23,
    tardy: 9,
    byGrade: [
      { grade: 'K', pct: 95.2 },
      { grade: '1st', pct: 94.9 },
      { grade: '2nd', pct: 94.5 },
      { grade: '3rd', pct: 95.8 },
      { grade: '4th', pct: 93.7 }
    ]
  };

  const meetingsToday = [
    { time: '7:45 AM', title: 'Grade-Level PLC — 3rd Grade Math', location: 'Room 312', duration: '30 min', desc: 'Data review with Ms. Drake & Mr. Watts' },
    { time: '9:00 AM', title: 'Meeting with Dana Lewis', location: 'Main Office', duration: '45 min', desc: 'AIG program review & screening data' },
    { time: '10:30 AM', title: 'Leadership Team Huddle', location: 'Conference Room', duration: '30 min', desc: 'Weekly check-in with Dana' },
    { time: '11:45 AM', title: 'Parent Conference — Tanya Webb', location: 'Room 204', duration: '30 min', desc: 'Re: son\'s academic progress' },
    { time: '1:15 PM', title: 'Staff PD Planning Meeting', location: 'Media Center', duration: '45 min', desc: 'Data-driven instruction workshop prep' }
  ];

  // Pulse checkpoints
  const pulseCheckpoints = [
    { time: '8:15 AM', message: 'Morning arrival smooth? Any carline or bus loop issues?', status: 'responded', response: 'Bus 47 late again — 12 min. Emailed transportation. Carline smooth otherwise.' },
    { time: '9:45 AM', message: '3rd grade Math PLC takeaways? Anything to action?', status: 'responded', response: 'Ms. Drake\'s number talk strategy working well. Share with grade 2 team.' },
    { time: '11:30 AM', message: 'Walkthrough follow-up notes? Any observations to log?', status: 'pending', response: '' },
    { time: '1:00 PM', message: 'AIG screening update? Any actions from Dana meeting?', status: 'pending', response: '' },
    { time: '2:45 PM', message: 'Specials rotation running on time? Any schedule conflicts?', status: 'skipped', response: '' }
  ];

  // Integrations
  const integrations = [
    { name: 'Canvas LMS', desc: 'Learning Management System', status: 'connected', lastSync: '3m ago', on: true, icon: 'book' },
    { name: 'Infinite Campus', desc: 'Student Information System', status: 'connected', lastSync: '2m ago', on: true, icon: 'database' },
    { name: 'Google Workspace', desc: 'Email, Calendar & Drive', status: 'connected', lastSync: '1m ago', on: true, icon: 'mail' },
    { name: 'AdvancED Platform', desc: 'Accreditation Platform', status: 'connected', lastSync: '1h ago', on: true, icon: 'folder' },
    { name: 'State DOE Reporting', desc: 'State Compliance & Reporting', status: 'pending', lastSync: 'Setup required', on: false, icon: 'calendar' },
    { name: 'Remind', desc: 'SMS & Parent Communication', status: 'available', lastSync: 'Not connected', on: false, icon: 'message' },
    { name: 'Otter.ai', desc: 'Meeting Transcripts', status: 'available', lastSync: 'Not connected', on: false, icon: 'headphones' }
  ];

  // Word board categories (mutable copy for editing)
  const defaultWordBoard = [
    { label: 'Who', words: ['Parent', 'Student', 'Teacher', 'Staff', 'Visitor', 'Counselor'] },
    { label: 'What', words: ['Concern', 'Praise', 'Request', 'Incident', 'Follow-up', 'Reminder'] },
    { label: 'Priority', words: ['Urgent', 'High', 'Normal', 'Low'] },
    { label: 'Domain', words: ['Safety', 'Academic', 'Behavior', 'Facilities', 'Budget', 'Schedule'] },
    { label: 'Location', words: ['Office', 'Hallway', 'Cafeteria', 'Gym', 'Classroom', 'Playground'] }
  ];

  // Deep copy for mutable state
  let wordBoard = JSON.parse(JSON.stringify(defaultWordBoard));
  let wordBoardEditMode = false;

  /* ============================================
     SOURCE ICON SVGS
     ============================================ */
  const sourceIcons = {
    email: '<svg class="source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    calendar: '<svg class="source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    mic: '<svg class="source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>',
    tap: '<svg class="source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>',
    pulse: '<svg class="source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
  };

  const integrationIcons = {
    database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
    message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
  };

  /* ============================================
     DRILL-DOWN DRAWER
     ============================================ */
  let drawerOpen = false;

  function openDrawer(title, subtitle, contentHtml) {
    // Remove existing drawer if any
    closeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.addEventListener('click', closeDrawer);

    const drawer = document.createElement('div');
    drawer.className = 'drawer-panel';
    drawer.innerHTML = `
      <div class="drawer-header">
        <div>
          <div class="drawer-title">${title}</div>
          ${subtitle ? `<div class="drawer-subtitle">${subtitle}</div>` : ''}
        </div>
        <button class="drawer-close" aria-label="Close panel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="drawer-content">${contentHtml}</div>
    `;

    drawer.querySelector('.drawer-close').addEventListener('click', closeDrawer);

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      drawer.classList.add('active');
    });

    drawerOpen = true;

    // ESC key closes
    document.addEventListener('keydown', handleDrawerEsc);

    // Animate attendance bars if present
    setTimeout(() => {
      drawer.querySelectorAll('.bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
    }, 100);
  }

  function closeDrawer() {
    const overlay = document.querySelector('.drawer-overlay');
    const drawer = document.querySelector('.drawer-panel');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    }
    if (drawer) {
      drawer.classList.remove('active');
      setTimeout(() => drawer.remove(), 200);
    }
    drawerOpen = false;
    document.removeEventListener('keydown', handleDrawerEsc);
  }

  function handleDrawerEsc(e) {
    if (e.key === 'Escape') closeDrawer();
  }

  /* ============================================
     KPI DRILL-DOWN CONTENT BUILDERS
     ============================================ */

  function buildTasksTodayContent() {
    const todayTasks = allTasks.filter(t => t.due.toLowerCase().startsWith('today'));
    return `
      <div class="drawer-stat-row">
        <div class="drawer-stat"><span class="drawer-stat-num">${todayTasks.length}</span> tasks scheduled for today</div>
      </div>
      <div class="drawer-list">
        ${todayTasks.map(t => {
          const pillClass = 'pill-' + t.category.toLowerCase();
          return `
          <div class="drawer-list-item">
            <div class="priority-dot ${t.priority}" style="flex-shrink:0;margin-top:6px;"></div>
            <div style="flex:1;min-width:0;">
              <div class="drawer-list-title">${t.task}</div>
              <div class="drawer-list-meta">
                <span class="category-pill ${pillClass}">${t.category}</span>
                <span>${t.due}</span>
                <span class="status-badge ${t.status}">${t.status.replace('-', ' ')}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function buildUnresolvedContent() {
    const unresolved = allTasks.filter(t => t.status === 'open' || t.status === 'in-progress');
    return `
      <div class="drawer-stat-row">
        <div class="drawer-stat"><span class="drawer-stat-num">${unresolved.length}</span> items require attention</div>
      </div>
      <div class="drawer-list">
        ${unresolved.map(t => {
          const pillClass = 'pill-' + t.category.toLowerCase();
          return `
          <div class="drawer-list-item">
            <div class="priority-dot ${t.priority}" style="flex-shrink:0;margin-top:6px;"></div>
            <div style="flex:1;min-width:0;">
              <div class="drawer-list-title">${t.task}</div>
              <div class="drawer-list-meta">
                <span class="category-pill ${pillClass}">${t.category}</span>
                <span>${t.due}</span>
                <span class="status-badge ${t.status}">${t.status.replace('-', ' ')}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function buildMeetingsContent() {
    return `
      <div class="drawer-stat-row">
        <div class="drawer-stat"><span class="drawer-stat-num">${meetingsToday.length}</span> meetings today</div>
      </div>
      <div class="drawer-list">
        ${meetingsToday.map(m => `
          <div class="drawer-list-item drawer-meeting-item">
            <div class="drawer-meeting-time">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${m.time}
            </div>
            <div style="flex:1;min-width:0;">
              <div class="drawer-list-title">${m.title}</div>
              <div class="drawer-list-meta">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>${m.location}</span>
                <span style="color:var(--color-text-faint);">&middot; ${m.duration}</span>
              </div>
              <div style="font-size:var(--text-xs);color:var(--color-text-faint);margin-top:var(--space-1);">${m.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function buildStaffCoverageContent() {
    const totalPositions = 34;
    const absent = staffCoverage.filter(s => s.status === 'absent');
    const covered = absent.filter(s => s.covered);
    const uncovered = absent.filter(s => !s.covered);
    const coveredCount = totalPositions - uncovered.length;

    // Sort: absent first, then present
    const sorted = [...staffCoverage].sort((a, b) => {
      if (a.status === 'absent' && b.status !== 'absent') return -1;
      if (a.status !== 'absent' && b.status === 'absent') return 1;
      return 0;
    });

    return `
      <div class="drawer-stat-row" style="margin-bottom:var(--space-4);">
        <div class="drawer-stat" style="font-size:var(--text-base);">
          <span class="drawer-stat-num">${coveredCount}</span> of <span class="drawer-stat-num">${totalPositions}</span> positions covered today
          <span style="font-weight:700;color:var(--color-success);margin-left:var(--space-2);">(${Math.round(coveredCount / totalPositions * 100)}%)</span>
        </div>
      </div>
      <div class="drawer-quick-stats">
        <div class="drawer-quick-stat">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--color-warning)" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          <span>${absent.length} absences today</span>
        </div>
        <div class="drawer-quick-stat">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--color-primary)" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
          <span>${covered.length} subs active</span>
        </div>
        <div class="drawer-quick-stat">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${uncovered.length > 0 ? 'var(--color-error)' : 'var(--color-success)'}" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>${uncovered.length} uncovered positions</span>
        </div>
      </div>
      <div class="drawer-table-wrapper">
        <table class="drawer-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Position</th>
              <th>Status</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(s => {
              const statusDot = s.status === 'present' ? 'coverage-present' :
                (s.covered ? 'coverage-covered' : 'coverage-uncovered');
              const statusText = s.status === 'present' ? 'Present' :
                `Absent — ${s.reason}`;
              const coverageText = s.status === 'present' ? '—' :
                (s.covered ? `Sub: ${s.sub}` : '<span class="uncovered-badge">UNCOVERED</span>');
              return `
              <tr>
                <td style="font-weight:500;">${s.name}</td>
                <td style="color:var(--color-text-muted);">${s.position}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:var(--space-2);">
                    <span class="coverage-dot ${statusDot}"></span>
                    <span>${statusText}</span>
                  </div>
                </td>
                <td>${coverageText}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildAttendanceContent() {
    const a = attendanceData;
    const maxPct = Math.max(...a.byGrade.map(g => g.pct));

    return `
      <div class="drawer-stat-row" style="margin-bottom:var(--space-4);">
        <div class="drawer-attendance-summary">
          <div class="drawer-attendance-big">
            <span class="drawer-stat-num" style="font-size:var(--text-2xl);">${a.present}</span>
            <span style="color:var(--color-text-muted);font-size:var(--text-sm);">/ ${a.enrolled} present</span>
          </div>
        </div>
      </div>
      <div class="drawer-quick-stats" style="margin-bottom:var(--space-5);">
        <div class="drawer-quick-stat">
          <span style="width:8px;height:8px;border-radius:var(--radius-full);background:var(--color-success);flex-shrink:0;"></span>
          <span>Enrolled: <strong>${a.enrolled}</strong></span>
        </div>
        <div class="drawer-quick-stat">
          <span style="width:8px;height:8px;border-radius:var(--radius-full);background:var(--color-primary);flex-shrink:0;"></span>
          <span>Present: <strong>${a.present}</strong></span>
        </div>
        <div class="drawer-quick-stat">
          <span style="width:8px;height:8px;border-radius:var(--radius-full);background:var(--color-error);flex-shrink:0;"></span>
          <span>Absent: <strong>${a.absent}</strong></span>
        </div>
        <div class="drawer-quick-stat">
          <span style="width:8px;height:8px;border-radius:var(--radius-full);background:var(--color-warning);flex-shrink:0;"></span>
          <span>Tardy: <strong>${a.tardy}</strong></span>
        </div>
      </div>
      <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-text);margin-bottom:var(--space-3);">Attendance by Grade</div>
      <div class="drawer-attendance-chart">
        ${a.byGrade.map(g => `
          <div class="attendance-bar-row">
            <div class="attendance-bar-label">${g.grade}</div>
            <div class="attendance-bar-track">
              <div class="bar-fill" style="width:0%;background:${g.pct >= 96 ? 'var(--color-success)' : g.pct >= 95 ? 'var(--color-warning)' : 'var(--color-error)'};" data-width="${g.pct}%"></div>
            </div>
            <div class="attendance-bar-value">${g.pct}%</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ============================================
     RENDER: DASHBOARD
     ============================================ */
  function renderKPIs() {
    const row = document.getElementById('kpiRow');
    if (!row) return;
    row.innerHTML = kpis.map((k, i) => `
      <div class="kpi-card" data-kpi-index="${i}" tabindex="0" role="button" aria-label="View ${k.label} details">
        <div class="kpi-label">${k.label}
          <svg class="kpi-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="kpi-value" data-kpi="${i}" data-target="${k.value}" data-suffix="${k.suffix}">0${k.suffix}</div>
        <div class="kpi-footer">
          <div class="kpi-delta ${k.direction}">
            ${k.direction === 'up' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>' :
              k.direction === 'down' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' :
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>'}
            ${k.delta}
          </div>
          ${sparklineSVG(k.data)}
        </div>
      </div>
    `).join('');

    // Animate values
    setTimeout(() => {
      row.querySelectorAll('.kpi-value').forEach(el => {
        const target = parseFloat(el.dataset.target);
        const suffix = el.dataset.suffix;
        animateValue(el, 0, target, 800, suffix);
      });
    }, 200);

    // KPI card click handlers
    row.querySelectorAll('.kpi-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.kpiIndex);
        handleKPIClick(idx);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const idx = parseInt(card.dataset.kpiIndex);
          handleKPIClick(idx);
        }
      });
    });
  }

  function handleKPIClick(index) {
    const kpi = kpis[index];
    let content = '';
    let subtitle = '';

    switch (index) {
      case 0: // Tasks Today
        subtitle = 'All tasks scheduled for today';
        content = buildTasksTodayContent();
        break;
      case 1: // Unresolved Items
        subtitle = 'Open and in-progress tasks requiring action';
        content = buildUnresolvedContent();
        break;
      case 2: // Meetings Today
        subtitle = 'Your schedule for today';
        content = buildMeetingsContent();
        break;
      case 3: // Staff Coverage
        subtitle = 'Classroom and position coverage status';
        content = buildStaffCoverageContent();
        break;
      case 4: // Attendance
        subtitle = 'Student attendance breakdown';
        content = buildAttendanceContent();
        break;
    }

    openDrawer(kpi.label, subtitle, content);
  }

  /* ============================================
     DASHBOARD FILTER BAR
     ============================================ */
  let dashboardCategoryFilter = 'all';
  let dashboardPriorityFilter = 'all';

  function renderDashboardFilters() {
    const filterBar = document.getElementById('dashboardFilters');
    if (!filterBar) return;

    const categories = ['All', 'Instructional', 'Compliance', 'Student', 'Staff', 'Facilities', 'Budget'];
    const priorities = ['All', 'Urgent', 'High', 'Normal', 'Low'];

    filterBar.innerHTML = `
      <div class="dashboard-filter-group">
        <span class="dashboard-filter-label">Category</span>
        <div class="dashboard-filter-pills" id="dashCatFilters">
          ${categories.map(c => `<button class="filter-pill ${c.toLowerCase() === dashboardCategoryFilter ? 'active' : ''}" data-filter="${c.toLowerCase()}">${c}</button>`).join('')}
        </div>
      </div>
      <div class="dashboard-filter-group">
        <span class="dashboard-filter-label">Priority</span>
        <div class="dashboard-filter-pills" id="dashPriorityFilters">
          ${priorities.map(p => `<button class="filter-pill ${p.toLowerCase() === dashboardPriorityFilter ? 'active' : ''}" data-filter="${p.toLowerCase()}">${p}</button>`).join('')}
        </div>
      </div>
    `;

    filterBar.querySelectorAll('#dashCatFilters .filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        filterBar.querySelectorAll('#dashCatFilters .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        dashboardCategoryFilter = pill.dataset.filter;
        renderFilteredPriorityQueue();
      });
    });

    filterBar.querySelectorAll('#dashPriorityFilters .filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        filterBar.querySelectorAll('#dashPriorityFilters .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        dashboardPriorityFilter = pill.dataset.filter;
        renderFilteredPriorityQueue();
      });
    });
  }

  function renderFilteredPriorityQueue() {
    const container = document.getElementById('priorityQueue');
    if (!container) return;

    let filtered = [...priorityTasks];
    if (dashboardCategoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category.toLowerCase() === dashboardCategoryFilter);
    }
    if (dashboardPriorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority.toLowerCase() === dashboardPriorityFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--color-text-faint);font-size:var(--text-sm);">No tasks match the selected filters</div>';
      return;
    }

    container.innerHTML = filtered.map(t => `
      <div class="task-item">
        <div class="task-checkbox" tabindex="0" role="checkbox" aria-checked="false" aria-label="Complete task"></div>
        <div class="task-content">
          <div class="task-title">${t.title}</div>
          <div class="task-meta">
            <span class="category-pill ${t.pill}">${t.category}</span>
            ${sourceIcons[t.sourceIcon] || ''}
            <span>${t.due}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action-btn" aria-label="Delegate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg></button>
          <button class="task-action-btn" aria-label="Snooze"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>
          <button class="task-action-btn" aria-label="Complete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
        </div>
      </div>
    `).join('');

    // Checkbox interaction
    container.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.addEventListener('click', () => {
        cb.classList.toggle('checked');
        const checked = cb.classList.contains('checked');
        cb.setAttribute('aria-checked', checked);
        if (checked) {
          cb.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
          cb.closest('.task-item').style.opacity = '0.5';
        } else {
          cb.innerHTML = '';
          cb.closest('.task-item').style.opacity = '1';
        }
      });
    });
  }

  function renderPriorityQueue() {
    renderFilteredPriorityQueue();
  }

  function renderTimeline() {
    const container = document.getElementById('timeline');
    if (!container) return;
    container.innerHTML = timelineEvents.map(e => `
      <div class="timeline-item">
        <div class="timeline-dot ${e.dot}"></div>
        <div class="timeline-time">${e.time}</div>
        <div class="timeline-content">
          <div class="timeline-event">${e.event}</div>
          ${e.desc ? `<div class="timeline-desc">${e.desc}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderCaptures() {
    const container = document.getElementById('recentCaptures');
    if (!container) return;
    container.innerHTML = captures.map(c => `
      <div class="capture-item">
        <div class="capture-header">
          <div class="capture-type">${sourceIcons[c.icon] || ''} ${c.type}</div>
          <div class="capture-time">${c.time}</div>
        </div>
        <div class="capture-text">${c.text}</div>
      </div>
    `).join('');
  }

  function renderInsights() {
    const container = document.getElementById('insights');
    if (!container) return;
    container.innerHTML = insightsData.map(ins => `
      <div class="insight-item">
        <div class="insight-icon ${ins.type}">
          ${ins.type === 'warning' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' :
            ins.type === 'success' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' :
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'}
        </div>
        <div>
          <div class="insight-text">${ins.text}</div>
          <div class="insight-meta">${ins.meta}</div>
        </div>
      </div>
    `).join('');
  }

  /* ============================================
     RENDER: TASKS VIEW
     ============================================ */
  function renderTasksView() {
    // Filter pills
    const filtersEl = document.getElementById('taskFilters');
    const categories = ['All', 'Instructional', 'Compliance', 'Student', 'Staff', 'Facilities', 'Budget'];
    if (filtersEl) {
      filtersEl.innerHTML = categories.map((c, i) =>
        `<button class="filter-pill ${i === 0 ? 'active' : ''}" data-filter="${c.toLowerCase()}">${c}</button>`
      ).join('');

      filtersEl.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          filtersEl.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          renderTaskTable(pill.dataset.filter);
        });
      });
    }

    // Tabs
    const tabsEl = document.getElementById('taskTabs');
    const tabs = ['All', 'Today', 'This Week', 'Delegated', 'Completed'];
    if (tabsEl) {
      tabsEl.innerHTML = tabs.map((t, i) =>
        `<button class="tab-item ${i === 0 ? 'active' : ''}" data-tab="${t.toLowerCase()}">${t}</button>`
      ).join('');

      tabsEl.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
          tabsEl.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          // Tab filtering logic would go here
        });
      });
    }

    // Table header
    const thead = document.getElementById('taskTableHead');
    if (thead) {
      thead.innerHTML = `<tr>
        <th style="width:30px;"></th>
        <th>Task</th>
        <th>Category</th>
        <th>Priority</th>
        <th>Source</th>
        <th>Due</th>
        <th>Assigned To</th>
        <th>Status</th>
      </tr>`;
    }

    renderTaskTable('all');
  }

  function renderTaskTable(filter) {
    const tbody = document.getElementById('taskTableBody');
    if (!tbody) return;
    const filtered = filter === 'all' ? allTasks : allTasks.filter(t => t.category.toLowerCase() === filter);
    tbody.innerHTML = filtered.map(t => {
      const pillClass = 'pill-' + t.category.toLowerCase();
      return `<tr>
        <td><div class="task-checkbox" tabindex="0" role="checkbox" aria-checked="false" aria-label="Complete"></div></td>
        <td style="font-weight:500;">${t.task}</td>
        <td><span class="category-pill ${pillClass}">${t.category}</span></td>
        <td><span class="priority-dot ${t.priority}"></span> ${t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}</td>
        <td style="color:var(--color-text-muted);">${t.source}</td>
        <td style="font-variant-numeric:tabular-nums;color:var(--color-text-muted);white-space:nowrap;">${t.due}</td>
        <td style="color:var(--color-text-muted);">${t.assignedTo}</td>
        <td><span class="status-badge ${t.status}">${t.status.replace('-', ' ')}</span></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.addEventListener('click', () => {
        cb.classList.toggle('checked');
        const checked = cb.classList.contains('checked');
        cb.setAttribute('aria-checked', checked);
        if (checked) {
          cb.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
          cb.closest('tr').style.opacity = '0.5';
        } else {
          cb.innerHTML = '';
          cb.closest('tr').style.opacity = '1';
        }
      });
    });
  }

  /* ============================================
     RENDER: CAPTURE VIEW — EDITABLE WORD BOARD
     ============================================ */
  let selectedWords = {};

  function renderWordBoard() {
    const container = document.getElementById('wordBoard');
    if (!container) return;
    selectedWords = {};

    if (wordBoardEditMode) {
      container.classList.add('edit-mode');
    } else {
      container.classList.remove('edit-mode');
    }

    container.innerHTML = wordBoard.map((cat, catIdx) => `
      <div>
        <div class="word-board-label">${cat.label}</div>
        <div class="word-board-row" data-cat-index="${catIdx}">
          ${cat.words.map((w, wIdx) => `
            <div class="word-btn-wrapper${wordBoardEditMode ? ' editing' : ''}">
              <button class="word-btn" data-category="${cat.label}" data-word="${w}" data-cat-index="${catIdx}" data-word-index="${wIdx}">${w}</button>
              ${wordBoardEditMode ? `<button class="word-remove-btn" data-cat-index="${catIdx}" data-word-index="${wIdx}" aria-label="Remove ${w}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>` : ''}
            </div>
          `).join('')}
          ${wordBoardEditMode ? `
            <div class="word-add-wrapper" data-cat-index="${catIdx}">
              <button class="word-add-btn" data-cat-index="${catIdx}" aria-label="Add word to ${cat.label}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    // Word button click (select)
    if (!wordBoardEditMode) {
      container.querySelectorAll('.word-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.dataset.category;
          if (btn.classList.contains('selected')) {
            btn.classList.remove('selected');
            delete selectedWords[cat];
          } else {
            container.querySelectorAll(`.word-btn[data-category="${cat}"]`).forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedWords[cat] = btn.dataset.word;
          }
          updateTapPreview(selectedWords);
        });
      });
    }

    // Remove word buttons
    if (wordBoardEditMode) {
      container.querySelectorAll('.word-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const catIdx = parseInt(btn.dataset.catIndex);
          const wIdx = parseInt(btn.dataset.wordIndex);
          wordBoard[catIdx].words.splice(wIdx, 1);
          renderWordBoard();
        });
      });

      // Add word buttons
      container.querySelectorAll('.word-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const catIdx = parseInt(btn.dataset.catIndex);
          const wrapper = btn.closest('.word-add-wrapper');

          // Check if input already shown
          if (wrapper.querySelector('.word-add-input')) return;

          const inputContainer = document.createElement('div');
          inputContainer.className = 'word-add-input-container';
          inputContainer.innerHTML = `
            <input type="text" class="word-add-input" placeholder="New word..." maxlength="20" autofocus>
            <button class="word-add-confirm" aria-label="Confirm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          `;

          wrapper.insertBefore(inputContainer, btn);
          btn.style.display = 'none';

          const input = inputContainer.querySelector('.word-add-input');
          const confirm = inputContainer.querySelector('.word-add-confirm');

          function addWord() {
            const val = input.value.trim();
            if (val) {
              wordBoard[catIdx].words.push(val);
              renderWordBoard();
            } else {
              inputContainer.remove();
              btn.style.display = '';
            }
          }

          input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') addWord();
            if (ev.key === 'Escape') {
              inputContainer.remove();
              btn.style.display = '';
            }
          });

          confirm.addEventListener('click', addWord);

          input.focus();
        });
      });
    }
  }

  function toggleWordBoardEditMode() {
    wordBoardEditMode = !wordBoardEditMode;
    const editBtn = document.getElementById('editBoardBtn');
    if (editBtn) {
      editBtn.textContent = wordBoardEditMode ? 'Done' : 'Edit Board';
      editBtn.classList.toggle('btn-primary', wordBoardEditMode);
      editBtn.classList.toggle('btn-ghost', !wordBoardEditMode);
    }
    renderWordBoard();
  }

  function resetWordBoard() {
    wordBoard = JSON.parse(JSON.stringify(defaultWordBoard));
    renderWordBoard();
  }

  // Bind edit board button
  const editBoardBtn = document.getElementById('editBoardBtn');
  if (editBoardBtn) {
    editBoardBtn.addEventListener('click', toggleWordBoardEditMode);
  }

  const resetBoardBtn = document.getElementById('resetBoardBtn');
  if (resetBoardBtn) {
    resetBoardBtn.addEventListener('click', resetWordBoard);
  }

  function updateTapPreview(selected) {
    const content = document.getElementById('tapPreviewContent');
    const confirmBtn = document.getElementById('tapConfirmBtn');
    const detail = document.getElementById('tapDetail');
    if (!content) return;

    const words = Object.values(selected);
    if (words.length === 0) {
      content.innerHTML = '<span style="color:var(--color-text-faint)">Select items above to generate a task...</span>';
      if (confirmBtn) confirmBtn.disabled = true;
      return;
    }

    const who = selected['Who'] || '—';
    const what = selected['What'] || '—';
    const priority = selected['Priority'] || 'Normal';
    const domain = selected['Domain'] || '—';
    const location = selected['Location'] || '—';
    const detailText = detail ? detail.value : '';

    content.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-2);color:var(--color-text);">
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
          ${words.map(w => `<span class="category-pill pill-instructional">${w}</span>`).join('')}
        </div>
        <div style="font-size:var(--text-sm);font-weight:500;">
          ${who} — ${what} — ${domain} (${location})
        </div>
        ${detailText ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted);font-style:italic;">"${detailText}"</div>` : ''}
        <div style="font-size:var(--text-xs);color:var(--color-text-faint);">Priority: ${priority}</div>
      </div>
    `;
    if (confirmBtn) confirmBtn.disabled = false;
  }

  // Mic button interaction
  const micBtn = document.getElementById('micBtn');
  const micLabel = document.getElementById('micLabel');
  const transcriptionArea = document.getElementById('transcriptionArea');
  const aiSuggestion = document.getElementById('aiSuggestion');
  const aiSuggestionText = document.getElementById('aiSuggestionText');
  const confirmCaptureBtn = document.getElementById('confirmCaptureBtn');
  let isRecording = false;

  if (micBtn) {
    micBtn.addEventListener('click', () => {
      isRecording = !isRecording;
      if (isRecording) {
        micBtn.classList.add('recording');
        micLabel.textContent = 'Recording...';
        transcriptionArea.innerHTML = '<span style="color:var(--color-text-faint)">Listening...</span>';
        if (aiSuggestion) aiSuggestion.style.display = 'none';

        // Simulate transcription after delay
        setTimeout(() => {
          if (isRecording) {
            transcriptionArea.innerHTML = '"The 3rd grade math team needs additional manipulatives for the fractions unit next week. Also, Mr. Colon mentioned the projector in Room 204 is flickering again."';
            if (confirmCaptureBtn) confirmCaptureBtn.disabled = false;
          }
        }, 2000);

        // Show AI suggestion
        setTimeout(() => {
          if (isRecording && aiSuggestion) {
            aiSuggestion.style.display = 'block';
            aiSuggestionText.innerHTML = '<strong>Category:</strong> Instructional + Facilities &middot; <strong>Priority:</strong> Normal &middot; <strong>Actions:</strong> Create 2 tasks — (1) Order math manipulatives, (2) Submit projector repair ticket for Room 204';
          }
        }, 3000);
      } else {
        micBtn.classList.remove('recording');
        micLabel.textContent = 'Tap to record';
      }
    });
  }

  // Tap clear
  const tapClearBtn = document.getElementById('tapClearBtn');
  if (tapClearBtn) {
    tapClearBtn.addEventListener('click', () => {
      document.querySelectorAll('.word-btn.selected').forEach(b => b.classList.remove('selected'));
      const detail = document.getElementById('tapDetail');
      if (detail) detail.value = '';
      selectedWords = {};
      updateTapPreview({});
    });
  }

  // Tap confirm
  const tapConfirmBtn = document.getElementById('tapConfirmBtn');
  if (tapConfirmBtn) {
    tapConfirmBtn.addEventListener('click', () => {
      const content = document.getElementById('tapPreviewContent');
      if (content) {
        content.innerHTML = '<div style="color:var(--color-success);font-weight:600;display:flex;align-items:center;gap:var(--space-2);"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Task saved successfully!</div>';
        tapConfirmBtn.disabled = true;
        setTimeout(() => {
          document.querySelectorAll('.word-btn.selected').forEach(b => b.classList.remove('selected'));
          const detail = document.getElementById('tapDetail');
          if (detail) detail.value = '';
          selectedWords = {};
          updateTapPreview({});
        }, 1500);
      }
    });
  }

  /* ============================================
     RENDER: PULSE VIEW
     ============================================ */
  function renderPulseView() {
    // Day map bar
    const daymap = document.getElementById('pulseDaymap');
    if (daymap) {
      const segments = [
        { label: 'Arrival', width: '10%', color: 'var(--color-primary)' },
        { label: 'AM Block', width: '25%', color: 'var(--cat-instructional)' },
        { label: 'Meetings', width: '15%', color: 'var(--cat-compliance)' },
        { label: 'Lunch', width: '10%', color: 'var(--cat-facilities)' },
        { label: 'PM Block', width: '25%', color: 'var(--cat-student)' },
        { label: 'Wrap', width: '15%', color: 'var(--cat-staff)' }
      ];
      daymap.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);font-size:var(--text-xs);color:var(--color-text-muted);">
          <span>7:30 AM</span><span>10:00 AM</span><span>12:00 PM</span><span>2:00 PM</span><span>4:00 PM</span>
        </div>
        <div class="pulse-bar">
          ${segments.map(s => `<div class="pulse-segment" style="width:${s.width};background:${s.color};opacity:0.85;"><span style="font-size:var(--text-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 var(--space-2);">${s.label}</span></div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:var(--space-2);">
          ${['8:15', '10:00', '12:30', '2:00', '3:30'].map(t => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--color-notification)" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <span style="font-size:var(--text-xs);color:var(--color-text-faint);font-variant-numeric:tabular-nums;">${t}</span>
          </div>`).join('')}
        </div>
      `;
    }

    // Checkpoints
    const cpContainer = document.getElementById('pulseCheckpoints');
    if (cpContainer) {
      cpContainer.innerHTML = pulseCheckpoints.map(cp => `
        <div class="pulse-checkpoint">
          <div class="pulse-status-icon ${cp.status}">
            ${cp.status === 'responded' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' :
              cp.status === 'skipped' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' :
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'}
          </div>
          <div class="pulse-content">
            <div class="pulse-time">${cp.time}</div>
            <div class="pulse-message">${cp.message}</div>
            ${cp.response ? `<div class="pulse-response">${cp.response}</div>` : ''}
          </div>
          <span class="status-badge ${cp.status === 'responded' ? 'completed' : cp.status === 'pending' ? 'in-progress' : 'open'}">${cp.status}</span>
        </div>
      `).join('');
    }

    // Stats
    const statsContainer = document.getElementById('pulseStats');
    if (statsContainer) {
      const stats = [
        { value: '83%', label: 'Response Rate' },
        { value: '4.2', label: 'Captures / Pulse' },
        { value: '12', label: 'Insights Generated' }
      ];
      statsContainer.innerHTML = stats.map(s => `
        <div class="pulse-stat-card">
          <div class="pulse-stat-value">${s.value}</div>
          <div class="pulse-stat-label">${s.label}</div>
        </div>
      `).join('');
    }
  }

  /* ============================================
     RENDER: INTEGRATIONS VIEW
     ============================================ */
  function renderIntegrationsView() {
    const grid = document.getElementById('integrationGrid');
    if (!grid) return;
    grid.innerHTML = integrations.map(intg => `
      <div class="integration-card">
        <div class="integration-top">
          <div class="integration-icon">${integrationIcons[intg.icon] || ''}</div>
          <div class="toggle-switch ${intg.on ? 'on' : ''}" data-toggle="intg-${intg.name.replace(/\s/g, '')}"></div>
        </div>
        <div class="integration-name">${intg.name}</div>
        <div class="integration-desc">${intg.desc}</div>
        <div class="integration-status ${intg.status}">
          ${intg.status === 'connected' ? 'Connected' : intg.status === 'pending' ? 'Pending Setup' : 'Available'}
          ${intg.status === 'connected' ? ` &middot; Synced ${intg.lastSync}` : ''}
        </div>
      </div>
    `).join('');

    // Re-bind toggle switches for new elements
    grid.querySelectorAll('.toggle-switch').forEach(el => {
      el.addEventListener('click', () => {
        el.classList.toggle('on');
      });
    });
  }

  /* ============================================
     OBSERVATIONS & WALKTHROUGHS
     ============================================ */
  
  // Teacher roster data — Westfield Academy Elementary (K-4)
  const teacherRoster = {
    'K': {
      'General': ['Ms. Lawson', 'Mr. Diaz', 'Ms. Chen']
    },
    '1st': {
      'General': ['Ms. Cho', 'Ms. Perry', 'Ms. Tate']
    },
    '2nd': {
      'General': ['Ms. Nash', 'Mr. Lyons', 'Ms. Ford']
    },
    '3rd': {
      'Math': ['Ms. Drake', 'Mr. Watts'],
      'ELA': ['Ms. Vega', 'Ms. Hale'],
      'Science': ['Ms. Drake', 'Mr. Watts'],
      'Social Studies': ['Ms. Vega', 'Ms. Hale']
    },
    '4th': {
      'Math': ['Mr. Quinn', 'Ms. Pratt'],
      'ELA': ['Ms. Avery', 'Mr. Kemp'],
      'Science': ['Mr. Quinn', 'Ms. Pratt'],
      'Social Studies': ['Ms. Avery', 'Mr. Kemp']
    }
  };

  // Observation state
  let obsState = {
    phase: 'setup', // 'setup' | 'live' | 'summary'
    grade: null,
    subject: null,
    teacher: null,
    period: null,
    noteType: 'observation',
    startTime: null,
    timerInterval: null,
    notes: [],       // { time: Date, elapsed: string, text: string, tags: string[], type: string }
    activeTags: []   // Currently toggled tags
  };

  // Past observations — Westfield ES sample walkthroughs
  const pastObservations = [
    { teacher: 'Ms. Cho', grade: '2nd', subject: 'Math', period: 'Period 2', date: 'Mar 6, 2026', duration: '18 min', initials: 'RC', notes: 10 },
    { teacher: 'Mr. Watts', grade: '3rd', subject: 'ELA', period: 'Period 1', date: 'Mar 5, 2026', duration: '22 min', initials: 'MW', notes: 8 },
    { teacher: 'Ms. Lawson', grade: 'K', subject: 'General', period: 'Morning', date: 'Mar 4, 2026', duration: '15 min', initials: 'ML', notes: 6 },
  ];

  function renderObservationsView() {
    // Render period pills
    const periodPills = document.getElementById('obsPeriodPills');
    if (periodPills) {
      const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Period 7', 'Period 8'];
      periodPills.innerHTML = periods.map(p =>
        `<button class="obs-pill" data-period="${p}">${p}</button>`
      ).join('');
      periodPills.querySelectorAll('.obs-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          obsState.period = btn.dataset.period;
          periodPills.querySelectorAll('.obs-pill').forEach(p => p.classList.toggle('selected', p.dataset.period === btn.dataset.period));
        });
      });
    }

    // Render grade pills
    const gradePills = document.getElementById('obsGradePills');
    if (gradePills) {
      const grades = Object.keys(teacherRoster);
      gradePills.innerHTML = grades.map(g =>
        `<button class="obs-pill" data-grade="${g}">${g}</button>`
      ).join('');
      gradePills.querySelectorAll('.obs-pill').forEach(btn => {
        btn.addEventListener('click', () => selectGrade(btn.dataset.grade));
      });
    }

    // Render past observations
    const pastList = document.getElementById('obsPastList');
    if (pastList) {
      pastList.innerHTML = pastObservations.map(o => `
        <div class="obs-past-item">
          <div class="obs-past-avatar">${o.initials}</div>
          <div class="obs-past-info">
            <div class="obs-past-name">${o.teacher}</div>
            <div class="obs-past-detail">${o.grade} &middot; ${o.subject} &middot; ${o.period} &middot; ${o.date}</div>
          </div>
          <div class="obs-past-duration">${o.duration}</div>
        </div>
      `).join('');
    }

    // Wire up stamp button
    const stampBtn = document.getElementById('obsStampBtn');
    if (stampBtn) {
      stampBtn.addEventListener('click', addObsNote);
    }

    // Wire up note input enter key (Ctrl+Enter for textarea)
    const noteInput = document.getElementById('obsNoteInput');
    if (noteInput) {
      noteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          addObsNote();
        }
      });
    }

    // Wire up tag toggles
    document.querySelectorAll('.obs-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        tag.classList.toggle('active');
        updateActiveTags();
      });
    });

    // Wire up start button
    const startBtn = document.getElementById('obsStartBtn');
    if (startBtn) {
      startBtn.addEventListener('click', startObservation);
    }

    // Wire up end button
    const endBtn = document.getElementById('obsEndBtn');
    if (endBtn) {
      endBtn.addEventListener('click', endObservation);
    }

    // Wire up new observation button
    const newBtn = document.getElementById('obsNewBtn');
    if (newBtn) {
      newBtn.addEventListener('click', resetObservation);
    }

    // Wire up note type buttons
    document.querySelectorAll('.obs-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.obs-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        obsState.noteType = btn.dataset.type;
        // Update placeholder based on type
        const input = document.getElementById('obsNoteInput');
        if (input) {
          const placeholders = {
            observation: 'Type your observation note...',
            recommendation: 'Type your coaching recommendation...',
            quote: 'Type the exact quote you heard...'
          };
          input.placeholder = placeholders[btn.dataset.type] || 'Type a note...';
        }
      });
    });
  }

  function selectGrade(grade) {
    obsState.grade = grade;
    obsState.subject = null;
    obsState.teacher = null;

    // Highlight selected grade
    document.querySelectorAll('#obsGradePills .obs-pill').forEach(p => {
      p.classList.toggle('selected', p.dataset.grade === grade);
    });

    // Show subject step
    const subjectStep = document.getElementById('obsStepSubject');
    const subjectPills = document.getElementById('obsSubjectPills');
    if (subjectStep && subjectPills) {
      subjectStep.classList.remove('hidden');
      const subjects = Object.keys(teacherRoster[grade] || {});
      subjectPills.innerHTML = subjects.map(s =>
        `<button class="obs-pill" data-subject="${s}">${s}</button>`
      ).join('');
      subjectPills.querySelectorAll('.obs-pill').forEach(btn => {
        btn.addEventListener('click', () => selectSubject(btn.dataset.subject));
      });
    }

    // Hide teacher step and start
    document.getElementById('obsStepTeacher')?.classList.add('hidden');
    document.getElementById('obsStartRow')?.classList.add('hidden');
  }

  function selectSubject(subject) {
    obsState.subject = subject;
    obsState.teacher = null;

    // Highlight selected subject
    document.querySelectorAll('#obsSubjectPills .obs-pill').forEach(p => {
      p.classList.toggle('selected', p.dataset.subject === subject);
    });

    // Show teacher step
    const teacherStep = document.getElementById('obsStepTeacher');
    const teacherPills = document.getElementById('obsTeacherPills');
    if (teacherStep && teacherPills) {
      teacherStep.classList.remove('hidden');
      const teachers = teacherRoster[obsState.grade]?.[subject] || [];
      teacherPills.innerHTML = teachers.map(t =>
        `<button class="obs-pill" data-teacher="${t}">${t}</button>`
      ).join('');
      teacherPills.querySelectorAll('.obs-pill').forEach(btn => {
        btn.addEventListener('click', () => selectTeacher(btn.dataset.teacher));
      });
    }

    document.getElementById('obsStartRow')?.classList.add('hidden');
  }

  function selectTeacher(teacher) {
    obsState.teacher = teacher;

    // Highlight selected teacher
    document.querySelectorAll('#obsTeacherPills .obs-pill').forEach(p => {
      p.classList.toggle('selected', p.dataset.teacher === teacher);
    });

    // Show start button
    document.getElementById('obsStartRow')?.classList.remove('hidden');
  }

  function startObservation() {
    obsState.phase = 'live';
    obsState.startTime = new Date();
    obsState.notes = [];
    obsState.activeTags = [];

    // Update live header info
    const teacherEl = document.getElementById('obsLiveTeacher');
    const metaEl = document.getElementById('obsLiveMeta');
    if (teacherEl) teacherEl.textContent = obsState.teacher;
    if (metaEl) metaEl.textContent = `${obsState.grade} \u00B7 ${obsState.subject}${obsState.period ? ' \u00B7 ' + obsState.period : ''} \u00B7 ${obsState.startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    // Switch phases
    document.getElementById('obsSetup')?.classList.add('hidden');
    document.getElementById('obsLive')?.classList.remove('hidden');
    document.getElementById('obsSummary')?.classList.add('hidden');

    // Clear previous entries
    const timeline = document.getElementById('obsTimeline');
    if (timeline) {
      timeline.innerHTML = `
        <div class="obs-timeline-empty">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--color-text-faint)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>Tap <strong>Stamp</strong> to log your first note</p>
        </div>
      `;
    }

    // Reset tags
    document.querySelectorAll('.obs-tag').forEach(t => t.classList.remove('active'));

    // Start timer
    const timerEl = document.getElementById('obsTimer');
    obsState.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - obsState.startTime) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function updateActiveTags() {
    obsState.activeTags = [];
    document.querySelectorAll('.obs-tag.active').forEach(t => {
      obsState.activeTags.push(t.dataset.tag);
    });
  }

  function addObsNote() {
    const input = document.getElementById('obsNoteInput');
    const text = input?.value.trim() || '';
    const tags = [...obsState.activeTags];

    if (!text && tags.length === 0) return;

    const now = new Date();
    const elapsed = Math.floor((now - obsState.startTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');

    const note = {
      time: now,
      timeStr: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
      elapsed: `${mins}:${secs}`,
      text: text,
      tags: tags,
      type: obsState.noteType || 'observation'
    };

    obsState.notes.push(note);

    // Render in timeline
    const timeline = document.getElementById('obsTimeline');
    if (timeline) {
      // Remove empty state
      const empty = timeline.querySelector('.obs-timeline-empty');
      if (empty) empty.remove();

      const entry = document.createElement('div');
      entry.className = 'obs-note-entry';

      const typeLabels = { observation: 'OBS', recommendation: 'REC', quote: 'QUOTE' };
      const typeClass = `obs-note-type--${note.type}`;
      const textClass = note.type === 'quote' ? 'obs-note-text obs-note-text--quote' : 'obs-note-text';
      const quotePrefix = note.type === 'quote' ? '\u201C' : '';
      const quoteSuffix = note.type === 'quote' ? '\u201D' : '';

      entry.innerHTML = `
        <div class="obs-note-time">${note.elapsed}</div>
        <div class="obs-note-body">
          <div class="obs-note-type ${typeClass}">${typeLabels[note.type]}</div>
          ${note.text ? `<div class="${textClass}">${quotePrefix}${note.text}${quoteSuffix}</div>` : ''}
          ${note.tags.length ? `
            <div class="obs-note-tags">
              ${note.tags.map(t => `<span class="obs-note-tag">${t}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
      timeline.appendChild(entry);
      entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Clear input and deselect tags
    if (input) input.value = '';
    document.querySelectorAll('.obs-tag').forEach(t => t.classList.remove('active'));
    obsState.activeTags = [];

    // Reset note type to observation
    obsState.noteType = 'observation';
    document.querySelectorAll('.obs-type-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('obsTypeObs')?.classList.add('active');
    const inputEl = document.getElementById('obsNoteInput');
    if (inputEl) inputEl.placeholder = 'Type your observation note...';
  }

  function endObservation() {
    // Stop timer
    if (obsState.timerInterval) {
      clearInterval(obsState.timerInterval);
      obsState.timerInterval = null;
    }

    obsState.phase = 'summary';

    // Calculate duration
    const endTime = new Date();
    const durationMs = endTime - obsState.startTime;
    const durationMins = Math.round(durationMs / 60000);

    // Switch phases
    document.getElementById('obsLive')?.classList.add('hidden');
    document.getElementById('obsSummary')?.classList.remove('hidden');

    // Populate summary
    const title = document.getElementById('obsSummaryTitle');
    const meta = document.getElementById('obsSummaryMeta');
    if (title) title.textContent = `${obsState.teacher} \u2014 Observation`;
    if (meta) meta.textContent = `${obsState.grade} \u00B7 ${obsState.subject} \u00B7 ${obsState.startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} \u00B7 ${durationMins} min`;

    // AI Insights (simulated)
    const insightsEl = document.getElementById('obsSummaryInsights');
    if (insightsEl) {
      const allTags = obsState.notes.flatMap(n => n.tags);
      const recNotes = obsState.notes.filter(n => n.type === 'recommendation');
      const quoteNotes = obsState.notes.filter(n => n.type === 'quote');
      const hasPacing = allTags.includes('Pacing') || allTags.includes('HW Review');
      const hasEnvironment = allTags.includes('Board setup') || allTags.includes('Learning target') || allTags.includes('Room organized');
      const hasParaIssue = allTags.includes('Para disengaged');
      const hasOutbursts = allTags.includes('Outbursts');

      insightsEl.innerHTML = `<ul>
        <li>Observation captured <strong>${obsState.notes.length} timestamped entries</strong> over ${durationMins} minutes \u2014 ${recNotes.length} recommendation${recNotes.length !== 1 ? 's' : ''} and ${quoteNotes.length} direct quote${quoteNotes.length !== 1 ? 's' : ''} logged.</li>
        ${hasPacing ? '<li><strong>Pacing concern flagged</strong> \u2014 review time allocation for homework review vs. new instruction. Best practice: homework review under 10 minutes to maximize new learning time.</li>' : ''}
        ${hasEnvironment ? '<li><strong>Classroom environment</strong> was noted \u2014 check that learning targets are posted as actionable I Can statements and anchor charts are relevant to current unit.</li>' : ''}
        ${hasParaIssue ? '<li><strong>Support staff engagement</strong> needs attention \u2014 paraprofessional was observed disengaged. Schedule a quick alignment meeting to clarify co-teaching expectations.</li>' : ''}
        ${hasOutbursts ? '<li><strong>Student outbursts</strong> observed \u2014 consider reviewing classroom management routines and response protocols for calling out without raising hands.</li>' : ''}
        <li>Suggest scheduling a <strong>post-observation debrief</strong> within 48 hours to discuss findings while context is fresh.</li>
      </ul>`;
    }

    // Tag summary
    const tagsEl = document.getElementById('obsSummaryTags');
    if (tagsEl) {
      const tagCounts = {};
      obsState.notes.forEach(n => {
        n.tags.forEach(t => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      });
      tagsEl.innerHTML = Object.entries(tagCounts).map(([tag, count]) =>
        `<span class="obs-tag-summary-pill">${tag} <span class="obs-tag-summary-count">${count}</span></span>`
      ).join('');
      if (Object.keys(tagCounts).length === 0) {
        tagsEl.innerHTML = '<span style="font-size:var(--text-xs);color:var(--color-text-faint);">No tags used</span>';
      }
    }

    // Full timeline
    const timelineEl = document.getElementById('obsSummaryTimeline');
    if (timelineEl) {
      timelineEl.innerHTML = obsState.notes.map(n => {
        const typeLabels = { observation: 'OBS', recommendation: 'REC', quote: 'QUOTE' };
        const typeClass = `obs-note-type--${n.type || 'observation'}`;
        const textClass = n.type === 'quote' ? 'obs-note-text obs-note-text--quote' : 'obs-note-text';
        const quotePrefix = n.type === 'quote' ? '\u201C' : '';
        const quoteSuffix = n.type === 'quote' ? '\u201D' : '';
        return `
        <div class="obs-note-entry">
          <div class="obs-note-time">${n.elapsed}</div>
          <div class="obs-note-body">
            <div class="obs-note-type ${typeClass}">${typeLabels[n.type || 'observation']}</div>
            ${n.text ? `<div class="${textClass}">${quotePrefix}${n.text}${quoteSuffix}</div>` : ''}
            ${n.tags.length ? `
              <div class="obs-note-tags">
                ${n.tags.map(t => `<span class="obs-note-tag">${t}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
      }).join('');
    }
  }

  function resetObservation() {
    obsState = {
      phase: 'setup',
      grade: null,
      subject: null,
      teacher: null,
      period: null,
      noteType: 'observation',
      startTime: null,
      timerInterval: null,
      notes: [],
      activeTags: []
    };

    // Reset all pills
    document.querySelectorAll('.obs-pill').forEach(p => p.classList.remove('selected'));
    document.getElementById('obsStepSubject')?.classList.add('hidden');
    document.getElementById('obsStepTeacher')?.classList.add('hidden');
    document.getElementById('obsStartRow')?.classList.add('hidden');

    // Switch phases
    document.getElementById('obsSetup')?.classList.remove('hidden');
    document.getElementById('obsLive')?.classList.add('hidden');
    document.getElementById('obsSummary')?.classList.add('hidden');

    // Re-render
    renderObservationsView();
  }

  /* ============================================
     INITIALIZE ALL VIEWS
     ============================================ */
  renderKPIs();
  renderDashboardFilters();
  renderPriorityQueue();
  renderTimeline();
  renderCaptures();
  renderInsights();
  renderTasksView();
  renderWordBoard();
  renderPulseView();
  renderIntegrationsView();
  renderObservationsView();

  // Tap detail input updates preview
  const tapDetail = document.getElementById('tapDetail');
  if (tapDetail) {
    tapDetail.addEventListener('input', () => {
      const selected = {};
      document.querySelectorAll('.word-btn.selected').forEach(b => {
        selected[b.dataset.category] = b.dataset.word;
      });
      updateTapPreview(selected);
    });
  }

})();
