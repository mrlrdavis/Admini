import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { IframeFallback, type IframeFallbackProps } from '../../src/components/IframeFallback';
import { configureClient, resetClient } from '../../src/services/getClient';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// REQ-6: Task status updates (open -> in_progress -> completed)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createStatusMockClient(opts?: {
  updateData?: unknown;
  updateError?: { message: string } | null;
}) {
  const singleFn = vi.fn().mockResolvedValue({
    data: opts?.updateData ?? {
      id: 'task-1',
      title: 'Test Task',
      description: null,
      priority: 'normal',
      status: 'in_progress',
      due_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
    },
    error: opts?.updateError ?? null,
  });

  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const eqFn = vi.fn().mockReturnValue({ select: selectFn });
  const updateFn = vi.fn().mockReturnValue({ eq: eqFn });

  // list tasks mock (needed for component rendering)
  const neqFn = vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  });

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'tasks') {
      return {
        select: vi.fn().mockReturnValue({ neq: neqFn }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: singleFn }),
        }),
        update: updateFn,
      };
    }
    return { select: vi.fn() };
  });

  return {
    client: { from: fromFn } as unknown as SupabaseClient,
    fromFn,
    updateFn,
    eqFn,
    selectFn,
    singleFn,
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
// 1. updateTaskStatus function calls Supabase correctly
// ---------------------------------------------------------------------------

describe('updateTaskStatus - Supabase update call (REQ-6)', () => {
  let mocks: ReturnType<typeof createStatusMockClient>;

  beforeEach(() => {
    mocks = createStatusMockClient();
    configureClient(mocks.client);
  });

  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('calls supabase.from("tasks").update() with status and updated_at', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'status-1',
      id: 'task-1',
      status: 'in_progress',
    });

    expect(mocks.fromFn).toHaveBeenCalledWith('tasks');
    expect(mocks.updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'in_progress',
        updated_at: expect.any(String),
      }),
    );
  });

  it('passes the correct task id to .eq("id", id)', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'status-2',
      id: 'task-abc-123',
      status: 'completed',
    });

    expect(mocks.eqFn).toHaveBeenCalledWith('id', 'task-abc-123');
  });

  it('chains .select().single() after update to return the updated row', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'status-3',
      id: 'task-1',
      status: 'completed',
    });

    expect(mocks.updateFn).toHaveBeenCalled();
    expect(mocks.eqFn).toHaveBeenCalled();
    expect(mocks.selectFn).toHaveBeenCalled();
    expect(mocks.singleFn).toHaveBeenCalled();
  });

  it('includes an ISO timestamp in updated_at field', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    const before = new Date().toISOString();

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'status-4',
      id: 'task-1',
      status: 'in_progress',
    });

    const after = new Date().toISOString();
    const callArgs = mocks.updateFn.mock.calls[0][0];
    expect(callArgs.updated_at).toBeDefined();
    // Verify it's a valid ISO string between before and after
    expect(callArgs.updated_at >= before).toBe(true);
    expect(callArgs.updated_at <= after).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. postMessage bridge handles tasks:update-status messages
// ---------------------------------------------------------------------------

describe('postMessage bridge - tasks:update-status handling (REQ-6)', () => {
  let mocks: ReturnType<typeof createStatusMockClient>;

  beforeEach(() => {
    mocks = createStatusMockClient();
    configureClient(mocks.client);
  });

  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('responds with tasks:update-status:result on success', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'bridge-1',
      id: 'task-1',
      status: 'in_progress',
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:update-status:result',
        requestId: 'bridge-1',
        ok: true,
        task: expect.objectContaining({ id: 'task-1' }),
      }),
      '*',
    );
  });

  it('preserves requestId in the response for correlation', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'unique-correlation-xyz',
      id: 'task-1',
      status: 'completed',
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:update-status:result',
        requestId: 'unique-correlation-xyz',
      }),
      '*',
    );
  });

  it('handles status transition from open to in_progress', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'cycle-1',
      id: 'task-1',
      status: 'in_progress',
    });

    expect(mocks.updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_progress' }),
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tasks:update-status:result', ok: true }),
      '*',
    );
  });

  it('handles status transition from in_progress to completed', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'cycle-2',
      id: 'task-1',
      status: 'completed',
    });

    expect(mocks.updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tasks:update-status:result', ok: true }),
      '*',
    );
  });

  it('handles JSON string format messages', async () => {
    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage(
      JSON.stringify({
        type: 'tasks:update-status',
        requestId: 'json-str-1',
        id: 'task-1',
        status: 'completed',
      }),
    );

    expect(mocks.updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:update-status:result',
        requestId: 'json-str-1',
        ok: true,
      }),
      '*',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. TasksTab UI - status display (status cycling via click)
// ---------------------------------------------------------------------------

describe('TasksTab - task status display and cycling (REQ-6)', () => {
  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('renders task status badges with the correct status text', async () => {
    resetClient();

    const taskRows = [
      {
        id: 'task-1',
        organization_id: 'org-1',
        created_by: 'user-1',
        title: 'Open task',
        description: null,
        priority: 'normal',
        status: 'open',
        due_at: null,
        created_at: '2024-06-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
      },
      {
        id: 'task-2',
        organization_id: 'org-1',
        created_by: 'user-1',
        title: 'In progress task',
        description: null,
        priority: 'high',
        status: 'in_progress',
        due_at: null,
        created_at: '2024-06-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
      },
      {
        id: 'task-3',
        organization_id: 'org-1',
        created_by: 'user-1',
        title: 'Completed task',
        description: null,
        priority: 'low',
        status: 'completed',
        due_at: null,
        created_at: '2024-06-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
      },
    ];

    const returnsFn = vi.fn().mockResolvedValue({ data: taskRows, error: null });
    const orderFn = vi.fn().mockReturnValue({ returns: returnsFn });
    const neqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ neq: neqFn });

    const tasksClient = {
      from: vi.fn().mockReturnValue({ select: selectFn }),
    } as unknown as SupabaseClient;
    configureClient(tasksClient);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    // Verify status labels are displayed (underscore replaced with space in UI)
    const openStatus = await findByText('open');
    expect(openStatus).toBeDefined();

    const inProgressStatus = await findByText('in progress');
    expect(inProgressStatus).toBeDefined();

    const completedStatus = await findByText('completed');
    expect(completedStatus).toBeDefined();
  });

  it('applies status-specific CSS classes to status badges', async () => {
    resetClient();

    const taskRows = [
      {
        id: 'task-1',
        organization_id: 'org-1',
        created_by: 'user-1',
        title: 'Status class task',
        description: null,
        priority: 'normal',
        status: 'in_progress',
        due_at: null,
        created_at: '2024-06-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
      },
    ];

    const returnsFn = vi.fn().mockResolvedValue({ data: taskRows, error: null });
    const orderFn = vi.fn().mockReturnValue({ returns: returnsFn });
    const neqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ neq: neqFn });

    const tasksClient = {
      from: vi.fn().mockReturnValue({ select: selectFn }),
    } as unknown as SupabaseClient;
    configureClient(tasksClient);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    const statusEl = await findByText('in progress');
    expect(statusEl.className).toContain('tasks-tab__status--in_progress');
  });

  it('renders task cards as list items that are clickable', async () => {
    resetClient();

    const taskRows = [
      {
        id: 'task-click-1',
        organization_id: 'org-1',
        created_by: 'user-1',
        title: 'Clickable task',
        description: null,
        priority: 'normal',
        status: 'open',
        due_at: null,
        created_at: '2024-06-01T00:00:00Z',
        updated_at: '2024-06-01T00:00:00Z',
      },
    ];

    const returnsFn = vi.fn().mockResolvedValue({ data: taskRows, error: null });
    const orderFn = vi.fn().mockReturnValue({ returns: returnsFn });
    const neqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ neq: neqFn });

    const tasksClient = {
      from: vi.fn().mockReturnValue({ select: selectFn }),
    } as unknown as SupabaseClient;
    configureClient(tasksClient);

    const { TasksTab } = await import('../../src/components/TasksTab');
    const { findByText } = render(createElement(TasksTab));

    const taskTitle = await findByText('Clickable task');
    // Task card is an <li> element
    const listItem = taskTitle.closest('li');
    expect(listItem).not.toBeNull();
    expect(listItem?.className).toContain('tasks-tab__task-card');
  });
});

// ---------------------------------------------------------------------------
// 4. Error handling when status update fails
// ---------------------------------------------------------------------------

describe('Task status update error handling (REQ-6)', () => {
  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('returns ok:false with error message when Supabase update fails', async () => {
    const errorMocks = createStatusMockClient();
    errorMocks.singleFn.mockResolvedValue({
      data: null,
      error: { message: 'Row-level security policy violation' },
    });
    configureClient(errorMocks.client);

    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'err-1',
      id: 'task-1',
      status: 'completed',
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:update-status:result',
        requestId: 'err-1',
        ok: false,
        error: 'Row-level security policy violation',
      }),
      '*',
    );
  });

  it('returns ok:false when task id does not exist (no rows found)', async () => {
    const errorMocks = createStatusMockClient();
    errorMocks.singleFn.mockResolvedValue({
      data: null,
      error: { message: 'JSON object requested, multiple (or no) rows returned' },
    });
    configureClient(errorMocks.client);

    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'err-2',
      id: 'nonexistent-task-id',
      status: 'in_progress',
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:update-status:result',
        requestId: 'err-2',
        ok: false,
        error: expect.stringContaining('rows returned'),
      }),
      '*',
    );
  });

  it('returns ok:false when network error occurs during update', async () => {
    const errorMocks = createStatusMockClient();
    errorMocks.singleFn.mockResolvedValue({
      data: null,
      error: { message: 'FetchError: network timeout' },
    });
    configureClient(errorMocks.client);

    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'err-3',
      id: 'task-1',
      status: 'completed',
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:update-status:result',
        requestId: 'err-3',
        ok: false,
        error: expect.stringContaining('network timeout'),
      }),
      '*',
    );
  });

  it('includes the requestId in error response for client correlation', async () => {
    const errorMocks = createStatusMockClient();
    errorMocks.singleFn.mockResolvedValue({
      data: null,
      error: { message: 'Some error' },
    });
    configureClient(errorMocks.client);

    const mockPostMessage = vi.fn();
    const { container } = render(createElement(IframeFallback, defaultProps()));
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: { postMessage: mockPostMessage },
      writable: true,
    });

    await sendMessage({
      type: 'tasks:update-status',
      requestId: 'correlation-err-id',
      id: 'task-1',
      status: 'completed',
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tasks:update-status:result',
        requestId: 'correlation-err-id',
        ok: false,
      }),
      '*',
    );
  });
});
