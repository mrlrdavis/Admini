# Requirements Document

## Introduction

This feature adds a new "Notes" tab to the AdminI workspace for taking meeting notes. Users can create, edit, and delete notes associated with meetings, and the system extracts task recommendations from note content using keyword-based pattern matching. Extracted tasks can be converted into DashboardTasks with a single action. The feature integrates with the existing workspace navigation, Supabase data layer, and responsive layout system.

## Glossary

- **Notes_Tab**: The new workspace tab (`'notes'`) added to the WorkspaceTab type, providing access to the meeting notes feature
- **Meeting_Note**: A data entity representing a meeting note, containing a title, date/time, optional attendees, content body, and extracted task suggestions
- **Note_Editor**: The component that provides the editing interface for creating and modifying Meeting_Note content
- **Task_Extractor**: The module responsible for scanning Meeting_Note content and identifying potential action items using keyword-based pattern matching
- **Extracted_Task**: A task suggestion identified by the Task_Extractor that has not yet been converted to a DashboardTask
- **Notes_List**: The view showing all Meeting_Notes for the current organization with search and filter capabilities
- **Notes_Service**: The service layer responsible for CRUD operations on Meeting_Notes via the Supabase client

## Requirements

### Requirement 1: Notes Tab in Workspace Navigation

**User Story:** As a user, I want a "Notes" tab in the workspace navigation, so that I can quickly access my meeting notes alongside other workspace features.

#### Acceptance Criteria

1. THE WorkspaceTab type SHALL include `'notes'` as a valid tab identifier
2. THE workspace navigation SHALL display a "Notes" tab item with the label "Notes"
3. WHEN the user selects the Notes_Tab, THE workspace SHALL render the meeting notes view
4. THE Notes_Tab SHALL appear in the navigation between the "Tasks" and "Pulse" tabs
5. THE Notes_Tab SHALL be accessible to users with any AdminiRole (admin, principal, teacher, staff)

### Requirement 2: Meeting Note CRUD Operations

**User Story:** As a user, I want to create, view, edit, and delete meeting notes, so that I can manage my meeting documentation over time.

#### Acceptance Criteria

1. WHEN the user initiates note creation, THE Notes_Service SHALL create a new Meeting_Note with a title, the current date/time, and empty content
2. WHEN the user edits a Meeting_Note, THE Notes_Service SHALL persist the updated title, attendees, and content fields
3. WHEN the user deletes a Meeting_Note, THE Notes_Service SHALL remove the Meeting_Note record from the database
4. IF the Notes_Service fails to persist a Meeting_Note operation, THEN THE Notes_Tab SHALL display an error message describing the failure
5. THE Notes_Service SHALL associate each Meeting_Note with the current user's organization via the `organization_id` field
6. THE Notes_Service SHALL record the `created_by` user identifier on each Meeting_Note

### Requirement 3: Note Editor Interface

**User Story:** As a user, I want a rich editing experience for my meeting notes, so that I can format content and structure my notes clearly.

#### Acceptance Criteria

1. THE Note_Editor SHALL provide a text input for the Meeting_Note title
2. THE Note_Editor SHALL provide a date/time display showing when the Meeting_Note was created
3. THE Note_Editor SHALL provide an optional attendees field accepting a comma-separated list of names
4. THE Note_Editor SHALL provide a content area supporting Markdown formatting (headings, bold, italic, bullet lists, numbered lists)
5. WHEN the user modifies content in the Note_Editor, THE Note_Editor SHALL trigger a save operation after the user stops typing for 2 seconds (debounced auto-save)
6. WHILE the Note_Editor is saving, THE Note_Editor SHALL display a saving indicator to the user

### Requirement 4: Task Extraction from Notes

**User Story:** As a user, I want action items in my notes to be automatically identified, so that I can convert them to tracked tasks without manual re-entry.

#### Acceptance Criteria

1. WHEN Meeting_Note content is saved, THE Task_Extractor SHALL scan the content for task patterns
2. THE Task_Extractor SHALL identify lines matching these patterns as Extracted_Tasks: lines prefixed with "TODO:", lines prefixed with "Action:", and bullet points starting with an imperative verb
3. THE Task_Extractor SHALL display identified Extracted_Tasks in a suggestions panel adjacent to the Note_Editor
4. WHEN the user confirms an Extracted_Task, THE Notes_Service SHALL create a new DashboardTask with the extracted text as the title, `'normal'` priority, and `'open'` status
5. WHEN the user dismisses an Extracted_Task, THE Notes_Tab SHALL remove the suggestion from the suggestions panel
6. IF the Task_Extractor identifies zero patterns in the content, THEN THE suggestions panel SHALL display an empty state message

### Requirement 5: Responsive Layout

**User Story:** As a user, I want the notes interface to adapt to my screen size, so that I can take meeting notes effectively on both desktop and mobile devices.

#### Acceptance Criteria

1. WHEN the viewport width exceeds 768px, THE Notes_Tab SHALL render a split-pane layout with the Notes_List on the left and the Note_Editor on the right
2. WHEN the viewport width is at or below 768px, THE Notes_Tab SHALL render a full-screen Note_Editor when a note is selected
3. WHEN on mobile layout with a note open, THE Notes_Tab SHALL provide a back navigation control to return to the Notes_List
4. WHEN the viewport is resized across the 768px breakpoint, THE Notes_Tab SHALL transition between split-pane and full-screen layouts without losing unsaved content

### Requirement 6: Data Persistence

**User Story:** As a user, I want my meeting notes stored securely in the cloud, so that I can access them from any device and my data is not lost.

#### Acceptance Criteria

1. THE Notes_Service SHALL store Meeting_Notes in a Supabase `meeting_notes` table with columns: `id` (UUID primary key), `organization_id`, `created_by`, `title`, `attendees` (text array), `content` (text), `extracted_tasks` (JSONB), `created_at` (timestamptz), and `updated_at` (timestamptz)
2. THE Notes_Service SHALL enforce Row Level Security so that users can only access Meeting_Notes belonging to their organization
3. WHEN a Meeting_Note is updated, THE Notes_Service SHALL set the `updated_at` field to the current timestamp
4. THE Notes_Service SHALL order Meeting_Notes by `created_at` descending when fetching the notes list

### Requirement 7: Search and Filtering

**User Story:** As a user, I want to search and filter my meeting notes, so that I can quickly find notes from past meetings.

#### Acceptance Criteria

1. THE Notes_List SHALL provide a search input that filters Meeting_Notes by title and content
2. WHEN the user enters a search query, THE Notes_List SHALL display only Meeting_Notes where the title or content contains the query text (case-insensitive)
3. WHEN the search query is cleared, THE Notes_List SHALL display all Meeting_Notes in the default order
4. THE Notes_List SHALL display the Meeting_Note title, creation date, and a content preview (first 100 characters) for each item
5. IF no Meeting_Notes match the search query, THEN THE Notes_List SHALL display a "No notes found" empty state message

### Requirement 8: Accessibility

**User Story:** As a user who relies on assistive technology, I want the meeting notes interface to be fully accessible, so that I can create and manage notes using a screen reader or keyboard navigation.

#### Acceptance Criteria

1. THE Notes_Tab SHALL support full keyboard navigation including focus management between the Notes_List and Note_Editor
2. THE Note_Editor content area SHALL have an accessible label describing its purpose (e.g., `aria-label="Meeting note content"`)
3. THE Extracted_Task suggestions SHALL be announced to screen readers when they appear using an ARIA live region
4. WHEN the user confirms or dismisses an Extracted_Task, THE Notes_Tab SHALL announce the result to screen readers
5. THE Notes_List items SHALL be navigable via arrow keys and selectable via Enter or Space
6. THE saving indicator SHALL use `aria-live="polite"` to announce save status changes to screen readers