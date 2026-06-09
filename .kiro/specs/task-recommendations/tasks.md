# Implementation Plan: Task Recommendations

## Overview

Implement a rule-based task recommendation engine that analyzes user context (captures, meeting notes) and surfaces suggestions on the Dashboard. The feature includes a provider-abstracted engine, a Dashboard widget with accept/dismiss actions, and a Settings toggle. Implementation uses TypeScript, React, and integrates with the existing `@admini/workspace` and `@admini/shared` packages.

## Tasks

- [x] 1. Define recommendation types and provider interface
  - [x] 1.1 Create recommendation types in packages/shared
    - Add `Recommendation`, `RecommendationSource`, `RecommendationContext`, `HandledRecommendation` types to `packages/shared/src/index.ts`
    - Add `RecommendationProvider` interface with `generateRecommendations` method
    - Export all new types from the shared package
    - _Requirements: 1.4, 7.2_
  - [x] 1.2 Extend AppPreferencesData with taskRecommendationsEnabled field
    - Add `taskRecommendationsEnabled: boolean` to `AppPreferencesData` interface in `packages/workspace/src/services/appPreferencesStorage.ts`
    - Update `DEFAULT_PREFERENCES` to set `taskRecommendationsEnabled: true`
    - Update the `AppPreferencesData` interface in `packages/workspace/src/components/AppPreferences.tsx`
    - _Requirements: 6.2_

- [x] 2. Implement the RuleBasedProvider
  - [x] 2.1 Create RuleBasedProvider service
    - Create `packages/workspace/src/services/ruleBasedProvider.ts`
    - Implement pattern matching for action phrases: "need to", "should", "follow up", "reminder", "action item", "todo", "dont forget"
    - Implement title extraction from surrounding sentence context
    - Implement confidence scoring based on pattern match strength
    - Respect the `maxResults` cap from context
    - _Requirements: 1.2, 1.3, 1.4_
  - [ ]* 2.2 Write property tests for RuleBasedProvider pattern matching
    - **Property 1: Pattern Matching Correctness**
    - **Validates: Requirements 1.2**
  - [ ]* 2.3 Write property tests for recommendation output validity
    - **Property 2: Recommendation Output Validity**
    - **Validates: Requirements 1.3, 1.4**

- [x] 3. Implement the RecommendationEngine
  - [x] 3.1 Create RecommendationEngine service
    - Create `packages/workspace/src/services/recommendationEngine.ts`
    - Implement `getRecommendations(userId, orgId)` that builds context and delegates to provider
    - Implement input limiting: 50 most recent captures, 20 most recent meeting notes
    - Implement deduplication against existing task titles (case-insensitive substring match)
    - Implement dismiss cooldown filtering (7-day window)
    - Implement result count cap of 5
    - Implement `markHandled(recommendationId, action)` to record handled state
    - Implement `refreshRecommendations(userId, orgId)` that bypasses cache
    - Add 5-second timeout for provider calls
    - _Requirements: 1.1, 1.5, 1.6, 2.1, 2.2, 2.3, 7.1, 8.2_
  - [x] 3.2 Write property tests for result count cap
    - **Property 3: Result Count Cap**
    - **Validates: Requirements 1.5**
  - [x] 3.3 Write property tests for input limiting
    - **Property 4: Input Limiting**
    - **Validates: Requirements 1.6**
  - [x] 3.4 Write property tests for deduplication exclusion
    - **Property 5: Deduplication Exclusion**
    - **Validates: Requirements 2.2**
  - [x] 3.5 Write property tests for dismiss cooldown filtering
    - **Property 6: Dismiss Cooldown Filtering**
    - **Validates: Requirements 2.3**

- [x] 4. Checkpoint - Core engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement the RecommendationsWidget UI component
  - [x] 5.1 Create RecommendationsWidget component
    - Create `packages/workspace/src/components/RecommendationsWidget.tsx`
    - Fetch recommendations on mount using RecommendationEngine
    - Check `taskRecommendationsEnabled` preference before rendering
    - Render recommendation cards with title, source excerpt, source type badge, and confidence indicator
    - Add "Accept" button that creates a task and removes the card
    - Add "Dismiss" button that marks as dismissed and removes the card
    - Show empty state when no recommendations available
    - Show error state with retry button on fetch failure
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 8.1, 8.3_
  - [x] 5.2 Write property tests for accept creates matching task
    - **Property 7: Accept Creates Matching Task**
    - **Validates: Requirements 4.1**
  - [x] 5.3 Write unit tests for RecommendationsWidget
    - Test empty state rendering
    - Test error state with retry
    - Test card rendering with all required fields
    - Test preference-disabled hides widget
    - _Requirements: 3.2, 3.3, 3.4, 4.4, 8.1_

- [x] 6. Integrate widget into DashboardTab
  - [x] 6.1 Add RecommendationsWidget to DashboardTab
    - Import and render `RecommendationsWidget` in `packages/workspace/src/components/DashboardTab.tsx`
    - Place widget below the KPI cards section
    - Pass `userId` and `organizationId` props
    - Conditionally render based on `taskRecommendationsEnabled` preference
    - _Requirements: 3.1, 3.4_

- [x] 7. Add Settings toggle to AppPreferences
  - [x] 7.1 Add Task Recommendations toggle to AppPreferences component
    - Add a toggle switch row in `packages/workspace/src/components/AppPreferences.tsx` following the existing compact mode pattern
    - Wire toggle to `onChange` callback with key `taskRecommendationsEnabled`
    - Use existing `role="switch"` pattern for accessibility
    - _Requirements: 6.1, 6.3, 6.4_
  - [x] 7.2 Write unit tests for the toggle behavior
    - Test toggle renders with correct initial state
    - Test toggling persists preference
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Export new components and services from workspace package
  - [x] 8.1 Update workspace package exports
    - Add `RecommendationsWidget` export to `packages/workspace/src/index.ts`
    - Add `recommendationEngine` service export
    - Add `ruleBasedProvider` service export
    - _Requirements: 7.1, 7.3_

- [x] 9. Final checkpoint - All tests pass and integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use the `fast-check` library for TypeScript property-based testing
- The provider interface enables future swap to AI/LLM-powered recommendations without changing UI or storage
- All recommendation logic runs client-side; no new Supabase tables needed for MVP (handled recommendations stored in IndexedDB)
