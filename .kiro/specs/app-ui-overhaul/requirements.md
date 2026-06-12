# Requirements Document

## Introduction

This document defines the requirements for a comprehensive UI/UX overhaul of the AdminI web application. The overhaul aligns the entire visual layer and interaction model to a specific Figma design mock provided by the CEO. The current application has accumulated incremental patches that do not cohesively match the target design. This spec covers a complete rewrite of the visual presentation layer, component layouts, navigation structure, and interaction patterns across all major application areas: Dashboard, Tasks, Capture, Notes, Observations, Pulse, Admin, and shared design system elements.

The tech stack remains: React, TypeScript, Vite, CSS custom properties, Supabase, and Cloudflare Workers.

## Glossary

- **Dashboard**: The primary landing view showing task summaries, calendar, schedule, and activity feed in a two-column layout
- **Sidebar**: The persistent left-side navigation panel visible on desktop viewports
- **Quick_Actions**: Pill-shaped shortcut buttons in the Dashboard top bar that navigate to common workflows
- **Level_Badge**: A clickable element in the Dashboard top bar displaying the user's gamification level and badge count
- **Achievements_Modal**: A dialog triggered by clicking the Level Badge that displays earned and locked badges with progress
- **Mini_Calendar**: A compact monthly calendar widget in the Dashboard right column showing task-day indicators
- **Todays_Schedule**: A section in the Dashboard right column displaying time blocks synced with Pulse Day Structure and calendar events
- **Activity_Feed**: A chronological list of recent user actions displayed in the Dashboard right column
- **Task_Card**: A collapsible/expandable card component representing a single task with subtask checkboxes
- **Calendar_View**: A calendar-based visualization of tasks, subtasks, and Google Calendar events in the Tasks tab
- **Notes_Tab**: A dedicated tab for meeting notes with rich text editing, meeting type selection, and AI-powered task creation
- **Capture_Tab**: A tab for voice and tap captures (no notes), with customizable categories and task creation from captures
- **Pulse_Tab**: A tab for managing daily schedule cadence and day structure
- **Admin_Tab**: A tab for staff invitation, roster management, and Google Classroom integration
- **Design_System**: The shared set of colors, typography, spacing, border radii, and component patterns used across the application
- **Toast**: A dismissable notification element that appears temporarily to confirm actions
- **Sage_Green**: The primary brand color (#6B8E6B) used for active states, buttons, and accents
- **Limestone**: The warm neutral background color (#F5F3EE) used for page backgrounds and subtle fills
- **Category_Tag**: A colored label chip indicating a task's domain (Compliance, Students, etc.)
- **Stale_Badge**: A red indicator on blocked tasks showing how long the task has been stalled
- **Day_Structure**: The Pulse-defined time blocks (Morning, Afternoon, End of Day) that organize the daily schedule
- **Observations_Tab**: A role-gated tab for classroom observations with AI-powered task creation for follow-up actions
- **Google_Integration_Service**: The service layer responsible for syncing Google Calendar events, Contacts, and Classroom data

## Requirements

### Requirement 1: Dashboard Two-Column Layout

**User Story:** As an administrator, I want the Dashboard to display in a structured two-column layout matching the Figma mock, so that I can quickly scan my priorities and schedule at a glance.

#### Acceptance Criteria

1. WHEN the Dashboard tab is active, THE Dashboard SHALL render a top bar containing a time-appropriate greeting, Quick Actions pill buttons, and a clickable Level Badge
2. WHEN the Dashboard tab is active, THE Dashboard SHALL render a left column containing High Priority, Due Today, Coming Due, Blocked Tasks, and Suggested Tasks sections in that order
3. WHEN the Dashboard tab is active, THE Dashboard SHALL render a right column containing Mini Calendar, Todays Schedule, and Activity Feed sections in that order
4. WHEN the viewport width is 900px or less, THE Dashboard SHALL collapse the two columns into a single stacked column
5. WHEN a task in the High Priority section has a category, THE Dashboard SHALL display a Category Tag chip with the appropriate warm color (orange for Compliance, yellow for general, green for Students)
6. WHEN a task appears in the Blocked Tasks section, THE Dashboard SHALL display the block reason text in red and a Stale Badge showing days since last update
7. WHEN a task in the Due Today section has a scheduled time, THE Dashboard SHALL display the time next to the task title

### Requirement 2: Quick Actions Bar

**User Story:** As an administrator, I want one-click shortcuts to common workflows, so that I can initiate frequent actions without navigating through tabs.

#### Acceptance Criteria

1. THE Dashboard SHALL display four Quick Action pill buttons: "Record a Capture", "Quick Tap Capture", "See Task Calendar", and "Update Roster"
2. WHEN the user clicks "Record a Capture", THE Dashboard SHALL navigate to the Capture Tab in voice mode
3. WHEN the user clicks "Quick Tap Capture", THE Dashboard SHALL navigate to the Capture Tab in tap mode
4. WHEN the user clicks "See Task Calendar", THE Dashboard SHALL navigate to the Tasks Tab in calendar view
5. WHEN the user clicks "Update Roster", THE Dashboard SHALL navigate to the Admin Tab

### Requirement 3: Achievements Modal

**User Story:** As an administrator, I want to view my earned and locked achievements, so that I can track my gamification progress and feel motivated.

#### Acceptance Criteria

1. WHEN the user clicks the Level Badge, THE Dashboard SHALL open the Achievements Modal as a centered overlay
2. THE Achievements_Modal SHALL display earned badges with their icon, name, description, and earned date
3. THE Achievements_Modal SHALL display locked badges greyed out with their icon, name, and description
4. THE Achievements_Modal SHALL display a gold progress bar showing progress toward the next level as a fraction of total badges earned
5. WHEN the user clicks outside the modal or the close button, THE Achievements_Modal SHALL close and return focus to the Dashboard

### Requirement 4: Desktop Sidebar Navigation

**User Story:** As a user, I want a persistent sidebar on desktop that clearly shows all available tabs, so that I can navigate the application efficiently.

#### Acceptance Criteria

1. THE Sidebar SHALL display the "AdminI." brand text at the top
2. THE Sidebar SHALL display navigation items in this order: Capture, Dashboard, Tasks, Notes, Observations, Pulse, Settings, Admin
3. WHEN a navigation item is the active tab, THE Sidebar SHALL highlight that item with Sage Green background
4. WHILE the user role is not admin or principal, THE Sidebar SHALL hide the Admin and Observations navigation items
5. THE Sidebar SHALL remain fixed on the left side of the viewport on desktop screen widths

### Requirement 5: Mini Calendar Widget

**User Story:** As an administrator, I want a compact calendar in my Dashboard that highlights days with tasks, so that I can quickly see my upcoming workload distribution.

#### Acceptance Criteria

1. THE Mini_Calendar SHALL display the current month with navigation arrows to move between months
2. THE Mini_Calendar SHALL highlight today's date with a Sage Green filled circle
3. WHEN a date has one or more tasks due, THE Mini_Calendar SHALL display a small dot indicator below that date
4. WHEN the user clicks a navigation arrow, THE Mini_Calendar SHALL transition to the previous or next month

### Requirement 6: Today's Schedule Integration

**User Story:** As an administrator, I want my Dashboard schedule to reflect my Pulse day structure and calendar events, so that I have one unified view of my day.

#### Acceptance Criteria

1. THE Todays_Schedule SHALL display time blocks defined in the user's Pulse Day Structure
2. WHEN a Google Calendar event or local event falls within a time block, THE Todays_Schedule SHALL display that event inline with a checkable circle and the event time
3. THE Todays_Schedule SHALL display only events occurring on the current date
4. WHEN an event is a local event (not from Google), THE Todays_Schedule SHALL display a delete button next to that event
5. IF a future-dated event exists, THEN THE Todays_Schedule SHALL exclude that event from the displayed list

### Requirement 7: Activity Feed

**User Story:** As an administrator, I want to see a chronological feed of recent actions, so that I can stay aware of what has changed in my workspace.

#### Acceptance Criteria

1. THE Activity_Feed SHALL display up to 7 recent activity items sorted in reverse chronological order
2. THE Activity_Feed SHALL display a colored icon by activity type (checkmark for create, circle for update) and a timestamp for each item
3. WHEN no sync events exist, THE Activity_Feed SHALL fall back to displaying task-derived activity items

### Requirement 8: Tasks Page Layout

**User Story:** As an administrator, I want a Tasks page with collapsible cards and filter options, so that I can manage my task list efficiently.

#### Acceptance Criteria

1. THE Tasks_Tab SHALL display tasks as collapsible/expandable Task Cards
2. THE Tasks_Tab SHALL provide filter buttons: All, Open, In Progress, Completed, Blocked
3. WHEN a Task Card is expanded, THE Tasks_Tab SHALL display subtask checkboxes directly on the card (not only in an edit view)
4. IF a task has incomplete subtasks, THEN THE Tasks_Tab SHALL prevent the parent task checkbox from being checked
5. THE Tasks_Tab SHALL provide a "Duplicate task" option in the task action menu
6. WHEN a task card is collapsed, THE Tasks_Tab SHALL show the task title, priority indicator, due date, and completion progress

### Requirement 9: Tasks Calendar View

**User Story:** As an administrator, I want a calendar view of my tasks overlaid with Google Calendar events, so that I can see my full schedule in one place.

#### Acceptance Criteria

1. THE Calendar_View SHALL display tasks, subtasks, and Google Calendar events overlaid on a calendar grid
2. THE Calendar_View SHALL display a left legend identifying Task, Subtask, Assigned, and Priority dot indicators
3. THE Calendar_View SHALL display an overdue task list alongside the calendar
4. THE Calendar_View SHALL include an "Add Event" button positioned on the calendar (not on the schedule section)
5. WHEN the user adds an event via the calendar, THE Calendar_View SHALL create a local event at the selected date and time

### Requirement 10: Notes Tab

**User Story:** As an administrator, I want a dedicated Notes tab with meeting-type templates and rich text editing, so that I can take structured meeting notes and create tasks from them.

#### Acceptance Criteria

1. THE Notes_Tab SHALL exist as its own navigation tab (separate from Capture)
2. THE Notes_Tab SHALL provide meeting type selection from: Observation Pre/Post Conference, Staff Meeting, Teacher Meeting, Parent Meeting, Student Meeting, Disciplinary Incident
3. THE Notes_Tab SHALL display fields at the top: Meeting Type, Date, Attendees
4. THE Notes_Tab SHALL provide a rich text toolbar with: Bold, Italic, List, Task checkbox, Divider
5. THE Notes_Tab SHALL provide a "Create Task from Note" action that uses AI to scan note content and suggest task creation
6. WHEN a note is created or edited, THE Notes_Tab SHALL automatically record a timestamp

### Requirement 11: Capture Tab

**User Story:** As an administrator, I want the Capture tab to focus on voice and tap capture modes (without notes), so that I can quickly record observations and categorize them.

#### Acceptance Criteria

1. THE Capture_Tab SHALL support voice capture and tap capture modes only (no notes section)
2. THE Capture_Tab SHALL display customizable tap categories that are configurable by administrators
3. THE Capture_Tab SHALL merge location options into a single "Where" field without separate "Domain" or "Group" fields
4. WHEN the user creates a task from a capture, THE Capture_Tab SHALL open a modal with editable task fields
5. WHEN a tap capture is completed, THE Capture_Tab SHALL summarize the captured data as a natural language sentence

### Requirement 12: Pulse Day Structure and Cadence

**User Story:** As an administrator, I want to manage my daily schedule cadence through Pulse, so that my Dashboard schedule reflects my actual day structure.

#### Acceptance Criteria

1. THE Pulse_Tab SHALL allow the user to define and edit Day Structure time blocks (period name, time range, activities)
2. THE Pulse_Tab SHALL provide cadence management options without a "disabled" option (cadence is always active)
3. WHEN the user updates the Day Structure, THE Todays_Schedule on the Dashboard SHALL reflect the updated time blocks

### Requirement 13: Google Calendar Integration

**User Story:** As an administrator, I want Google Calendar events visible in all calendar-related views, so that I have a unified picture of my commitments.

#### Acceptance Criteria

1. THE Google_Integration_Service SHALL fetch and display Google Calendar events in the Dashboard Todays Schedule, the Tasks Calendar View, and the Mini Calendar dot indicators
2. WHEN a calendar view is rendered, THE Google_Integration_Service SHALL merge Google Calendar events with local events for display
3. IF the Google Calendar connection fails, THEN THE Google_Integration_Service SHALL fall back to displaying local events only without an error blocking the view

### Requirement 14: Notifications and Integrations

**User Story:** As an administrator, I want assignees notified on task changes and observation sharing via email, so that my team stays informed.

#### Acceptance Criteria

1. WHEN a task is created or updated with an assignee, THE System SHALL send a notification to the assigned user
2. WHEN the user shares an observation via Gmail, THE System SHALL prompt for the recipient email address before sending
3. THE System SHALL provide contact autocomplete from Google Contacts when entering email recipients
4. THE System SHALL integrate Google Classroom roster data in the Admin Tab

### Requirement 15: Admin Tab Functionality

**User Story:** As an administrator, I want to invite staff, manage membership accounts, manage roles and permissions, and view pending invitations, so that I can fully manage my school's team from within the application.

#### Acceptance Criteria

1. THE Admin_Tab SHALL provide a functional staff invitation form that sends email invitations via Resend
2. THE Admin_Tab SHALL display a staff roster with role management (view and change roles)
3. THE Admin_Tab SHALL display a pending invitations list that persists across page refreshes
4. THE Admin_Tab SHALL display Google Classroom roster data when the integration is active
5. THE Admin_Tab SHALL allow administrators to manage school membership accounts (add, remove, edit member profiles)
6. THE Admin_Tab SHALL allow administrators to manage permissions for each staff member (assign roles: admin, principal, teacher)
7. THE Admin_Tab SHALL allow administrators to edit the school name
8. THE Admin_Tab SHALL provide a roster upload capability to bulk-add staff members
9. THE Admin_Tab SHALL display sent invitations with their current status (pending, accepted, expired)

### Requirement 16: Design System and Visual Style

**User Story:** As a user, I want the application to have a cohesive, warm visual design matching the Figma mock, so that the interface feels polished and professional.

#### Acceptance Criteria

1. THE Design_System SHALL use Sage Green (#6B8E6B) as the primary accent color for active states, buttons, and highlights
2. THE Design_System SHALL use Limestone (#F5F3EE) as the primary background color for pages and subtle fills
3. THE Design_System SHALL use a card-based layout with subtle borders (1px solid) and rounded corners
4. THE Design_System SHALL use warm-toned Category Tags: orange for general categories, yellow for scheduling, green for student-related, red for blocked items
5. THE Design_System SHALL use system fonts with clean typography (no custom web fonts required)
6. THE Design_System SHALL apply dark mode styling only to the authentication/front porch screens, not to the main application

### Requirement 17: Toast Notifications

**User Story:** As a user, I want toast notifications that are dismissable and non-intrusive, so that I receive confirmation of actions without workflow disruption.

#### Acceptance Criteria

1. THE Toast SHALL display a visible and functional dismiss button (x) that removes the toast on click
2. THE Toast SHALL have proper pointer-events so that the dismiss button and toast content are interactive
3. WHEN an undo action is triggered, THE Toast SHALL not produce repeated or duplicate toast messages

### Requirement 18: Date Handling

**User Story:** As a user, I want dates to display correctly without timezone-related off-by-one errors, so that tasks and events appear on the intended day.

#### Acceptance Criteria

1. THE System SHALL parse all date strings as local dates (splitting on 'T' and using only the date portion) to prevent timezone offset causing a "day before" display bug
2. WHEN comparing a task due date to today, THE System SHALL use local date comparison (year, month, day) without UTC conversion
3. IF an event has a future date, THEN THE Todays_Schedule SHALL exclude that event from today's display

### Requirement 19: Observations Tab

**User Story:** As an administrator, I want a dedicated Observations tab for classroom observation workflows with AI-powered task creation for follow-up actions, so that I can efficiently document observations and assign resulting tasks.

#### Acceptance Criteria

1. THE Observations_Tab SHALL display a list of completed and in-progress classroom observations
2. THE Observations_Tab SHALL provide a "Create Task from Observation" action that uses AI to scan observation content and suggest a follow-up task (where the default task action is to send/share the observation)
3. WHEN AI generates a task from an observation, THE Observations_Tab SHALL pre-fill the task with relevant observation details and default the action to sending/sharing
4. THE Observations_Tab SHALL allow sharing observations via Gmail with a prompt for recipient email
5. WHILE the user role is not admin or principal, THE Observations_Tab SHALL be hidden from navigation
