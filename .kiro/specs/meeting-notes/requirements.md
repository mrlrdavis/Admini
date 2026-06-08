# Requirements Document

## Introduction

This document defines the requirements for the Meeting Notes feature in AdminI. The feature enables users to create, manage, and search meeting notes within their organization's workspace. Notes are persisted in Supabase with row-level security, and the feature scaffolds interfaces for future AI-powered summaries and task extraction.

## Glossary

- **Notes_Tab**: The workspace tab component that hosts all meeting notes functionality
- **Notes_List**: The component that displays a searchable, paginated list of meeting notes
- **Note_Editor**: The component for creating and editing individual meeting notes
- **Notes_Service**: The service layer responsible for CRUD operations on meeting notes via Supabase
- **Meeting_Note**: A persisted record containing title, body, attendees, and metadata
- **WorkspaceShell**: The existing workspace shell component that manages tab navigation
- **Organization**: The tenant entity that scopes all data access via RLS policies

## Requirements

### Requirement 1: Tab Registration

**User Story:** As a user, I want to see a "Notes" tab in the workspace navigation, so that I can access my meeting notes from the main interface.

#### Acceptance Criteria

1. THE WorkspaceShell SHALL include a "Notes" tab in the visible tab list for all authenticated users
2. WHEN a user clicks the Notes tab, THE Notes_Tab SHALL render in the workspace content area
3. THE Notes_Tab SHALL be registered as a native tab in the WorkspaceShell NATIVE_TABS set

### Requirement 2: Notes Listing

**User Story:** As a user, I want to see a list of my organization's meeting notes, so that I can find and access existing notes.

#### Acceptance Criteria

1. WHEN the Notes_Tab is active and in list mode, THE Notes_List SHALL display meeting notes belonging to the user's organization
2. THE Notes_List SHALL display each note's title, creation date, and attendee count
3. THE Notes_List SHALL order notes by creation date descending (newest first)
4. WHEN more notes exist than the page size, THE Notes_List SHALL support pagination with limit and offset

### Requirement 3: Note Creation

**User Story:** As a user, I want to create new meeting notes, so that I can capture information from meetings.

#### Acceptance Criteria

1. WHEN a user clicks the "New Note" button, THE Notes_Tab SHALL display the Note_Editor in create mode
2. THE Note_Editor SHALL provide input fields for title, body, and attendees
3. WHEN a user submits a valid note, THE Notes_Service SHALL persist the note to Supabase with the user's organization ID and user ID
4. WHEN a note is successfully created, THE Notes_Tab SHALL navigate back to the list view and display the new note

### Requirement 4: Note Editing

**User Story:** As a user, I want to edit my existing meeting notes, so that I can update or correct information after a meeting.

#### Acceptance Criteria

1. WHEN a user selects a note from the list, THE Notes_Tab SHALL display the Note_Editor in edit mode with the note's data pre-populated
2. WHEN a user submits changes to a note, THE Notes_Service SHALL update the note in Supabase and set the updated_at timestamp
3. WHEN a note is successfully updated, THE Notes_Tab SHALL navigate back to the list view

### Requirement 5: Note Deletion

**User Story:** As a user, I want to delete meeting notes I no longer need, so that I can keep my notes organized.

#### Acceptance Criteria

1. WHEN a user initiates deletion of a note, THE Notes_List SHALL display a confirmation prompt before proceeding
2. WHEN deletion is confirmed, THE Notes_Service SHALL remove the note from Supabase
3. WHEN a note is successfully deleted, THE Notes_List SHALL remove the note from the displayed list without requiring a full page reload

### Requirement 6: Search and Filter

**User Story:** As a user, I want to search my meeting notes by title, so that I can quickly find specific notes.

#### Acceptance Criteria

1. THE Notes_List SHALL provide a search input field
2. WHEN a user types a search query, THE Notes_List SHALL debounce the input for 300 milliseconds before executing the search
3. WHEN a search query is provided, THE Notes_Service SHALL filter notes whose title contains the query text (case-insensitive)
4. WHEN the search input is cleared, THE Notes_List SHALL display the full unfiltered list

### Requirement 7: Input Validation

**User Story:** As a user, I want clear feedback when my input is invalid, so that I can correct errors before saving.

#### Acceptance Criteria

1. WHEN a user attempts to save a note with an empty or whitespace-only title, THE Note_Editor SHALL display a validation error and prevent submission
2. WHEN a user attempts to save a note with a title exceeding 200 characters, THE Note_Editor SHALL display a validation error and prevent submission
3. THE Note_Editor SHALL allow saving a note with an empty body (draft state)
4. THE Note_Editor SHALL allow saving a note with no attendees

### Requirement 8: Data Persistence and Security

**User Story:** As an organization administrator, I want meeting notes to be securely persisted and scoped to my organization, so that data is protected.

#### Acceptance Criteria

1. THE Notes_Service SHALL persist all meeting notes in the Supabase meeting_notes table
2. THE meeting_notes table SHALL enforce row-level security so users can only view notes belonging to their organization
3. THE meeting_notes table SHALL enforce that users can only update or delete notes they created
4. THE meeting_notes table SHALL enforce that the created_by field matches the authenticated user on insert

### Requirement 9: Error Handling

**User Story:** As a user, I want clear error messages when operations fail, so that I know what went wrong and how to recover.

#### Acceptance Criteria

1. IF a network error occurs during a save operation, THEN THE Note_Editor SHALL display an error message and preserve the form state
2. IF a permission error occurs during an operation, THEN THE Notes_Tab SHALL display a "Permission denied" message and navigate to the list view
3. IF a note fails to load in edit mode, THEN THE Note_Editor SHALL display an error message with an option to return to the list

### Requirement 10: AI Hook Scaffolding (Future-State)

**User Story:** As a developer, I want scaffolded interfaces for AI-powered features, so that smart summaries and task extraction can be implemented in the future.

#### Acceptance Criteria

1. THE system SHALL export a NoteSummaryHook interface that accepts note body text and returns a generated summary
2. THE system SHALL export a NoteTaskExtractionHook interface that accepts note body text and returns suggested tasks
3. THE NoteSummaryHook and NoteTaskExtractionHook interfaces SHALL include an isAvailable flag to indicate feature readiness

### Requirement 11: Rich Text Body

**User Story:** As a user, I want to format my meeting notes with rich text, so that I can organize content clearly.

#### Acceptance Criteria

1. THE Note_Editor SHALL provide a text area for the note body that supports multi-line input
2. WHEN displaying note body content, THE system SHALL sanitize HTML content to prevent cross-site scripting attacks
