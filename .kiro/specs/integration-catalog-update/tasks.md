# Implementation Plan: Integration Catalog Update

## Overview

Update the AdminI integration catalog by modifying shared types and the integration catalog array. Remove Schoology and Infinite Campus, add Email and Calendar productivity integrations, introduce deprecation-handling types and utility functions, and add UI filtering for deprecated providers.

## Tasks

- [ ] 1. Update IntegrationProvider type and add deprecation types in shared package
  - [ ] 1.1 Update IntegrationProvider union type in packages/shared/src/index.ts
    - Remove 'schoology' and 'infinite_campus' from the union
    - Set type to exactly 'google_classroom' | 'email' | 'calendar'
    - _Requirements: 1.2, 2.2, 6.1_
  - [ ] 1.2 Add DeprecatedIntegrationProvider and AnyIntegrationProvider types
    - Add export type DeprecatedIntegrationProvider = 'schoology' | 'infinite_campus'
    - Add export type AnyIntegrationProvider = IntegrationProvider | DeprecatedIntegrationProvider
    - _Requirements: 6.2, 6.3_

- [ ] 2. Update integrationCatalog array in integrations package
  - [ ] 2.1 Remove schoology and infinite_campus entries from packages/integrations/src/index.ts
    - Delete the schoology catalog item object
    - Delete the infinite_campus catalog item object
    - _Requirements: 1.1, 2.1_
  - [ ] 2.2 Add email and calendar entries to integrationCatalog
    - Add email entry: provider 'email', name 'Email', category 'productivity', authModes ['oauth'], scopes ['inbox:read', 'messages:send'], persistenceTargets ['indexeddb', 'supabase']
    - Add calendar entry: provider 'calendar', name 'Calendar', category 'productivity', authModes ['oauth'], scopes ['events:read', 'events:create'], persistenceTargets ['indexeddb', 'supabase']
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

- [ ] 3. Add deprecation utility functions
  - [ ] 3.1 Add isActiveProvider type guard to packages/integrations/src/index.ts
    - Import AnyIntegrationProvider, IntegrationProvider, DeprecatedIntegrationProvider from @admini/shared
    - Implement isActiveProvider(provider: AnyIntegrationProvider): provider is IntegrationProvider
    - Returns true for 'google_classroom', 'email', 'calendar'
    - _Requirements: 8.2_
  - [ ] 3.2 Add isDeprecatedProvider type guard to packages/integrations/src/index.ts
    - Implement isDeprecatedProvider(provider: AnyIntegrationProvider): provider is DeprecatedIntegrationProvider
    - Returns true for 'schoology', 'infinite_campus'
    - _Requirements: 8.3_

- [ ] 4. Checkpoint - Verify compilation and connector stubs
  - Run TypeScript compilation to confirm no type errors
  - Verify createMockConnector('email') and createMockConnector('calendar') work correctly (existing generic implementation should handle new providers)
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.3, 2.3, 3.5, 4.5, 5.3, 7.1, 7.2, 7.3_

- [ ] 5. Add UI filtering logic for deprecated providers
  - [ ] 5.1 Add connection filtering helper to integrations package
    - Create a getActiveConnections function or equivalent filtering logic
    - Use isActiveProvider to filter out connections with deprecated provider values
    - Export from packages/integrations/src/index.ts
    - _Requirements: 8.4_
  - [ ] 5.2 Update any UI integration list rendering to use the filter
    - Locate UI components that display integration connections
    - Apply filtering so only active catalog providers are displayed
    - _Requirements: 8.4_

- [ ] 6. Write unit tests for catalog update
  - [ ]* 6.1 Write unit tests for integrationCatalog contents
    - Assert catalog contains exactly 3 entries: google_classroom, email, calendar
    - Assert catalog does NOT contain schoology or infinite_campus
    - Assert email entry has correct scopes, authModes, persistenceTargets
    - Assert calendar entry has correct scopes, authModes, persistenceTargets
    - Assert google_classroom entry is unchanged
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_
  - [ ]* 6.2 Write unit tests for isActiveProvider and isDeprecatedProvider
    - Assert isActiveProvider returns true for google_classroom, email, calendar
    - Assert isActiveProvider returns false for schoology, infinite_campus
    - Assert isDeprecatedProvider returns true for schoology, infinite_campus
    - Assert isDeprecatedProvider returns false for google_classroom, email, calendar
    - _Requirements: 8.2, 8.3_
  - [ ]* 6.3 Write unit tests for createMockConnector with new providers
    - Assert createMockConnector('email').health() returns status 'mock'
    - Assert createMockConnector('calendar').health() returns status 'mock'
    - Assert all interface methods return valid mock data without throwing
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 6.4 Write property tests for catalog invariants
    - **Property 1: Catalog completeness** - every IntegrationProvider value has a catalog entry
    - **Property 2: No deprecated providers in catalog** - no catalog entry has a deprecated provider
    - **Property 4: All catalog items support OAuth** - every entry includes 'oauth' in authModes
    - **Property 5: Mock connector provider identity** - for all active providers, createMockConnector(p).provider === p
    - **Validates: Requirements 1.1, 2.1, 3.1, 3.2, 4.1, 4.2, 5.1, 7.1, 7.2, 7.3**

- [ ] 7. Final checkpoint - Ensure all tests pass
  - Run full TypeScript compilation across workspace
  - Run all unit and property tests
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["5.1", "5.2"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["7"] }
  ]
}
```

## Notes

- Tasks marked with * are optional and can be skipped for faster MVP
- The existing createMockConnector is generic and already works for any provider string, so no structural changes are needed for it
- Google Classroom entry must remain byte-for-byte identical to preserve existing behavior
- No database migrations are needed - deprecated records remain untouched (soft deprecation)
- Property tests validate universal correctness properties from the design document
