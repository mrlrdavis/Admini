/**
 * AdminI Mobile App ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â app.js
 * All interactivity: tab switching, recording, word board, dark mode, etc.
 * In-memory state only ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â no persistent storage used.
 */

const App = (function () {
  'use strict';

  // =========================================
  // WORD BOARD DATA
  // =========================================
  const defaultWordBoardData = [
    { cat: 'who', label: 'WHO', words: ['Parent', 'Student', 'Teacher', 'Staff', 'Counselor', 'Visitor'] },
    { cat: 'what', label: 'WHAT', words: ['Concern', 'Praise', 'Request', 'Incident', 'Follow-up', 'Reminder', 'Observation'] },
    { cat: 'urgency', label: 'URGENCY', words: ['Urgent', 'High', 'Normal', 'Low'] },
    { cat: 'domain', label: 'DOMAIN', words: ['Safety', 'Academic', 'Behavior', 'Facilities', 'Budget', 'Schedule', 'Health'] },
    { cat: 'where', label: 'WHERE', words: ['Office', 'Hallway', 'Cafeteria', 'Gym', 'Classroom', 'Playground', 'Parking', 'Library'] }
  ];

  // Deep clone for mutable copy
  let wordBoardData = JSON.parse(JSON.stringify(defaultWordBoardData));

  // =========================================
  // QUICK CAPTURES DATA
  // =========================================
  // No default quick captures for real users ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â start empty
  const defaultQuickCaptures = [];

  let quickCaptures = JSON.parse(JSON.stringify(defaultQuickCaptures));

  // =========================================
  // DASHBOARD DATA
  // =========================================
  const kpiData = [
    { id: 'tasks', value: '0', label: 'Tasks', accent: false },
    { id: 'unresolved', value: '0', label: 'Unresolved', accent: false },
    { id: 'meetings', value: '0', label: 'Meetings', accent: false },
    { id: 'attendance', value: '0%', label: 'Attendance', accent: false },
    { id: 'staff-coverage', value: '0%', label: 'Staff Coverage', accent: false }
  ];

  const tasksToday = [];

  const unresolvedItems = [];

  const meetingsToday = [];

  const staffCoverage = [];

  const attendanceData = {
    enrolled: 0, present: 0, absent: 0, tardy: 0,
    byGrade: []
  };

  function taskBridgeRequest(type, payload) {
    return new Promise((resolve, reject) => {
      if (window.parent === window) {
        reject(new Error('Task persistence requires the signed-in AdminI app shell.'));
        return;
      }
      const requestId = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error('Task request timed out.'));
      }, 15000);

      function onMessage(event) {
        const data = event.data || {};
        if (data.requestId !== requestId || data.type !== `${type}:result`) return;
        window.clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        if (data.ok) resolve(data);
        else reject(new Error(data.error || 'Task request failed.'));
      }

      window.addEventListener('message', onMessage);
      window.parent.postMessage({ type, requestId, ...payload }, '*');
    });
  }

  function formatTaskDue(dueAt) {
    if (!dueAt) return 'No due date';
    const date = new Date(dueAt);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function parseTaskLabels(description) {
    const match = String(description || '').match(/^Labels:\s*([^\n]+)/i);
    return match ? match[1].split(',').map((label) => label.trim()).filter(Boolean) : ['student'];
  }

  function persistedTaskToMobileTask(task) {
    return {
      id: task.id,
      title: task.title,
      priority: task.priority || 'normal',
      status: task.status || 'open',
      due: formatTaskDue(task.dueAt),
      labels: parseTaskLabels(task.description)
    };
  }

  function applyPersistedTasks(tasks) {
    tasksToday.splice(0, tasksToday.length, ...(tasks || []).map(persistedTaskToMobileTask));
    unresolvedItems.splice(0, unresolvedItems.length, ...tasksToday.filter((task) => task.status !== 'completed'));
    renderTaskList();
    renderKPICards();
  }

  async function loadPersistedTasks() {
    try {
      const result = await taskBridgeRequest('tasks:list', {});
      applyPersistedTasks(result.tasks || []);
    } catch (error) {
      console.warn(error);
    }
  }

  async function createPersistedTask(input) {
    const result = await taskBridgeRequest('tasks:create', { task: input });
    const created = persistedTaskToMobileTask(result.task);
    tasksToday.unshift(created);
    unresolvedItems.unshift(created);
    renderTaskList();
    renderKPICards();
    return created;
  }

  async function persistTaskStatus(taskId, completed) {
    if (!taskId) return;
    try {
      const result = await taskBridgeRequest('tasks:update-status', {
        id: taskId,
        status: completed ? 'completed' : 'open'
      });
      const updated = persistedTaskToMobileTask(result.task);
      const index = tasksToday.findIndex((task) => task.id === taskId);
      if (index >= 0) tasksToday.splice(index, 1, updated);
      unresolvedItems.splice(0, unresolvedItems.length, ...tasksToday.filter((task) => task.status !== 'completed'));
      renderKPICards();
    } catch (error) {
      showToast(error.message || 'Task update failed');
      loadPersistedTasks();
    }
  }

  // Word icon map
  const wordIcons = {
    'Parent': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚Â¤', 'Student': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢', 'Teacher': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã‚Â¡', 'Staff': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â«', 'Counselor': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â¬', 'Visitor': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Âª',
    'Concern': 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â', 'Praise': 'ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚Â­Ãƒâ€šÃ‚Â', 'Request': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹', 'Incident': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¨', 'Follow-up': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾', 'Reminder': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Â', 'Observation': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â',
    'Urgent': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â´', 'High': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â ', 'Normal': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¢', 'Low': 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Âª',
    'Safety': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒâ€šÃ‚Â¡ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â', 'Academic': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“', 'Behavior': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â¤Ãƒâ€šÃ‚Â', 'Facilities': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â', 'Budget': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â°', 'Schedule': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦', 'Health': 'ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â¤ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â',
    'Office': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â¢', 'Hallway': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¶', 'Cafeteria': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â½ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â', 'Gym': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬', 'Classroom': 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â', 'Playground': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¡', 'Parking': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦Ãƒâ€šÃ‚Â¿ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â', 'Library': 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢'
  };

  const wordIconChoices = [
    { label: 'Pin', icon: '&#128204;' },
    { label: 'Person', icon: '&#128100;' },
    { label: 'School', icon: '&#127979;' },
    { label: 'Alert', icon: '&#9888;' },
    { label: 'Star', icon: '&#11088;' },
    { label: 'Check', icon: '&#9989;' },
    { label: 'Calendar', icon: '&#128197;' },
    { label: 'Clock', icon: '&#9200;' },
    { label: 'Note', icon: '&#128221;' },
    { label: 'Flag', icon: '&#128681;' }
  ];

  // Quick capture icon SVGs
  const qcIcons = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m13 2-2 2.5h3L12 7"/><path d="M10 14v-3"/><path d="M14 14v-3"/><path d="M11 19c-1.7 0-3-1.3-3-3v-2h8v2c0 1.7-1.3 3-3 3h-2Z"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>'
  ];

  // =========================================
  // STATE
  // =========================================
  let currentUserRole = '';

  const state = {
    activeTab: 'capture',
    captureMode: 'voice',
    isRecording: false,
    recordingInterval: null,
    selectedWords: {},          // { who: 'Parent', what: 'Concern', ... }
    // No demo captures ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â empty for new users
    recentCaptures: [],
    theme: null,
    boardEditing: false,
    qcEditing: false,
    newTaskPriority: 'normal',
    newTaskLabels: ['student'],
    sheetPage: 0,
    dupConfirmed: false,
    newTaskDue: 'today',
    newTaskTime: '',
    transcriptionText: '',
    transcriptionTimeout: null,
    pulseTimer: 23,
    addingWordCat: null,  // category currently adding a word to
    addWordIcon: wordIconChoices[0].icon
  };

  function emptyState(title, description) {
    return `
      <div class="capture-empty">
        <div class="capture-empty__title">${title}</div>
        <div class="capture-empty__desc">${description}</div>
      </div>
    `;
  }

  function clearStaticDemoContent() {
    document.querySelectorAll('.priority-queue .priority-card').forEach((el) => el.remove());
    document.querySelector('.priority-queue')?.insertAdjacentHTML('beforeend', emptyState('No tasks yet', 'New tasks will appear after you capture or add them.'));
    document.querySelector('.activity-feed')?.querySelectorAll('.activity-item').forEach((el) => el.remove());
    document.querySelector('.activity-feed')?.insertAdjacentHTML('beforeend', emptyState('No activity yet', 'Activity will appear after you create captures, tasks, or observations.'));
    const taskList = document.getElementById('task-list');
    if (taskList) taskList.innerHTML = emptyState('No tasks yet', 'Use capture or the add task button to create your first task.');
    const pulseTimeline = document.querySelector('.pulse-timeline');
    if (pulseTimeline) pulseTimeline.innerHTML = emptyState('No Pulse checkpoints yet', 'Add schedule or capture context to create Pulse prompts.');
    document.querySelectorAll('.pulse-stat__value').forEach((el) => { el.textContent = '0'; });
    const pulseCountdownTitle = document.querySelector('.pulse-countdown__title');
    if (pulseCountdownTitle) pulseCountdownTitle.textContent = 'No Pulse scheduled';
  }

  function setProfileText(profile) {
    const name = profile?.name || profile?.email || '';
    const schoolName = profile?.schoolName || 'Not provided';
    const role = profile?.role || 'Not provided';
    const greeting = getTimeGreeting();
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) greetingEl.innerHTML = `${greeting}, <span id="user-id"></span>`;
    const userEl = document.getElementById('user-id');
    if (userEl) userEl.textContent = name;
    const greetingSubtext = document.querySelector('.dashboard__greeting p');
    if (greetingSubtext) greetingSubtext.textContent = `${schoolName} - ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
    const profileRows = [...document.querySelectorAll('#subview-settings .settings-item')];
    profileRows.forEach((row) => {
      const label = row.querySelector('.settings-item__label')?.textContent?.trim();
      const value = row.querySelector('.settings-item__value');
      if (!value) return;
      if (label === 'Name') value.textContent = name || 'Not provided';
      if (label === 'School') value.textContent = schoolName;
      if (label === 'Email') value.textContent = profile?.email || 'Not provided';
      if (label === 'Role') value.textContent = role;
    });
  }

  function getTimeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function applyUserProfile(profile) {
    currentUserRole = (profile?.role || '').toLowerCase();
    setProfileText(profile);
  }

  // Sample transcription phrases for demo
  const sampleTranscriptions = [];

  // =========================================
  // INITIALIZATION
  // =========================================
  function init() {
    initTheme();
    updateClock();
    setInterval(updateClock, 30000);
    clearStaticDemoContent();
    renderRecentCaptures();
    renderWordBoard();
    renderQuickCaptures();
    renderKPICards();
    initHashRouting();
    startPulseTimer();
    initMobObs();
    loadPersistedTasks();
    initProfileEditButtons();
    window.AdminiPrototype = { applyUserProfile };

    // Refresh task list when the page regains visibility (multi-device consistency)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadPersistedTasks();
      }
    });
  }

  function initTheme() {
    state.theme = 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeToggle();
  }

  function initHashRouting() {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['capture', 'dashboard', 'tasks', 'pulse', 'more'].includes(hash)) {
      switchTab(hash);
    }
    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '');
      if (h && h !== state.activeTab) {
        switchTab(h);
      }
    });
  }

  // =========================================
  // CLOCK
  // =========================================
  function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('current-time');
    const dateEl = document.getElementById('current-date');
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  // =========================================
  // TAB NAVIGATION
  // =========================================
  function switchTab(tab) {
    state.activeTab = tab;

    // Update views
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + tab);
    if (view) view.classList.add('active');

    // Update tab bar
    document.querySelectorAll('.tab-bar__item').forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
    const activeBtn = document.querySelector(`.tab-bar__item[data-tab="${tab}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.setAttribute('aria-selected', 'true');
    }

    // Hide sub-views when switching to More tab
    if (tab === 'more') {
      hideSubView();
    }

    // Show/hide FAB
    const fab = document.getElementById('tasks-fab');
    if (fab) {
      fab.classList.toggle('hidden', tab !== 'tasks');
    }

    // Update hash
    window.location.hash = tab;

    // Scroll to top
    const content = document.querySelector('.app-content');
    if (content) content.scrollTop = 0;
  }

  // =========================================
  // CAPTURE MODE TOGGLE
  // =========================================
  function setMode(mode) {
    state.captureMode = mode;
    const slider = document.getElementById('mode-slider');
    const btnVoice = document.getElementById('btn-voice');
    const btnTap = document.getElementById('btn-tap');
    const voiceMode = document.getElementById('voice-mode');
    const tapMode = document.getElementById('tap-mode');

    if (mode === 'voice') {
      slider.classList.remove('right');
      btnVoice.classList.add('active');
      btnVoice.setAttribute('aria-selected', 'true');
      btnTap.classList.remove('active');
      btnTap.setAttribute('aria-selected', 'false');
      voiceMode.classList.remove('hidden');
      tapMode.classList.remove('active');
    } else {
      slider.classList.add('right');
      btnTap.classList.add('active');
      btnTap.setAttribute('aria-selected', 'true');
      btnVoice.classList.remove('active');
      btnVoice.setAttribute('aria-selected', 'false');
      voiceMode.classList.add('hidden');
      tapMode.classList.add('active');
    }
  }

  function goToCapture(mode) {
    switchTab('capture');
    setTimeout(() => setMode(mode), 100);
  }

  // =========================================
  // VOICE RECORDING (SIMULATED)
  // =========================================
  function toggleRecording() {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function startRecording() {
    state.isRecording = true;
    const container = document.getElementById('mic-container');
    const transArea = document.getElementById('transcription-area');
    const transText = document.getElementById('transcription-text');
    const cursor = document.getElementById('transcription-cursor');

    container.classList.add('recording');
    transArea.classList.add('visible');
    transText.textContent = '';
    cursor.style.display = 'inline-block';

    if (!sampleTranscriptions.length) {
      transText.textContent = 'Listening...';
      return;
    }

    // Use captured input when transcription services are connected.
    const sample = sampleTranscriptions[Math.floor(Math.random() * sampleTranscriptions.length)];
    const words = sample.text.split(' ');
    let wordIndex = 0;

    state.recordingInterval = setInterval(() => {
      if (wordIndex < words.length) {
        transText.textContent += (wordIndex === 0 ? '' : ' ') + words[wordIndex];
        wordIndex++;
        // Auto-scroll
        transArea.scrollTop = transArea.scrollHeight;
      } else {
        // Auto-stop after text is complete
        setTimeout(() => {
          stopRecording(sample);
        }, 800);
        clearInterval(state.recordingInterval);
      }
    }, 120);

    // Vibrate if available (haptic feedback)
    if (navigator.vibrate) navigator.vibrate(50);
  }

  function stopRecording(sample) {
    state.isRecording = false;
    const container = document.getElementById('mic-container');
    const cursor = document.getElementById('transcription-cursor');

    container.classList.remove('recording');
    cursor.style.display = 'none';

    if (state.recordingInterval) {
      clearInterval(state.recordingInterval);
      state.recordingInterval = null;
    }

    // Show AI suggestion
    if (sample) {
      showAISuggestion(sample);
    }
  }

  function showAISuggestion(sample) {
    const suggestion = document.getElementById('ai-suggestion');
    const meta = document.getElementById('ai-meta');
    const task = document.getElementById('ai-task');
    const stepText = document.getElementById('ai-step-text');

    meta.innerHTML = `
      <span class="pill pill--${sample.categoryClass}">${sample.category}</span>
      <span class="pill pill--${sample.priorityClass}">${sample.priority}</span>
    `;
    task.textContent = sample.task;
    stepText.textContent = sample.step;
    suggestion.classList.add('visible');
  }

  function confirmCapture() {
    const transText = document.getElementById('transcription-text');
    const text = transText.textContent;

    if (text) {
      // Add to recent captures
      const now = new Date();
      state.recentCaptures.unshift({
        time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        text: text,
        mode: 'voice',
        category: 'Captured',
        priority: 'Normal',
        categoryClass: 'student',
        priorityClass: 'normal'
      });
      if (state.recentCaptures.length > 5) state.recentCaptures.pop();
      renderRecentCaptures();
    }

    // Reset
    resetVoiceCapture();
    showToast('Capture confirmed!');
  }

  function editCapture() {
    // Focus on transcription for editing (simulated)
    showToast('Edit mode ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â tap confirm when done');
  }

  function resetVoiceCapture() {
    const transArea = document.getElementById('transcription-area');
    const suggestion = document.getElementById('ai-suggestion');
    transArea.classList.remove('visible');
    suggestion.classList.remove('visible');
  }

  // =========================================
  // RECENT CAPTURES
  // =========================================
  function renderRecentCaptures() {
    const list = document.getElementById('recent-list-voice');
    if (!list) return;
    if (!state.recentCaptures || state.recentCaptures.length === 0) {
      list.innerHTML = `
        <div class="capture-empty">
          <div class="capture-empty__title">No captures yet</div>
          <div class="capture-empty__desc">You haven't created any captures yet. Start with a voice or tap capture to see them here.</div>
          <div style="margin-top:10px;"><button class="btn btn--primary" onclick="App.switchTab('capture')">Create your first capture</button></div>
        </div>
      `;
      return;
    }

    list.innerHTML = state.recentCaptures.slice(0, 5).map(cap => `
      <div class="capture-card">
        <div class="capture-card__header">
          <span class="capture-card__time">${cap.time}</span>
          <span class="capture-card__mode">
            ${cap.mode === 'voice' ?
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>' :
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>'
            }
            ${cap.mode === 'voice' ? 'Voice' : 'Tap'}
          </span>
        </div>
        <div class="capture-card__text">${cap.text}</div>
        <div class="capture-card__pills">
          <span class="pill pill--${cap.categoryClass}">${cap.category}</span>
          <span class="pill pill--${cap.priorityClass}">${cap.priority}</span>
        </div>
      </div>
    `).join('');
  }

  // =========================================
  // WORD BOARD ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â DYNAMIC RENDERING
  // =========================================
  function renderWordBoard() {
    const board = document.getElementById('word-board');
    if (!board) return;

    const isEditing = state.boardEditing;
    const gridColClass = { 'urgency': 'word-board__grid--4col', 'where': 'word-board__grid--4col' };

    // Build the edit button area
    let editBtnHTML;
    if (isEditing) {
      editBtnHTML = `
        <div class="word-board__edit-area">
          <button class="word-board__done-btn" onclick="App.toggleBoardEdit()">Done</button>
          <button class="word-board__reset-btn" onclick="App.resetWordBoard()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
            Reset Board
          </button>
        </div>
      `;
    } else {
      editBtnHTML = `
        <button class="word-board__edit-btn" aria-label="Edit board" onclick="App.toggleBoardEdit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
      `;
    }

    let sectionsHTML = wordBoardData.map(section => {
      const colClass = gridColClass[section.cat] || '';
      const wordsHTML = section.words.map(word => {
        const icon = wordIcons[word] || 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã¢â‚¬â„¢';
        const isSelected = state.selectedWords[section.cat] === word;
        const selectedClass = isSelected ? ' selected' : '';
        const deleteBtn = isEditing ? `<button class="word-btn__delete" onclick="event.stopPropagation(); App.removeWordFromBoard('${section.cat}', '${escapeHTML(word)}')" aria-label="Remove ${word}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>` : '';
        return `
          <button class="word-btn word-btn--${section.cat}${selectedClass}" data-cat="${section.cat}" data-val="${escapeHTML(word)}" onclick="App.tapWord(this)">
            ${deleteBtn}
            <span class="word-btn__icon">${icon}</span>
            ${escapeHTML(word)}
            <span class="word-btn__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>
          </button>
        `;
      }).join('');

      const addBtnHTML = isEditing ? `
        <button class="word-btn word-btn--add" onclick="App.showAddWordInput('${section.cat}')" aria-label="Add word to ${section.label}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          Add
        </button>
      ` : '';

      return `
        <div class="word-board__section">
          <div class="word-board__label word-board__label--${section.cat}">${section.label}</div>
          <div class="word-board__grid ${colClass}">
            ${wordsHTML}
            ${addBtnHTML}
          </div>
        </div>
      `;
    }).join('');

    const bottomBar = isEditing ? `
      <div class="word-board__bottom-bar">
        <div class="word-board__bottom-title">Quick edits: add or remove words. Use the desktop app for full board customization.</div>
        <div class="word-board__bottom-actions">
          ${wordBoardData.map(section => `<button class="word-board__bottom-chip" onclick="App.showAddWordInput('${section.cat}')">${section.label}</button>`).join('')}
        </div>
      </div>
    ` : '';

    board.className = 'word-board' + (isEditing ? ' word-board--editing' : '');
    board.innerHTML = editBtnHTML + sectionsHTML + bottomBar;
  }

  function openBoardCustomization() {
    hideSubView();
    switchTab('capture');
    if (!state.boardEditing) {
      state.boardEditing = true;
    }
    state.addingWordCat = null;
    hideAddWordSheet();
    renderWordBoard();
    showToast('Board edit mode active');
  }

  function downloadExportData() {
    const rows = [
      ['Timestamp', 'Mode', 'Text', 'Category', 'Priority']
    ];
    state.recentCaptures.forEach(cap => {
      rows.push([cap.time, cap.mode, cap.text, cap.category, cap.priority]);
    });
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const filename = 'admini-data-export.csv';

    if (window.showSaveFilePicker) {
      window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }]
      }).then(handle => handle.createWritable()).then(writable => writable.write(blob).then(() => writable.close())).then(() => {
        showToast('Export saved');
      }).catch(() => {
        showToast('Export canceled');
      });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Export downloaded');
    }
  }

  function toggleBoardEdit() {
    state.boardEditing = !state.boardEditing;
    // Close any add word input
    state.addingWordCat = null;
    hideAddWordSheet();
    renderWordBoard();
    if (!state.boardEditing) {
      showToast('Edit mode off');
    }
  }

  function removeWordFromBoard(cat, word) {
    const section = wordBoardData.find(s => s.cat === cat);
    if (!section) return;
    const idx = section.words.indexOf(word);
    if (idx === -1) return;
    section.words.splice(idx, 1);
    // Also remove from selected if it was selected
    if (state.selectedWords[cat] === word) {
      delete state.selectedWords[cat];
    }
    renderWordBoard();
    updateSelectedArea();
    updateAIPreview();
    updateCaptureButton();
    showToast(`Removed: ${word}`);
  }

  function showAddWordInput(cat) {
    state.addingWordCat = cat;
    const section = wordBoardData.find(s => s.cat === cat);
    const label = section ? section.label : cat;

    // Show the add word bottom sheet
    const overlay = document.getElementById('add-word-overlay');
    const sheet = document.getElementById('add-word-sheet');
    const title = document.getElementById('add-word-title');
    const input = document.getElementById('add-word-input');
    const iconGrid = document.getElementById('add-word-icon-grid');

    title.textContent = `Add word to ${label}`;
    input.value = '';
    state.addWordIcon = wordIconChoices[0].icon;
    if (iconGrid) {
      iconGrid.innerHTML = wordIconChoices.map((choice, index) => `
        <button class="icon-choice${index === 0 ? ' selected' : ''}" type="button" onclick="App.setAddWordIcon('${choice.icon}', this)" aria-label="${choice.label}">
          <span>${choice.icon}</span>
          ${choice.label}
        </button>
      `).join('');
    }
    overlay.classList.add('visible');
    sheet.classList.add('visible');
    setTimeout(() => input.focus(), 350);
  }

  function setAddWordIcon(icon, button) {
    state.addWordIcon = icon;
    document.querySelectorAll('.icon-choice').forEach((choice) => choice.classList.remove('selected'));
    button?.classList.add('selected');
  }

  function hideAddWordSheet() {
    const overlay = document.getElementById('add-word-overlay');
    const sheet = document.getElementById('add-word-sheet');
    if (overlay) overlay.classList.remove('visible');
    if (sheet) sheet.classList.remove('visible');
  }

  function confirmAddWord() {
    const input = document.getElementById('add-word-input');
    const word = input.value.trim();
    if (!word || !state.addingWordCat) return;

    const section = wordBoardData.find(s => s.cat === state.addingWordCat);
    if (!section) return;

    // Prevent duplicates
    if (section.words.includes(word)) {
      showToast('Word already exists');
      return;
    }

    section.words.push(word);
    wordIcons[word] = state.addWordIcon;
    hideAddWordSheet();
    renderWordBoard();
    showToast(`Added: ${word}`);
  }

  function resetWordBoard() {
    wordBoardData = JSON.parse(JSON.stringify(defaultWordBoardData));
    state.selectedWords = {};
    renderWordBoard();
    updateSelectedArea();
    updateAIPreview();
    updateCaptureButton();
    showToast('Board reset to defaults');
  }

  // =========================================
  // QUICK CAPTURES ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â DYNAMIC RENDERING
  // =========================================
  function renderQuickCaptures() {
    const container = document.getElementById('quick-captures-container');
    if (!container) return;

    const isEditing = state.qcEditing;

    // Title area with edit toggle
    let titleHTML;
    if (isEditing) {
      titleHTML = `
        <div class="quick-captures__title-row">
          <div class="quick-captures__title">Quick Captures</div>
          <button class="quick-captures__edit-toggle" onclick="App.toggleQCEdit()">Done</button>
        </div>
      `;
    } else {
      titleHTML = `
        <div class="quick-captures__title-row">
          <div class="quick-captures__title">Quick Captures</div>
          <button class="quick-captures__edit-toggle" onclick="App.toggleQCEdit()" aria-label="Edit quick captures">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
        </div>
      `;
    }

    let listHTML = '';
    if (quickCaptures.length === 0) {
      listHTML = `
        <div class="quick-captures__empty">
          <div class="quick-captures__empty-title">No Quick Captures yet</div>
          <div class="quick-captures__empty-desc">Create a capture and tap "Save as Quick Capture" to save shortcuts here.</div>
          <div style="margin-top:10px;"><button class="btn btn--primary" onclick="App.switchTab('capture')">Go to Capture</button></div>
        </div>
      `;
    } else {
      listHTML = quickCaptures.map((qc, i) => {
      const icon = qcIcons[i % qcIcons.length];
      const deleteBtn = isEditing ? `<button class="qc-delete-btn" onclick="event.stopPropagation(); App.removeQuickCapture('${qc.id}')" aria-label="Remove shortcut"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>` : '';
      return `
        <button class="quick-capture-btn${isEditing ? ' quick-capture-btn--editing' : ''}" onclick="App.useQuickCapture('${qc.id}')">
          ${deleteBtn}
          ${icon}
          ${escapeHTML(qc.label)}
        </button>
      `;
    }).join('');
    }
    // Add "Save as Quick Capture" button in edit mode
    const addBtnHTML = isEditing ? `
      <button class="quick-capture-btn quick-capture-btn--add" onclick="App.saveAsQuickCapture()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
        Save as Quick Capture
      </button>
    ` : '';

    container.innerHTML = `
      ${titleHTML}
      <div class="quick-captures__list">
        ${listHTML}
        ${addBtnHTML}
      </div>
    `;
  }

  function toggleQCEdit() {
    state.qcEditing = !state.qcEditing;
    renderQuickCaptures();
  }

  function removeQuickCapture(id) {
    const idx = quickCaptures.findIndex(qc => qc.id === id);
    if (idx === -1) return;
    const removed = quickCaptures.splice(idx, 1)[0];
    renderQuickCaptures();
    showToast(`Removed: ${removed.label}`);
  }

  function useQuickCapture(id) {
    if (state.qcEditing) return; // Don't activate in edit mode
    const qc = quickCaptures.find(q => q.id === id);
    if (!qc) return;

    // Set selected words
    state.selectedWords = { ...qc.combo };

    // Update button states
    document.querySelectorAll('.word-btn').forEach(b => b.classList.remove('selected'));
    Object.entries(qc.combo).forEach(([cat, val]) => {
      const btn = document.querySelector(`.word-btn[data-cat="${cat}"][data-val="${val}"]`);
      if (btn) btn.classList.add('selected');
    });

    updateSelectedArea();
    updateAIPreview();
    updateCaptureButton();

    // Scroll to capture button
    const captureBtn = document.getElementById('tap-capture-btn');
    if (captureBtn) captureBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function saveAsQuickCapture() {
    const words = state.selectedWords;
    const keys = Object.keys(words);
    if (keys.length === 0) {
      showToast('Select words on the board first');
      return;
    }

    // Build label
    const label = Object.values(words).join(' + ');
    const id = 'qc' + Date.now();
    quickCaptures.push({ id, label, combo: { ...words } });
    renderQuickCaptures();
    showToast('Quick Capture saved!');
  }

  // Legacy quickCapture function for backward compatibility
  function quickCapture(combo) {
    const combos = {
      'parent-concern-hallway': { who: 'Parent', what: 'Concern', where: 'Hallway' },
      'student-incident-safety': { who: 'Student', what: 'Incident', domain: 'Safety' },
      'staff-request-schedule': { who: 'Staff', what: 'Request', domain: 'Schedule' }
    };

    const words = combos[combo];
    if (!words) return;
    state.selectedWords = { ...words };
    document.querySelectorAll('.word-btn').forEach(b => b.classList.remove('selected'));
    Object.entries(words).forEach(([cat, val]) => {
      const btn = document.querySelector(`.word-btn[data-cat="${cat}"][data-val="${val}"]`);
      if (btn) btn.classList.add('selected');
    });
    updateSelectedArea();
    updateAIPreview();
    updateCaptureButton();
    const captureBtn = document.getElementById('tap-capture-btn');
    if (captureBtn) captureBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // =========================================
  // TAP MODE ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â WORD BOARD INTERACTION
  // =========================================
  function tapWord(btn) {
    if (state.boardEditing) return; // Don't select in edit mode
    const cat = btn.dataset.cat;
    const val = btn.dataset.val;

    // Deselect other buttons in same category
    document.querySelectorAll(`.word-btn[data-cat="${cat}"]`).forEach(b => {
      if (b !== btn) b.classList.remove('selected');
    });

    // Toggle this button
    btn.classList.toggle('selected');

    if (btn.classList.contains('selected')) {
      state.selectedWords[cat] = val;
    } else {
      delete state.selectedWords[cat];
    }

    updateSelectedArea();
    updateAIPreview();
    updateCaptureButton();
  }

  function updateSelectedArea() {
    const area = document.getElementById('selected-area');
    if (!area) return;
    const keys = Object.keys(state.selectedWords);

    if (keys.length === 0) {
      area.innerHTML = '<span class="selected-area__label">Tap words above to build your capture...</span>';
      return;
    }

    area.innerHTML = keys.map(cat => `
      <span class="selected-pill">
        ${state.selectedWords[cat]}
        <button class="selected-pill__remove" onclick="App.removeWord('${cat}')" aria-label="Remove ${state.selectedWords[cat]}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </span>
    `).join('');
  }

  function removeWord(cat) {
    delete state.selectedWords[cat];
    // Deselect button
    document.querySelectorAll(`.word-btn[data-cat="${cat}"]`).forEach(b => b.classList.remove('selected'));
    updateSelectedArea();
    updateAIPreview();
    updateCaptureButton();
  }

  function updateAIPreview() {
    const el = document.getElementById('ai-preview-text');
    if (!el) return;
    const words = state.selectedWords;
    const detailInput = document.getElementById('quick-detail-input');
    const detail = detailInput ? detailInput.value : '';

    const parts = [];
    if (words.who) parts.push(words.who);
    if (words.what) parts.push(words.what.toLowerCase());
    if (words.domain) parts.push(`related to ${words.domain.toLowerCase()}`);
    if (words.where) parts.push(`in ${words.where}`);
    if (words.urgency) parts.push(`ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${words.urgency} priority`);
    if (detail) parts.push(`(${detail})`);

    if (parts.length === 0) {
      el.textContent = 'Select words to see task preview...';
      el.className = 'ai-preview__empty';
    } else {
      // Generate a task-like sentence
      let task = '';
      if (words.who && words.what) {
        task = `${words.what} from ${words.who.toLowerCase()}`;
        if (words.domain) task += ` regarding ${words.domain.toLowerCase()}`;
        if (words.where) task += ` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${words.where}`;
        if (detail) task += `. ${detail}`;
      } else {
        task = parts.join(' ');
      }
      el.textContent = task.charAt(0).toUpperCase() + task.slice(1);
      el.className = 'ai-preview__text';
    }
  }

  function updateCaptureButton() {
    const btn = document.getElementById('tap-capture-btn');
    if (!btn) return;
    const keys = Object.keys(state.selectedWords);
    btn.disabled = keys.length === 0;
  }

  function submitTapCapture() {
    const words = state.selectedWords;
    const detail = document.getElementById('quick-detail-input').value;

    if (Object.keys(words).length === 0) return;

    // Build text
    const parts = Object.values(words);
    let text = parts.join(' + ');
    if (detail) text += ` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${detail}`;

    // Determine category
    let catClass = 'student';
    if (words.domain === 'Facilities') catClass = 'facilities';
    else if (words.domain === 'Budget') catClass = 'budget';
    else if (words.domain === 'Safety') catClass = 'safety';

    // Add to recent captures
    const now = new Date();
    state.recentCaptures.unshift({
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      text: text,
      mode: 'tap',
      category: words.domain || 'General',
      priority: words.urgency || 'Normal',
      categoryClass: catClass,
      priorityClass: (words.urgency || 'normal').toLowerCase()
    });
    if (state.recentCaptures.length > 5) state.recentCaptures.pop();

    // Reset
    state.selectedWords = {};
    document.querySelectorAll('.word-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('quick-detail-input').value = '';
    updateSelectedArea();
    updateAIPreview();
    updateCaptureButton();
    renderRecentCaptures();

    showToast('Tap capture saved!');
  }

  function focusDetail() {
    document.getElementById('quick-detail-input').focus();
  }

  // =========================================
  // KPI CARDS ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â DASHBOARD
  // =========================================
  function renderKPICards() {
    const scroll = document.getElementById('kpi-scroll');
    if (!scroll) return;
    const activeTasks = tasksToday.filter((task) => task.status !== 'completed');
    const unresolved = unresolvedItems.filter((task) => task.status !== 'completed');
    const tasksKpi = kpiData.find((item) => item.id === 'tasks');
    const unresolvedKpi = kpiData.find((item) => item.id === 'unresolved');
    if (tasksKpi) tasksKpi.value = String(activeTasks.length);
    if (unresolvedKpi) unresolvedKpi.value = String(unresolved.length);

    scroll.innerHTML = kpiData.map(kpi => `
      <button class="kpi-card${kpi.accent ? ' kpi-card--accent' : ''}" onclick="App.showKPIDetail('${kpi.id}')" aria-label="View ${kpi.label} details">
        <div class="kpi-card__value">${kpi.value}</div>
        <div class="kpi-card__label">${kpi.label}</div>
        <div class="kpi-card__chevron">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </button>
    `).join('');
  }

  function showKPIDetail(kpiId) {
    const overlay = document.getElementById('kpi-detail-overlay');
    const sheet = document.getElementById('kpi-detail-sheet');
    const title = document.getElementById('kpi-detail-title');
    const content = document.getElementById('kpi-detail-content');

    let titleText = '';
    let contentHTML = '';

    switch (kpiId) {
      case 'tasks':
        titleText = 'Today\'s Tasks';
        if (!tasksToday.length) {
          contentHTML = emptyState('No tasks yet', 'Tasks will appear after you capture or add them.');
          break;
        }
        contentHTML = tasksToday.map(t => `
          <div class="kpi-detail-item">
            <div class="kpi-detail-item__row">
              <span class="kpi-detail-item__status ${t.status === 'completed' ? 'kpi-detail-item__status--done' : ''}">
                ${t.status === 'completed' ?
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' :
                  '<span class="kpi-detail-item__dot kpi-detail-item__dot--' + t.priority.toLowerCase() + '"></span>'
                }
              </span>
              <div class="kpi-detail-item__body">
                <div class="kpi-detail-item__title${t.status === 'completed' ? ' kpi-detail-item__title--done' : ''}">${t.title}</div>
                <div class="kpi-detail-item__meta">
                  <span class="pill pill--${t.priority.toLowerCase()}">${t.priority}</span>
                  <span class="kpi-detail-item__time">Due: ${t.due}</span>
                </div>
              </div>
            </div>
          </div>
        `).join('');
        break;

      case 'unresolved':
        titleText = 'Unresolved Items';
        if (!unresolvedItems.length) {
          contentHTML = emptyState('No unresolved items', 'Open items will appear here after you create tasks.');
          break;
        }
        contentHTML = unresolvedItems.map(item => `
          <div class="kpi-detail-item">
            <div class="kpi-detail-item__row">
              <span class="kpi-detail-item__dot kpi-detail-item__dot--${item.priority.toLowerCase()}"></span>
              <div class="kpi-detail-item__body">
                <div class="kpi-detail-item__title">${item.title}</div>
                <div class="kpi-detail-item__meta">
                  <span class="pill pill--${item.priority.toLowerCase()}">${item.priority}</span>
                  <span class="kpi-detail-item__badge">${item.status}</span>
                  <span class="kpi-detail-item__time">${item.age} ago</span>
                </div>
              </div>
            </div>
          </div>
        `).join('');
        break;

      case 'meetings':
        titleText = 'Today\'s Meetings';
        if (!meetingsToday.length) {
          contentHTML = emptyState('No meetings yet', 'Connected calendars or manual entries will appear here.');
          break;
        }
        contentHTML = meetingsToday.map(m => `
          <div class="kpi-detail-item kpi-detail-item--meeting">
            <div class="kpi-detail-item__time-block">${m.time}</div>
            <div class="kpi-detail-item__body">
              <div class="kpi-detail-item__title">${m.title}</div>
              <div class="kpi-detail-item__meta">
                <span class="kpi-detail-item__location">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  ${m.location}
                </span>
                <span class="kpi-detail-item__duration">${m.duration}</span>
              </div>
            </div>
          </div>
        `).join('');
        break;

      case 'attendance':
        titleText = 'Attendance';
        const ad = attendanceData;
        contentHTML = `
          <div class="kpi-detail-summary">
            <div class="kpi-detail-summary__row">
              <span class="kpi-detail-summary__label">Enrolled</span>
              <span class="kpi-detail-summary__value">${ad.enrolled}</span>
            </div>
            <div class="kpi-detail-summary__row">
              <span class="kpi-detail-summary__label">Present</span>
              <span class="kpi-detail-summary__value" style="color:var(--color-success)">${ad.present}</span>
            </div>
            <div class="kpi-detail-summary__row">
              <span class="kpi-detail-summary__label">Absent</span>
              <span class="kpi-detail-summary__value" style="color:var(--color-error)">${ad.absent}</span>
            </div>
            <div class="kpi-detail-summary__row">
              <span class="kpi-detail-summary__label">Tardy</span>
              <span class="kpi-detail-summary__value" style="color:var(--color-warning)">${ad.tardy}</span>
            </div>
          </div>
          <div class="kpi-detail-section-title">By Grade</div>
          <div class="kpi-detail-grades">
            ${ad.byGrade.length ? ad.byGrade.map(g => `
              <div class="kpi-detail-grade">
                <div class="kpi-detail-grade__label">${g.grade}</div>
                <div class="kpi-detail-grade__bar-wrap">
                  <div class="kpi-detail-grade__bar" style="width:${g.pct}%"></div>
                </div>
                <div class="kpi-detail-grade__pct">${g.pct}%</div>
              </div>
            `).join('') : '<div class="capture-empty__desc">No attendance data connected yet.</div>'}
          </div>
        `;
        break;

      case 'staff-coverage':
        titleText = 'Staff Coverage';
        const absentStaff = staffCoverage.filter(s => s.status === 'absent');
        const presentStaff = staffCoverage.filter(s => s.status === 'present');
        if (!staffCoverage.length) {
          contentHTML = emptyState('No staff coverage data', 'Connected roster or attendance systems will populate this view.');
          break;
        }
        contentHTML = `
          <div class="kpi-detail-summary">
            <div class="kpi-detail-summary__row">
              <span class="kpi-detail-summary__label">Total Staff</span>
              <span class="kpi-detail-summary__value">34</span>
            </div>
            <div class="kpi-detail-summary__row">
              <span class="kpi-detail-summary__label">Covered</span>
              <span class="kpi-detail-summary__value" style="color:var(--color-success)">32 of 34</span>
            </div>
          </div>
          <div class="kpi-detail-section-title" style="color:var(--color-error)">Absent (${absentStaff.length})</div>
          ${absentStaff.map(s => `
            <div class="kpi-detail-item">
              <div class="kpi-detail-item__row">
                <div class="kpi-detail-staff-avatar kpi-detail-staff-avatar--absent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div class="kpi-detail-item__body">
                  <div class="kpi-detail-item__title">${s.name}</div>
                  <div class="kpi-detail-item__meta">
                    <span>${s.position}</span>
                  </div>
                  <div class="kpi-detail-item__meta">
                    <span class="pill pill--urgent">${s.reason}</span>
                    <span class="kpi-detail-item__sub">Sub: ${s.sub}</span>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
          <div class="kpi-detail-section-title" style="color:var(--color-success)">Present (${presentStaff.length})</div>
          ${presentStaff.map(s => `
            <div class="kpi-detail-item">
              <div class="kpi-detail-item__row">
                <div class="kpi-detail-staff-avatar kpi-detail-staff-avatar--present">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div class="kpi-detail-item__body">
                  <div class="kpi-detail-item__title">${s.name}</div>
                  <div class="kpi-detail-item__meta"><span>${s.position}</span></div>
                </div>
              </div>
            </div>
          `).join('')}
        `;
        break;
    }

    title.textContent = titleText;
    content.innerHTML = contentHTML;
    overlay.classList.add('visible');
    sheet.classList.add('visible');
  }

  function hideKPIDetail() {
    const overlay = document.getElementById('kpi-detail-overlay');
    const sheet = document.getElementById('kpi-detail-sheet');
    if (overlay) overlay.classList.remove('visible');
    if (sheet) sheet.classList.remove('visible');
  }

  // =========================================
  // TASKS
  // =========================================
  function renderTaskList() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;
    if (!tasksToday.length) {
      taskList.innerHTML = emptyState('No tasks yet', 'Use capture or the add task button to create your first task.');
      return;
    }

    taskList.innerHTML = tasksToday.map((task) => {
      const labels = task.labels && task.labels.length ? task.labels : ['student'];
      const pillsHTML = labels.map((key) => {
        const text = labelMap[key] || key;
        return `<span class="pill pill--${key}">${text}</span>`;
      }).join('');
      const completed = task.status === 'completed';
      return `
        <div class="task-item${completed ? ' completed' : ''}" data-filter-tags="all today ${labels.join(' ')}" style="animation: slideUp 300ms var(--ease-golden)">
          <div class="task-item__row">
            <button class="task-item__checkbox${completed ? ' checked' : ''}" data-task-id="${task.id || ''}" onclick="App.toggleTask(this)" aria-label="${completed ? 'Mark incomplete' : 'Mark complete'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="${completed ? '' : 'display:none'}"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <div class="task-item__body">
              <div class="task-item__title">${escapeHTML(task.title)}</div>
              <div class="task-item__footer">
                ${pillsHTML}
                <span class="priority-dot priority-dot--${task.priority}"></span>
                <span class="task-item__due">${task.due || 'No due date'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function filterTasks(filter, btn) {
    // Update pill states
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Show/hide tasks
    document.querySelectorAll('.task-item').forEach(item => {
      const tags = item.dataset.filterTags || '';
      if (filter === 'all' || tags.includes(filter)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }

  function toggleTask(checkbox) {
    const isChecked = checkbox.classList.contains('checked');
    const taskItem = checkbox.closest('.task-item');
    const svg = checkbox.querySelector('svg');

    if (isChecked) {
      checkbox.classList.remove('checked');
      taskItem.classList.remove('completed');
      svg.style.display = 'none';
      checkbox.setAttribute('aria-label', 'Mark complete');
    } else {
      checkbox.classList.add('checked');
      taskItem.classList.add('completed');
      svg.style.display = '';
      checkbox.setAttribute('aria-label', 'Mark incomplete');
      // Haptic
      if (navigator.vibrate) navigator.vibrate(30);
    }
    persistTaskStatus(checkbox.dataset.taskId, !isChecked);
  }

  function showAddTask() {
    state.sheetPage = 0;
    updateSheetCarousel();
    showBottomSheet();
    setTimeout(() => {
      document.getElementById('new-task-input').focus();
    }, 350);
    updateAddBtn();
  }

  function setNewTaskPriority(btn) {
    btn.closest('.priority-grid').querySelectorAll('.priority-card-pick').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    state.newTaskPriority = btn.dataset.priority;
  }

  function setNewTaskLabel(btn) {
    const label = btn.dataset.label;
    const idx = state.newTaskLabels.indexOf(label);
    if (idx > -1) {
      // Deselect ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â but keep at least one
      if (state.newTaskLabels.length > 1) {
        state.newTaskLabels.splice(idx, 1);
        btn.classList.remove('active');
      }
    } else {
      state.newTaskLabels.push(label);
      btn.classList.add('active');
    }
  }

  /* ---- Due date/time ---- */
  function setDue(btn) {
    btn.closest('.due-picker').querySelectorAll('.due-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state.newTaskDue = btn.dataset.due;
    // Show/hide time row (hide for custom since it has its own time input)
    const timeRow = document.getElementById('due-time-row');
    const customRow = document.getElementById('due-custom-row');
    if (state.newTaskDue === 'custom') {
      if (timeRow) timeRow.style.display = 'none';
      if (customRow) customRow.style.display = 'flex';
    } else {
      if (timeRow) timeRow.style.display = '';
      if (customRow) customRow.style.display = 'none';
    }
  }

  function toggleCustomDue() {
    const customRow = document.getElementById('due-custom-row');
    const timeRow = document.getElementById('due-time-row');
    const picker = document.querySelector('.due-picker');
    picker.querySelectorAll('.due-chip').forEach(c => c.classList.remove('active'));
    picker.querySelector('[data-due="custom"]').classList.add('active');
    state.newTaskDue = 'custom';
    if (customRow) customRow.style.display = 'flex';
    if (timeRow) timeRow.style.display = 'none';
  }

  function setDueTime(btn) {
    btn.closest('.due-time-chips').querySelectorAll('.due-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    state.newTaskTime = btn.dataset.time;
  }

  function buildDueString() {
    let dueDay = '';
    if (state.newTaskDue === 'today') dueDay = 'Today';
    else if (state.newTaskDue === 'tomorrow') dueDay = 'Tomorrow';
    else if (state.newTaskDue === 'this-week') dueDay = 'This Week';
    else if (state.newTaskDue === 'custom') {
      const dateVal = document.getElementById('due-date-input').value;
      const timeVal = document.getElementById('due-time-input').value;
      if (dateVal) {
        const d = new Date(dateVal + 'T00:00');
        const opts = { month: 'short', day: 'numeric' };
        dueDay = d.toLocaleDateString('en-US', opts);
      } else {
        dueDay = 'Today';
      }
      if (timeVal) {
        const [h, m] = timeVal.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${dueDay} ${h12}:${String(m).padStart(2,'0')} ${ampm}`;
      }
      return dueDay;
    }
    if (state.newTaskTime) return `${dueDay} ${state.newTaskTime}`;
    return dueDay;
  }

  function buildDueAt() {
    const now = new Date();
    if (state.newTaskDue === 'custom') {
      const dateVal = document.getElementById('due-date-input')?.value;
      const timeVal = document.getElementById('due-time-input')?.value || '17:00';
      if (!dateVal) return undefined;
      return new Date(`${dateVal}T${timeVal}`).toISOString();
    }
    const due = new Date(now);
    if (state.newTaskDue === 'tomorrow') due.setDate(due.getDate() + 1);
    if (state.newTaskDue === 'this-week') due.setDate(due.getDate() + 7);
    if (state.newTaskTime) {
      const match = state.newTaskTime.match(/^(\d+)(?::(\d+))?\s*(AM|PM)$/i);
      if (match) {
        let hour = Number(match[1]);
        const minute = Number(match[2] || 0);
        const meridiem = match[3].toUpperCase();
        if (meridiem === 'PM' && hour < 12) hour += 12;
        if (meridiem === 'AM' && hour === 12) hour = 0;
        due.setHours(hour, minute, 0, 0);
      }
    } else {
      due.setHours(17, 0, 0, 0);
    }
    return due.toISOString();
  }

  /* ---- Carousel navigation ---- */
  const labelMap = {
    instructional: 'Instructional',
    compliance: 'Compliance',
    student: 'Student',
    staff: 'Staff',
    facilities: 'Facilities',
    budget: 'Budget'
  };

  function updateSheetCarousel() {
    const carousel = document.getElementById('sheet-carousel');
    if (!carousel) return;
    carousel.classList.toggle('page-1', state.sheetPage === 1);
    document.querySelectorAll('.sheet-step').forEach(s => {
      s.classList.toggle('active', Number(s.dataset.step) === state.sheetPage);
    });
  }

  function updateAddBtn() {
    const btn = document.getElementById('sheet-add-btn');
    const input = document.getElementById('new-task-input');
    if (btn && input) btn.disabled = !input.value.trim();
    // Show/hide swipe hint
    const hint = document.getElementById('sheet-swipe-hint');
    if (hint) hint.style.opacity = input && input.value.trim() ? '1' : '0';
  }

  // Enable/disable Add Task as user types
  document.addEventListener('input', (e) => {
    if (e.target.id === 'new-task-input') updateAddBtn();
  });

  function goToPage2() {
    const input = document.getElementById('new-task-input');
    if (!input || !input.value.trim()) return;
    state.sheetPage = 1;
    updateSheetCarousel();
    // Populate summary
    const summary = document.getElementById('sheet-summary');
    const pillsHTML = state.newTaskLabels.map(key => {
      const text = labelMap[key] || key;
      return `<span class="pill pill--${key}" style="font-size:11px;">${text}</span>`;
    }).join('');
    if (summary) {
      summary.innerHTML = `
        <span style="font-weight:600;color:var(--color-text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(input.value.trim())}</span>
        ${pillsHTML}
      `;
    }
  }

  function sheetBack() {
    state.sheetPage = 0;
    updateSheetCarousel();
    setTimeout(() => {
      document.getElementById('new-task-input').focus();
    }, 300);
  }

  /* Swipe gesture for carousel */
  (function initSheetSwipe() {
    let startX = 0, startY = 0, dragging = false;
    document.addEventListener('DOMContentLoaded', () => {
      const carousel = document.getElementById('sheet-carousel');
      if (!carousel) return;
      carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        dragging = true;
      }, { passive: true });
      carousel.addEventListener('touchend', (e) => {
        if (!dragging) return;
        dragging = false;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return; // too small or vertical
        if (dx < 0 && state.sheetPage === 0) {
          // Swipe left ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ page 2 (only if title filled)
          const input = document.getElementById('new-task-input');
          if (input && input.value.trim()) goToPage2();
        } else if (dx > 0 && state.sheetPage === 1) {
          // Swipe right ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ back to page 1
          sheetBack();
        }
      }, { passive: true });
    });
  })();

  /* ---- Duplicate / Related Task Detection ---- */
  const STOP_WORDS = new Set(['the','a','an','to','for','of','on','in','and','or','is','it','at','by','with','from','up','re','about','that','this','was','be','my','me','so','do','if','no','not']);

  function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  }

  function findRelatedTasks(newTitle) {
    const newTokens = tokenize(newTitle);
    if (newTokens.length === 0) return [];

    const existing = document.querySelectorAll('.task-item__title');
    const matches = [];

    existing.forEach(el => {
      const existingTitle = el.textContent.trim();
      const existingTokens = tokenize(existingTitle);
      // Count shared keywords
      const shared = newTokens.filter(t => existingTokens.some(et => et === t || et.includes(t) || t.includes(et)));
      const score = shared.length / Math.max(newTokens.length, 1);
      if (score >= 0.4 || shared.length >= 2) {
        matches.push({ title: existingTitle, score, shared });
      }
    });

    // Sort by score descending, limit to 3
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 3);
  }

  function addNewTask() {
    const input = document.getElementById('new-task-input');
    const title = input.value.trim();
    if (!title) return;

    // Check for duplicates/related ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â only if not already confirmed
    const dupBanner = document.getElementById('dup-banner');
    if (!state.dupConfirmed) {
      const related = findRelatedTasks(title);
      if (related.length > 0) {
        // Show inline duplicate warning
        if (dupBanner) {
          const listHTML = related.map(r =>
            `<div class="dup-item">${escapeHTML(r.title)}</div>`
          ).join('');
          dupBanner.innerHTML = `
            <div class="dup-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>
              <span>Similar tasks found</span>
            </div>
            <div class="dup-list">${listHTML}</div>
            <div class="dup-actions">
              <button class="btn btn--ghost btn--sm" onclick="App.dismissDup()">Cancel</button>
              <button class="btn btn--primary btn--sm" onclick="App.confirmDup()">Add Anyway</button>
            </div>
          `;
          dupBanner.classList.add('visible');
        }
        return;
      }
    }

    // Reset dup state
    state.dupConfirmed = false;
    if (dupBanner) { dupBanner.classList.remove('visible'); dupBanner.innerHTML = ''; }

    commitTask(title).catch((error) => {
      const addBtn = document.getElementById('sheet-add-btn');
      if (addBtn) addBtn.disabled = false;
      showToast(error.message || 'Task could not be saved');
    });
  }

  async function commitTask(title) {
    const addBtn = document.getElementById('sheet-add-btn');
    if (addBtn) addBtn.disabled = true;
    await createPersistedTask({
      title,
      description: `Labels: ${state.newTaskLabels.join(', ')}\nCreated from mobile task entry.`,
      priority: state.newTaskPriority,
      dueAt: buildDueAt()
    });
    const input = document.getElementById('new-task-input');
    if (input) input.value = '';
    hideBottomSheet();
    showToast('Task added!');
  }

  function confirmDup() {
    state.dupConfirmed = true;
    addNewTask();
  }

  function dismissDup() {
    const dupBanner = document.getElementById('dup-banner');
    if (dupBanner) { dupBanner.classList.remove('visible'); dupBanner.innerHTML = ''; }
    state.dupConfirmed = false;
  }

  // =========================================
  // BOTTOM SHEET (Add Task)
  // =========================================
  function showBottomSheet() {
    document.getElementById('bottom-sheet-overlay').classList.add('visible');
    document.getElementById('bottom-sheet').classList.add('visible');
  }

  function hideBottomSheet() {
    document.getElementById('bottom-sheet-overlay').classList.remove('visible');
    document.getElementById('bottom-sheet').classList.remove('visible');
    // Reset for next open
    state.newTaskPriority = 'normal';
    state.newTaskLabels = ['student'];
    state.sheetPage = 0;
    state.newTaskDue = 'today';
    state.newTaskTime = '';
    state.dupConfirmed = false;
    const sheet = document.getElementById('bottom-sheet');
    sheet.querySelectorAll('.label-pill').forEach((p, i) => p.classList.toggle('active', i === 0));
    sheet.querySelectorAll('.priority-card-pick').forEach(p => {
      p.classList.toggle('active', p.dataset.priority === 'normal');
    });
    // Reset due picker
    sheet.querySelectorAll('.due-picker .due-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
    sheet.querySelectorAll('.due-time-chips .due-chip').forEach(c => c.classList.remove('active'));
    const customRow = document.getElementById('due-custom-row');
    const timeRow = document.getElementById('due-time-row');
    if (customRow) customRow.style.display = 'none';
    if (timeRow) timeRow.style.display = '';
    const dateInput = document.getElementById('due-date-input');
    const timeInput = document.getElementById('due-time-input');
    if (dateInput) dateInput.value = '';
    if (timeInput) timeInput.value = '';
    // Reset dup banner
    const dupBanner = document.getElementById('dup-banner');
    if (dupBanner) { dupBanner.classList.remove('visible'); dupBanner.innerHTML = ''; }
    const input = document.getElementById('new-task-input');
    if (input) input.value = '';
    // Reset carousel position
    setTimeout(() => updateSheetCarousel(), 320);
  }

  // =========================================
  // NOTIFICATION BANNER
  // =========================================
  function showNotification(text) {
    const banner = document.getElementById('notification-banner');
    const textEl = document.getElementById('notification-text');
    textEl.textContent = text;
    banner.classList.add('visible');

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      hideNotification();
    }, 8000);
  }

  function hideNotification() {
    const banner = document.getElementById('notification-banner');
    banner.classList.remove('visible');
  }

  // =========================================
  // PULSE BANNER
  // =========================================
  function dismissPulseBanner() {
    const banner = document.getElementById('pulse-banner');
    banner.style.display = 'none';
  }

  // =========================================
  // PULSE TIMER
  // =========================================
  function startPulseTimer() {
    setInterval(() => {
      if (state.pulseTimer > 0) {
        state.pulseTimer--;
        const el = document.getElementById('pulse-timer');
        if (el) el.textContent = state.pulseTimer + 'm';
      }
    }, 60000);
  }

  // =========================================
  // MORE TAB ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â SUB-VIEWS
  // =========================================
  function showSubView(name) {
    const menu = document.getElementById('more-menu');
    const view = document.getElementById('subview-' + name);
    if (menu) menu.style.display = 'none';
    document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
    if (view) view.classList.add('active');
    // Admin-only notice for integrations management
    if (name === 'integrations') {
      const isAdmin = currentUserRole === 'admin' || currentUserRole === 'principal';
      let notice = view.querySelector('.admin-only-notice');
      if (!isAdmin && !notice) {
        const el = document.createElement('div');
        el.className = 'admin-only-notice';
        el.style.cssText = 'margin:var(--space-4);padding:var(--space-3);background:#fef3c7;border:1px solid #fcd34d;border-radius:var(--radius-md, 8px);font-size:var(--text-sm);color:#92400e;';
        el.textContent = 'Admin only \u2014 only administrators or principals can connect or disconnect integrations.';
        view.appendChild(el);
      } else if (isAdmin && notice) {
        notice.remove();
      }
    }
  }

  function hideSubView() {
    const menu = document.getElementById('more-menu');
    document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
    if (menu) menu.style.display = '';
  }

  function showSubViewWithContent(id, title, htmlContent) {
    // Create or reuse a dynamic help detail subview
    let view = document.getElementById('subview-help-detail');
    if (!view) {
      view = document.createElement('div');
      view.className = 'sub-view';
      view.id = 'subview-help-detail';
      document.getElementById('view-more').appendChild(view);
    }
    view.innerHTML = `
      <div class="sub-view__header">
        <button class="sub-view__back" aria-label="Go back" onclick="App.hideSubView()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 class="sub-view__title">${title}</h2>
      </div>
      <div style="padding: 0 var(--space-4); font-size: var(--text-sm); line-height: 1.6;">
        ${htmlContent}
      </div>
    `;
    const menu = document.getElementById('more-menu');
    if (menu) menu.style.display = 'none';
    document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
    view.classList.add('active');
  }


  function simulateUpload() {
    showToast('Camera/upload would open here');
  }

  function showHelpTopic(topic) {
    const helpContent = {
      'Getting Started Guide': '<div style="padding:var(--space-3);"><h3 style="margin:0 0 var(--space-3);">Getting Started</h3><p>AdminI helps school administrators capture and organize information faster.</p><ul><li><strong>Voice Capture</strong> \u2014 Tap the mic to record observations hands-free</li><li><strong>Tap Capture</strong> \u2014 Quick-select words to build structured captures</li><li><strong>Tasks</strong> \u2014 Captures generate actionable tasks automatically</li><li><strong>Pulse</strong> \u2014 Contextual check-ins keep you on track</li></ul></div>',
      'Using Voice Capture': '<div style="padding:var(--space-3);"><h3 style="margin:0 0 var(--space-3);">Voice Capture</h3><p>Speak naturally and AdminI transcribes your words.</p><ol><li>Tap the microphone button</li><li>Speak clearly</li><li>Review the AI-suggested task</li><li>Tap Confirm to save or Edit to modify</li></ol><p><strong>Privacy:</strong> PII is automatically redacted before storage.</p></div>',
      'Understanding Pulses': '<div style="padding:var(--space-3);"><h3 style="margin:0 0 var(--space-3);">Pulses</h3><p>Contextual check-in prompts throughout your day.</p><ul><li>Default: every 2 hours during active hours</li><li>Smart Timing adjusts based on calendar gaps</li><li>Respond with voice/tap capture, skip, or snooze</li></ul></div>',
      'Customizing Your Board': '<div style="padding:var(--space-3);"><h3 style="margin:0 0 var(--space-3);">Customizing Your Tap Board</h3><p>The tap capture board gives you quick-select words organized by category (Who, What, Where, Action, Urgency).</p><h4>Quick editing on mobile:</h4><ol><li>Go to the <strong>Capture</strong> tab and switch to <strong>Tap</strong> mode</li><li>Tap the pencil icon to enter edit mode</li><li>Remove words with the X button</li><li>Add words with the + button in any category</li><li>Tap <strong>Done</strong> when finished</li></ol><p><strong>For full customization</strong> (reordering categories, bulk editing, icon choices), use the desktop app under Settings \u2192 Tap Capture Customization.</p></div>',
      'Contact Support': '<div style="padding:var(--space-3);"><h3 style="margin:0 0 var(--space-3);">Contact Support</h3><p>Need help?</p><ul><li><strong>Email:</strong> support@admini.app</li><li><strong>Response time:</strong> Within 24 hours on business days</li></ul></div>'
    };
    const content = helpContent[topic] || '<div style="padding:var(--space-3);"><p>Help content for this topic is coming soon.</p></div>';
    showSubViewWithContent('help-detail', topic, content);
  }



  // =========================================
  // THEME
  // =========================================
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeToggle();
    // Update meta theme color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', state.theme === 'dark' ? '#0F1117' : '#F8F9FC');
    }
  }

  function updateThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      if (state.theme === 'dark') {
        toggle.classList.add('active');
        toggle.setAttribute('aria-checked', 'true');
      } else {
        toggle.classList.remove('active');
        toggle.setAttribute('aria-checked', 'false');
      }
    }
  }

  // =========================================
  // TOGGLE SWITCHES
  // =========================================
  function toggleSwitch(el) {
    const isActive = el.classList.contains('active');
    el.classList.toggle('active');
    el.setAttribute('aria-checked', !isActive);
    if (navigator.vibrate) navigator.vibrate(20);
  }

  // =========================================
  // TOAST
  // =========================================
  function showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: var(--color-text);
      color: var(--color-text-inverse);
      padding: 10px 20px;
      border-radius: 999px;
      font-size: var(--text-sm);
      font-weight: 500;
      z-index: 500;
      opacity: 0;
      transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      white-space: nowrap;
      max-width: 90%;
      text-align: center;
    `;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Remove after 2s
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // =========================================
  // UTILS
  // =========================================
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // =========================================
  // QUICK DETAIL INPUT LISTENER
  // =========================================
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('quick-detail-input');
    if (input) {
      input.addEventListener('input', updateAIPreview);
    }
  });

  // =========================================
  // INIT
  // =========================================
  document.addEventListener('DOMContentLoaded', init);

  // =========================================
  // OBSERVATIONS
  // =========================================
  const mobObsTeacherRoster = {};

  let mobObs = {
    phase: 'setup',
    period: null, grade: null, subject: null, teacher: null,
    startTime: null, timerInterval: null,
    notes: [], activeTags: [], noteType: 'observation'
  };

  const mobObsPast = [];

  function initMobObs() {
    // Period pills
    const pp = document.getElementById('mobObsPeriodPills');
    if (pp) {
      pp.innerHTML = ['P1','P2','P3','P4','P5','P6','P7','P8'].map(p =>
        `<button class="mob-obs-pill" data-period="${p}">${p}</button>`
      ).join('');
      pp.querySelectorAll('.mob-obs-pill').forEach(b => b.addEventListener('click', () => {
        mobObs.period = b.dataset.period;
        pp.querySelectorAll('.mob-obs-pill').forEach(x => x.classList.toggle('selected', x === b));
      }));
    }

    // Grade pills
    const gp = document.getElementById('mobObsGradePills');
    if (gp) {
      const grades = Object.keys(mobObsTeacherRoster);
      if (!grades.length) {
        gp.innerHTML = '<div style="color:var(--color-text-faint);font-size:var(--text-sm);">No roster data yet. Upload a CSV or connect a system from Integrations.</div>';
      } else {
      gp.innerHTML = grades.map(g =>
        `<button class="mob-obs-pill" data-grade="${g}">${g}</button>`
      ).join('');
      gp.querySelectorAll('.mob-obs-pill').forEach(b => b.addEventListener('click', () => mobObsSelectGrade(b.dataset.grade)));
      }
    }

    // Past list
    const pl = document.getElementById('mobObsPastList');
    if (pl) {
      if (!mobObsPast.length) {
        pl.innerHTML = '<div style="color:var(--color-text-faint);font-size:var(--text-sm);padding:var(--space-4);">No observations yet.</div>';
      } else {
      pl.innerHTML = mobObsPast.map(o => `
        <div class="mob-obs-past-item">
          <div class="mob-obs-past-avatar">${o.initials}</div>
          <div class="mob-obs-past-info">
            <div class="mob-obs-past-name">${o.teacher}</div>
            <div class="mob-obs-past-detail">${o.grade} \u00b7 ${o.subject} \u00b7 ${o.period} \u00b7 ${o.date}</div>
          </div>
          <div class="mob-obs-past-dur">${o.duration}</div>
        </div>
      `).join('');
      }
    }

    // Tag toggles
    document.querySelectorAll('.mob-obs-tag').forEach(t => {
      t.addEventListener('click', () => {
        t.classList.toggle('active');
        mobObs.activeTags = [...document.querySelectorAll('.mob-obs-tag.active')].map(x => x.dataset.tag);
      });
    });

    // Type buttons
    document.querySelectorAll('.mob-obs-type').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.mob-obs-type').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        mobObs.noteType = b.dataset.type;
        const inp = document.getElementById('mobObsInput');
        if (inp) inp.placeholder = { observation: 'Type your observation note...', recommendation: 'Type your coaching recommendation...', quote: 'Type the exact quote...' }[b.dataset.type] || '';
      });
    });

    // Stamp button
    document.getElementById('mobObsStamp')?.addEventListener('click', mobObsAddNote);

    // Enter in textarea
    document.getElementById('mobObsInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mobObsAddNote(); }
    });

    // Start
    document.getElementById('mobObsStartBtn')?.addEventListener('click', mobObsStart);

    // End
    document.getElementById('mobObsEnd')?.addEventListener('click', mobObsFinish);

    // New
    document.getElementById('mobObsNew')?.addEventListener('click', mobObsReset);
  }

  function mobObsSelectGrade(grade) {
    mobObs.grade = grade; mobObs.subject = null; mobObs.teacher = null;
    document.querySelectorAll('#mobObsGradePills .mob-obs-pill').forEach(p => p.classList.toggle('selected', p.dataset.grade === grade));
    const sf = document.getElementById('mobObsSubjectField');
    const sp = document.getElementById('mobObsSubjectPills');
    if (sf && sp) {
      sf.classList.remove('hidden');
      const subjects = Object.keys(mobObsTeacherRoster[grade] || {});
      sp.innerHTML = subjects.map(s => `<button class="mob-obs-pill" data-subject="${s}">${s}</button>`).join('');
      sp.querySelectorAll('.mob-obs-pill').forEach(b => b.addEventListener('click', () => mobObsSelectSubject(b.dataset.subject)));
    }
    document.getElementById('mobObsTeacherField')?.classList.add('hidden');
    document.getElementById('mobObsStartRow')?.classList.add('hidden');
  }

  function mobObsSelectSubject(subject) {
    mobObs.subject = subject; mobObs.teacher = null;
    document.querySelectorAll('#mobObsSubjectPills .mob-obs-pill').forEach(p => p.classList.toggle('selected', p.dataset.subject === subject));
    const tf = document.getElementById('mobObsTeacherField');
    const tp = document.getElementById('mobObsTeacherPills');
    if (tf && tp) {
      tf.classList.remove('hidden');
      const teachers = mobObsTeacherRoster[mobObs.grade]?.[subject] || [];
      tp.innerHTML = teachers.map(t => `<button class="mob-obs-pill" data-teacher="${t}">${t}</button>`).join('');
      tp.querySelectorAll('.mob-obs-pill').forEach(b => b.addEventListener('click', () => {
        mobObs.teacher = b.dataset.teacher;
        tp.querySelectorAll('.mob-obs-pill').forEach(x => x.classList.toggle('selected', x === b));
        document.getElementById('mobObsStartRow')?.classList.remove('hidden');
      }));
    }
    document.getElementById('mobObsStartRow')?.classList.add('hidden');
  }

  function mobObsStart() {
    mobObs.phase = 'live';
    mobObs.startTime = new Date();
    mobObs.notes = [];
    mobObs.activeTags = [];
    mobObs.noteType = 'observation';
    document.getElementById('mobObsLiveTeacher').textContent = mobObs.teacher;
    document.getElementById('mobObsLiveMeta').textContent = `${mobObs.grade} \u00b7 ${mobObs.subject}${mobObs.period ? ' \u00b7 ' + mobObs.period : ''} \u00b7 ${mobObs.startTime.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
    document.getElementById('mobObsSetup')?.classList.add('hidden');
    document.getElementById('mobObsLive')?.classList.remove('hidden');
    document.getElementById('mobObsSummary')?.classList.add('hidden');
    document.getElementById('mobObsTimeline').innerHTML = '<div class="mob-obs-empty">Tap Stamp to log your first note</div>';
    document.querySelectorAll('.mob-obs-tag').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mob-obs-type').forEach(b => b.classList.remove('active'));
    document.querySelector('.mob-obs-type[data-type="observation"]')?.classList.add('active');
    const timerEl = document.getElementById('mobObsTimer');
    mobObs.timerInterval = setInterval(() => {
      const e = Math.floor((Date.now() - mobObs.startTime) / 1000);
      timerEl.textContent = `${String(Math.floor(e/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}`;
    }, 1000);
  }

  function mobObsAddNote() {
    const inp = document.getElementById('mobObsInput');
    const text = inp?.value.trim() || '';
    const tags = [...mobObs.activeTags];
    if (!text && !tags.length) return;
    const now = new Date();
    const e = Math.floor((now - mobObs.startTime) / 1000);
    const elapsed = `${String(Math.floor(e/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}`;
    const note = { time: now, timeStr: now.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'}), elapsed, text, tags, type: mobObs.noteType };
    mobObs.notes.push(note);
    const tl = document.getElementById('mobObsTimeline');
    const empty = tl?.querySelector('.mob-obs-empty');
    if (empty) empty.remove();
    const typeLabels = { observation: 'OBS', recommendation: 'REC', quote: 'QUOTE' };
    const qPre = note.type === 'quote' ? '\u201c' : '';
    const qSuf = note.type === 'quote' ? '\u201d' : '';
    const el = document.createElement('div');
    el.className = 'mob-obs-note';
    el.innerHTML = `
      <div class="mob-obs-note-time">${note.elapsed}</div>
      <div class="mob-obs-note-body">
        <div class="mob-obs-note-type mob-obs-note-type--${note.type}">${typeLabels[note.type]}</div>
        ${note.text ? `<div class="mob-obs-note-text${note.type==='quote'?' mob-obs-note-text--quote':''}">${qPre}${note.text}${qSuf}</div>` : ''}
        ${note.tags.length ? `<div class="mob-obs-note-tags">${note.tags.map(t=>`<span class="mob-obs-note-tag-pill">${t}</span>`).join('')}</div>` : ''}
      </div>
    `;
    tl?.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (inp) { inp.value = ''; inp.placeholder = 'Type your observation note...'; }
    document.querySelectorAll('.mob-obs-tag').forEach(t => t.classList.remove('active'));
    mobObs.activeTags = [];
    mobObs.noteType = 'observation';
    document.querySelectorAll('.mob-obs-type').forEach(b => b.classList.remove('active'));
    document.querySelector('.mob-obs-type[data-type="observation"]')?.classList.add('active');
  }

  function mobObsFinish() {
    if (mobObs.timerInterval) { clearInterval(mobObs.timerInterval); mobObs.timerInterval = null; }
    mobObs.phase = 'summary';
    const dur = Math.round((Date.now() - mobObs.startTime) / 60000);
    document.getElementById('mobObsLive')?.classList.add('hidden');
    document.getElementById('mobObsSummary')?.classList.remove('hidden');
    document.getElementById('mobObsSummaryTitle').textContent = `${mobObs.teacher} \u2014 Observation`;
    document.getElementById('mobObsSummaryMeta').textContent = `${mobObs.grade} \u00b7 ${mobObs.subject}${mobObs.period ? ' \u00b7 ' + mobObs.period : ''} \u00b7 ${dur} min`;
    // Insights
    const allTags = mobObs.notes.flatMap(n => n.tags);
    const recs = mobObs.notes.filter(n => n.type === 'recommendation').length;
    const quotes = mobObs.notes.filter(n => n.type === 'quote').length;
    document.getElementById('mobObsInsights').innerHTML = `<ul>
      <li><strong>${mobObs.notes.length} entries</strong> over ${dur} min \u2014 ${recs} recommendation${recs!==1?'s':''}, ${quotes} quote${quotes!==1?'s':''}.</li>
      ${allTags.includes('Pacing') || allTags.includes('HW Review') ? '<li>Pacing flagged \u2014 review time allocation for homework review vs. new instruction.</li>' : ''}
      ${allTags.includes('Para disengaged') ? '<li>Support staff engagement needs attention.</li>' : ''}
      ${allTags.includes('Outbursts') ? '<li>Student outbursts observed \u2014 review management routines.</li>' : ''}
      <li>Schedule a post-observation debrief within 48 hours.</li>
    </ul>`;
    // Tags
    const tc = {};
    mobObs.notes.forEach(n => n.tags.forEach(t => { tc[t] = (tc[t]||0)+1; }));
    document.getElementById('mobObsSummaryTags').innerHTML = Object.entries(tc).map(([t,c]) =>
      `<span class="mob-obs-tag-sum-pill">${t} <span class="mob-obs-tag-sum-count">${c}</span></span>`
    ).join('') || '<span style="font-size:11px;color:var(--color-text-faint)">No tags used</span>';
    // Timeline
    const typeLabels = { observation: 'OBS', recommendation: 'REC', quote: 'QUOTE' };
    document.getElementById('mobObsSummaryTimeline').innerHTML = mobObs.notes.map(n => {
      const qPre = n.type === 'quote' ? '\u201c' : '';
      const qSuf = n.type === 'quote' ? '\u201d' : '';
      return `<div class="mob-obs-note">
        <div class="mob-obs-note-time">${n.elapsed}</div>
        <div class="mob-obs-note-body">
          <div class="mob-obs-note-type mob-obs-note-type--${n.type}">${typeLabels[n.type]}</div>
          ${n.text ? `<div class="mob-obs-note-text${n.type==='quote'?' mob-obs-note-text--quote':''}">${qPre}${n.text}${qSuf}</div>` : ''}
          ${n.tags.length ? `<div class="mob-obs-note-tags">${n.tags.map(t=>`<span class="mob-obs-note-tag-pill">${t}</span>`).join('')}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function mobObsReset() {
    mobObs = { phase:'setup', period:null, grade:null, subject:null, teacher:null, startTime:null, timerInterval:null, notes:[], activeTags:[], noteType:'observation' };
    document.querySelectorAll('.mob-obs-pill').forEach(p => p.classList.remove('selected'));
    document.getElementById('mobObsSubjectField')?.classList.add('hidden');
    document.getElementById('mobObsTeacherField')?.classList.add('hidden');
    document.getElementById('mobObsStartRow')?.classList.add('hidden');
    document.getElementById('mobObsSetup')?.classList.remove('hidden');
    document.getElementById('mobObsLive')?.classList.add('hidden');
    document.getElementById('mobObsSummary')?.classList.add('hidden');
    initMobObs();
  }

  // =========================================
  // PUBLIC API
  // =========================================
  // PROFILE EDITING
  // =========================================
  function showProfileEdit(field) {
    const profileRows = [...document.querySelectorAll('#subview-settings .settings-item')];
    let currentValue = '';
    let label = '';
    let readOnly = false;
    let notice = '';

    if (field === 'display-name') {
      label = 'Display Name';
      const row = profileRows.find(r => r.querySelector('.settings-item__label')?.textContent?.trim() === 'Name');
      currentValue = row?.querySelector('.settings-item__value')?.textContent?.trim() || '';
      if (currentValue === 'Not provided') currentValue = '';
    } else if (field === 'school') {
      label = 'School Name';
      const isAdmin = currentUserRole === 'admin' || currentUserRole === 'principal';
      readOnly = !isAdmin;
      notice = isAdmin
        ? 'All organization members will see this update.'
        : 'Admin only � only administrators or principals can change the school name.';
      const row = profileRows.find(r => r.querySelector('.settings-item__label')?.textContent?.trim() === 'School');
      currentValue = row?.querySelector('.settings-item__value')?.textContent?.trim() || '';
      if (currentValue === 'Not provided') currentValue = '';
    } else if (field === 'email') {
      label = 'Email';
      readOnly = true;
      const row = profileRows.find(r => r.querySelector('.settings-item__label')?.textContent?.trim() === 'Email');
      currentValue = row?.querySelector('.settings-item__value')?.textContent?.trim() || '';
      if (currentValue === 'Not provided') currentValue = '';
    } else if (field === 'role') {
      label = 'Role';
      readOnly = true;
      const row = profileRows.find(r => r.querySelector('.settings-item__label')?.textContent?.trim() === 'Role');
      currentValue = row?.querySelector('.settings-item__value')?.textContent?.trim() || '';
      if (currentValue === 'Not provided') currentValue = '';
    }

    const title = document.getElementById('profile-edit-title');
    const body = document.getElementById('profile-edit-body');
    if (title) title.textContent = readOnly ? label : 'Edit ' + label;

    const escapedValue = (currentValue || '').replace(/"/g, '&quot;');
    let html = '';
    if (notice) {
      html += '<div style="padding:var(--space-3);background:#fef3c7;border:1px solid #fcd34d;border-radius:var(--radius-md);font-size:var(--text-sm);color:#92400e;margin-bottom:var(--space-3);">' + notice + '</div>';
    }
    if (readOnly) {
      html += '<div style="padding:var(--space-3);background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);color:var(--color-text-muted);">' + (escapedValue || 'Not provided') + '</div>';
      html += '<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2);">This field is read-only and cannot be changed here.</div>';
    } else {
      html += '<input id="profile-edit-input" type="text" class="quick-detail__input" value="' + escapedValue + '" placeholder="Enter ' + label.toLowerCase() + '" style="width:100%;margin-bottom:var(--space-3);" />';
      if (field === 'school') {
        html += '<div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3);">';
        html += '<input id="profile-edit-notify-email" type="checkbox" style="width:16px;height:16px;cursor:pointer;" />';
        html += '<label for="profile-edit-notify-email" style="font-size:var(--text-sm);color:var(--color-text);cursor:pointer;">Notify organization members by email about this change</label>';
        html += '</div>';
      }
      html += '<div style="display:flex;gap:var(--space-3);justify-content:flex-end;">';
      html += '<button class="btn btn--ghost btn--sm" onclick="App.hideProfileEdit()">Cancel</button>';
      html += '<button class="btn btn--primary btn--sm" onclick="App.saveProfileField(\'' + field + '\')">Save</button>';
      html += '</div>';
    }
    if (body) body.innerHTML = html;

    const overlay = document.getElementById('profile-edit-overlay');
    const sheet = document.getElementById('profile-edit-sheet');
    if (overlay) overlay.classList.add('visible');
    if (sheet) sheet.classList.add('visible');
    if (!readOnly) {
      setTimeout(() => {
        const input = document.getElementById('profile-edit-input');
        if (input) input.focus();
      }, 350);
    }
  }

  function hideProfileEdit() {
    const overlay = document.getElementById('profile-edit-overlay');
    const sheet = document.getElementById('profile-edit-sheet');
    if (overlay) overlay.classList.remove('visible');
    if (sheet) sheet.classList.remove('visible');
  }

  function saveProfileField(field) {
    const input = document.getElementById('profile-edit-input');
    if (!input) return;
    const newValue = input.value.trim();
    if (!newValue) return;

    const profileRows = [...document.querySelectorAll('#subview-settings .settings-item')];
    if (field === 'display-name') {
      const row = profileRows.find(r => r.querySelector('.settings-item__label')?.textContent?.trim() === 'Name');
      if (row) row.querySelector('.settings-item__value').textContent = newValue;
      const greetingEl = document.getElementById('user-id');
      if (greetingEl) greetingEl.textContent = newValue;
    } else if (field === 'school') {
      const row = profileRows.find(r => r.querySelector('.settings-item__label')?.textContent?.trim() === 'School');
      if (row) row.querySelector('.settings-item__value').textContent = newValue;
      const greetingSubtext = document.querySelector('.dashboard__greeting p');
      if (greetingSubtext) {
        greetingSubtext.textContent = newValue + ' - ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      }
    }
    const payload = { type: 'profile:update', field: field, value: newValue };
    if (field === 'school') {
      const notifyCheckbox = document.getElementById('profile-edit-notify-email');
      payload.notifyByEmail = notifyCheckbox ? notifyCheckbox.checked : false;
    }
    parent.postMessage(payload, '*');
    hideProfileEdit();
  }

  function initProfileEditButtons() {
    document.querySelectorAll('[data-profile-edit]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var field = btn.getAttribute('data-profile-edit');
        showProfileEdit(field);
      });
    });
  }

  // =========================================
  return {
    switchTab,
    setMode,
    goToCapture,
    toggleRecording,
    confirmCapture,
    editCapture,
    renderWordBoard,
    tapWord,
    removeWord,
    quickCapture,
    useQuickCapture,
    focusDetail,
    submitTapCapture,
    toggleBoardEdit,
    removeWordFromBoard,
    showAddWordInput,
    setAddWordIcon,
    hideAddWordSheet,
    confirmAddWord,
    resetWordBoard,
    renderQuickCaptures,
    toggleQCEdit,
    removeQuickCapture,
    saveAsQuickCapture,
    showKPIDetail,
    renderKPICards,
    hideKPIDetail,
    filterTasks,
    toggleTask,
    showAddTask,
    setNewTaskPriority,
    setNewTaskLabel,
    sheetBack,
    addNewTask,
    confirmDup,
    dismissDup,
    showSubView,
    hideSubView,
    simulateUpload,
    showHelpTopic,
    toggleTheme,
    toggleSwitch,
    dismissPulseBanner,
    hideBottomSheet,
    hideNotification,
    showNotification,
    initMobObs,
    mobObsSelectGrade,
    openBoardCustomization,
    downloadExportData,
    mobObsSelectSubject,
    mobObsStart,
    mobObsAddNote,
    mobObsFinish,
    mobObsReset,
    setDue,
    setDueTime,
    toggleCustomDue,
    showProfileEdit,
    hideProfileEdit,
    saveProfileField
  };

})();

