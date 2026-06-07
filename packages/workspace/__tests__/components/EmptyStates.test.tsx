import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { configureClient, resetClient } from '../../src/services/getClient';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// REQ-6: Empty states show helpful guidance (not broken UI).
//         Loading states display while data fetches (no flash of empty content).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers - Mock Supabase client that returns empty data
// ---------------------------------------------------------------------------

function createEmptyTasksClient() {
  const returnsFn = vi.fn().mockResolvedValue({ data: [], error: null });
  const orderFn = vi.fn().mockReturnValue({ returns: returnsFn });
  const neqFn = vi.fn().mockReturnValue({ order: orderFn });
  const selectFn = vi.fn().mockReturnValue({ neq: neqFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });

  return { client: { from: fromFn } as unknown as SupabaseClient };
}

function createEmptyDashboardClient() {
  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'tasks') {
      return {
        select: vi.fn().mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count) {
            return {
              in: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({ count: 0, error: null }),
              }),
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
              }),
            };
          }
          return {
            neq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                returns: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }),
      };
    }
    if (table === 'sync_events') {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              returns: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
    }
    return { select: vi.fn().mockReturnValue({ neq: vi.fn() }) };
  });

  return { client: { from: fromFn } as unknown as SupabaseClient };
}

function createNeverResolvingClient() {
  const returnsFn = vi.fn().mockReturnValue(new Promise(() => {}));
  const orderFn = vi.fn().mockReturnValue({ returns: returnsFn });
  const neqFn = vi.fn().mockReturnValue({ order: orderFn });
  const selectFn = vi.fn().mockReturnValue({ neq: neqFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });

  return { client: { from: fromFn } as unknown as SupabaseClient };
}

function createNeverResolvingDashboardClient() {
  const fromFn = vi.fn().mockImplementation(() => {
    return {
      select: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            returns: vi.fn().mockReturnValue(new Promise(() => {})),
          }),
        }),
        in: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue(new Promise(() => {})),
        }),
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue(new Promise(() => {})),
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            returns: vi.fn().mockReturnValue(new Promise(() => {})),
          }),
        }),
      }),
    };
  });

  return { client: { from: fromFn } as unknown as SupabaseClient };
}

// ---------------------------------------------------------------------------
// 1. TasksTab Empty States
// ---------------------------------------------------------------------------

describe('TasksTab - empty state shows helpful guidance (REQ-6)', () => {
  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('shows "No tasks yet" title when task list is empty', async () => {
    const { client } = createEmptyTasksClient();
    configureClient(client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    expect(await findByText('No tasks yet')).toBeDefined();
  });

  it('shows guidance text explaining where tasks come from', async () => {
    const { client } = createEmptyTasksClient();
    configureClient(client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    expect(await findByText('Tasks you create or are assigned will appear here.')).toBeDefined();
  });

  it('empty state is contained in a dedicated element (not broken UI)', async () => {
    const { client } = createEmptyTasksClient();
    configureClient(client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { container, findByText } = render(createElement(TasksTab));

    await findByText('No tasks yet');

    const emptyState = container.querySelector('.tasks-tab__empty-state');
    expect(emptyState).not.toBeNull();
  });

  it('does not show error role element when list is empty', async () => {
    const { client } = createEmptyTasksClient();
    configureClient(client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { container, findByText } = render(createElement(TasksTab));

    await findByText('No tasks yet');

    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).toBeNull();
  });

  it('does not show loading skeleton after data loads empty', async () => {
    const { client } = createEmptyTasksClient();
    configureClient(client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { container, findByText } = render(createElement(TasksTab));

    await findByText('No tasks yet');

    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. DashboardTab Empty/Welcome State
// ---------------------------------------------------------------------------

describe('DashboardTab - empty state with appropriate messaging (REQ-6)', () => {
  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('shows "No open tasks" when priority queue is empty', async () => {
    const { client } = createEmptyDashboardClient();
    configureClient(client);

    const { DashboardTab } = await import('../../src/components/DashboardTab');
    const { findByText } = render(createElement(DashboardTab, { userName: 'Test User' }));

    expect(await findByText('No open tasks')).toBeDefined();
  });

  it('shows "No recent activity" when activity feed is empty', async () => {
    const { client } = createEmptyDashboardClient();
    configureClient(client);

    const { DashboardTab } = await import('../../src/components/DashboardTab');
    const { findByText } = render(createElement(DashboardTab, { userName: 'Test User' }));

    expect(await findByText('No recent activity')).toBeDefined();
  });

  it('shows greeting with user name even when data is empty', async () => {
    const { client } = createEmptyDashboardClient();
    configureClient(client);

    const { DashboardTab, getTimeGreeting } = await import('../../src/components/DashboardTab');
    const { findByText } = render(createElement(DashboardTab, { userName: 'Alice' }));

    const greeting = getTimeGreeting();
    expect(await findByText(new RegExp(greeting + ',\\s*Alice'))).toBeDefined();
  });

  it('does not show error state when data is simply empty', async () => {
    const { client } = createEmptyDashboardClient();
    configureClient(client);

    const { DashboardTab } = await import('../../src/components/DashboardTab');
    const { container, findByText } = render(createElement(DashboardTab, { userName: 'Test User' }));

    await findByText('No open tasks');

    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).toBeNull();
  });

  it('renders KPI cards with zero values (not broken UI)', async () => {
    const { client } = createEmptyDashboardClient();
    configureClient(client);

    const { DashboardTab } = await import('../../src/components/DashboardTab');
    const { findByText } = render(createElement(DashboardTab, { userName: 'Test User' }));

    expect(await findByText('Tasks')).toBeDefined();
    expect(await findByText('Completed')).toBeDefined();
    expect(await findByText('Overdue')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. CaptureTab Empty State
// ---------------------------------------------------------------------------

describe('CaptureTab - empty state guidance (REQ-6)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "No captures yet" in the recent captures section', async () => {
    const { CaptureTab } = await import('../../src/components/CaptureTab');
    const { findByText } = render(createElement(CaptureTab));

    expect(await findByText('No captures yet')).toBeDefined();
  });

  it('shows transcription placeholder guidance when not recording', async () => {
    const { CaptureTab } = await import('../../src/components/CaptureTab');
    const { findByText } = render(createElement(CaptureTab));

    expect(await findByText('Your transcription will appear here')).toBeDefined();
  });

  it('does not show broken UI or error elements in default state', async () => {
    const { CaptureTab } = await import('../../src/components/CaptureTab');
    const { container } = render(createElement(CaptureTab));

    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. PulseTab Empty State
// ---------------------------------------------------------------------------

describe('PulseTab - empty state guidance (REQ-6)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "No Pulse checkpoints yet" when timeline is empty', async () => {
    const { PulseTab } = await import('../../src/components/PulseTab');
    const { findByText } = render(createElement(PulseTab));

    expect(await findByText('No Pulse checkpoints yet')).toBeDefined();
  });

  it('shows helpful description about when checkpoints will appear', async () => {
    const { PulseTab } = await import('../../src/components/PulseTab');
    const { findByText } = render(createElement(PulseTab));

    expect(
      await findByText('Your scheduled pulse check-ins will appear here throughout the day.'),
    ).toBeDefined();
  });

  it('empty state is contained within a dedicated element (not broken UI)', async () => {
    const { PulseTab } = await import('../../src/components/PulseTab');
    const { container, findByText } = render(createElement(PulseTab));

    await findByText('No Pulse checkpoints yet');

    const emptyState = container.querySelector('.pulse-tab__empty-state');
    expect(emptyState).not.toBeNull();
  });

  it('does not show error elements in empty state', async () => {
    const { PulseTab } = await import('../../src/components/PulseTab');
    const { container } = render(createElement(PulseTab));

    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Loading States - No flash of empty content
// ---------------------------------------------------------------------------

describe('Loading states display while data fetches (REQ-6)', () => {
  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('TasksTab shows loading skeleton with aria-busy while data fetches', async () => {
    const { client } = createNeverResolvingClient();
    configureClient(client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { container } = render(createElement(TasksTab));

    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).not.toBeNull();
  });

  it('TasksTab does not show empty state text during loading', async () => {
    const { client } = createNeverResolvingClient();
    configureClient(client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { queryByText } = render(createElement(TasksTab));

    expect(queryByText('No tasks yet')).toBeNull();
  });

  it('DashboardTab shows loading skeleton with aria-busy while data fetches', async () => {
    const { client } = createNeverResolvingDashboardClient();
    configureClient(client);

    const { DashboardTab } = await import('../../src/components/DashboardTab');
    const { container } = render(createElement(DashboardTab, { userName: 'Tester' }));

    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).not.toBeNull();
  });

  it('DashboardTab does not show empty state text during loading', async () => {
    const { client } = createNeverResolvingDashboardClient();
    configureClient(client);

    const { DashboardTab } = await import('../../src/components/DashboardTab');
    const { queryByText } = render(createElement(DashboardTab, { userName: 'Tester' }));

    expect(queryByText('No open tasks')).toBeNull();
    expect(queryByText('No recent activity')).toBeNull();
  });

  it('CaptureTab shows loading skeleton when loading prop is true', async () => {
    const { CaptureTab } = await import('../../src/components/CaptureTab');
    const { container } = render(createElement(CaptureTab, { loading: true }));

    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).not.toBeNull();
  });

  it('CaptureTab does not show content during loading', async () => {
    const { CaptureTab } = await import('../../src/components/CaptureTab');
    const { queryByText } = render(createElement(CaptureTab, { loading: true }));

    expect(queryByText('Capture')).toBeNull();
    expect(queryByText('No captures yet')).toBeNull();
  });

  it('PulseTab shows loading skeleton when loading prop is true', async () => {
    const { PulseTab } = await import('../../src/components/PulseTab');
    const { container } = render(createElement(PulseTab, { loading: true }));

    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).not.toBeNull();
  });

  it('PulseTab does not show content during loading', async () => {
    const { PulseTab } = await import('../../src/components/PulseTab');
    const { queryByText } = render(createElement(PulseTab, { loading: true }));

    expect(queryByText("Today's Pulses")).toBeNull();
    expect(queryByText('No Pulse checkpoints yet')).toBeNull();
  });
});

