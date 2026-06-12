Implementation Plan: App UI Overhaul

## Overview

This plan implements the comprehensive UI/UX overhaul of the AdminI web application, aligning the visual layer to the Figma design mock. The implementation is structured into two distinct sections:

- **Section A: Presentation Layer** - Component markup, CSS, layout, interaction patterns, and client-side state
- **Section B: Service/Data Layer** - Supabase queries, API integrations, Cloudflare Workers, data fetching, and persistence logic

### Key Implementation Principles

1. **Explicit Data Contracts** - Every component task specifies its props interface, service functions called, and data shape expected
2. **Metadata-Driven Categories** - Category-to-color mappings driven by a `CategoryRegistry` configuration object, not hardcoded values
3. **Deterministic Algorithms** - Event merging, activity ordering, and task duplication follow specified step-by-step algorithms
4. **Mandatory Property Tests** - All property tests are required (no asterisk, no optional markers)
5. **Complete Lifecycle Documentation** - Admin workflows specify full lifecycle with failure handling and rollback
6. **State Machine Transitions** - Navigation, modals, and form submissions follow documented state machines

---

### State Machines

**Tab Navigation:**
```
States: idle | transitioning
Events: TAB_CLICK(tabId)
Transitions:
  idle + TAB_CLICK(tabId) ->
    1. Dismiss any open modals (AchievementsModal, task-creation modals)
    2. Set activeTab = tabId
    3. Reset scroll position to top for target tab
    4. Preserve filter selections within each tab (component state retained)
    5. -> idle
```

**Modal Open/Close:**
```
States: closed | opening | open | closing
Events: TRIGGER_OPEN | ANIMATION_END | TRIGGER_CLOSE | OUTSIDE_CLICK | ESC_KEY | TAB_SWITCH
Transitions:
  closed + TRIGGER_OPEN -> opening
  opening + ANIMATION_END -> open
  open + (TRIGGER_CLOSE | OUTSIDE_CLICK | ESC_KEY | TAB_SWITCH) -> closing
  closing + ANIMATION_END -> closed
Side effects:
  opening: trap focus, add backdrop
  closing: restore focus to trigger element, remove backdrop
```

**Form Submission (Task creation, CSV import, Invitation):**
```
States: idle | validating | submitting | success | error
Events: SUBMIT | VALIDATION_PASS | VALIDATION_FAIL | RESPONSE_OK | RESPONSE_ERR | RESET
Transitions:
  idle + SUBMIT -> validating
  validating + VALIDATION_PASS -> submitting
  validating + VALIDATION_FAIL -> error (with field-level errors)
  submitting + RESPONSE_OK -> success
  submitting + RESPONSE_ERR -> error (with server message)
  error + RESET -> idle
  success + RESET -> idle
```

**Filter State (TasksTab):**
```
States: { activeFilter: FilterType, view: 'list' | 'calendar' }
Events: FILTER_CHANGE(filter) | VIEW_TOGGLE
Transitions:
  { activeFilter, view } + FILTER_CHANGE(f) -> { activeFilter: f, view }
  { activeFilter, view } + VIEW_TOGGLE -> { activeFilter, view: flip(view) }
  On TAB_SWITCH away: state is preserved (not reset)
  On TAB_SWITCH back: state is restored from component state
```

---

### Deterministic Algorithms

**Algorithm 1: Event Merging (Google Calendar + Local Events)**
```
Input: googleEvents: CalendarEvent[], localEvents: LocalEvent[]
Output: MergedEvent[]

Steps:
  1. Create a Map<string, MergedEvent> keyed by event ID
  2. For each event in localEvents: insert into map with source='local' (local events have priority)
  3. For each event in googleEvents:
     a. If map does NOT contain event.id -> insert with source='google'
     b. If map CONTAINS event.id -> skip (local takes precedence)
  4. Collect all map values into an array
  5. Sort by start ascending using localeCompare on ISO strings (stable sort)
  6. Return sorted array

Invariant: result.length === |unique IDs across both inputs|
Invariant: No two items in result share the same ID
Invariant: result is sorted ascending by start time
```

**Algorithm 2: Activity Feed Ordering and Capping**
```
Input: syncEvents: ActivityEvent[], tasks: DashboardTask[]
Output: ActivityEvent[] (max 7)

Steps:
  1. If syncEvents.length > 0: source = syncEvents
     Else: source = tasks.map(t => deriveActivityFromTask(t))
  2. Sort source by createdAt descending (stable sort, ties broken by ID ascending)
  3. Slice to first 7 items
  4. Return sliced array

Invariant: result.length <= 7
Invariant: result is sorted in strictly non-increasing order by createdAt
Invariant: If syncEvents is non-empty, no task-derived items appear in result
```

**Algorithm 3: Task Duplication**
```
Input: sourceTask: TaskWithSubtasks
Output: TaskWithSubtasks (new task)

Steps:
  1. Deep clone sourceTask via structuredClone()
  2. Fields COPIED (preserved as-is):
     - title, description, priority, category, dueAt, assignee
  3. Fields RESET:
     - id -> crypto.randomUUID()
     - status -> 'open'
     - completedAt -> undefined
     - createdAt -> new Date().toISOString()
     - updatedAt -> new Date().toISOString()
     - staleDays -> 0
     - blockReason -> undefined
     - subtasks[*].id -> crypto.randomUUID() (each subtask gets new ID)
     - subtasks[*].completed -> false
  4. Persist cloned task via taskService.create(clone)
  5. Return persisted task

Invariant: clone.id !== sourceTask.id
Invariant: All subtask IDs are unique and differ from source
Invariant: clone.status === 'open'
Invariant: All subtask.completed === false
```

---

### Metadata-Driven Category Registry

```typescript
// packages/shared/src/categoryRegistry.ts
interface CategoryConfig {
  id: string;
  label: string;
  colorToken: string;   // CSS custom property name
  colorHex: string;     // Fallback hex value
  icon?: string;
}

type CategoryRegistry = Map<string, CategoryConfig>;

const defaultRegistry: CategoryConfig[] = [
  { id: 'compliance', label: 'Compliance', colorToken: '--color-category-orange', colorHex: '#E8A838' },
  { id: 'scheduling', label: 'Scheduling', colorToken: '--color-category-yellow', colorHex: '#E6C84D' },
  { id: 'students', label: 'Students', colorToken: '--color-category-green', colorHex: '#7BAF7B' },
  { id: 'blocked', label: 'Blocked', colorToken: '--color-category-red', colorHex: '#D63031' },
];

function getCategoryStyle(categoryId: string, registry: CategoryRegistry): CategoryConfig | undefined;
function getAllCategories(registry: CategoryRegistry): CategoryConfig[];
function createRegistry(configs: CategoryConfig[]): CategoryRegistry;
```

Components consume `getCategoryStyle(task.category.id, registry)` rather than switch-on-color-string.

---

### Admin Workflow Lifecycles

**CSV Roster Upload Lifecycle:**
```
States: upload -> validate -> preview -> confirm -> persist

File Validation (at upload step):
  - Accepted formats: .csv, .xlsx
  - Max file size: 5MB
  - Must contain at least 1 data row (non-header)
  - Required columns: name, email, role
  Failure: Show inline error (wrong format / too large / empty), stay on upload step

Parsing (at validate step):
  - Parse all rows, collect errors per-row
  - Error types: missing required field, invalid email format, invalid role value
  - Display: highlight error rows in red with reason tooltip
  - User can fix inline or skip error rows

Preview (at preview step):
  - Show table of valid rows with name, email, role
  - Show error count badge if some rows had errors
  - User can: confirm valid rows, cancel (discard all), go back to fix errors

Persist (at confirm step):
  - Persist valid rows via organizationService.bulkAddMembers()
  - On partial failure: persist succeeded rows, return error list with row numbers and reasons
  - User can retry failed rows without re-uploading
  - Rollback: No automatic rollback; user can manually remove incorrectly added members

Cancel at any step: discard parsed data, return to upload
```

**Staff Invitation Lifecycle:**
```
States: compose -> validate -> send -> confirm

Fields: email (required), role (admin|principal|teacher, required), message (optional)

Validation:
  - Valid email format (regex + no existing member check)
  - Not already invited (check pending invitations)
  - Not already a member (check org members)
  Failure: field-level error message on the offending field

Send:
  - Call invitationService.sendInvitation() -> Resend API via Cloudflare Worker
  - On success: add to pending invitations list, show success toast
  - On failure: show error toast with "Retry" button
  - Retry: re-send with same data without user re-entry
  - Max retries: 3 before showing "Contact support" message

Success: Clear form, add entry to pending invitations list
```

**AI Task Creation (from Capture/Notes/Observations) Lifecycle:**
```
States: trigger -> loading -> preview -> edit -> persist

Trigger: User clicks "Create Task from [Source]"

Loading:
  - Show skeleton/spinner in modal
  - Send content to Cloudflare Worker AI endpoint
  - Timeout: 15 seconds
  - On timeout/error: Show "Could not generate task" toast, offer "Create manually" button as fallback

Preview:
  - AI returns: { title, description, assignee?, dueDate?, priority? }
  - Display pre-filled form with AI suggestions highlighted
  - User can accept all or edit individual fields

Edit:
  - User modifies any field (title, description, assignee, due date, priority, category)
  - Validation: title required, due date must be valid if provided

Persist:
  - Call taskService.create(taskData)
  - On success: close modal, show success toast, refresh task list
  - On failure: show error toast, keep modal open with "Retry" button
  - Retry preserves all user edits

User confirmation flow: Preview -> [Accept/Edit] -> Confirm -> Persist
User can cancel at any step (preview, edit) to discard without saving
```

---

### Component Dependency Graph

```
DesktopSidebar / MobileTabBar
  depends on: WorkspaceTab type, AdminiRole, tab navigation state machine

DashboardTab
  QuickActionsBar -> depends on: onTabChange callback
  LevelBadge -> depends on: DashboardKPIs (badge count, level)
  AchievementsModal -> depends on: Badge[], modal state machine
  MiniCalendar -> depends on: DashboardTask[] (due dates)
  TodaysSchedule -> depends on: DayStructureBlock[], mergedEvents (Algorithm 1)
  ActivityFeed -> depends on: ActivityEvent[] (Algorithm 2)
  TaskSection -> depends on: TaskWithSubtasks[], CategoryRegistry

TasksTab
  TaskFilterBar -> depends on: filter state machine
  TaskCard -> depends on: TaskWithSubtasks, CategoryRegistry, Algorithm 3
  CalendarView -> depends on: mergedEvents (Algorithm 1), DashboardTask[]
  OverdueList -> depends on: DashboardTask[] filtered by parseLocalDate

CaptureTab -> depends on: captureService, TapCategory[], organizationId
NotesTab -> depends on: meetingNotesService, MeetingNote, organizationId
ObservationsTab -> depends on: observationService, AdminiRole (gate)
PulseTab -> depends on: dayStructureService, DayStructureBlock[]
AdminTab -> depends on: invitationService, organizationService, AdminiRole (gate)
```

---

## Tasks

### Section A: Presentation Layer (UI/Components)

- [ ] 1. Design system tokens and shared foundation
  - [-] 1.1 Update design tokens in `@admini/ui/styles.css`
    - Update `--color-sage` to `#6B8E6B`, `--color-sage-deep` to `#4A6B4A`, `--color-bg` to `#F5F3EE`
    - Add category tokens: `--color-category-orange`, `--color-category-yellow`, `--color-category-green`, `--color-category-red`
    - Verify `--font-body` remains system font stack, `Tomorrow` only for headings
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [-] 1.2 Create `CategoryRegistry` module in `packages/shared/src/categoryRegistry.ts`
    - **Data Contract:**
      ```typescript
      // Input: CategoryConfig[] (configuration array)
      // Output: CategoryRegistry (Map<string, CategoryConfig>)
      interface CategoryConfig {
        id: string;
        label: string;
        colorToken: string;
        colorHex: string;
        icon?: string;
      }
      type CategoryRegistry = Map<string, CategoryConfig>;
      function getCategoryStyle(categoryId: string, registry: CategoryRegistry): CategoryConfig | undefined;
      function getAllCategories(registry: CategoryRegistry): CategoryConfig[];
      function createRegistry(configs: CategoryConfig[]): CategoryRegistry;
      ```
    - Export default registry with compliance/scheduling/students/blocked entries
    - Registry is injectable (tests can override with custom configs)
    - All components consume `getCategoryStyle()` - no switch statements on color strings
    - _Requirements: 1.5, 16.4_

  - [-] 1.3 Extract shared utilities to `packages/shared/src/`
    - **Data Contract:**
      ```typescript
      // packages/shared/src/dateUtils.ts
      function parseLocalDate(dateStr: string): Date;
      function isLocalDate(a: string, b: string): boolean;
      function filterTodayEvents(events: CalendarEvent[]): CalendarEvent[];

      // packages/shared/src/greetingUtils.ts
      function getTimeGreeting(): string; // "Good morning" | "Good afternoon" | "Good evening"

      // packages/shared/src/activityUtils.ts
      function formatActivityAction(event: ActivityEvent): string;
      ```
    - Each utility is a pure function with documented input/output types
    - _Requirements: 18.1, 18.2, 1.1_

  - [x] 1.4 Write property tests for shared utilities
    - **Property 1: Time greeting correctness** - For any hour 0-23, getTimeGreeting returns correct greeting with no gaps/overlaps
    - **Validates: Requirements 1.1**
    - **Property 13: Local date parsing preserves calendar day** - parseLocalDate produces Date matching original string year/month/day regardless of timezone
    - **Validates: Requirements 18.1, 18.2**
    - File: `packages/shared/src/__tests__/dateUtils.property.test.ts`

- [x] 2. Navigation and layout shell
  - [x] 2.1 Implement `DesktopSidebar` component
    - **Data Contract:**
      ```typescript
      // Props (input):
      interface DesktopSidebarProps {
        activeTab: WorkspaceTab;
        tabs: TabItem[];
        userRole: AdminiRole;
        onTabChange: (tabId: WorkspaceTab) => void;
        onSignOut?: () => void;
      }
      interface TabItem {
        id: WorkspaceTab;
        label: string;
        icon: React.ReactNode;
        requiredRoles?: AdminiRole[];
      }
      // Output/Events: Calls onTabChange(tabId) on click; calls onSignOut() on sign-out
      // Services called: None (pure presentational)
      // Data expected: tabs array with role metadata
      ```
    - Tab order: Capture, Dashboard, Tasks, Notes, Observations, Pulse, Settings, Admin
    - Active tab: Sage Green background highlight via `--color-sage`
    - Role gating: filter tabs where `requiredRoles` does not include `userRole`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.2 Implement `MobileTabBar` component
    - **Data Contract:** Same props interface as `DesktopSidebarProps`
    - **Output/Events:** Same `onTabChange` callback
    - Renders below 900px viewport width (CSS media query)
    - Same role-gating logic as DesktopSidebar
    - _Requirements: 1.4, 4.4_

  - [x] 2.3 Implement `NavigationRenderer` responsive switch
    - **Data Contract:**
      ```typescript
      interface NavigationRendererProps {
        activeTab: WorkspaceTab;
        userRole: AdminiRole;
        onTabChange: (tabId: WorkspaceTab) => void;
        onSignOut?: () => void;
      }
      // Services called: None
      // State machine: Tab Navigation (dismiss modals, reset scroll, preserve filters)
      ```
    - Renders DesktopSidebar above 900px, MobileTabBar at/below 900px
    - Implements tab navigation state machine transitions
    - On TAB_CLICK: dismiss open modals, set activeTab, reset scroll, preserve filter state
    - _Requirements: 1.4, 4.5_

  - [x] 2.4 Write property tests for navigation role-gating
    - **Property 3: Role-gating hides restricted navigation** - For any non-admin/non-principal role, Admin and Observations are excluded from rendered output
    - **Validates: Requirements 4.4, 19.5**
    - File: `packages/workspace/src/components/__tests__/Navigation.property.test.ts`

- [ ] 3. Dashboard tab - presentation components
  - [x] 3.1 Implement `QuickActionsBar` component
    - **Data Contract:**
      ```typescript
      interface QuickActionsBarProps {
        onTabChange: (tabId: WorkspaceTab, options?: { mode?: string; view?: string }) => void;
      }
      // Output: Calls onTabChange with specific tab + mode combinations
      // Services called: None (pure presentational)
      // Buttons: "Record a Capture" -> Capture/voice, "Quick Tap Capture" -> Capture/tap,
      //          "See Task Calendar" -> Tasks/calendar, "Update Roster" -> Admin
      ```
    - Four pill-shaped buttons with Sage Green styling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Implement `LevelBadge` component
    - **Data Contract:**
      ```typescript
      interface LevelBadgeProps {
        level: number;
        badgeCount: number;
        onClick: () => void;
      }
      // Output: Calls onClick when badge is clicked (triggers AchievementsModal)
      // Services called: None
      // Data expected: level and badgeCount from DashboardKPIs
      ```
    - Clickable badge element in top bar
    - _Requirements: 3.1_

  - [x] 3.3 Implement `AchievementsModal` component
    - **Data Contract:**
      ```typescript
      interface AchievementsModalProps {
        isOpen: boolean;
        onClose: () => void;
        badges: Badge[];
        totalBadges: number;
      }
      // Output: Calls onClose on dismiss (click outside, close button, ESC)
      // Services called: None (data passed in)
      // State machine: Modal Open/Close (focus trap, backdrop, restore focus)
      ```
    - Earned badges with icon, name, description, date
    - Locked badges greyed out
    - Gold progress bar: earnedCount / totalBadges
    - Implements modal state machine (focus trap, ESC dismiss, outside click dismiss)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.4 Implement `MiniCalendar` component
    - **Data Contract:**
      ```typescript
      interface MiniCalendarProps {
        tasks: DashboardTask[];
        currentMonth?: Date; // defaults to today
        onMonthChange?: (month: Date) => void;
      }
      // Output: Renders month grid, dots on days with tasks
      // Services called: None (data passed in)
      // Data expected: tasks[].dueAt parsed via parseLocalDate
      ```
    - Month grid with prev/next navigation arrows
    - Today highlighted with Sage Green filled circle
    - Dot indicators on dates that have >=1 task due (using parseLocalDate)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [-] 3.5 Implement `TodaysSchedule` component
    - **Data Contract:**
      ```typescript
      interface TodaysScheduleProps {
        dayStructure: DayStructureBlock[];
        mergedEvents: MergedEvent[]; // output of Algorithm 1
        onDeleteEvent?: (eventId: string) => void;
      }
      // Output: Renders time blocks with inline events; calls onDeleteEvent for local events
      // Services called: None (merged data passed in)
      // Algorithm dependency: Receives pre-merged events (Algorithm 1 applied upstream)
      // Event placement: event.startHour falls within block's start/end range
      ```
    - Time blocks from Day Structure
    - Events placed in blocks by start hour
    - Delete button visible only for local events (source === 'local')
    - Only current-date events displayed (filterTodayEvents applied upstream)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [-] 3.6 Implement `ActivityFeed` component
    - **Data Contract:**
      ```typescript
      interface ActivityFeedProps {
        items: ActivityEvent[]; // pre-sorted and capped by Algorithm 2
      }
      // Output: Renders list of activity items with icons and timestamps
      // Services called: None (data passed in, Algorithm 2 applied upstream)
      // Data shape: max 7 items, sorted descending by createdAt
      ```
    - Colored icon per activity type (checkmark=create, circle=update)
    - Timestamp display
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 3.7 Implement `TaskSection` component (Dashboard task cards)
    - **Data Contract:**
      ```typescript
      interface TaskSectionProps {
        title: string; // "High Priority" | "Due Today" | "Coming Due" | "Blocked" | "Suggested"
        tasks: TaskWithSubtasks[];
        registry: CategoryRegistry;
        onTaskAction?: (taskId: string, action: TaskAction) => void;
      }
      // Output: Renders task cards with category tags from registry
      // Services called: None (data passed in)
      // Category lookup: getCategoryStyle(task.category.id, registry)
      ```
    - Category tags rendered via `getCategoryStyle()` (metadata-driven, no switch)
    - Blocked tasks show blockReason in red + stale badge (staleDays)
    - Due Today tasks show scheduled time next to title
    - _Requirements: 1.2, 1.5, 1.6, 1.7_

  - [ ] 3.8 Write property tests for Dashboard components
    - **Property 4: Mini calendar task-day indicators** - For any set of tasks with due dates in the displayed month, dots appear on exactly those dates with >=1 task
    - **Validates: Requirements 5.3**
    - **Property 5: Event-to-time-block placement** - For any event with a start time, it is placed in exactly the block whose range contains that start hour
    - **Validates: Requirements 6.2**
    - **Property 8: Activity feed ordering and limit** - For any list of activity events, at most 7 displayed, sorted non-increasing by createdAt
    - **Validates: Requirements 7.1**
    - File: `packages/workspace/src/components/__tests__/Dashboard.property.test.ts`

- [ ] 4. Checkpoint - Verify design system, navigation, and Dashboard rendering
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Tasks tab - presentation components
  - [ ] 5.1 Implement `TaskFilterBar` component
    - **Data Contract:**
      ```typescript
      interface TaskFilterBarProps {
        activeFilter: 'all' | 'open' | 'in-progress' | 'completed' | 'blocked';
        onFilterChange: (filter: FilterType) => void;
        activeView: 'list' | 'calendar';
        onViewToggle: () => void;
      }
      // Output: Calls onFilterChange(filter) on pill click; onViewToggle on view switch
      // Services called: None
      // State machine: Filter State (preserved across tab switches)
      ```
    - Filter pills: All, Open, In Progress, Completed, Blocked
    - View toggle: list <-> calendar
    - Implements filter state machine (state preserved on tab switch)
    - _Requirements: 8.2_

  - [ ] 5.2 Implement `TaskCard` component
    - **Data Contract:**
      ```typescript
      interface TaskCardProps {
        task: TaskWithSubtasks;
        registry: CategoryRegistry;
        isExpanded: boolean;
        onToggleExpand: () => void;
        onSubtaskToggle: (subtaskId: string) => void;
        onDuplicate: () => void;
        onStatusChange: (status: TaskStatus) => void;
      }
      // Output: User interactions -> callbacks
      // Services called: None (callbacks passed up)
      // Algorithm dependency: onDuplicate triggers Algorithm 3 upstream
      // Category: getCategoryStyle(task.category.id, registry)
      // Rule: parent checkbox disabled if any subtask.completed === false (Property 9)
      ```
    - Collapsed: title, priority indicator, due date, completion progress
    - Expanded: subtask checkboxes inline, category tag, block reason
    - Duplicate action in menu (triggers Algorithm 3 in service layer)
    - Parent task completion disabled when incomplete subtasks exist
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6_

  - [ ] 5.3 Implement `CalendarView` component
    - **Data Contract:**
      ```typescript
      interface CalendarViewProps {
        mergedEvents: MergedEvent[]; // Algorithm 1 output
        tasks: DashboardTask[];
        onAddEvent: (date: string, time?: string) => void;
      }
      // Output: Calendar grid; calls onAddEvent when user adds event
      // Services called: None (data passed in)
      // Legend: Task dot, Subtask dot, Assigned indicator, Priority indicator
      ```
    - Monthly grid with tasks + events overlaid
    - Left legend: Task, Subtask, Assigned, Priority dot indicators
    - "Add Event" button on calendar (creates local event)
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [ ] 5.4 Implement `OverdueList` component
    - **Data Contract:**
      ```typescript
      interface OverdueListProps {
        tasks: DashboardTask[]; // pre-filtered: dueAt < today && status !== 'completed'
      }
      // Output: Renders overdue task list alongside calendar
      // Services called: None
      // Filtering: upstream uses parseLocalDate for date comparison (no UTC)
      ```
    - Lists tasks where parseLocalDate(dueAt) < today and status != completed
    - _Requirements: 9.3_

  - [ ] 5.5 Write property tests for Tasks components
    - **Property 9: Subtask completion gates parent task** - For any task with >=1 subtask where completed=false, parent checkbox is disabled
    - **Validates: Requirements 8.4**
    - **Property 10: Overdue task identification** - For any task where local due date < today and status != completed, it appears in overdue list
    - **Validates: Requirements 9.3**
    - File: `packages/workspace/src/components/__tests__/Tasks.property.test.ts`

- [ ] 6. Capture, Notes, and Observations tabs - presentation components
  - [ ] 6.1 Implement `CaptureTab` component
    - **Data Contract:**
      ```typescript
      interface CaptureTabProps {
        initialMode?: 'voice' | 'tap';
        organizationId?: string;
      }
      // Services called: captureService.createCapture(), captureService.getCategories()
      // Output: Creates CaptureRecord, optionally triggers AI task creation modal
      // Data expected: TapCategory[] from captureService
      // State: voice/tap mode toggle, capture form state, "Create Task" modal (form submission state machine)
      ```
    - Voice mode: recording interface with AI summary generation
    - Tap mode: customizable category grid, unified "Where" field
    - "Create Task from Capture" modal with AI pre-fill (AI Task Creation lifecycle)
    - Natural language sentence summary on tap completion
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 6.2 Implement `NotesTab` component
    - **Data Contract:**
      ```typescript
      interface NotesTabProps {
        organizationId?: string;
        userId?: string;
      }
      // Services called: meetingNotesService.create(), meetingNotesService.update()
      // Output: Creates/edits MeetingNote, triggers AI task creation
      // Data expected: MeetingNote from service, MeetingType enum
      // State: form fields, rich text content, "Create Task" modal (AI Task Creation lifecycle)
      ```
    - Meeting type dropdown: Observation Pre/Post Conference, Staff Meeting, Teacher Meeting, Parent Meeting, Student Meeting, Disciplinary Incident
    - Fields: Meeting Type, Date, Attendees
    - Rich text toolbar: Bold, Italic, List, Task checkbox, Divider
    - "Create Task from Note" - triggers AI Task Creation lifecycle (loading -> preview -> edit -> persist)
    - Auto-timestamp on create/edit
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 6.3 Implement `ObservationsTab` component
    - **Data Contract:**
      ```typescript
      interface ObservationsTabProps {
        organizationId?: string;
        userId?: string;
      }
      // Services called: observationService.list(), observationService.shareViaGmail()
      // Output: Observation list, AI task creation, Gmail share
      // Data expected: Observation[] from service
      // Role gate: only rendered if userRole === 'admin' || userRole === 'principal'
      // State: observation list, share modal, "Create Task" modal (AI Task Creation lifecycle)
      ```
    - Role-gated (admin/principal only)
    - Observation list with status indicators
    - "Create Task from Observation" - AI Task Creation lifecycle, default action = share/send
    - Gmail share with contact autocomplete (Google Contacts API)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [ ] 6.4 Write property tests for event visibility
    - **Property 6: Today's events filter** - For any set of events, filterTodayEvents returns only events whose local date matches today
    - **Validates: Requirements 6.3, 6.5, 18.3**
    - **Property 7: Local event delete button visibility** - Delete button rendered iff event source is local (not Google)
    - **Validates: Requirements 6.4**
    - File: `packages/workspace/src/components/__tests__/Navigation.property.test.ts`

- [ ] 7. Pulse and Admin tabs - presentation components
  - [ ] 7.1 Implement `PulseTab` component
    - **Data Contract:**
      ```typescript
      interface PulseTabProps {
        organizationId?: string;
        userId?: string;
      }
      // Services called: dayStructureService.get(), dayStructureService.update()
      // Output: Edits DayStructureBlock[], updates propagate to Dashboard TodaysSchedule
      // Data expected: DayStructureBlock[] from service
      // State: editing form for blocks (period name, time range, activities)
      ```
    - Day Structure editor: period name, time range, activities
    - Cadence management (always active, no "disabled" option)
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 7.2 Implement `AdminTab` component
    - **Data Contract:**
      ```typescript
      interface AdminTabProps {
        organizationId?: string;
        userRole: AdminiRole;
      }
      // Services called: invitationService.send(), organizationService.getMembers(),
      //   organizationService.updateRole(), organizationService.bulkAddMembers(),
      //   organizationService.editSchoolName()
      // Output: Staff management, invitations, roster upload
      // State machines: Form Submission (invitation), CSV Upload lifecycle
      // Role gate: only rendered if userRole === 'admin'
      ```
    - **Staff Invitation Form** - Implements Staff Invitation lifecycle:
      - Fields: email, role (admin/principal/teacher), optional message
      - Validation: valid email, not already invited, not already member
      - Send via Resend (Cloudflare Worker), retry on failure (max 3)
      - Success: clear form, add to pending list
    - **Staff Roster** with role management (view/change roles)
    - **Pending Invitations** list (persisted via Supabase, shows status: pending/accepted/expired)
    - **Google Classroom Roster** display (when integration active)
    - **Membership Account Management** (add, remove, edit profiles)
    - **School Name Editing**
    - **Roster Upload (CSV/Excel)** - Implements CSV Upload lifecycle:
      - File validation: format (.csv/.xlsx), size (<=5MB), non-empty, required columns
      - Parse: collect per-row errors (missing field, invalid email, invalid role)
      - Preview: valid rows table + error count badge
      - Confirm: persist valid rows, report failures with row numbers
      - Rollback: manual (user removes incorrectly added members)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

  - [ ] 7.3 Implement `Toast` component with deduplication
    - **Data Contract:**
      ```typescript
      interface ToastProps {
        message: string;
        id: string;
        onDismiss: (id: string) => void;
        action?: { label: string; onClick: () => void };
      }
      // Toast Manager:
      interface ToastManagerState {
        currentToast: ToastProps | null;
        // Deduplication: track current visible toast ID
        // On undo trigger: if toast with same message is visible, skip
      }
      // Output: Calls onDismiss on X click or auto-dismiss
      // Deduplication rule: never show >1 toast simultaneously
      ```
    - Visible dismiss button (x) with proper `pointer-events`
    - Deduplication: track current toast ID, suppress duplicates on rapid undo
    - Undo completes before toast unmount
    - _Requirements: 17.1, 17.2, 17.3_

  - [ ] 7.4 Write property test for Toast deduplication
    - **Property 12: Toast deduplication** - For any sequence of rapid undo triggers, simultaneously visible toasts never exceed 1
    - **Validates: Requirements 17.3**
    - File: `packages/workspace/src/components/__tests__/Toast.property.test.ts`

- [ ] 8. Checkpoint - Verify all presentation components render correctly
  - Ensure all tests pass, ask the user if questions arise.

---

### Section B: Service/Data Layer (Backend/APIs)

- [x] 9. Event merging and calendar services
  - [x] 9.1 Implement `mergeEvents` function in `packages/workspace/src/services/calendarMerge.ts`
    - **Data Contract:**
      ```typescript
      // Input:
      function mergeEvents(
        googleEvents: CalendarEvent[],
        localEvents: LocalEvent[]
      ): MergedEvent[];

      interface MergedEvent {
        id: string;
        summary: string;
        start: string;
        end: string;
        source: 'google' | 'local';
      }
      ```
    - Implements **Algorithm 1** exactly as specified:
      1. Create Map keyed by event ID
      2. Insert local events first (priority)
      3. Insert Google events only if ID not already present
      4. Collect values, sort by start ascending (localeCompare, stable)
      5. Return sorted array
    - _Requirements: 13.2_

  - [x] 9.2 Implement `buildActivityFeed` function in `packages/workspace/src/services/activityFeed.ts`
    - **Data Contract:**
      ```typescript
      function buildActivityFeed(
        syncEvents: ActivityEvent[],
        tasks: DashboardTask[]
      ): ActivityEvent[];

      // Returns: max 7 items, sorted descending by createdAt
      // Fallback: if syncEvents empty, derive from tasks
      ```
    - Implements **Algorithm 2** exactly:
      1. Source selection (syncEvents preferred, tasks as fallback)
      2. Sort by createdAt descending (ties: ID ascending)
      3. Slice to 7
    - _Requirements: 7.1, 7.3_

  - [x] 9.3 Implement `duplicateTask` function in `packages/workspace/src/services/taskDuplication.ts`
    - **Data Contract:**
      ```typescript
      function duplicateTask(
        sourceTask: TaskWithSubtasks,
        taskService: { create: (task: TaskWithSubtasks) => Promise<TaskWithSubtasks> }
      ): Promise<TaskWithSubtasks>;

      // Copies: title, description, priority, category, dueAt, assignee
      // Resets: id, status='open', completedAt=undefined, timestamps=now,
      //         staleDays=0, blockReason=undefined, subtask IDs=new, subtasks completed=false
      ```
    - Implements **Algorithm 3** exactly:
      1. structuredClone the source
      2. Copy specified fields, reset specified fields
      3. Persist via taskService.create()
      4. Return persisted task
    - _Requirements: 8.5_

  - [x] 9.4 Write property tests for deterministic algorithms
    - **Property 11: Event merge completeness** - For any set of Google + local events, merged result contains all unique IDs, no duplicates, sorted ascending
    - **Validates: Requirements 13.2**
    - **Property 2: Stale days calculation** - For any task with updatedAt in the past, staleDays equals calendar days between updatedAt and today, always non-negative
    - **Validates: Requirements 1.6**
    - File: `packages/workspace/src/services/__tests__/googleIntegration.property.test.ts`

- [ ] 10. Checkpoint - Verify all deterministic algorithms pass property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Google Calendar integration service
  - [x] 11.1 Update `googleIntegrationService` for merged event pipeline
    - **Data Contract:**
      ```typescript
      // Existing service interface (packages/workspace/src/services/googleIntegrationService.ts)
      function getTodayCalendarEvents(): Promise<CalendarEvent[]>;
      function getCalendarEvents(startDate: string, endDate: string): Promise<CalendarEvent[]>;

      // Error handling: returns [] on token missing or API failure
      // Consumers: DashboardTab, TasksTab CalendarView, MiniCalendar
      // Pipeline: fetch -> mergeEvents(google, local) -> filterTodayEvents (for schedule)
      ```
    - Graceful degradation: return empty arrays on failure (no error banner for calendar)
    - Consumers call mergeEvents() with results + local events
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 11.2 Implement local event CRUD in `packages/workspace/src/services/localEventService.ts`
    - **Data Contract:**
      ```typescript
      interface LocalEventService {
        getEvents(): LocalEvent[];
        addEvent(event: Omit<LocalEvent, 'id'>): LocalEvent;
        deleteEvent(eventId: string): void;
      }
      // Storage: localStorage with try/catch fallback to empty array
      // Consumers: TodaysSchedule (delete), CalendarView (add)
      ```
    - localStorage-backed with try/catch (private browsing fallback)
    - _Requirements: 6.4, 9.5_

- [ ] 12. Admin services and AI task creation
  - [ ] 12.1 Implement invitation service updates in `packages/workspace/src/services/invitationService.ts`
    - **Data Contract:**
      ```typescript
      interface InvitationService {
        sendInvitation(data: { email: string; role: AdminiRole; message?: string }): Promise<OrgInvitation>;
        getPendingInvitations(orgId: string): Promise<OrgInvitation[]>;
        cancelInvitation(invitationId: string): Promise<void>;
      }
      // Calls: Cloudflare Worker (Resend API) for email delivery
      // Error handling: throws on send failure, caller shows retry toast (max 3 retries)
      // Validation: email format, not already invited, not already member (checked before call)
      ```
    - Implements Staff Invitation lifecycle send step
    - Retry logic: caller retries up to 3 times on failure, then shows "Contact support"
    - _Requirements: 15.1, 15.3, 15.9_

  - [ ] 12.2 Implement roster upload service in `packages/workspace/src/services/rosterUploadService.ts`
    - **Data Contract:**
      ```typescript
      interface RosterUploadService {
        validateFile(file: File): ValidationResult;
        parseRoster(file: File): Promise<ParseResult>;
        persistMembers(validRows: RosterRow[]): Promise<PersistResult>;
      }

      interface ValidationResult {
        valid: boolean;
        error?: 'wrong_format' | 'too_large' | 'empty_file' | 'missing_columns';
      }

      interface ParseResult {
        validRows: RosterRow[];
        errorRows: { row: number; field: string; reason: string }[];
      }

      interface PersistResult {
        succeeded: RosterRow[];
        failed: { row: number; reason: string }[];
      }

      interface RosterRow {
        name: string;
        email: string;
        role: 'admin' | 'principal' | 'teacher';
        rowNumber: number;
      }
      ```
    - Implements CSV Upload lifecycle:
      - validateFile: format (.csv/.xlsx), size <=5MB, non-empty
      - parseRoster: extract rows, validate required columns, collect per-row errors
      - persistMembers: bulk create via organizationService, return success/failure lists
    - No automatic rollback; partial success allowed
    - _Requirements: 15.8_

  - [ ] 12.3 Implement AI task creation worker client in `packages/workspace/src/services/aiTaskService.ts`
    - **Data Contract:**
      ```typescript
      interface AITaskService {
        generateTaskFromContent(content: string, source: 'capture' | 'note' | 'observation'): Promise<AITaskSuggestion>;
      }

      interface AITaskSuggestion {
        title: string;
        description: string;
        assignee?: string;
        dueDate?: string;
        priority?: 'high' | 'medium' | 'low';
      }
      // Calls: Cloudflare Worker AI endpoint (POST /api/ai/generate-task)
      // Timeout: 15 seconds
      // Error handling: throws on timeout/worker error
      // Caller: shows loading state, on error offers manual fallback
      ```
    - Implements AI Task Creation lifecycle loading/analysis step
    - 15-second timeout; throws on failure for caller to handle
    - _Requirements: 10.5, 11.4, 19.2_

  - [ ] 12.4 Update notification service for task assignment
    - **Data Contract:**
      ```typescript
      interface NotificationService {
        notifyAssignee(taskId: string, assigneeId: string, action: 'created' | 'updated'): Promise<void>;
      }
      // Calls: Cloudflare Worker (Resend API) for email notification
      // Retry: 2 automatic retries with exponential backoff (1s, 3s)
      // Failure state: log error, do not block task creation/update
      // Trigger: called by taskService on create/update with assignee
      ```
    - Non-blocking: notification failure does not block task operation
    - Retry: 2 retries with exponential backoff, then silent fail (logged)
    - _Requirements: 14.1_

- [ ] 13. Checkpoint - Verify all service layer functions and integrations
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Integration wiring and end-to-end composition
  - [ ] 14.1 Wire `DashboardTab` to services and algorithms
    - **Wiring:**
      - Fetch tasks via dashboardService.getTasks() -> pass to TaskSection, MiniCalendar
      - Fetch Google events via googleIntegrationService.getTodayCalendarEvents()
      - Fetch local events via localEventService.getEvents()
      - Merge: mergeEvents(googleEvents, localEvents) -> pass to TodaysSchedule
      - Filter: filterTodayEvents(mergedEvents) -> pass to TodaysSchedule
      - Build feed: buildActivityFeed(syncEvents, tasks) -> pass to ActivityFeed
      - Fetch KPIs via dashboardService.getKPIs() -> pass to LevelBadge
      - Pass CategoryRegistry instance to TaskSection
    - Error handling: show error banner with Retry on fetch failure, individual sections degrade independently
    - _Requirements: 1.1, 1.2, 1.3, 5.3, 6.1, 6.2, 6.3, 7.1, 13.1_

  - [ ] 14.2 Wire `TasksTab` to services and algorithms
    - **Wiring:**
      - Fetch tasks via dashboardService.getTasks() -> filter by activeFilter -> pass to TaskCard list
      - Merge events for CalendarView: mergeEvents(google, local) -> pass to CalendarView
      - Duplicate: onDuplicate -> duplicateTask(task, taskService) -> refresh list
      - Overdue: tasks.filter(t => parseLocalDate(t.dueAt) < today && t.status !== 'completed') -> OverdueList
      - Pass CategoryRegistry to TaskCard
      - Local event add: localEventService.addEvent() from CalendarView
    - _Requirements: 8.1, 8.5, 9.1, 9.3_

  - [ ] 14.3 Wire `AdminTab` to services and lifecycles
    - **Wiring:**
      - Invitation form -> invitationService.sendInvitation() with retry logic (max 3)
      - Roster upload -> rosterUploadService pipeline (validate -> parse -> preview -> persist)
      - Staff list -> organizationService.getMembers()
      - Role change -> organizationService.updateRole()
      - School name -> organizationService.editSchoolName()
      - Pending invitations -> invitationService.getPendingInvitations()
    - Form state machine: idle -> validating -> submitting -> success/error
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 15.7, 15.8_

  - [ ] 14.4 Wire AI task creation across Capture/Notes/Observations
    - **Wiring:**
      - "Create Task from X" button -> show loading modal -> aiTaskService.generateTaskFromContent()
      - On success: show pre-filled form (preview step)
      - On timeout/error: show error toast + "Create manually" fallback button
      - Edit step: user modifies fields -> confirm -> taskService.create()
      - On persist failure: show error toast + "Retry" (preserves edits)
      - On persist success: close modal, show success toast, refresh task list
    - Implements full AI Task Creation lifecycle across all three tabs
    - _Requirements: 10.5, 11.4, 19.2_

  - [ ] 14.5 Write integration tests for cross-component flows
    - Day Structure update in Pulse -> reflected in Dashboard TodaysSchedule
    - Google Calendar data appears across Dashboard, Tasks Calendar, Mini Calendar
    - Task creation from Capture/Notes/Observations triggers AI service
    - Notification sent on task assignment (non-blocking)
    - CSV upload end-to-end: file -> validate -> parse -> preview -> persist
    - _Requirements: 12.3, 13.1, 10.5, 14.1, 15.8_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All property tests are **mandatory** (no asterisk markers) - they are required for correctness validation
- Each component task specifies its full data contract: props interface, services called, data shape expected
- Category-to-color mappings are always resolved via `CategoryRegistry` - no hardcoded switch statements
- Deterministic algorithms (event merge, activity feed, task duplication) are implemented as standalone pure functions with explicit invariants
- State machines (tab navigation, modal lifecycle, form submission, filter state) are documented and implemented as explicit transition logic
- Admin workflows (CSV upload, invitation, AI task creation) specify complete lifecycle with failure handling at every step
- Tasks in Section A (presentation) have NO direct service calls - they receive data via props from wired parent containers
- Tasks in Section B (services) are pure logic/data - no DOM rendering
- Integration wiring (task 14) is the boundary where presentation meets services

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1", "2.2", "9.1", "9.2", "9.3"] },
    { "id": 2, "tasks": ["2.3", "2.4", "9.4", "11.1", "11.2"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.4", "3.5", "3.6", "3.7", "5.1", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 4, "tasks": ["3.3", "3.8", "5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["5.5", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 7, "tasks": ["7.4"] },
    { "id": 8, "tasks": ["14.1", "14.2", "14.3", "14.4"] },
    { "id": 9, "tasks": ["14.5"] }
  ]
}
```
