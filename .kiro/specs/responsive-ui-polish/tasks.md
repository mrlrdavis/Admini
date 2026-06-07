# Implementation Plan: Responsive UI Polish

## Overview

This plan implements responsive scaling for the front porch auth screens and elevates workspace tabs from functional shells to visually rich, interactive experiences. The approach is CSS-first with minimal JS additions for interactive indicators. Changes span `apps/mobile/src/styles.css`, `packages/ui/src/`, and `packages/workspace/src/`.

## Tasks

- [x] 1. Foundation — global tokens, utility classes, and shared styles
  - [x] 1.1 Add interactive feedback tokens and press-feedback utility class to workspace styles
    - Add `--transition-press` token to `packages/ui/src/styles.css`
    - Add `.ws-press-feedback` utility class with `:active` scale/shadow to `packages/workspace/src/styles/index.css`
    - Add `prefers-reduced-motion` media query disabling transitions/animations to `packages/workspace/src/styles/index.css`
    - _Requirements: 8.11, 8.12_

  - [x] 1.2 Add workspace background gradient to LayoutShell styles
    - Add `linear-gradient(180deg, var(--color-limestone-light) 0%, var(--color-bg) 40%, var(--color-bg) 100%)` background to `.layout-shell__content` in `packages/ui/src/styles.css`
    - _Requirements: 3.1, 3.2_

  - [x] 1.3 Implement fade-in transition on LayoutShell content mount
    - In `packages/ui/src/LayoutShell.tsx`, apply `layout-shell__content--entered` class when loading is false
    - Add CSS for opacity/transform transition (250ms ease) in `packages/ui/src/styles.css`
    - Include the entered transition in the `prefers-reduced-motion` override
    - _Requirements: 3.3_

  - [x] 1.4 Enhance Skeleton component with pulse animation
    - Update `packages/ui/src/Skeleton.tsx` to support a `<SkeletonCard>` variant with configurable height
    - Add CSS keyframe pulse animation to the skeleton placeholder styling
    - _Requirements: 8.12_

- [x] 2. Front porch responsive CSS
  - [x] 2.1 Implement fluid spacing and typography scaling for `.auth-page`
    - In `apps/mobile/src/styles.css`, add `clamp()`-based padding/gap for `.home-panel`
    - Add logo text scaling: `clamp(48px, 11.5vw, 84px)`
    - Add tagline/greeting scaling: `clamp(14px, 3.5vw, 21px)`
    - Add `@media (max-height: 680px)` rules to compress vertical spacing
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_

  - [x] 2.2 Implement safe-area positioning for fixed UI elements
    - Position `.breath-button` with `top: max(18px, env(safe-area-inset-top) + 8px)`
    - Position `.visual-mode-button` with `bottom: max(22px, env(safe-area-inset-bottom) + 8px)`
    - Add `@media (max-width: 360px)` rule to center product credit text
    - Add minimum 44x44px touch target sizing for viewports < 360px
    - _Requirements: 1.4, 7.1, 7.2, 7.3, 6.4_

  - [x] 2.3 Implement split-auth responsive breakpoints
    - Add `@media (max-width: 820px)` rule to switch `.split-auth` to single-column stacked layout
    - Add `@media (max-width: 420px)` rule to hide `.auth-story` and make `.auth-conversation` full-width/full-height
    - Ensure form inputs work with on-screen keyboard via `dvh` unit usage
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Checkpoint — Verify front porch and foundation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. DashboardTab enhancements
  - [x] 4.1 Implement KPI scroll strip with edge-bleed pattern
    - In `packages/workspace/src/styles/dashboard.css`, add `.dashboard-tab__kpis` flex container with `overflow-x: auto`, negative margins, hidden scrollbars, and `scroll-snap-type: x mandatory`
    - Update `packages/workspace/src/components/DashboardTab.tsx` to wrap KPI cards in the scroll container
    - Add `@media (max-width: 428px)` rule to stack KPIs vertically as single-column
    - _Requirements: 8.1, 4.3_

  - [x] 4.2 Implement Pulse Countdown card
    - Add `.dashboard-tab__countdown-card` styles (icon badge, horizontal flex, tinted sage background) to `packages/workspace/src/styles/dashboard.css`
    - Update `DashboardTab.tsx` to render the countdown card with icon badge, label, title, and value
    - _Requirements: 8.2_

  - [x] 4.3 Implement section headers with action links
    - Add `.dashboard-tab__section-header` styles (flex, baseline-aligned, space-between) to `packages/workspace/src/styles/dashboard.css`
    - Update `DashboardTab.tsx` to render `<header>` elements with h2 and trailing "View all" button for each section
    - _Requirements: 8.4_

  - [x] 4.4 Implement Priority Queue press feedback and metadata row
    - Add press-scale styles (`:active` transform scale 0.99) and colored left-border by priority to task items in `packages/workspace/src/styles/dashboard.css`
    - Update `DashboardTab.tsx` to render metadata row (due date, source icon) on each task card
    - Apply `.ws-press-feedback` class to task items
    - _Requirements: 8.3, 8.11_

  - [ ] 4.5 Write component tests for DashboardTab enhancements
    - Verify `.dashboard-tab__section-header` renders with action link
    - Verify `.dashboard-tab__countdown-card` renders icon badge and value
    - Verify KPI scroll container has expected classes
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 5. TasksTab enhancements
  - [x] 5.1 Implement sliding filter indicator
    - Add `.tasks-tab__filter-indicator` styles (absolute positioned, animated translateX) to `packages/workspace/src/styles/tasks.css`
    - Update `packages/workspace/src/components/TasksTab.tsx` to track active filter pill position via refs and render the indicator `<span>` with dynamic `left`/`width` style
    - _Requirements: 8.5_

  - [x] 5.2 Implement FAB animation and styling
    - Add `.tasks-tab__fab` styles (sage-deep background, elevated shadow, scale-up on hover/active) to `packages/workspace/src/styles/tasks.css`
    - _Requirements: 8.6_

  - [x] 5.3 Implement empty state
    - Add `.tasks-tab__empty-state`, `.tasks-tab__empty-title`, `.tasks-tab__empty-desc` styles to `packages/workspace/src/styles/tasks.css`
    - Update `TasksTab.tsx` to render the empty state when no tasks match the active filter
    - _Requirements: 8.7_

  - [ ] 5.4 Write component tests for TasksTab enhancements
    - Verify `.tasks-tab__filter-indicator` renders and updates position on filter change
    - Verify empty state renders descriptive title and subtitle
    - _Requirements: 8.5, 8.7_

- [x] 6. CaptureTab enhancements
  - [x] 6.1 Implement mode toggle slider
    - Add `.capture-tab__mode-toggle` and `.capture-tab__mode-indicator` styles (sliding background pill with translateX) to `packages/workspace/src/styles/capture.css`
    - Update `packages/workspace/src/components/CaptureTab.tsx` to render the indicator element and toggle `--tap` modifier class based on mode state
    - _Requirements: 8.10_

  - [x] 6.2 Implement mic pulse ring animation
    - Add `@keyframes mic-pulse` and `.capture-tab__mic-btn--recording` pseudo-element styles (two staggered ring animations) to `packages/workspace/src/styles/capture.css`
    - Update `CaptureTab.tsx` to apply `--recording` class when recording is active
    - Include pulse animation in `prefers-reduced-motion` override
    - _Requirements: 8.10_

  - [x] 6.3 Implement AI suggestion card with sparkle icon
    - Add `.capture-tab__ai-suggestion-header` styles and sparkle icon SVG to `packages/workspace/src/styles/capture.css`
    - Update `CaptureTab.tsx` to render the AI suggestion card structure with sparkle SVG, "AI" badge, and "Suggestion" label
    - _Requirements: 8.10_

  - [ ] 6.4 Write component tests for CaptureTab enhancements
    - Verify `.capture-tab__mode-indicator` renders and gains `--tap` class on mode switch
    - Verify mic button gains `--recording` class when recording
    - Verify AI suggestion card renders sparkle icon
    - _Requirements: 8.10_

- [x] 7. Checkpoint — Verify Dashboard, Tasks, and Capture tabs
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. PulseTab enhancements
  - [x] 8.1 Implement stat cards and timeline structure
    - Add `.pulse-tab__stat-card`, `.pulse-tab__stat-value`, `.pulse-tab__stat-label` styles to `packages/workspace/src/styles/pulse.css`
    - Update `packages/workspace/src/components/PulseTab.tsx` to render stat cards row (value + label) and a timeline section placeholder
    - _Requirements: 8.8_

  - [x] 8.2 Implement day structure visualization
    - Add `.pulse-tab__day-row` styles with gradient time-block left border (pseudo-element with linear-gradient sage-light to sage-dark) to `packages/workspace/src/styles/pulse.css`
    - Update `PulseTab.tsx` to render day structure rows with time labels and activity blocks
    - _Requirements: 8.8_

- [x] 9. MoreTab enhancements
  - [x] 9.1 Implement menu items with icons, descriptions, and chevrons
    - Add `.more-tab__link-content`, `.more-tab__link-desc`, `.more-tab__link-chevron` styles to `packages/workspace/src/styles/more.css`
    - Update `packages/workspace/src/components/MoreTab.tsx` to render each menu item with leading icon, label, optional description line, and trailing chevron
    - Add hover translateX(2px) animation on chevron
    - _Requirements: 8.9_

  - [ ] 9.2 Write component tests for PulseTab and MoreTab enhancements
    - Verify PulseTab renders stat cards with value and label
    - Verify MoreTab menu items include `.more-tab__link-chevron` and `.more-tab__link-desc`
    - _Requirements: 8.8, 8.9_

- [x] 10. Skeleton loading replacement and workspace mobile layout
  - [x] 10.1 Replace loading text with SkeletonCard components in all tabs
    - Update `DashboardTab.tsx`, `TasksTab.tsx`, `CaptureTab.tsx`, `PulseTab.tsx`, `MoreTab.tsx` to use `<SkeletonCard>` from `@admini/ui` instead of `<p>Loading...</p>`
    - Add `aria-busy="true"` to loading container wrappers
    - _Requirements: 8.12_

  - [x] 10.2 Implement workspace content area mobile layout
    - Add `@media (max-width: 428px)` rules to `packages/workspace/src/styles/index.css` for 16px horizontal padding
    - Ensure bottom padding of at least 80px plus safe-area inset for tab bar clearance
    - _Requirements: 4.1, 4.2_

- [x] 11. Onboarding wizard responsive fit
  - [x] 11.1 Add responsive styles for the onboarding wizard modal
    - Add `@media (max-width: 420px)` rules to make the onboarding modal full-width with 12px margin
    - Add `@media (max-height: 700px)` rules to reduce padding and grid gap
    - Add container-width rule to reflow option grid to single-column below 480px
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 12. Typography scaling and final polish
  - [x] 12.1 Apply clamp-based typography to workspace headings
    - Add `clamp(20px, 4.5vw, 32px)` sizing for section titles in workspace to `packages/workspace/src/styles/index.css`
    - _Requirements: 6.3_

  - [x] 12.2 Add comprehensive `prefers-reduced-motion` support
    - Audit all animation/transition additions and ensure they are covered by the reduced-motion media query
    - Add reduced-motion overrides for: filter indicator, mode indicator, mic pulse, FAB scale, press feedback, skeleton pulse
    - _Requirements: (accessibility compliance, design error handling section)_

- [x] 13. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- No property-based tests — this feature is entirely visual/CSS with no pure algorithmic logic
- Unit tests validate component structure and class application via Vitest + React Testing Library
- The design uses TypeScript/React and CSS throughout — no language selection needed
- All new CSS extends existing `--ws-*` design tokens; no new dependencies introduced

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "10.2", "11.1", "12.1"] },
    { "id": 2, "tasks": ["4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "6.1", "6.2", "6.3", "8.1", "9.1"] },
    { "id": 3, "tasks": ["4.4", "8.2", "10.1"] },
    { "id": 4, "tasks": ["4.5", "5.4", "6.4", "9.2", "12.2"] }
  ]
}
```
