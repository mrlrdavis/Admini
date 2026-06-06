# Implementation Plan: UI Uplift Optimization

## Overview

Transform the `packages/ui` design system from purple/violet to sage/limestone, add CSS-only transitions and skeleton loading states, evolve `LayoutShell` into a platform-adaptive shell with ResizeObserver-based mode switching, and integrate the Tomorrow display typeface. All changes are authored in `packages/ui` and consumed by both `apps/mobile` and `apps/desktop` via the `@admini/ui` alias.

## Tasks

- [x] 1. Token System overhaul in styles.css
  - [x] 1.1 Replace color palette and define all design tokens
    - Remove all purple/violet hex values (`#7c3aed`, `#5b21b6`, `#a78bfa`, `#ddd6fe`, `#f5f3ff`, `#241e36`) from `packages/ui/src/styles.css`
    - Define sage/limestone color tokens in `:root`: `--color-sage`, `--color-sage-deep`, `--color-sage-soft`, `--color-limestone`, `--color-limestone-light`, `--color-bg`, `--color-surface`, `--color-surface-muted`, `--color-text`, `--color-text-muted`, `--color-text-faint`, `--color-border`, `--color-primary` (#87a878), `--color-primary-strong` (#54745c), `--color-success`, `--color-warning`, `--color-danger`, `--shadow-soft`
    - Define spacing tokens: `--space-xs` (4px), `--space-sm` (8px), `--space-md` (16px), `--space-lg` (24px), `--space-xl` (32px)
    - Define radius tokens: `--radius-sm` (4px), `--radius-md` (8px), `--radius-card` (12px), `--radius-pill` (9999px)
    - Define transition tokens: `--transition-fast` (150ms ease), `--transition-normal` (250ms ease)
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 2.1_

  - [x] 1.2 Add dark mode token block
    - Replace the existing `[data-theme='dark']` selector block with sage/limestone dark equivalents
    - Ensure every color token in `:root` has a corresponding declaration in `[data-theme='dark']`
    - _Requirements: 1.3_

  - [x] 1.3 Add transition declarations to interactive elements
    - Add `transition` shorthand to `.admini-button` for `background-color`, `border-color`, `color`, `transform` using `--transition-fast`
    - Add `transition` shorthand to `.admini-card` for `box-shadow`, `border-color`, `transform` using `--transition-normal`
    - Add `transition: opacity var(--transition-normal), transform var(--transition-normal)` to `.layout-shell__content`
    - _Requirements: 2.2, 2.3, 2.5, 2.6_

  - [x] 1.4 Add skeleton animation keyframes
    - Add `@keyframes skeleton-pulse` that cycles opacity between 0.4 and 1.0 over 1.5s
    - Add `.skeleton` class with background `var(--color-surface-muted)` and the pulse animation
    - Add `.skeleton-card` class with `border-radius: var(--radius-card)`
    - _Requirements: 3.2, 3.5_

  - [x] 1.5 Add typography tokens and @font-face declarations
    - Add `@font-face` declarations for Tomorrow at weights 400, 500, 600, 700 with `font-display: swap`
    - Define `--font-display: 'Tomorrow', system-ui, -apple-system, sans-serif`
    - Define `--font-body: 'Avenir Next', Nunito, Quicksand, Inter, ui-sans-serif, system-ui, sans-serif`
    - Define font-weight tokens: `--font-weight-normal` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600), `--font-weight-bold` (700)
    - Apply `--font-display` to `h1, h2, h3, h4, .display-text`
    - Apply `--font-body` to `body` and form controls
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 1.6 Add LayoutShell CSS layout modes
    - Add `.layout-shell--mobile` (flex column) and `.layout-shell--desktop` (flex row) classes
    - Style `.layout-shell__bottom-bar` with fixed bottom positioning and safe-area padding
    - Style `.layout-shell__sidebar` with min-width 220px, max-width 280px, and transition on width/opacity
    - Add transition on navigation elements using `--transition-normal`
    - _Requirements: 4.3, 4.4, 4.5_

- [x] 2. Create Skeleton and SkeletonCard components
  - [x] 2.1 Implement Skeleton and SkeletonCard in `packages/ui/src/Skeleton.tsx`
    - Create `Skeleton` component accepting `width`, `height`, `className`, and optional `borderRadius` props
    - Render a `<div>` with inline `width`/`height` styles and the `.skeleton` CSS class
    - Create `SkeletonCard` component with `className` and optional `height` props
    - SkeletonCard applies `.skeleton` and `.skeleton-card` classes with card-like default dimensions
    - _Requirements: 3.1, 3.5_

  - [ ]* 2.2 Write property test for Skeleton dimension fidelity
    - **Property 4: Skeleton Dimension Fidelity**
    - Generate random valid width/height values and verify the rendered element's inline style matches
    - **Validates: Requirements 3.1**

- [x] 3. Evolve LayoutShell to platform-adaptive component
  - [x] 3.1 Refactor LayoutShell with mode prop and ResizeObserver
    - Add `mode` prop (`'auto' | 'mobile' | 'desktop'`, default `'auto'`)
    - Add `renderNavigation` render-prop accepting `{ layoutMode, tabs, activeTab, onTabChange }`
    - Add `tabs`, `activeTab`, `onTabChange`, and `loading` props
    - Implement ResizeObserver-based width detection in `mode="auto"` (threshold 768px)
    - Render bottom-tab bar in mobile mode, sidebar in desktop mode
    - Maintain `children` content area rendering identically in both modes
    - Export `LayoutMode` type
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7_

  - [x] 3.2 Add lazy-loading and skeleton fallback to LayoutShell
    - Display `Skeleton` placeholders in content area when `loading` is true
    - Support `React.lazy` + `Suspense` pattern for tab content with skeleton fallback
    - Implement error boundary that catches fetch failures and renders error state with retry button
    - _Requirements: 3.3, 3.4, 3.6_

  - [ ]* 3.3 Write property test for auto-mode layout detection
    - **Property 7: Auto-Mode Layout Detection**
    - Generate random container widths and verify mobile layout when <=768px, desktop when >768px
    - **Validates: Requirements 4.2**

  - [ ]* 3.4 Write property test for renderNavigation contract
    - **Property 8: renderNavigation Contract**
    - Verify renderNavigation is always called with `{ layoutMode, tabs, activeTab, onTabChange }` matching current state
    - **Validates: Requirements 4.6**

- [x] 4. Checkpoint - Verify core components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Polish TabBar transitions
  - [x] 5.1 Add transition classes to TabBar
    - Add `transition: color var(--transition-fast), transform var(--transition-fast)` to `.tab-item`
    - Add `transition: transform var(--transition-fast)` to `.tab-item__icon`
    - Add `transform: scale(1.1)` to `.tab-item--active .tab-item__icon`
    - No API changes to TabBarProps
    - _Requirements: 2.4_

- [x] 6. Update exports and app integration
  - [x] 6.1 Update `packages/ui/src/index.ts` exports
    - Export `Skeleton`, `SkeletonCard` from `./Skeleton`
    - Export `LayoutMode` type from `./LayoutShell`
    - Update `LayoutShellProps` export to reflect new interface
    - _Requirements: 3.1, 3.5, 4.1_

  - [x] 6.2 Update `apps/desktop` to consume new tokens and LayoutShell
    - Import `@admini/ui/styles.css` to pull in new token system
    - Migrate any app-level duplicate token overrides to use the UI package tokens
    - Update LayoutShell usage to new `mode`/`renderNavigation` API if applicable
    - _Requirements: 1.4_

  - [x] 6.3 Update `apps/mobile` to consume new tokens and LayoutShell
    - Import `@admini/ui/styles.css` to pull in new token system
    - Migrate any app-level duplicate token overrides to use the UI package tokens
    - Update LayoutShell usage to new `mode`/`renderNavigation` API if applicable
    - _Requirements: 1.4_

- [ ] 7. Token and typography property tests
  - [ ]* 7.1 Set up vitest and fast-check in `packages/ui`
    - Add `vitest`, `@testing-library/react`, `jsdom`, and `fast-check` as devDependencies
    - Create `vitest.config.ts` with jsdom environment
    - Add `test` script to `packages/ui/package.json`
    - _Requirements: N/A (test infrastructure)_

  - [ ]* 7.2 Write property test for token set completeness
    - **Property 1: Token Set Completeness**
    - Parse `styles.css` and verify every required token name exists in the `:root` block
    - **Validates: Requirements 1.1, 1.6**

  - [ ]* 7.3 Write property test for dark mode parity
    - **Property 2: Dark Mode Parity**
    - Parse `styles.css` and verify every color token in `:root` has a matching entry in `[data-theme='dark']`
    - **Validates: Requirements 1.3**

  - [ ]* 7.4 Write property test for purple/violet absence
    - **Property 3: Purple/Violet Absence**
    - Scan `styles.css` content and assert none of the legacy hex values appear
    - **Validates: Requirements 1.5**

  - [ ]* 7.5 Write property test for display font heading application
    - **Property 10: Display Font Heading Application**
    - Verify heading elements and `.display-text` resolve to `--font-display` in the stylesheet rules
    - **Validates: Requirements 5.3**

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses TypeScript + React in a monorepo with `@admini/ui` as the shared package
- No test framework currently exists in `packages/ui` - task 7.1 bootstraps vitest + fast-check
- Font files (Tomorrow woff2) need to be placed in a `public/fonts/` directory accessible to both apps
## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["2.1", "5.1"] },
    { "id": 3, "tasks": ["3.1", "2.2"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4", "7.5"] }
  ]
}
```
