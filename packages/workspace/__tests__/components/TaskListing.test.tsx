import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import { createElement } from 'react';
import { IframeFallback, type IframeFallbackProps } from '../../src/components/IframeFallback';
import { configureClient, resetClient } from '../../src/services/getClient';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// REQ-6: Task list loads from Supabase
// ---------------------------------------------------------------------------

// Sample task rows returned from Supabase
const sampleTasks = [
  {
    id: 'task-1',
    organization_id: 'org-1',
    created_by: 'user-1',
    title: 'Staff meeting prep',
    description: 'Prepare agenda for Monday',
    priority: 'high',
    status: 'open',
    due_at: '2024-06-20T00:00:00Z',
    created_at: '2024-06-10T12:00:00Z',
    updated_at: '2024-06-10T12:00:00Z',
  },
  {
    id: 'task-2',
    organization_id: 'org-1',
    created_by: 'user-1',
    title: 'Grade homework',
    description: null,
    priority: 'normal',
    status: 'in_progress',
    due_at: null,
    created_at: '2024-06-09T08:00:00Z',
    updated_at: '2024-06-11T09:00:00Z',
  },
  {
    id: 'task-3',
    organization_id: 'org-1',
    created_by: 'user-2',
    title: 'Order supplies',
    description: 'Whiteboard markers and paper',
    priority: 'low',
    status: 'completed',
    due_at: '2024-06-15T00:00:00Z',
    created_at: '2024-06-08T14:00:00Z',
    updated_at: '2024-06-12T10:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createListMockClient(opts?: {
  listData?: unknown[];
  listError?: { message: string; code?: string } | null;
}) {
  const orderFn = vi.fn().mockResolvedValue({
    data: opts?.listData ?? sampleTasks,
    error: opts?.listError ?? null,
  });
  const neqFn = vi.fn().mockReturnValue({ order: orderFn });
  const selectFn = vi.fn().mockReturnValue({ neq: neqFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });

  return {
    client: { from: fromFn } as unknown as SupabaseClient,
    fromFn,
    selectFn,
    neqFn,
    orderFn,
  };
}

function createDashboardMockClient(opts?: {
  listData?: unknown[];
  listError?: { message: string; code?: string } | null;
}) {
  const returnsFn = vi.fn().mockResolvedValue({
    data: opts?.listData ?? sampleTasks,
    error: opts?.listError ?? null,
  });
  const orderFn = vi.fn().mockReturnValue({ returns: returnsFn });
  const neqFn = vi.fn().mockReturnValue({ order: orderFn });
  const selectFn = vi.fn().mockReturnValue({ neq: neqFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });

  return {
    client: { from: fromFn } as unknown as SupabaseClient,
    fromFn,
    selectFn,
    neqFn,
    orderFn,
    returnsFn,
  };
}

function defaultProps(overrides?: Partial<IframeFallbackProps>): IframeFallbackProps {
  return {
    src: 'https://example.com',
    visible: true,
    userPayload: { userId: 'user-1', name: 'Tester' },
    onSignOut: vi.fn(),
    onResetUserData: vi.fn(),
    ...overrides,
  };
}

async function sendMessage(data: unknown) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { data }));
    await new Promise((r) => setTimeout(r, 0));
  });
}

// ---------------------------------------------------------------------------
// 1. listTasks function queries Supabase correctly
// ---------------------------------------------------------------------------

describe('listTasks - Supabase query shape (REQ-6)', () => {
  let mocks: ReturnType<typeof createListMockClient>;

  beforeEach(() => {
    mocks = createListMockClient();
    configureClient(mocks.client);
  });

  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('queries the "tasks" table', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({ type: 'tasks:list', requestId: 'list-q-1' });

    expect(mocks.fromFn).toHaveBeenCalledWith('tasks');
  });

  it('selects all columns with select("*")', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({ type: 'tasks:list', requestId: 'list-q-2' });

    expect(mocks.selectFn).toHaveBeenCalledWith('*');
  });

  it('filters out archived tasks with .neq("status", "archived")', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({ type: 'tasks:list', requestId: 'list-q-3' });

    expect(mocks.neqFn).toHaveBeenCalledWith('status', 'archived');
  });

  it('orders by created_at descending', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({ type: 'tasks:list', requestId: 'list-q-4' });

    expect(mocks.orderFn).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

// ---------------------------------------------------------------------------
// 2. postMessage bridge handles tasks:list messages
// ---------------------------------------------------------------------------

describe('postMessage bridge - tasks:list handling (REQ-6)', () => {
  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('responds with tasks:list:result containing the task array on success', async () => {
    const mocks = createListMockClient({ listData: sampleTasks });
    configureClient(mocks.client);

    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({ type: 'tasks:list', requestId: 'list-bridge-1' });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:list:result',
        requestId: 'list-bridge-1',
        ok: true,
        tasks: sampleTasks,
      }),
      '*',
    );
  });

  it('preserves requestId for client-side correlation', async () => {
    const mocks = createListMockClient();
    configureClient(mocks.client);

    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({ type: 'tasks:list', requestId: 'custom-correlation-id' });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:list:result',
        requestId: 'custom-correlation-id',
      }),
      '*',
    );
  });

  it('returns ok:false with error message when Supabase query fails', async () => {
    const mocks = createListMockClient();
    mocks.orderFn.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table tasks' },
    });
    configureClient(mocks.client);

    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({ type: 'tasks:list', requestId: 'list-err-1' });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:list:result',
        requestId: 'list-err-1',
        ok: false,
        error: 'permission denied for table tasks',
      }),
      '*',
    );
  });

  it('returns an empty tasks array when no non-archived tasks exist', async () => {
    const mocks = createListMockClient();
    mocks.orderFn.mockResolvedValue({ data: [], error: null });
    configureClient(mocks.client);

    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({ type: 'tasks:list', requestId: 'list-empty-1' });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:list:result',
        requestId: 'list-empty-1',
        ok: true,
        tasks: [],
      }),
      '*',
    );
  });

  it('handles JSON string format messages for tasks:list', async () => {
    const mocks = createListMockClient();
    configureClient(mocks.client);

    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage(JSON.stringify({ type: 'tasks:list', requestId: 'json-list-1' }));

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:list:result',
        requestId: 'json-list-1',
        ok: true,
      }),
      '*',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. TasksTab displays loaded tasks correctly
// ---------------------------------------------------------------------------

describe('TasksTab - task list rendering (REQ-6)', () => {
  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('renders multiple tasks with their titles', async () => {
    const mocks = createDashboardMockClient({ listData: sampleTasks });
    configureClient(mocks.client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    expect(await findByText('Staff meeting prep')).toBeDefined();
    expect(await findByText('Grade homework')).toBeDefined();
    expect(await findByText('Order supplies')).toBeDefined();
  });

  it('renders task priority indicators', async () => {
    const mocks = createDashboardMockClient({ listData: sampleTasks });
    configureClient(mocks.client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    // Priority pills should show the priority text
    expect(await findByText('high')).toBeDefined();
    expect(await findByText('normal')).toBeDefined();
    expect(await findByText('low')).toBeDefined();
  });

  it('renders task status labels', async () => {
    const mocks = createDashboardMockClient({ listData: sampleTasks });
    configureClient(mocks.client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    expect(await findByText('open')).toBeDefined();
    expect(await findByText('in progress')).toBeDefined();
    expect(await findByText('completed')).toBeDefined();
  });

  it('renders due dates for tasks that have them', async () => {
    const mocks = createDashboardMockClient({ listData: sampleTasks });
    configureClient(mocks.client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { container, findByText } = render(createElement(TasksTab));

    // Wait for loading to finish
    await findByText('Staff meeting prep');

    // Tasks with due_at should show a due date element
    const dueDateElements = container.querySelectorAll('.tasks-tab__due-date');
    expect(dueDateElements.length).toBeGreaterThan(0);
  });

  it('shows loading skeleton state initially', async () => {
    // Use a never-resolving promise to keep the component in loading state
    const returnsFn = vi.fn().mockReturnValue(new Promise(() => {}));
    const orderFn = vi.fn().mockReturnValue({ returns: returnsFn });
    const neqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ neq: neqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    const loadingClient = { from: fromFn } as unknown as SupabaseClient;
    configureClient(loadingClient);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { container } = render(createElement(TasksTab));

    // Should show loading state with aria-busy
    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Error handling when listing fails
// ---------------------------------------------------------------------------

describe('TasksTab - error handling on list failure (REQ-6)', () => {
  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('displays the error message from Supabase', async () => {
    const mocks = createDashboardMockClient();
    mocks.returnsFn.mockResolvedValue({
      data: null,
      error: { message: 'Could not connect to database', code: 'CONNECTION_ERROR' },
    });
    configureClient(mocks.client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    expect(await findByText('Could not connect to database')).toBeDefined();
  });

  it('shows error in an alert role element', async () => {
    const mocks = createDashboardMockClient();
    mocks.returnsFn.mockResolvedValue({
      data: null,
      error: { message: 'Server error', code: '500' },
    });
    configureClient(mocks.client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { container, findByText } = render(createElement(TasksTab));

    await findByText('Server error');
    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
  });

  it('provides a Retry button on error', async () => {
    const mocks = createDashboardMockClient();
    mocks.returnsFn.mockResolvedValue({
      data: null,
      error: { message: 'Timeout', code: 'TIMEOUT' },
    });
    configureClient(mocks.client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    const retryBtn = await findByText('Retry');
    expect(retryBtn).toBeDefined();
    expect(retryBtn.tagName.toLowerCase()).toBe('button');
  });

  it('handles RLS policy violation errors gracefully', async () => {
    const mocks = createDashboardMockClient();
    mocks.returnsFn.mockResolvedValue({
      data: null,
      error: { message: 'new row violates row-level security policy', code: '42501' },
    });
    configureClient(mocks.client);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    // Should display the error, not crash
    expect(await findByText('new row violates row-level security policy')).toBeDefined();
  });
});
