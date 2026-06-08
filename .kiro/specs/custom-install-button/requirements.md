# Requirements Document

## Introduction

This feature introduces a custom branded install button for the AdminI PWA that builds on top of the existing `@admini/pwa` package's `useInstallPrompt` hook. The custom button replaces the generic `InstallButton` component with a polished, context-aware UI that adapts its placement between desktop (header/toolbar) and mobile (banner/card), supports user dismissal with a 30-day cooldown persisted in localStorage, applies attention-grabbing animation on first appearance, and disappears permanently when the app is running in standalone mode. The feature does not modify the `@admini/pwa` package source.

## Glossary

- **Custom_Install_Button**: The branded React component that renders the AdminI install prompt UI, consuming `useInstallPrompt` from `@admini/pwa`
- **Install_Banner**: The mobile-specific layout of the Custom_Install_Button, rendered as a dismissible card or banner near the top or bottom of the viewport
- **Install_Header_Action**: The desktop-specific layout of the Custom_Install_Button, rendered inline within the app header or toolbar
- **Dismissal_Record**: A JSON object stored in localStorage containing a timestamp representing when the user last dismissed the install prompt
- **Cooldown_Period**: The 30-day duration after a dismissal during which the Custom_Install_Button remains hidden
- **First_Appearance**: The first time the Custom_Install_Button is shown to a user in a given session after sign-in, when no Dismissal_Record exists or the Cooldown_Period has expired
- **Standalone_Mode**: The display mode detected via `window.matchMedia('(display-mode: standalone)')` indicating the app has been installed
- **Breakpoint**: The viewport width threshold (768px) at which the app transitions between desktop and mobile layouts

## Requirements

### Requirement 1: Install Button Visibility Logic

**User Story:** As a user, I want the install button to appear only when installation is actually available and I haven't recently dismissed it, so that I am not bothered by irrelevant or repetitive prompts.

#### Acceptance Criteria

1. WHEN `useInstallPrompt` returns `isInstallable: true` AND no unexpired Dismissal_Record exists in localStorage, THE Custom_Install_Button SHALL render and be visible to the user
2. WHEN `useInstallPrompt` returns `isInstallable: false`, THE Custom_Install_Button SHALL NOT render regardless of the Dismissal_Record state
3. WHILE the app is running in Standalone_Mode, THE Custom_Install_Button SHALL NOT render
4. WHEN the user completes their first successful sign-in and `isInstallable` is true, THE Custom_Install_Button SHALL appear prominently without requiring any additional user interaction
5. WHEN the `beforeinstallprompt` event fires after the Custom_Install_Button was previously hidden due to a consumed prompt, THE Custom_Install_Button SHALL re-render as visible

### Requirement 2: Button UI and Branding

**User Story:** As a user, I want the install button to look like part of the AdminI app, so that I trust the prompt and understand it is an official feature.

#### Acceptance Criteria

1. THE Custom_Install_Button SHALL display the text "Install AdminI" alongside a download icon consistent with the AdminI design system
2. THE Custom_Install_Button SHALL use AdminI brand colors, typography, and border-radius values from the existing `@admini/ui` design tokens
3. WHEN the Custom_Install_Button is shown for the First_Appearance, THE Custom_Install_Button SHALL play a subtle entrance animation (slide-in or pulse) to attract user attention
4. WHEN the Custom_Install_Button is shown on subsequent appearances after the First_Appearance within the same session, THE Custom_Install_Button SHALL render without animation
5. WHEN the user hovers over or focuses the Custom_Install_Button, THE Custom_Install_Button SHALL display a visual hover/focus state that meets WCAG 2.1 AA contrast requirements

### Requirement 3: Dismissal Persistence

**User Story:** As a user, I want to dismiss the install prompt and not see it again for a reasonable period, so that I am not repeatedly interrupted.

#### Acceptance Criteria

1. THE Custom_Install_Button SHALL include a visible dismiss control (close icon or "Not now" action) separate from the install action
2. WHEN the user activates the dismiss control, THE Custom_Install_Button SHALL immediately hide and store a Dismissal_Record in localStorage with the current timestamp
3. WHILE a Dismissal_Record exists and fewer than 30 days have elapsed since the stored timestamp, THE Custom_Install_Button SHALL NOT render even if `isInstallable` is true
4. WHEN 30 days have elapsed since the Dismissal_Record timestamp and `isInstallable` is true, THE Custom_Install_Button SHALL render again as if no prior dismissal occurred
5. IF localStorage is unavailable or throws an error, THEN THE Custom_Install_Button SHALL fall back to session-only dismissal behavior without crashing

### Requirement 4: Responsive Placement

**User Story:** As a user, I want the install prompt to appear in a natural location for my device type, so that it feels integrated and not intrusive.

#### Acceptance Criteria

1. WHEN the viewport width exceeds the Breakpoint (768px), THE Custom_Install_Button SHALL render as the Install_Header_Action positioned within the app header or toolbar area
2. WHEN the viewport width is at or below the Breakpoint (768px), THE Custom_Install_Button SHALL render as the Install_Banner displayed as a card or banner element
3. WHEN the viewport is resized across the Breakpoint while the Custom_Install_Button is visible, THE Custom_Install_Button SHALL transition to the appropriate placement without unmounting or losing state
4. THE Install_Banner SHALL NOT overlap or obscure the primary navigation (bottom tab bar) on mobile
5. THE Install_Header_Action SHALL NOT displace existing toolbar actions; it SHALL occupy a designated slot that accommodates the button without layout shift

### Requirement 5: Accessibility

**User Story:** As a user with assistive technology, I want the install button to be fully accessible, so that I can discover, understand, and activate it without barriers.

#### Acceptance Criteria

1. THE Custom_Install_Button install action SHALL have an `aria-label` of "Install AdminI application" that conveys purpose to screen readers
2. THE dismiss control SHALL have an `aria-label` of "Dismiss install prompt" that conveys purpose to screen readers
3. THE Custom_Install_Button SHALL be keyboard navigable; both the install action and dismiss control SHALL be reachable via Tab and activatable via Enter or Space
4. THE Custom_Install_Button SHALL maintain a minimum color contrast ratio of 4.5:1 for text and 3:1 for interactive component boundaries against adjacent backgrounds, conforming to WCAG 2.1 AA
5. WHEN the Custom_Install_Button appears or is dismissed, THE Custom_Install_Button SHALL announce the state change to screen readers using an ARIA live region or focus management
6. THE Custom_Install_Button entrance animation SHALL respect the `prefers-reduced-motion: reduce` media query by disabling animation when the user has indicated a preference for reduced motion

### Requirement 6: Standalone Detection and Permanent Removal

**User Story:** As a user who has already installed AdminI, I want the install button to never appear again, so that I have a clean interface without redundant prompts.

#### Acceptance Criteria

1. WHEN the app detects Standalone_Mode via `window.matchMedia('(display-mode: standalone)')`, THE Custom_Install_Button SHALL NOT render
2. WHEN the display mode changes to standalone during a session (user installs mid-session), THE Custom_Install_Button SHALL immediately disappear without requiring a page reload
3. THE Custom_Install_Button SHALL consume the `isStandalone` value from `useInstallPrompt` to detect standalone state, rather than implementing independent standalone detection logic
4. WHILE in Standalone_Mode, THE Custom_Install_Button SHALL NOT read or evaluate the Dismissal_Record from localStorage, avoiding unnecessary storage operations
