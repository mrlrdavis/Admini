# Requirements Document

## Introduction

This feature migrates the Admini mobile workspace from a full-screen iframe-based prototype to native React components, following an incremental tab-by-tab approach. The Dashboard tab is the first to be converted. Unconverted tabs continue to render inside an iframe fallback. A new Admin-only Organization Management tab is introduced. Reusable UI primitives are extracted into the `@admini/ui` package while app-specific workspace views remain in apps/mobile/src.

## Glossary

- **Workspace_Shell**: The top-level native React container that replaces the current full-screen iframe layout, providing the application frame, tab bar, and content area.
- **Tab_Bar**: A persistent bottom navigation component rendered natively in React that allows the user to switch between workspace tabs.
- **Dashboard_Tab**: The native React implementation of the Dashboard view containing a greeting, KPI cards, priority task queue, activity feed, and pulse countdown.
- **Admin_Tab**: An Organization Management tab visible only to users with the Admin role, providing school details editing, user invitations, role management, and app permission toggles.
- **Iframe_Fallback**: A mechanism that renders unconverted prototype tabs inside an embedded iframe pointing to the existing Mobile_index.html prototype.
- **Active_Tab**: The currently selected tab in the workspace, tracked via component state.
- **User_Role**: One of the six roles assigned during onboarding: School leader, Operations leader, Instructional coach, Campus support, District staff, or Admin.
- **KPI_Card**: A visual component displaying a single key performance indicator with a label and value.
- **Priority_Queue**: A ranked list of the user's most urgent open tasks displayed on the Dashboard.
- **Activity_Feed**: A chronological list of recent events relevant to the user's workspace.
- **Pulse_Countdown**: A timer or progress indicator showing time remaining until the next scheduled pulse check-in.
- **Organization_Management**: The set of administrative functions for editing school details, inviting users, changing roles, and managing app permissions.
- **Supabase**: The backend-as-a-service platform used for authentication, database, and real-time data.

## Requirements

### Requirement 1: Workspace Shell Architecture

**User Story:** As a school administrator, I want the workspace to load as a native React application shell, so that I experience faster interactions and a consistent UI without full-page iframe rendering.

#### Acceptance Criteria

1. WHEN the authenticated user completes onboarding, THE Workspace_Shell SHALL render a native React layout containing the Tab_Bar and a content area.
2. THE Workspace_Shell SHALL replace the current full-screen iframe rendering of the prototype for all converted tabs.
3. THE Workspace_Shell SHALL maintain the existing postMessage bridge for communication with the Iframe_Fallback content.
4. THE Workspace_Shell SHALL occupy the full viewport height and width without scrollbars on the shell itself.

### Requirement 2: Tab Bar Navigation

**User Story:** As a school administrator, I want a native bottom tab bar, so that I can switch between workspace sections without page reloads or iframe navigation delays.

#### Acceptance Criteria

1. THE Tab_Bar SHALL render at the bottom of the viewport as a fixed-position navigation element.
2. THE Tab_Bar SHALL display tab items for: Capture, Dashboard, Tasks, Pulse, and More.
3. WHEN the user has the Admin role, THE Tab_Bar SHALL display an additional Organization Management tab item.
4. WHEN the user taps a tab item, THE Workspace_Shell SHALL update the Active_Tab state and render the corresponding content view.
5. THE Tab_Bar SHALL visually indicate the Active_Tab with a distinct selected style.
6. THE Tab_Bar SHALL manage navigation state via in-component React state without a router library.

### Requirement 3: Dashboard Tab Native Implementation

**User Story:** As a school administrator, I want the Dashboard tab to render natively in React, so that I see my KPIs, priority tasks, and activity feed with minimal load time and smooth interactions.

#### Acceptance Criteria

1. WHEN the Active_Tab is Dashboard, THE Dashboard_Tab SHALL render a time-based greeting using the authenticated user's display name.
2. WHEN the Active_Tab is Dashboard, THE Dashboard_Tab SHALL display KPI_Card components showing relevant performance metrics.
3. WHEN the Active_Tab is Dashboard, THE Dashboard_Tab SHALL display a Priority_Queue listing the user's open tasks sorted by urgency.
4. WHEN the Active_Tab is Dashboard, THE Dashboard_Tab SHALL display an Activity_Feed showing recent workspace events in reverse chronological order.
5. WHEN the Active_Tab is Dashboard, THE Dashboard_Tab SHALL display a Pulse_Countdown indicating time until the next scheduled check-in.
6. THE Dashboard_Tab SHALL fetch task data from the existing Supabase task API used by the postMessage bridge.
7. IF the Dashboard_Tab fails to load data from Supabase, THEN THE Dashboard_Tab SHALL display an inline error message and a retry action.

### Requirement 4: Hybrid Iframe Fallback for Unconverted Tabs

**User Story:** As a school administrator, I want unconverted tabs to continue working through the existing prototype, so that I retain full functionality during the incremental migration.

#### Acceptance Criteria

1. WHEN the Active_Tab corresponds to an unconverted tab (Capture, Tasks, Pulse, or More), THE Workspace_Shell SHALL render the Iframe_Fallback displaying Mobile_index.html.
2. THE Iframe_Fallback SHALL pass the user data payload to the iframe via postMessage on load.
3. THE Iframe_Fallback SHALL listen for postMessage events from the iframe and dispatch sign-out, task CRUD, and user-data sync actions to the native React shell.
4. WHEN switching from an unconverted tab to a native tab, THE Workspace_Shell SHALL hide the Iframe_Fallback without destroying the iframe element to preserve its internal state.
5. WHEN switching back to an unconverted tab, THE Workspace_Shell SHALL show the previously hidden Iframe_Fallback and resend the current user data payload.

### Requirement 5: Role-Based Tab Visibility

**User Story:** As a platform owner, I want the Admin Organization Management tab to be visible only to Admin-role users, so that sensitive management functions are restricted to authorized personnel.

#### Acceptance Criteria

1. WHEN the authenticated user's role is Admin, THE Tab_Bar SHALL include the Admin_Tab item in the navigation.
2. WHEN the authenticated user's role is not Admin, THE Tab_Bar SHALL exclude the Admin_Tab item from the navigation.
3. IF a non-Admin user attempts to access the Admin_Tab content directly (via state manipulation), THEN THE Workspace_Shell SHALL redirect the Active_Tab to Dashboard and not render Admin_Tab content.

### Requirement 6: Admin Organization Management Tab

**User Story:** As an Admin user, I want an Organization Management tab, so that I can manage school details, invite users, change roles, and control app permissions from within the workspace.

#### Acceptance Criteria

1. WHEN the Active_Tab is Admin_Tab and the user role is Admin, THE Admin_Tab SHALL display an editable view of school details including school name, address, and contact information.
2. WHEN the Admin user submits updated school details, THE Admin_Tab SHALL persist changes to Supabase and display a success confirmation.
3. IF the school details update fails, THEN THE Admin_Tab SHALL display an error message with the failure reason and retain the edited form state.
4. THE Admin_Tab SHALL provide an invite form that accepts an email address and a target role for the new user.
5. WHEN the Admin user submits a user invitation, THE Admin_Tab SHALL send the invitation via Supabase and display the pending invitation in a list.
6. THE Admin_Tab SHALL display a list of current organization members with their assigned roles.
7. WHEN the Admin user changes a member's role, THE Admin_Tab SHALL update the role in Supabase and reflect the change in the member list.
8. THE Admin_Tab SHALL display a list of app permission toggles controlling feature access for the organization.
9. WHEN the Admin user toggles an app permission, THE Admin_Tab SHALL persist the change to Supabase and reflect the updated state.

### Requirement 7: Shared UI Component Library Expansion

**User Story:** As a developer, I want reusable UI primitives in @admini/ui, so that workspace views share consistent styling and behavior without code duplication.

#### Acceptance Criteria

1. THE @admini/ui package SHALL export a Tab_Bar component that accepts tab configuration and an active tab identifier.
2. THE @admini/ui package SHALL export a LayoutShell component that renders a full-viewport container with a content slot and a fixed bottom Tab_Bar slot.
3. THE @admini/ui package SHALL export a KPI_Card component that accepts a label, value, and optional trend indicator.
4. THE @admini/ui package SHALL export components using TypeScript with explicit prop type definitions.
5. THE @admini/ui package SHALL maintain React 18 as a peer dependency without introducing additional runtime dependencies.

### Requirement 8: Data Flow and Supabase Integration for Organization Management

**User Story:** As an Admin user, I want organization management actions to persist reliably to the backend, so that changes to school details, user roles, and permissions are durable and consistent.

#### Acceptance Criteria

1. THE Admin_Tab SHALL read and write school details using Supabase database queries against an organizations table.
2. THE Admin_Tab SHALL read and write user invitations using Supabase database queries against an invitations table.
3. THE Admin_Tab SHALL read and write member roles using Supabase database queries against a members table.
4. THE Admin_Tab SHALL read and write app permissions using Supabase database queries against a permissions table.
5. WHILE a Supabase write operation is in progress, THE Admin_Tab SHALL display a loading indicator and disable the submit action to prevent duplicate submissions.
6. IF a Supabase query returns an authorization error, THEN THE Admin_Tab SHALL display a message indicating insufficient permissions and not retry automatically.
