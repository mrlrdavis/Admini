# Design Document: UI Uplift Optimization

## Overview

This feature transforms the `packages/ui` design system from a purple/violet palette to a sage/limestone palette, adds CSS-only visual polish (transitions, skeleton loading), introduces a platform-adaptive `LayoutShell` that switches between bottom-tab (mobile) and sidebar (desktop) navigation, and integrates the Tomorrow display typeface. All changes live in `packages/ui` as the single source of truth consumed by both `apps/mobile` and `apps/desktop`.

## Architecture

Both `apps/mobile` and `apps/desktop` consume `packages/ui` via the existing `@admini/ui` alias. The `packages/workspace` layer consumes `LayoutShell` and `Skeleton` components from `@admini/ui`.

```
+-----------------------------------------------------+
|  apps/mobile  |  apps/desktop                       |
|  (Vite + React)                                     |
+-----------------------------------------------------+
|  packages/workspace                                 |
|  WorkspaceShell - Tabs - Services                   |
+-----------------------------------------------------+
|  packages/ui  (this feature)                        |
|  Token_System - LayoutShell - TabBar - Skeleton     |
|  KPICard - Typography - Transitions                 |
+-----------------------------------------------------+
```

### Key Design Decisions

- **ResizeObserver** for layout detection (not media queries) allows container-based adaptation independent of viewport.
- **CSS-only animations** with no runtime animation libraries; transitions and keyframes only.
- **React.lazy + Suspense** for tab lazy-loading with minimal bundle overhead per tab.
- **Render-prop pattern** for navigation lets consumers provide platform-specific navigation UI while LayoutShell manages layout structure.

## Components and Interfaces

### 1. Token System (`packages/ui/src/styles.css`)

The CSS custom properties file is the foundational layer. It defines:

- **Color tokens**: Sage/limestone palette replacing purple/violet
- **Spacing tokens**: `--space-xs` through `--space-xl`
- **Radius tokens**: `--radius-sm`, `--radius-md`, `--radius-card`, `--radius-pill`
- **Transition tokens**: `--transition-fast` (150ms), `--transition-normal` (250ms)
- **Typography tokens**: `--font-display`, `--font-body`, font-weight scale
- **Shadow token**: `--shadow-soft`

Light mode is the `:root` default. Dark mode is scoped under `[data-theme='dark']`.

### 2. LayoutShell (`packages/ui/src/LayoutShell.tsx`)

The LayoutShell evolves from a simple column layout to a platform-adaptive container.

**Mode detection:**
- `mode="auto"` uses ResizeObserver on the shell element to toggle between mobile (width <=768px) and desktop (width >768px).
- `mode="mobile"` forces bottom-tab bar layout.
- `mode="desktop"` forces sidebar layout.

**Layout rendering:**
- Mobile: vertical flex column with content area + fixed bottom nav.
- Desktop: horizontal flex row with sidebar nav (220-280px) + content area.

**Lazy loading and loading states:**
- Tabs are lazy-loaded via `React.lazy()` + `Suspense`.
- A `fallback` renders `Skeleton` components matching expected content structure.
- On fetch failure, an error boundary catches and shows an error state with retry.

#### LayoutShell Props

```typescript
export type LayoutMode = 'mobile' | 'desktop';

export interface LayoutShellProps {
  mode?: 'auto' | 'mobile' | 'desktop';
  children: ReactNode;
  renderNavigation: (props: {
    layoutMode: LayoutMode;
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
  }) => ReactNode;
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  loading?: boolean;
}
```
#### Implementation Strategy

```typescript
function LayoutShell({ mode = 'auto', children, renderNavigation, tabs, activeTab, onTabChange, loading }: LayoutShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('mobile');

  useEffect(() => {
    if (mode !== 'auto') {
      setLayoutMode(mode === 'mobile' ? 'mobile' : 'desktop');
      return;
    }
    const el = shellRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setLayoutMode(width > 768 ? 'desktop' : 'mobile');
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);

  const navElement = renderNavigation({ layoutMode, tabs, activeTab, onTabChange });

  return (
    <div ref={shellRef} className={`layout-shell layout-shell--${layoutMode}`}>
      {layoutMode === 'desktop' && <aside className="layout-shell__sidebar">{navElement}</aside>}
      <main className="layout-shell__content">
        {loading ? <SkeletonContent /> : children}
      </main>
      {layoutMode === 'mobile' && <nav className="layout-shell__bottom-bar">{navElement}</nav>}
    </div>
  );
}
```

### 3. Skeleton / SkeletonCard (`packages/ui/src/Skeleton.tsx`)

Lightweight placeholder components for perceived performance.

- `Skeleton`: renders a `<div>` with `width`/`height` from props, applying a CSS pulse animation.
- `SkeletonCard`: wraps `Skeleton` with `border-radius: var(--radius-card)` and card-like proportions.

#### Skeleton Props

```typescript
export interface SkeletonProps {
  width: string | number;
  height: string | number;
  className?: string;
  borderRadius?: string;
}

export interface SkeletonCardProps {
  className?: string;
  height?: string | number;
}
```

### 4. TabBar (`packages/ui/src/TabBar.tsx`)

Existing TabBar enhanced with:
- Transition on `color` and `transform` (icon scale) using `--transition-fast`.
- No API changes, same `TabBarProps` interface.

#### TabItem (unchanged)

```typescript
export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}
```

### 5. Typography

- `@font-face` declaration for Tomorrow (weight 400-700, `font-display: swap`).
- `--font-display` applied to `h1` through `h4` and `.display-text`.
- `--font-body` applied to `body` and form controls.

---

## Data Models

No persistent data models are introduced. All state is ephemeral UI state:

| State | Type | Location | Purpose |
|-------|------|----------|---------|
| layoutMode | 'mobile' or 'desktop' | LayoutShell (internal) | Tracks current layout from ResizeObserver |
| activeTab | string | Consumer (WorkspaceShell) | Currently selected tab |
| loading | boolean | Consumer | Whether tab content is loading |
| renderedTabs | Set of string | LayoutShell (internal) | Tracks which tabs have been rendered for lazy-load |
---

## Token System Color Palette

### Light Mode (`:root`)

| Token | Value | Purpose |
|-------|-------|---------|
| --color-sage | #87a878 | Primary sage green |
| --color-sage-deep | #54745c | Deep sage for emphasis |
| --color-sage-soft | #b5ccab | Soft sage for backgrounds |
| --color-limestone | #c8c2b4 | Neutral warm stone |
| --color-limestone-light | #e8e4dc | Light limestone for surfaces |
| --color-bg | #f9f8f6 | Page background |
| --color-surface | #ffffff | Card/panel surface |
| --color-surface-muted | #f3f1ec | Muted surface |
| --color-text | #2c3e2d | Primary text |
| --color-text-muted | #5a6b5c | Secondary text |
| --color-text-faint | #8a9a8c | Tertiary/hint text |
| --color-border | #d4d0c8 | Border color |
| --color-primary | #87a878 | Primary action color (sage) |
| --color-primary-strong | #54745c | Strong primary |
| --color-success | #10b981 | Success state |
| --color-warning | #f59e0b | Warning state |
| --color-danger | #ef4444 | Danger state |
| --shadow-soft | 0 12px 32px rgba(44, 62, 45, 0.08) | Soft elevation |

### Dark Mode (`[data-theme='dark']`)

| Token | Value |
|-------|-------|
| --color-sage | #9fbf91 |
| --color-sage-deep | #6a9b72 |
| --color-sage-soft | #3d5a40 |
| --color-limestone | #7a7568 |
| --color-limestone-light | #4a4640 |
| --color-bg | #1a1e1a |
| --color-surface | #252a25 |
| --color-surface-muted | #2f352f |
| --color-text | #e4ebe5 |
| --color-text-muted | #a3b3a5 |
| --color-text-faint | #5f6f61 |
| --color-border | #3d4a3e |
| --color-primary | #9fbf91 |
| --color-primary-strong | #b5d4a8 |
| --color-success | #34d399 |
| --color-warning | #fbbf24 |
| --color-danger | #f87171 |
| --shadow-soft | 0 14px 36px rgba(0, 0, 0, 0.3) |

---

## Spacing and Radius Tokens

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-card: 12px;
  --radius-pill: 9999px;
}
```

---

## Transition System

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}

.admini-button {
  transition: background-color var(--transition-fast),
              border-color var(--transition-fast),
              color var(--transition-fast),
              transform var(--transition-fast);
}

.admini-card {
  transition: box-shadow var(--transition-normal),
              border-color var(--transition-normal),
              transform var(--transition-normal);
}

.tab-item {
  transition: color var(--transition-fast),
              transform var(--transition-fast);
}

.tab-item__icon {
  transition: transform var(--transition-fast);
}

.tab-item--active .tab-item__icon {
  transform: scale(1.1);
}

.layout-shell__content {
  transition: opacity var(--transition-normal),
              transform var(--transition-normal);
}
```
---

## Skeleton Animation

```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1.0; }
}

.skeleton {
  background: var(--color-surface-muted);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-card {
  border-radius: var(--radius-card);
}
```

---

## LayoutShell CSS Layout Modes

```css
.layout-shell--mobile {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.layout-shell--mobile .layout-shell__bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  transition: transform var(--transition-normal);
}

.layout-shell--desktop {
  display: flex;
  flex-direction: row;
  height: 100dvh;
}

.layout-shell--desktop .layout-shell__sidebar {
  min-width: 220px;
  max-width: 280px;
  transition: width var(--transition-normal), opacity var(--transition-normal);
}
```

---

## Typography Integration

```css
@font-face {
  font-family: 'Tomorrow';
  src: url('/fonts/Tomorrow-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'Tomorrow';
  src: url('/fonts/Tomorrow-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
}

@font-face {
  font-family: 'Tomorrow';
  src: url('/fonts/Tomorrow-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-display: swap;
}

@font-face {
  font-family: 'Tomorrow';
  src: url('/fonts/Tomorrow-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

:root {
  --font-display: 'Tomorrow', system-ui, -apple-system, sans-serif;
  --font-body: 'Avenir Next', Nunito, Quicksand, Inter, ui-sans-serif, system-ui, sans-serif;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}

body {
  font-family: var(--font-body);
}

h1, h2, h3, h4, .display-text {
  font-family: var(--font-display);
}

button, input, textarea, select {
  font-family: var(--font-body);
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Font load failure | font-display: swap ensures system-ui renders immediately; no layout shift |
| Tab lazy-load failure | Error boundary catches, renders error state with retry button |
| ResizeObserver unavailable | Falls back to mode="mobile" (safe default) |
| Invalid mode prop | TypeScript enforces at compile time; runtime defaults to "auto" |
| Skeleton with 0/negative dimensions | Renders as hidden (min-width/min-height: 0) |

---

## File Structure (New/Modified)

```
packages/ui/src/
  styles.css           (MODIFIED: tokens, transitions, skeleton animation, typography, layout modes)
  LayoutShell.tsx      (MODIFIED: platform-adaptive with mode prop, ResizeObserver, lazy-load)
  Skeleton.tsx         (NEW: Skeleton + SkeletonCard components)
  TabBar.tsx           (MODIFIED: transition classes added)
  index.ts            (MODIFIED: export Skeleton, SkeletonCard, LayoutMode)
```
---

## Testing Strategy

- **Property-based tests**: Token completeness, dark mode parity, skeleton dimension fidelity, layout mode detection, and renderNavigation contract are tested with generated inputs using vitest + fast-check.
- **Example-based unit tests**: Specific token values (primary colors), transition declarations, skeleton keyframe values, font-face swap behavior.
- **Integration tests**: CSS cascade override behavior (token import order), full WorkspaceShell rendering with LayoutShell.
- **Smoke tests**: No animation library dependencies in package.json.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system, essentially a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token Set Completeness

For any token name in the required set (color tokens: --color-sage, --color-sage-deep, --color-sage-soft, --color-limestone, --color-limestone-light, --color-bg, --color-surface, --color-surface-muted, --color-text, --color-text-muted, --color-text-faint, --color-border, --color-primary, --color-primary-strong, --color-success, --color-warning, --color-danger, --shadow-soft; spacing: --space-xs, --space-sm, --space-md, --space-lg, --space-xl; radius: --radius-sm, --radius-md, --radius-card, --radius-pill), the styles.css :root block SHALL contain a declaration for that token.

**Validates: Requirements 1.1, 1.6**

### Property 2: Dark Mode Parity

For any color token defined in the :root block of styles.css, a corresponding declaration with the same custom property name SHALL exist in the [data-theme='dark'] selector block.

**Validates: Requirements 1.3**

### Property 3: Purple/Violet Absence

For any of the legacy purple/violet hex values (#7c3aed, #5b21b6, #a78bfa, #ddd6fe, #f5f3ff, #241e36), the value SHALL NOT appear anywhere in the packages/ui/src/styles.css file.

**Validates: Requirements 1.5**

### Property 4: Skeleton Dimension Fidelity

For any valid width and height values passed as props to the Skeleton component, the rendered element's inline style SHALL contain matching width and height values.

**Validates: Requirements 3.1**

### Property 5: Loading State Skeleton Display

For any tab in a loading state (either initial lazy-load or data fetch in progress), the LayoutShell SHALL render Skeleton placeholder elements in the content area rather than the tab's actual content.

**Validates: Requirements 3.3, 3.4**

### Property 6: Error State on Fetch Failure

For any tab whose data fetch fails after displaying a Skeleton placeholder, the UI SHALL replace the skeleton with an error state component that includes a retry action element.

**Validates: Requirements 3.6**

### Property 7: Auto-Mode Layout Detection

For any container width value when mode="auto", the LayoutShell SHALL render in mobile layout mode (bottom-tab bar) when width is 768px or less and in desktop layout mode (sidebar) when width exceeds 768px.

**Validates: Requirements 4.2**

### Property 8: renderNavigation Contract

For any combination of layout state (layoutMode, tabs, activeTab, onTabChange), the renderNavigation render-prop SHALL be invoked with an object containing all four properties matching the current LayoutShell state.

**Validates: Requirements 4.6**

### Property 9: Content Invariance Across Layout Modes

For any children content passed to LayoutShell, the content area SHALL render the children identically regardless of whether the current layout mode is mobile or desktop.

**Validates: Requirements 4.7**

### Property 10: Display Font Heading Application

For any heading element (h1 through h4) or element with class .display-text rendered within the UI package scope, the computed font-family SHALL resolve to the --font-display token value.

**Validates: Requirements 5.3**