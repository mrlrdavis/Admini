# Technical Design: Native Workspace Migration

## Overview

This design migrates the Admini mobile workspace from a full-screen iframe prototype to a native React component tree. The Dashboard tab is converted first; unconverted tabs (Capture, Tasks, Pulse, More) continue rendering inside a hidden/shown iframe. A new Admin-only Organization Management tab is introduced. Reusable primitives live in `packages/ui`; app-specific workspace views live in `apps/mobile/src`.

**Tech stack**: React 18, Vite 5, TypeScript, Supabase (existing `@supabase/supabase-js ^2.45`), no router library.

---

## Architecture

### Component Tree

```
<App>
  +-- <AuthScreen />            (existing - unchanged)
  +-- <OnboardingWizard />      (existing - unchanged)
  +-- <WorkspaceShell>          (NEW - replaces ProtectedWorkspace iframe-only mode)
        +-- <ContentArea>
        |     +-- <DashboardTab />        (native - first conversion)
        |     +-- <AdminTab />            (native - new, role-gated)
        |     +-- <IframeFallback />      (hidden/shown for unconverted tabs)
        +-- <TabBar />                    (fixed bottom nav)
```

### Data Flow

```
+-------------------------------------------------------------+
|  WorkspaceShell (state: activeTab, user, profile)           |
|                                                             |
|  +---------+    props     +--------------+                  |
|  | TabBar  |<------------>| ContentArea  |                  |
|  +---------+  onTabChange |              |                  |
|                            |  DashboardTab|--> Supabase     |
|                            |  AdminTab   |--> Supabase     |
|                            |  IframeFallback--> postMessage |
|                            +--------------+                  |
+-------------------------------------------------------------+
```

- **State owner**: `WorkspaceShell` holds `activeTab` (component state via `useState`).
- **User/profile data**: passed down as props from `App` -> `WorkspaceShell` -> child tabs.
- **Supabase**: each tab fetches its own data using the existing singleton client in `supabase.ts`.
- **postMessage bridge**: `IframeFallback` manages the two-way bridge with the iframe content.

### Migration Strategy: Iframe Fallback Coexistence

```
WorkspaceShell
+-- DashboardTab          (rendered when activeTab === 'dashboard')
+-- AdminTab              (rendered when activeTab === 'admin' && role === 'admin')
+-- IframeFallback        (ALWAYS mounted, visibility toggled)
      +-- <iframe src="Mobile_index.html" style="display: none|block" />
```

**Key rules**:
1. The iframe is **never destroyed** - it stays in the DOM across all tab switches.
2. When `activeTab` is a native tab (`dashboard`, `admin`), the iframe gets `display: none`.
3. When `activeTab` is an unconverted tab (`capture`, `tasks`, `pulse`, `more`), the iframe gets `display: block` and receives a fresh `userPayload` postMessage.
4. Native tabs render conditionally (`activeTab === 'dashboard' && <DashboardTab />`).

**Future tab conversion path**: Create a new `XyzTab.tsx`, add conditional render in `WorkspaceShell`, remove the tab ID from the unconverted set. No changes to `IframeFallback` or `TabBar`.

---

## Components and Interfaces

### 1. LayoutShell (`packages/ui`)

Full-viewport wrapper with a content slot and a fixed-bottom slot for the tab bar.

```typescript
// packages/ui/src/LayoutShell.tsx
export interface LayoutShellProps {
  children: React.ReactNode;
  bottomBar: React.ReactNode;
}

export function LayoutShell({ children, bottomBar }: LayoutShellProps): JSX.Element;
```

CSS: `height: 100dvh; display: flex; flex-direction: column; overflow: hidden;`

### 2. TabBar (`packages/ui`)

Configurable bottom navigation bar. Renders tab items from a declarative config array.

```typescript
// packages/ui/src/TabBar.tsx
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): JSX.Element;
```

- Renders a `<nav>` with `role="tablist"`.
- Active item receives `aria-selected="true"` and a CSS class `.tab-item--active`.
- Fixed position at bottom, safe-area inset padding for mobile.

### 3. KPICard (`packages/ui`)

Displays a single metric with optional trend direction.

```typescript
// packages/ui/src/KPICard.tsx
export interface KPICardProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
}

export function KPICard({ label, value, trend }: KPICardProps): JSX.Element;
```

### 4. WorkspaceShell (`apps/mobile/src`)

Top-level workspace container replacing the current `ProtectedWorkspace` post-onboarding iframe mode.

```typescript
// apps/mobile/src/workspace/WorkspaceShell.tsx
import type { AuthUser } from '../supabase';

export type WorkspaceTab = 'capture' | 'dashboard' | 'tasks' | 'pulse' | 'more' | 'admin';

export interface WorkspaceShellProps {
  user: AuthUser;
  userRole: string;
  userName: string;
  schoolName: string;
  prototypePath: string;
  onSignOut: () => void;
  onResetUserData: () => void;
}
```

**State**:
```typescript
const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
```

**Role guard logic**:
```typescript
useEffect(() => {
  if (activeTab === 'admin' && userRole !== 'admin') {
    setActiveTab('dashboard');
  }
}, [activeTab, userRole]);
```

**Tab configuration builder**:
```typescript
const tabs: TabItem[] = useMemo(() => {
  const base: TabItem[] = [
    { id: 'capture', label: 'Capture' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'pulse', label: 'Pulse' },
    { id: 'more', label: 'More' },
  ];
  if (userRole === 'admin') {
    base.push({ id: 'admin', label: 'Admin' });
  }
  return base;
}, [userRole]);
```

### 5. DashboardTab (`apps/mobile/src`)

Native implementation of the Dashboard view.

```typescript
// apps/mobile/src/workspace/DashboardTab.tsx
export interface DashboardTabProps {
  userName: string;
}
```

**Internal state**:
```typescript
const [tasks, setTasks] = useState<PersistedTask[]>([]);
const [events, setEvents] = useState<ActivityEvent[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

**Sections**:
1. **Greeting**: `getTimeGreeting() + ', ' + userName`
2. **KPI Cards**: Rendered from computed metrics (open tasks count, completed this week, overdue count).
3. **Priority Queue**: `tasks.filter(t => t.status === 'open').sort(byUrgency)` - urgency sort: `urgent > high > normal > low`, ties broken by `dueAt` ascending.
4. **Activity Feed**: `events.sort((a, b) => b.createdAt - a.createdAt)` - reverse chronological.
5. **Pulse Countdown**: Computed from next scheduled pulse time.

**Data fetching**: calls `listTasks()` from existing `supabase.ts`. On error, shows inline error + retry button.

### 6. AdminTab (`apps/mobile/src`)

Organization management - school details, member list, invitations, permissions.

```typescript
// apps/mobile/src/workspace/AdminTab.tsx
export interface AdminTabProps {
  organizationId: string;
}
```

**Internal state per section**:
```typescript
const [schoolDetails, setSchoolDetails] = useState<OrgDetails | null>(null);
const [detailsForm, setDetailsForm] = useState<OrgDetailsForm>({});
const [saving, setSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);

const [members, setMembers] = useState<OrgMember[]>([]);
const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
const [inviteEmail, setInviteEmail] = useState('');
const [inviteRole, setInviteRole] = useState<AdminiRole>('staff');

const [permissions, setPermissions] = useState<AppPermission[]>([]);
```

### 7. IframeFallback (`apps/mobile/src`)

Manages the hidden/shown iframe for unconverted tabs.

```typescript
// apps/mobile/src/workspace/IframeFallback.tsx
export interface IframeFallbackProps {
  src: string;
  visible: boolean;
  userPayload: Record<string, unknown>;
  onSignOut: () => void;
  onResetUserData: () => void;
}
```

**Behavior**:
- Renders a single `<iframe>` that is never unmounted.
- `visible` controls `style={{ display: visible ? 'block' : 'none' }}`.
- On mount and when `visible` transitions to `true`, sends `userPayload` via `postMessage`.
- Listens for incoming messages: `request-signout`, `reset-user-data`, `tasks:list`, `tasks:create`, `tasks:update-status`.

---

## Data Models

### TypeScript Interfaces

```typescript
// apps/mobile/src/workspace/types.ts

export type AdminiRole = 'admin' | 'principal' | 'teacher' | 'staff';

export interface OrgDetails {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface OrgDetailsForm {
  name?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface OrgMember {
  profileId: string;
  email: string;
  displayName: string;
  role: AdminiRole;
  joinedAt: string;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: AdminiRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface AppPermission {
  id: string;
  permissionKey: string;
  enabled: boolean;
}

export interface ActivityEvent {
  id: string;
  entityType: string;
  action: string;
  createdAt: string;
}
```

### Supabase Schema

The existing migration (`20260530180500_admini_core_schema.sql`) already provides:

| Admin Tab Feature | Existing Table | Key Columns |
|---|---|---|
| School details | `organizations` | `id`, `name`, `slug`, `created_at` |
| Member list + roles | `organization_memberships` | `organization_id`, `profile_id`, `role` |
| Invitations | `invitations` | `organization_id`, `email`, `role`, `status` |

#### New Table: `organization_permissions`

```sql
-- supabase/migrations/YYYYMMDD_org_permissions.sql

create table public.organization_permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  permission_key text not null,
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, permission_key)
);

create index org_permissions_org_idx
  on public.organization_permissions (organization_id);

create trigger org_permissions_set_updated_at
  before update on public.organization_permissions
  for each row execute function public.set_updated_at();

alter table public.organization_permissions enable row level security;

create policy "members can read org permissions"
  on public.organization_permissions for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "admins can manage org permissions"
  on public.organization_permissions for all
  to authenticated
  using (public.org_role(organization_id) = 'admin')
  with check (public.org_role(organization_id) = 'admin');

grant select, insert, update, delete
  on public.organization_permissions to authenticated;
```

#### Extended `organizations` Columns

```sql
-- supabase/migrations/YYYYMMDD_org_details_columns.sql

alter table public.organizations
  add column address text,
  add column contact_email text,
  add column contact_phone text;
```

### State Management Summary

| Concern | Strategy |
|---------|----------|
| Active tab | `useState<WorkspaceTab>` in `WorkspaceShell` |
| User/profile data | Props drilled from `App` |
| Dashboard tasks | Local `useState` + `useEffect` fetch in `DashboardTab` |
| Admin tab data | Local `useState` per section in `AdminTab` |
| Iframe communication | `useEffect` for message listener in `IframeFallback` |
| Loading/error states | Co-located `useState` in each tab component |

No global state library. Each tab owns its async state. The shell manages which tab is active and passes identity props.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Dashboard data fetch fails | Inline error banner + "Retry" button; component does not crash |
| Admin tab write fails (network) | Error message with reason; form state preserved; submit re-enabled |
| Admin tab write fails (403/auth) | "Insufficient permissions" message; no automatic retry |
| Iframe postMessage timeout | No-op; iframe manages its own error states internally |

---

## File Structure

```
packages/ui/src/
  index.ts                 (re-exports all primitives)
  LayoutShell.tsx
  TabBar.tsx
  KPICard.tsx
  styles.css               (existing, extended)

apps/mobile/src/
  App.tsx                  (modified: renders WorkspaceShell post-onboarding)
  main.tsx                 (unchanged)
  supabase.ts              (extended: org queries)
  styles.css               (extended)
  workspace/
    WorkspaceShell.tsx
    DashboardTab.tsx
    AdminTab.tsx
    IframeFallback.tsx
    types.ts
    useOrgData.ts          (hook: fetches org details, members, invitations, permissions)

supabase/migrations/
  YYYYMMDD_org_details_columns.sql
  YYYYMMDD_org_permissions.sql
```

---

## Testing Strategy

- **Unit tests**: Example-based tests for specific render outputs (onboarding -> shell renders, error messages, tab item lists).
- **Property tests**: Universal properties validated across generated inputs (sort orders, role gating, iframe visibility invariant, form-state preservation on error).
- **Integration tests**: Supabase CRUD operations with mocked client for Admin tab data flows.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system - essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Admin tab visibility is role-gated

*For any* user object, the Admin tab item appears in the TabBar's rendered output if and only if `user.role === 'admin'`.

**Validates: Requirements 2.3, 5.1, 5.2**

### Property 2: Tab selection renders corresponding content

*For any* valid tab identifier and any user state, setting `activeTab` to that identifier causes the WorkspaceShell to render the content component associated with that tab and no other tab's content component.

**Validates: Requirements 2.4**

### Property 3: Non-admin forced redirect from admin tab

*For any* user whose role is not `'admin'`, if `activeTab` is set to `'admin'`, the WorkspaceShell SHALL reset `activeTab` to `'dashboard'` and not render AdminTab content.

**Validates: Requirements 5.3**

### Property 4: Time-based greeting includes user name

*For any* display name string and any hour of the day (0-23), the greeting output contains both a time-appropriate prefix ("Good morning" | "Good afternoon" | "Good evening") and the provided display name.

**Validates: Requirements 3.1**

### Property 5: Priority queue sorted by urgency

*For any* list of open tasks, the priority queue renders them in descending urgency order (urgent > high > normal > low), with ties broken by ascending due date.

**Validates: Requirements 3.3**

### Property 6: Activity feed in reverse chronological order

*For any* list of activity events, the activity feed renders them sorted by `createdAt` descending (most recent first).

**Validates: Requirements 3.4**

### Property 7: Iframe visibility invariant

*For any* sequence of tab switches, the iframe element is visible (`display: block`) if and only if the current `activeTab` is an unconverted tab (`capture` | `tasks` | `pulse` | `more`). The iframe element is never removed from the DOM.

**Validates: Requirements 4.1, 4.4, 4.5**

### Property 8: postMessage dispatch correctness

*For any* incoming postMessage event whose `type` is in the set `{'request-signout', 'reset-user-data', 'tasks:list', 'tasks:create', 'tasks:update-status'}`, the IframeFallback SHALL invoke the corresponding action handler exactly once.

**Validates: Requirements 4.3**

### Property 9: Error state preserves form data

*For any* Admin tab form (school details, invitation, role change, permission toggle), if the Supabase write operation returns an error, the form fields SHALL retain their pre-submission values and the error message SHALL be non-empty.

**Validates: Requirements 6.3**

### Property 10: Member list completeness

*For any* array of organization members returned by Supabase, the AdminTab member list SHALL render exactly one entry per member, each displaying the member's display name, email, and role.

**Validates: Requirements 6.6**

### Property 11: Permission toggles completeness

*For any* array of organization permissions returned by Supabase, the AdminTab permission list SHALL render exactly one toggle per permission, each reflecting the current `enabled` state.

**Validates: Requirements 6.8**

### Property 12: KPICard renders all provided data

*For any* `label` (non-empty string), `value` (string or number), and optional `trend` ('up' | 'down' | 'neutral'), the KPICard component's rendered output contains the label text and the string representation of the value.

**Validates: Requirements 7.3**

### Property 13: Loading state disables submission

*For any* Admin tab write operation that is in-flight (pending promise), the submit button associated with that operation SHALL be `disabled` and a loading indicator SHALL be present in the rendered output.

**Validates: Requirements 8.5**
