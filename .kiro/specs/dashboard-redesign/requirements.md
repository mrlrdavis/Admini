# Requirements Document

## Introduction

This specification covers a comprehensive redesign of the Dashboard UI to match updated Figma mockups. The redesign involves typography and icon sizing adjustments, interactive hover effects, widget border styling, layout restructuring (Quick Actions repositioning, side-by-side widgets, fixed-height columns), new UI elements (trophy/badge progress icon, expand buttons on task widgets), filter system improvements on the Tasks page, and minor icon changes in the navigation bar.

## Glossary

- **Dashboard**: The main overview screen rendered by `DashboardTab.tsx`, displaying task widgets, calendar, schedule, and activity feed.
- **Task_Widget**: A card-style section on the Dashboard that displays a filtered list of tasks (High Priority, Due Today, Coming Due, Blocked, or Suggested).
- **Section_Header**: The colored band at the top of each Task_Widget containing an icon, title, and count badge.
- **Top_Bar**: The horizontal bar at the top of the Dashboard containing the greeting, level badge, and trophy icon.
- **Quick_Actions_Widget**: A widget displaying shortcut buttons for common actions (Add Task, Capture, Schedule, etc.), each with an icon and shorthand title.
- **Calendar_Widget**: The mini-calendar card displayed on the right column of the Dashboard.
- **Schedule_Widget**: The "Today's Schedule" card showing time-blocked events for the current day.
- **Activity_Feed_Widget**: The card displaying recent activity events (task completions, captures, notes, etc.).
- **Trophy_Icon**: A trophy/badge progress indicator displayed in the Top_Bar that shows progress toward earning badges.
- **Expand_Button**: A button in the upper-right corner of a Task_Widget that navigates to the Tasks page with the corresponding filter applied.
- **Tasks_Page**: The full-page task list view accessible from the navigation sidebar, supporting filter and sort operations.
- **Filter_Group**: A labeled cluster of filter options on the Tasks_Page, organizing filters by category.
- **Navigation_Bar**: The sidebar (desktop) or tab bar (mobile) rendered by `NavigationRenderer.tsx` containing application tabs.
- **Pulse_Tab**: The "Pulse" navigation tab used for viewing team pulse/activity data.

## Requirements

### Requirement 1: Section Header Typography and Icon Sizing

**User Story:** As a user, I want section headers to be legible and visually balanced, so that I can quickly identify each widget's purpose.

#### Acceptance Criteria

1. THE Dashboard SHALL render Section_Header title text at a font size larger than 0.5625rem (minimum 0.75rem).
2. THE Dashboard SHALL render Section_Header icons at a size that matches other widget icons used throughout the application (minimum 0.75rem).
3. THE Section_Header SHALL maintain uppercase letter-spacing styling after the font size increase.

### Requirement 2: Task Item Hover Effect

**User Story:** As a user, I want visual feedback when hovering over task items, so that I can clearly see which item I am about to interact with.

#### Acceptance Criteria

1. WHEN a user hovers over a task item in the High Priority Task_Widget, THE Dashboard SHALL change the task item background color to #FFF3E0.
2. WHEN a user hovers over a task item in the Due Today Task_Widget, THE Dashboard SHALL change the task item background color to #EAF3EA.
3. WHEN a user hovers over a task item in the Coming Due Task_Widget, THE Dashboard SHALL change the task item background color to #FFF0E6.
4. WHEN a user hovers over a task item in the Blocked Task_Widget, THE Dashboard SHALL change the task item background color to #FCE8E8.
5. WHEN a user hovers over a task item in the Suggested Task_Widget, THE Dashboard SHALL change the task item background color to #F2ECFB.
6. WHEN the user moves the cursor away from the task item, THE Dashboard SHALL revert the background color to the default (transparent/white).

### Requirement 3: Widget Outline Borders

**User Story:** As a user, I want each widget to have a colored outline matching its theme, so that widgets are visually distinct and easy to differentiate.

#### Acceptance Criteria

1. THE Dashboard SHALL render the High Priority Task_Widget with a border color of #C0392B (red).
2. THE Dashboard SHALL render the Due Today Task_Widget with a border color of #4A6B4A (green).
3. THE Dashboard SHALL render the Coming Due Task_Widget with a border color of #D35400 (orange).
4. THE Dashboard SHALL render the Blocked Task_Widget with a border color of #C0392B (red).
5. THE Dashboard SHALL render the Suggested Task_Widget with a border color of #7D3C98 (purple).
6. THE Dashboard SHALL apply a border-radius of 12px to each Task_Widget outline.

### Requirement 4: Trophy/Badge Progress Icon

**User Story:** As a user, I want to see my badge progress at a glance in the top bar, so that I can track my achievements without opening the full badges panel.

#### Acceptance Criteria

1. THE Dashboard Top_Bar SHALL display a Trophy_Icon element showing a trophy/badge visual indicator.
2. WHEN the user has earned badges, THE Trophy_Icon SHALL display a progress indicator reflecting the ratio of earned badges to total available badges.
3. WHEN the user clicks the Trophy_Icon, THE Dashboard SHALL open the Achievements/Badges modal panel.
4. THE Trophy_Icon SHALL be positioned in the Top_Bar area, visually aligned with the existing level badge element.

### Requirement 5: Quick Actions Repositioned as Widget

**User Story:** As a user, I want Quick Actions displayed as a dedicated widget alongside the calendar, so that common actions are accessible without occupying top bar space.

#### Acceptance Criteria

1. THE Dashboard SHALL render the Quick_Actions_Widget in the right column, adjacent to the Calendar_Widget.
2. THE Quick_Actions_Widget SHALL NOT appear in the Top_Bar area.
3. THE Quick_Actions_Widget SHALL display each action with a prominent icon and a shorthand title label.
4. THE Quick_Actions_Widget SHALL maintain the same set of action buttons currently available (Add Task, Capture, Schedule, and other existing actions).
5. WHEN a user clicks a quick action button, THE Quick_Actions_Widget SHALL trigger the same action as the previous top-bar implementation.

### Requirement 6: Today's Schedule and Activity Feed Side-by-Side Layout

**User Story:** As a user, I want the Schedule and Activity Feed displayed horizontally next to each other, so that I can see both at once without scrolling.

#### Acceptance Criteria

1. THE Dashboard SHALL render the Schedule_Widget and Activity_Feed_Widget in a horizontal (side-by-side) layout.
2. THE side-by-side layout SHALL replace the previous stacked (vertical) arrangement of these two widgets.
3. WHILE the viewport width is at or below 900px, THE Dashboard SHALL revert the Schedule_Widget and Activity_Feed_Widget to a stacked vertical layout.

### Requirement 7: Fixed Height Widgets with Internal Scroll

**User Story:** As a user, I want all widgets to align at the bottom of the visible area with scrollable content, so that the dashboard looks clean and I can access overflow content within each widget.

#### Acceptance Criteria

1. THE Dashboard SHALL render left-column and right-column widgets so that their bottom edges align visually.
2. WHEN a Task_Widget contains more items than fit within the fixed height, THE Task_Widget SHALL display a vertical scrollbar within its content area.
3. WHEN the Schedule_Widget content exceeds the fixed height, THE Schedule_Widget SHALL display a vertical scrollbar within its content area.
4. WHEN the Activity_Feed_Widget content exceeds the fixed height, THE Activity_Feed_Widget SHALL display a vertical scrollbar within its content area.
5. THE Dashboard column containers SHALL NOT scroll as a whole; only individual widget content areas SHALL scroll.

### Requirement 8: Expand Button on Task Widgets

**User Story:** As a user, I want an expand button on each task widget, so that I can quickly navigate to the Tasks page with the relevant filter pre-applied.

#### Acceptance Criteria

1. THE Dashboard SHALL display an Expand_Button in the upper-right corner of the Section_Header for each of the following Task_Widgets: High Priority, Due Today, Coming Due, and Blocked.
2. WHEN a user clicks the Expand_Button on the High Priority Task_Widget, THE Dashboard SHALL navigate to the Tasks_Page with the "High" priority filter applied.
3. WHEN a user clicks the Expand_Button on the Due Today Task_Widget, THE Dashboard SHALL navigate to the Tasks_Page with the "Due" filter applied.
4. WHEN a user clicks the Expand_Button on the Coming Due Task_Widget, THE Dashboard SHALL navigate to the Tasks_Page with the "Coming Due" filter applied.
5. WHEN a user clicks the Expand_Button on the Blocked Task_Widget, THE Dashboard SHALL navigate to the Tasks_Page with the "Blocked" filter applied.
6. THE Expand_Button SHALL NOT appear on the Suggested Task_Widget.

### Requirement 9: Tasks Page Filter System Reorganization

**User Story:** As a user, I want the Tasks page filters organized into logical groups, so that I can find and apply filters quickly without visual clutter.

#### Acceptance Criteria

1. THE Tasks_Page SHALL organize filters into two Filter_Groups: "Progress" and "Type".
2. THE Progress Filter_Group SHALL contain the following filters: In Progress, Completed, Blocked, Due, Coming Due.
3. THE Type Filter_Group SHALL contain the following filters: High, Normal, Low.
4. THE Tasks_Page SHALL support the new "Due" filter that displays tasks due today.
5. THE Tasks_Page SHALL support the new "Coming Due" filter that displays tasks approaching their due date.
6. THE Tasks_Page filter labels SHALL use concise single-word or two-word names (no verbose descriptions).

### Requirement 10: Suggested Tasks Dashboard Exclusivity

**User Story:** As a user, I want Suggested Tasks to appear only on the dashboard, so that the Tasks page remains focused on my actual task list.

#### Acceptance Criteria

1. THE Dashboard SHALL display the Suggested Task_Widget with AI-generated task recommendations.
2. THE Tasks_Page SHALL NOT display suggested tasks or a "Suggested" filter option.
3. THE Suggested Task_Widget SHALL only be accessible from the Dashboard view.

### Requirement 11: Pulse Tab Icon Change

**User Story:** As a user, I want the Pulse tab to use a heart icon, so that the icon better represents the "Pulse" concept visually.

#### Acceptance Criteria

1. THE Navigation_Bar SHALL display a heart icon (❤️) for the Pulse_Tab entry.
2. THE heart icon SHALL replace the current Pulse_Tab icon (💓) in both the desktop sidebar and mobile tab bar.
