import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createElement } from 'react';
import { IframeFallback, type IframeFallbackProps } from '../../src/components/IframeFallback';
import { configureClient, resetClient } from '../../src/services/getClient';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// REQ-6: Task creation works via Supabase
// ---------------------------------------------------------------------------

function createTaskMockClient(opts?: {
  insertData?: unknown;
  insertError?: { message: string } | null;
}) {
  const singleFn = vi.fn().mockResolvedValue({
    data: opts?.insertData ?? {
      id: 'task-new-1',
      title: 'Created Task',
      description: null,
      priority: 'normal',
      status: 'open',
      due_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    error: opts?.insertError ?? null,
  });

  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });

  const neqFn = vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  });

  const fromFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ neq: neqFn }),
    insert: insertFn,
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: singleFn }),
      }),
    }),
  });

  return {
    client: { from: fromFn } as unknown as SupabaseClient,
    insertFn,
    selectFn,
    singleFn,
    fromFn,
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

describe('Task Creation via Supabase (REQ-6)', () => {
  let mocks: ReturnType<typeof createTaskMockClient>;

  beforeEach(() => {
    mocks = createTaskMockClient();
    configureClient(mocks.client);
  });

  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  describe('createTask function - Supabase insert call', () => {
    it('calls supabase.from("tasks").insert() with the provided task input', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await sendMessage({
        type: 'tasks:create',
        requestId: 'create-1',
        task: { title: 'Buy supplies' },
      });

      expect(mocks.fromFn).toHaveBeenCalledWith('tasks');
      expect(mocks.insertFn).toHaveBeenCalledWith({ title: 'Buy supplies' });
    });

    it('passes all optional fields (description, priority, status, due_at) to insert', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      const taskInput = {
        title: 'Grade papers',
        description: 'Math class homework set 3',
        priority: 'high',
        status: 'open',
        due_at: '2024-06-15T17:00:00Z',
      };

      await sendMessage({
        type: 'tasks:create',
        requestId: 'create-2',
        task: taskInput,
      });

      expect(mocks.insertFn).toHaveBeenCalledWith(taskInput);
    });

    it('chains .select().single() after insert to return the created row', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await sendMessage({
        type: 'tasks:create',
        requestId: 'create-3',
        task: { title: 'Test chaining' },
      });

      expect(mocks.insertFn).toHaveBeenCalled();
      expect(mocks.selectFn).toHaveBeenCalled();
      expect(mocks.singleFn).toHaveBeenCalled();
    });

    it('returns the created task data in the success response', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await sendMessage({
        type: 'tasks:create',
        requestId: 'create-4',
        task: { title: 'Return data test' },
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:create:result',
          requestId: 'create-4',
          ok: true,
          task: expect.objectContaining({
            id: 'task-new-1',
            title: 'Created Task',
          }),
        }),
        '*',
      );
    });
  });

  describe('createTask error handling', () => {
    it('returns ok:false with error message when Supabase insert fails', async () => {
      resetClient();
      const errorMocks = createTaskMockClient();
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
        type: 'tasks:create',
        requestId: 'create-err-1',
        task: { title: 'Failing task' },
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:create:result',
          requestId: 'create-err-1',
          ok: false,
          error: 'Row-level security policy violation',
        }),
        '*',
      );
    });

    it('returns ok:false when Supabase returns a constraint violation', async () => {
      resetClient();
      const errorMocks = createTaskMockClient();
      errorMocks.singleFn.mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
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
        type: 'tasks:create',
        requestId: 'create-err-2',
        task: { title: 'Duplicate task' },
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:create:result',
          requestId: 'create-err-2',
          ok: false,
          error: expect.stringContaining('duplicate key'),
        }),
        '*',
      );
    });
  });

  describe('postMessage bridge - tasks:create message handling', () => {
    it('handles tasks:create message with only required title field', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await sendMessage({
        type: 'tasks:create',
        requestId: 'msg-1',
        task: { title: 'Minimal task' },
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:create:result',
          requestId: 'msg-1',
          ok: true,
        }),
        '*',
      );
    });

    it('preserves requestId in the response for client-side correlation', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await sendMessage({
        type: 'tasks:create',
        requestId: 'unique-req-abc',
        task: { title: 'Correlation test' },
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:create:result',
          requestId: 'unique-req-abc',
        }),
        '*',
      );
    });

    it('handles tasks:create with priority set to urgent', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await sendMessage({
        type: 'tasks:create',
        requestId: 'urgent-1',
        task: { title: 'Fire drill prep', priority: 'urgent' },
      });

      expect(mocks.insertFn).toHaveBeenCalledWith({
        title: 'Fire drill prep',
        priority: 'urgent',
      });
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:create:result',
          ok: true,
        }),
        '*',
      );
    });

    it('handles JSON string format messages for tasks:create', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await sendMessage(
        JSON.stringify({
          type: 'tasks:create',
          requestId: 'json-str-1',
          task: { title: 'JSON string task' },
        }),
      );

      expect(mocks.insertFn).toHaveBeenCalledWith({ title: 'JSON string task' });
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:create:result',
          requestId: 'json-str-1',
          ok: true,
        }),
        '*',
      );
    });
  });

  describe('TasksTab - task loading from Supabase', () => {
    it('loads tasks from Supabase and renders them', async () => {
      resetClient();

      const taskRows = [
        {
          id: 'task-1',
          organization_id: 'org-1',
          created_by: 'user-1',
          title: 'Review curriculum',
          description: null,
          priority: 'high',
          status: 'open',
          due_at: '2024-06-20T00:00:00Z',
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

      const taskTitle = await findByText('Review curriculum');
      expect(taskTitle).toBeDefined();
    });

    it('displays empty state when no tasks exist', async () => {
      resetClient();

      const returnsFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderFn = vi.fn().mockReturnValue({ returns: returnsFn });
      const neqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ neq: neqFn });

      const emptyClient = {
        from: vi.fn().mockReturnValue({ select: selectFn }),
      } as unknown as SupabaseClient;
      configureClient(emptyClient);

      const { TasksTab } = await import('../../src/components/TasksTab');
      const { findByText } = render(createElement(TasksTab));

      const emptyTitle = await findByText('No tasks yet');
      expect(emptyTitle).toBeDefined();
    });

    it('displays error state when Supabase fetch fails', async () => {
      resetClient();

      const returnsFn = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Network error', code: 'NETWORK_ERROR' },
      });
      const orderFn = vi.fn().mockReturnValue({ returns: returnsFn });
      const neqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ neq: neqFn });

      const failClient = {
        from: vi.fn().mockReturnValue({ select: selectFn }),
      } as unknown as SupabaseClient;
      configureClient(failClient);

      const { TasksTab } = await import('../../src/components/TasksTab');
      const { findByText } = render(createElement(TasksTab));

      const errorMsg = await findByText('Network error');
      expect(errorMsg).toBeDefined();
    });
  });
});
