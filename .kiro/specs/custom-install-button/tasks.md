# Implementation Plan: Custom Install Button

## Overview

Implement a custom branded PWA install button that adapts between desktop and mobile, supports dismissal with 30-day cooldown, animates on first appearance, and hides in standalone mode.

## Tasks

- [ ] 1. Create CustomInstallButton component
  - [ ] 1.1 Create component file at apps/web/src/components/CustomInstallButton.tsx
    - Import useInstallPrompt from @admini/pwa
    - Implement visibility logic (isInstallable AND not dismissed AND not standalone)
    - Render install action button with "Install AdminI" text and download icon
    - Render dismiss button with "Not now" text
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

  - [ ] 1.2 Implement dismissal persistence with localStorage
    - Store dismissal timestamp in localStorage key 'admini_install_dismissed'
    - Check 30-day cooldown on mount
    - Fall back to session-only dismissal if localStorage unavailable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 1.3 Implement responsive placement logic
    - Use viewport width check (768px breakpoint)
    - Desktop: render as inline header action
    - Mobile: render as fixed banner card
    - Handle resize transitions without unmounting
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 2. Add entrance animation and styling
  - [ ] 2.1 Create CSS styles using AdminI design tokens
    - Use brand colors, typography, border-radius from @admini/ui
    - Desktop: compact inline button style
    - Mobile: card/banner style with shadow
    - _Requirements: 2.1, 2.2_

  - [ ] 2.2 Implement entrance animation with reduced-motion support
    - Slide-in animation on first appearance
    - No animation on subsequent appearances in same session
    - Disable animation when prefers-reduced-motion: reduce
    - _Requirements: 2.3, 2.4, 5.6_

- [ ] 3. Add accessibility features
  - [ ] 3.1 Add ARIA labels and keyboard navigation
    - aria-label="Install AdminI application" on install button
    - aria-label="Dismiss install prompt" on dismiss button
    - Ensure Tab/Enter/Space keyboard access
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 3.2 Add ARIA live region for state changes
    - Announce appearance and dismissal to screen readers
    - Ensure WCAG 2.1 AA contrast (4.5:1 text, 3:1 borders)
    - _Requirements: 5.4, 5.5_

- [ ] 4. Integrate into app layout
  - [ ] 4.1 Replace existing InstallButton usage in UnifiedWorkspace
    - Remove or replace the current <InstallButton /> from @admini/pwa
    - Render CustomInstallButton in the appropriate position
    - _Requirements: 1.4, 6.1, 6.2, 6.3_

- [ ] 5. Standalone detection and cleanup
  - [ ] 5.1 Consume isStandalone from useInstallPrompt
    - Use isStandalone to completely prevent rendering
    - Listen for display-mode changes mid-session
    - Skip localStorage reads when in standalone
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 6. Final verification
  - Verify build passes
  - Test desktop and mobile placement
  - Test dismissal persistence
  - Test standalone mode hiding

## Notes

- The @admini/pwa package is NOT modified; only its exported useInstallPrompt hook is consumed
- The existing InstallButton component from @admini/pwa remains available for other apps
- CSS uses existing design tokens so theme changes (light/dark) work automatically
- The 768px breakpoint matches the existing LayoutShell responsive logic

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["6"] }
  ]
}
```