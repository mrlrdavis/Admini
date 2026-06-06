# Requirements Document

## Introduction

This feature consolidates the Admini design system by migrating sage/limestone design tokens into `packages/ui` as the single source of truth, replacing the current purple/violet palette. It adds visual polish through CSS transitions, micro-animations, and loading states. It introduces platform-adaptive layout components that render as a bottom-tab bar on mobile and a sidebar on desktop. Finally, it incorporates the Tomorrow typeface as the display/heading font alongside the existing Avenir Next / Nunito / Quicksand stack.

## Glossary

- **Token_System**: The CSS custom properties (design tokens) defined in `packages/ui/src/styles.css` that serve as the single source of truth for colors, spacing, shadows, and typography across the monorepo.
- **UI_Package**: The shared `packages/ui` package that exports reusable components and the Token_System to both `apps/mobile` and `apps/desktop`.
- **LayoutShell**: The platform-adaptive shell component exported from the UI_Package that manages layout mode based on container context.
- **Skeleton_Placeholder**: A lightweight placeholder element that mimics the shape and size of content while data is loading, providing perceived performance feedback to the user.
- **Transition_Layer**: The CSS transition and animation declarations applied to interactive and stateful elements to provide smooth visual feedback.
- **Display_Font**: The Tomorrow typeface used for headings and display-level text within the application.
- **Body_Font_Stack**: The existing font stack consisting of Avenir Next, Nunito, Quicksand, and system fallbacks used for body and UI text.
- **Mobile_Context**: A rendering context where the viewport width is 768px or narrower, triggering bottom-tab navigation layout.
- **Desktop_Context**: A rendering context where the viewport width exceeds 768px, triggering sidebar navigation layout.

## Requirements

### Requirement 1: Design Token Consolidation

**User Story:** As a developer, I want a single source of truth for design tokens in `packages/ui`, so that both apps use a consistent sage/limestone palette without duplicated or conflicting variables.

#### Acceptance Criteria

1. THE Token_System SHALL define the following color tokens: `--color-sage`, `--color-sage-deep`, `--color-sage-soft`, `--color-limestone`, `--color-limestone-light`, `--color-bg`, `--color-surface`, `--color-surface-muted`, `--color-text`, `--color-text-muted`, `--color-text-faint`, `--color-border`, `--color-primary`, `--color-primary-strong`, `--color-success`, `--color-warning`, `--color-danger`, and `--shadow-soft`.
2. THE Token_System SHALL map `--color-primary` to the sage palette value `#87a878` in light mode and `--color-primary-strong` to `#54745c` in light mode.
3. THE Token_System SHALL provide a dark mode variant under the `[data-theme='dark']` selector that maps sage and limestone tokens to appropriate dark-mode equivalents.
4. WHEN the Token_System is imported by an application, THE Token_System SHALL override any app-level duplicate token definitions for tokens that share the same custom property name.
5. THE Token_System SHALL remove all purple/violet color values (`#7c3aed`, `#5b21b6`, `#a78bfa`, `#ddd6fe`, `#f5f3ff`, `#241e36`) from the `packages/ui/src/styles.css` root declarations.
6. THE Token_System SHALL define spacing tokens (`--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`) and radius tokens (`--radius-sm`, `--radius-md`, `--radius-card`, `--radius-pill`) for consistent spatial rhythm.

### Requirement 2: Visual Polish - Transitions and Micro-Animations

**User Story:** As a user, I want smooth visual feedback on interactive elements, so that the interface feels responsive and polished.

#### Acceptance Criteria

1. THE UI_Package SHALL define transition duration tokens: `--transition-fast` (150ms) and `--transition-normal` (250ms) with an `ease` timing function.
2. WHEN a user hovers or focuses on a button component, THE Transition_Layer SHALL animate `background-color`, `border-color`, `color`, and `transform` properties using `--transition-fast`.
3. WHEN a user hovers or focuses on a card component, THE Transition_Layer SHALL animate `box-shadow`, `border-color`, and `transform` properties using `--transition-normal`.
4. WHEN a tab becomes active in the TabBar, THE Transition_Layer SHALL animate the color and icon scale change using `--transition-fast`.
5. THE Transition_Layer SHALL use only CSS transitions and keyframe animations without external animation libraries.
6. THE UI_Package SHALL apply `transition: opacity var(--transition-normal), transform var(--transition-normal)` to stateful content areas to enable smooth enter/exit transitions.

### Requirement 3: Visual Polish - Loading States and Perceived Performance

**User Story:** As a user, I want visual placeholders while content loads, so that I perceive the application as fast and understand that content is being fetched.

#### Acceptance Criteria

1. THE UI_Package SHALL export a `Skeleton` component that renders a pulsing placeholder matching the dimensions passed via `width` and `height` props.
2. THE Skeleton_Placeholder SHALL use a CSS keyframe animation that cycles opacity between 0.4 and 1.0 over a 1.5-second period.
3. WHEN a workspace tab is loading data, THE LayoutShell SHALL display Skeleton_Placeholder elements in place of the content area that match the expected layout structure.
4. WHEN a tab panel has not been previously rendered, THE LayoutShell SHALL lazy-load the tab content and display a Skeleton_Placeholder until the component is ready.
5. THE UI_Package SHALL export a `SkeletonCard` variant that renders a card-shaped placeholder with the standard `--radius-card` border radius.
6. IF a data fetch fails after showing a Skeleton_Placeholder, THEN THE UI_Package SHALL replace the skeleton with an error state component that includes a retry action.

### Requirement 4: Platform-Adaptive Layout

**User Story:** As a user, I want navigation that adapts to my device context, so that I get a bottom-tab bar on mobile and a sidebar on desktop without maintaining separate layout components.

#### Acceptance Criteria

1. THE LayoutShell SHALL accept a `mode` prop with values `"auto"`, `"mobile"`, or `"desktop"` that determines layout behavior.
2. WHEN the `mode` prop is set to `"auto"`, THE LayoutShell SHALL detect the container width and render bottom-tab layout in Mobile_Context and sidebar layout in Desktop_Context.
3. WHILE the LayoutShell renders in Mobile_Context, THE LayoutShell SHALL position the navigation as a fixed bottom tab bar with safe-area inset padding.
4. WHILE the LayoutShell renders in Desktop_Context, THE LayoutShell SHALL position the navigation as a vertical sidebar on the left side of the viewport with a minimum width of 220px and a maximum width of 280px.
5. WHEN the container width crosses the 768px threshold, THE LayoutShell SHALL transition between layout modes using a CSS transition on the navigation element with `--transition-normal` duration.
6. THE LayoutShell SHALL expose a `renderNavigation` render-prop that receives the current `layoutMode` ("mobile" | "desktop"), the tab list, the active tab, and the `onTabChange` handler.
7. THE LayoutShell SHALL maintain the existing `children` and content-area API so that tab content renders identically regardless of layout mode.

### Requirement 5: Typography - Display Font Integration

**User Story:** As a designer, I want the Tomorrow typeface used for display and heading text, so that the application has a distinctive visual identity distinct from the body font stack.

#### Acceptance Criteria

1. THE Token_System SHALL define a `--font-display` custom property with the value `'Tomorrow', system-ui, -apple-system, sans-serif`.
2. THE Token_System SHALL define a `--font-body` custom property with the value `'Avenir Next', Nunito, Quicksand, Inter, ui-sans-serif, system-ui, sans-serif`.
3. THE UI_Package SHALL apply `--font-display` to all heading elements (`h1` through `h4`) and elements with a `.display-text` class.
4. THE UI_Package SHALL apply `--font-body` to the root `body` element and all form controls.
5. WHEN the Tomorrow font file is unavailable or fails to load, THE Token_System SHALL fall back to the `system-ui` font without layout shift by declaring appropriate `font-display: swap` behavior.
6. THE Token_System SHALL define font-weight tokens: `--font-weight-normal` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600), and `--font-weight-bold` (700).
