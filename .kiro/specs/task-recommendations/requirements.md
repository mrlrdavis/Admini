# Requirements Document

## Introduction

The Task Recommendations feature provides intelligent task suggestions to AdminI users based on their contextual data (captured notes, meeting notes, calendar events, and pulse observations). The feature uses a rule-based engine to identify action-oriented content and propose tasks that users can accept or dismiss. It is surfaced as a widget on the Dashboard tab and controlled via a toggle in App Preferences.

## Glossary

- **Recommendation_Engine**: The service that orchestrates recommendation generation by delegating to a provider, deduplicating against existing tasks, and managing recommendation lifecycle
- **Rule_Based_Provider**: The initial recommendation provider that uses pattern matching on captured content to identify action-oriented phrases and generate task suggestions
- **Recommendations_Widget**: The Dashboard UI component that displays recommendation cards with accept and dismiss actions
- **Recommendation**: A suggested task generated from user context, containing a title, source reference, confidence score, and suggested priority
- **App_Preferences**: The settings storage layer that persists user preferences including the task recommendations toggle
- **Capture**: A text note recorded by the user via voice, tap, or typed input
- **Meeting_Note**: A structured note associated with a meeting event
- **Handled_Recommendation**: A recommendation that has been either accepted (converted to a task) or dismissed by the user

## Requirements

### Requirement 1: Generate Task Recommendations from Context

**User Story:** As a user, I want the system to analyze my captured notes and meeting notes to suggest tasks, so that I do not miss important action items.

#### Acceptance Criteria

1. WHEN the user opens the Dashboard tab, THE Recommendation_Engine SHALL generate recommendations by scanning recent captures and meeting notes for action-oriented language
2. THE Rule_Based_Provider SHALL match phrases including "need to", "should", "follow up", "reminder", "action item", "todo", and "dont forget" to identify potential tasks
3. WHEN a match is found, THE Rule_Based_Provider SHALL extract a task title from the surrounding sentence context
4. THE Rule_Based_Provider SHALL assign a confidence score between 0.0 and 1.0 to each recommendation based on pattern match strength
5. THE Recommendation_Engine SHALL limit results to a maximum of 5 recommendations per generation cycle
6. THE Recommendation_Engine SHALL only process the 50 most recent captures and 20 most recent meeting notes

### Requirement 2: Deduplicate Recommendations Against Existing Tasks

**User Story:** As a user, I want recommendations to exclude tasks I already have, so that I see only genuinely new suggestions.

#### Acceptance Criteria

1. WHEN generating recommendations, THE Recommendation_Engine SHALL compare each candidate title against existing task titles in the organization
2. IF a recommendation title closely matches an existing task title, THEN THE Recommendation_Engine SHALL exclude it from the results
3. WHEN a recommendation has been previously dismissed, THE Recommendation_Engine SHALL exclude it from results for a 7-day cooldown period

### Requirement 3: Display Recommendations on Dashboard

**User Story:** As a user, I want to see task recommendations on my Dashboard, so that I can quickly review and act on suggestions.

#### Acceptance Criteria

1. WHILE the task recommendations preference is enabled, THE Recommendations_Widget SHALL display on the Dashboard tab below the KPI cards section
2. THE Recommendations_Widget SHALL render each recommendation as a card showing the title, source excerpt, source type indicator, and confidence level
3. WHEN no recommendations are available, THE Recommendations_Widget SHALL display an empty state message: "Start capturing notes to get task suggestions"
4. WHILE the task recommendations preference is disabled, THE Recommendations_Widget SHALL not render on the Dashboard

### Requirement 4: Accept a Recommendation

**User Story:** As a user, I want to accept a recommendation to create a real task from it, so that I can quickly convert suggestions into actionable items.

#### Acceptance Criteria

1. WHEN the user clicks the accept button on a recommendation card, THE Recommendations_Widget SHALL create a new task with the recommendation title and suggested priority
2. WHEN a task is successfully created from a recommendation, THE Recommendation_Engine SHALL mark the recommendation as handled with action "accepted"
3. WHEN a task is successfully created, THE Recommendations_Widget SHALL remove the card from the display
4. IF task creation fails, THEN THE Recommendations_Widget SHALL display an error message and keep the recommendation card visible

### Requirement 5: Dismiss a Recommendation

**User Story:** As a user, I want to dismiss irrelevant recommendations, so that I only see useful suggestions.

#### Acceptance Criteria

1. WHEN the user clicks the dismiss button on a recommendation card, THE Recommendation_Engine SHALL mark the recommendation as handled with action "dismissed"
2. WHEN a recommendation is dismissed, THE Recommendations_Widget SHALL remove the card from the display
3. WHEN a recommendation is dismissed, THE Recommendation_Engine SHALL record the dismissal timestamp for cooldown tracking

### Requirement 6: Toggle Recommendations via Settings

**User Story:** As a user, I want to enable or disable task recommendations in my preferences, so that I can control whether suggestions appear on my Dashboard.

#### Acceptance Criteria

1. THE App_Preferences SHALL include a "Task Recommendations" toggle switch in the preferences screen
2. THE App_Preferences SHALL default the task recommendations toggle to enabled for new users
3. WHEN the user toggles task recommendations off, THE App_Preferences SHALL persist the preference and THE Recommendations_Widget SHALL immediately stop rendering
4. WHEN the user toggles task recommendations on, THE App_Preferences SHALL persist the preference and THE Recommendations_Widget SHALL render on the next Dashboard visit

### Requirement 7: Provider Abstraction for Future AI Integration

**User Story:** As a developer, I want the recommendation system to use a provider interface, so that the rule-based engine can be replaced with an AI-powered provider in the future.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL accept any provider implementing the RecommendationProvider interface
2. THE RecommendationProvider interface SHALL define a single method: generateRecommendations that accepts a RecommendationContext and returns a list of Recommendations
3. WHEN a new provider is registered, THE Recommendation_Engine SHALL use it without requiring changes to the UI or storage layers

### Requirement 8: Handle Engine Errors Gracefully

**User Story:** As a user, I want the Dashboard to remain functional even when recommendations fail to load, so that my workflow is not disrupted.

#### Acceptance Criteria

1. IF the Recommendation_Engine fails to fetch context data, THEN THE Recommendations_Widget SHALL display a non-intrusive error message with a retry option
2. IF the Rule_Based_Provider exceeds a 5-second processing timeout, THEN THE Recommendation_Engine SHALL cancel the request and return cached results or an empty list
3. IF an error occurs during recommendation generation, THEN THE Dashboard SHALL continue to function normally with all other sections visible