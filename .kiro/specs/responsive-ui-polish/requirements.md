# Requirements Document

## Introduction

This feature addresses two visual quality concerns identified after the recent UI uplift:

1. The workspace content area (rendered by WorkspaceShell with DashboardTab, AdminTab, etc.) does not look visually polished after the user completes sign-in/sign-up and the setup wizard. The layout, spacing, and visual continuity between the auth flow and the workspace need improvement.

2. The mobile front porch (auth/sign-in/sign-up screens scoped to `.auth-page`) does not adapt properly to varying phone dimensions -- small phones clip content, large phones leave too much whitespace, and different aspect ratios break the intended layout.

Both issues affect the mobile app (`apps/mobile`) primarily but workspace polish also applies to the desktop app where WorkspaceShell is consumed.

## Glossary

- **Front_Porch**: The set of authentication screens (home, sign-in, sign-up) displayed before the user is authenticated, styled under the `.auth-page` class.
- **Workspace_Shell**: The post-authentication application shell that renders navigation tabs and tab content (DashboardTab, CaptureTab, TasksTab, PulseTab, MoreTab, AdminTab).
- **Onboarding_Wizard**: The first-time setup flow displayed after authentication but before the workspace, rendered by FirstTimeOnboardingWizard.
- **Layout_Shell**: The platform-adaptive container (`.layout-shell`) that manages content area and navigation placement across mobile and desktop.
- **Viewport**: The visible area of the application on a device screen, varying by phone model (width x height and pixel density).
- **Safe_Area**: The device-specific insets (notch, home indicator, status bar) that content must avoid overlapping.
- **Design_Tokens**: CSS custom properties (sage/limestone palette) defined in `packages/ui/src/styles.css` that establish the visual language.

## Requirements

### Requirement 1: Front Porch Responsive Scaling

**User Story:** As a mobile user, I want the auth screens to fit my phone regardless of its size, so that content is readable and interactive elements are reachable without scrolling or clipping.

#### Acceptance Criteria

1. WHILE the Viewport width is between 320px and 428px, THE Front_Porch SHALL display all content (logo, tagline, action buttons) without horizontal overflow or text truncation.
2. WHILE the Viewport height is less than 680px, THE Front_Porch SHALL reduce vertical spacing and font sizes proportionally so that the primary call-to-action buttons remain visible without scrolling.
3. THE Front_Porch SHALL use relative units (dvh, vw, clamp, min/max) for all layout-critical spacing and typography so that layout scales continuously across viewport sizes.
4. WHEN the device has a notch or home indicator, THE Front_Porch SHALL respect Safe_Area insets so that no interactive element is obscured by hardware features.

### Requirement 2: Split Auth Panel Mobile Adaptation

**User Story:** As a mobile user signing in or signing up, I want the split-panel auth layout to reflow into a stacked layout on small screens, so that form fields are large enough to tap and read.

#### Acceptance Criteria

1. WHILE the Viewport width is 820px or less, THE Front_Porch SHALL render the split-auth panels (AuthStoryPanel and auth-conversation) in a single-column stacked layout instead of a two-column grid.
2. WHILE the Viewport width is 420px or less, THE Front_Porch SHALL hide the AuthStoryPanel entirely and show only the auth-conversation form to maximize usable form space.
3. WHEN the on-screen keyboard is active on a mobile device, THE Front_Porch SHALL ensure the active input field remains visible and not obscured by the keyboard.

### Requirement 3: Workspace Shell Visual Continuity

**User Story:** As a user who just completed onboarding, I want the workspace to feel like a natural continuation of the polished auth flow, so that the experience feels cohesive.

#### Acceptance Criteria

1. THE Workspace_Shell SHALL apply the sage/limestone Design_Tokens consistently for backgrounds, text, borders, and card surfaces so that the workspace matches the auth flow palette.
2. THE Workspace_Shell SHALL render the Layout_Shell with a full-height (100dvh) container that prevents content from appearing as a partial white rectangle or floating card.
3. WHEN the user transitions from the Onboarding_Wizard to the Workspace_Shell, THE Layout_Shell SHALL use a fade-in transition (250ms ease) so the switch does not feel abrupt.

### Requirement 4: Workspace Content Area Mobile Layout

**User Story:** As a mobile user in the workspace, I want dashboard cards, task lists, and other content to use the full screen width with proper padding, so that nothing feels cramped or off-center.

#### Acceptance Criteria

1. WHILE the Viewport width is 428px or less, THE Workspace_Shell content area SHALL use 16px horizontal padding and content elements SHALL fill the available width.
2. THE Workspace_Shell content area SHALL reserve bottom padding of at least 80px (plus Safe_Area inset) to prevent content from being hidden behind the fixed tab bar.
3. WHILE the Viewport width is 428px or less, THE DashboardTab KPI cards SHALL stack vertically in a single column instead of a three-column grid.

### Requirement 5: Onboarding Wizard Responsive Fit

**User Story:** As a mobile user completing the setup wizard, I want the onboarding modal to fit my screen without requiring scrolling past the viewport edges, so that I can complete each step comfortably.

#### Acceptance Criteria

1. WHILE the Viewport width is 420px or less, THE Onboarding_Wizard modal SHALL occupy the full screen width with 12px horizontal margin and expand vertically to fit content without overflow.
2. WHILE the Viewport height is less than 700px, THE Onboarding_Wizard SHALL reduce card padding and option grid gap so that all options and the submit button are visible without scrolling.
3. THE Onboarding_Wizard option grid SHALL reflow from multi-column to single-column WHEN the container width is less than 480px.

### Requirement 6: Typography Scaling Across Devices

**User Story:** As a mobile user, I want text to remain legible on small phones and proportionate on large phones, so that the experience is comfortable on any device.

#### Acceptance Criteria

1. THE Front_Porch logo text SHALL scale between 48px (320px viewport) and 84px (428px viewport) using a CSS clamp function.
2. THE Front_Porch tagline and greeting text SHALL scale between 14px and 21px based on viewport width.
3. THE Workspace_Shell heading text SHALL use clamp-based sizing between 20px and 32px for section titles.
4. WHILE the Viewport width is less than 360px, THE Front_Porch SHALL set a minimum touch-target size of 44x44px for all interactive elements.

### Requirement 7: Fixed UI Element Safe Positioning

**User Story:** As a mobile user, I want the Breathe button, visual mode toggle, and product credit to stay accessible regardless of my phone's dimensions, so that they are always reachable.

#### Acceptance Criteria

1. THE Front_Porch Breathe button SHALL be positioned within the Safe_Area bounds using inset-relative positioning (top: max(18px, env(safe-area-inset-top) + 8px)).
2. THE Front_Porch visual mode toggle SHALL be positioned within the Safe_Area bounds using inset-relative positioning (bottom: max(22px, env(safe-area-inset-bottom) + 8px)).
3. WHILE the Viewport width is less than 360px, THE Front_Porch product credit text SHALL reposition from fixed bottom-left to a centered bottom position to avoid overlap with the visual mode toggle.

### Requirement 8: Workspace Tab Content Structure and Delight

**User Story:** As a user navigating the workspace tabs, I want the tab pages to have the same structured layout, visual richness, and interactive feedback as the original prototype, so that the experience feels complete and delightful rather than skeletal.

#### Acceptance Criteria

1. THE DashboardTab KPI section SHALL render as a horizontally-scrollable card strip with edge-bleed (negative margins matching parent padding) and hidden scrollbars, matching the prototype kpi-scroll pattern.
2. THE DashboardTab Pulse Countdown section SHALL render as a visually distinct card with an icon badge, label, title, and countdown value in a horizontal flex layout, using a tinted background (sage highlight).
3. THE DashboardTab Priority Queue section SHALL render each task as a card with press-scale feedback (transform: scale(0.99) on active), a colored left-border by priority, and metadata row (due date, source icon).
4. THE DashboardTab section headers SHALL include a section title with an inline action link (such as "View all") on the trailing side.
5. THE TasksTab filter pills SHALL include a sliding indicator (pill underline or background) that animates between the active filter option.
6. THE TasksTab floating action button SHALL use elevation shadow, sage-deep background, and a scale-up hover/press animation.
7. THE TasksTab empty state SHALL display a descriptive title and subtitle with muted styling, matching the prototype capture-empty pattern.
8. THE PulseTab SHALL render pulse stats as a row of stat cards (value + label), a timeline section, and a day-structure visualization area with placeholder content.
9. THE MoreTab SHALL render menu items as full-width row buttons with leading icon, text with optional description, and trailing chevron, matching the prototype menu-item pattern.
10. THE CaptureTab SHALL render the voice/tap mode toggle with a sliding indicator background, the microphone button with animated ring pulses, and the AI suggestion card with a sparkle icon header.
11. WHEN a user taps a workspace card or list item, THE Workspace_Shell SHALL provide tactile press feedback (scale transform and shadow reduction) within 100ms of the tap event.
12. THE Workspace_Shell loading states SHALL display animated skeleton cards (pulse animation on rounded placeholders) instead of plain text loading indicators.
