import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { IframeFallback, type IframeFallbackProps } from '../../src/components/IframeFallback';
import { configureClient, resetClient } from '../../src/services/getClient';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockClient(overrides?: {
  selectData?: unknown;
  selectError?: { message: string } | null;
  singleData?: unknown;
  singleError?: { message: string } | null;
}) {
  const singleFn = vi.fn().mockResolvedValue({
    data: overrides?.singleData ?? { id: '1', title: 'Test' },
    error: overrides?.singleError ?? null,
  });

  const insertFn = vi.fn().mockReturnValue({ select: () => ({ single: singleFn }) });
  const updateFn = vi.fn().mockReturnValue({ eq: () => ({ select: () => ({ single: singleFn }) }) });
  const orderFn = vi.fn().mockResolvedValue({
    data: overrides?.selectData ?? [{ id: '1', title: 'Task 1' }],
    error: overrides?.selectError ?? null,
  });
  const gtFn = vi.fn().mockReturnValue({ order: orderFn });
  const neqFn = vi.fn().mockReturnValue({ gt: gtFn });

  const fromFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ neq: neqFn }),
    insert: insertFn,
    update: updateFn,
  });

  return { from: fromFn } as unknown as SupabaseClient;
}

function defaultProps(overrides?: Partial<IframeFallbackProps>): IframeFallbackProps {
  return {
    src: 'https://example.com',
    visible: true,
    userPayload: { userId: '123', name: 'Test' },
    onSignOut: vi.fn(),
    onResetUserData: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IframeFallback', () => {
  let mockClient: SupabaseClient;

  beforeEach(() => {
    mockClient = createMockClient();
    configureClient(mockClient);
  });

  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders an iframe with the correct src', () => {
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe!.getAttribute('src')).toBe('https://example.com');
    });

    it('sets display:block when visible is true', () => {
      const { container } = render(createElement(IframeFallback, defaultProps({ visible: true })));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      expect(iframe.style.display).toBe('block');
    });

    it('sets display:none when visible is false', () => {
      const { container } = render(createElement(IframeFallback, defaultProps({ visible: false })));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      expect(iframe.style.display).toBe('none');
    });

    it('has accessible title attribute', () => {
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe');
      expect(iframe!.getAttribute('title')).toBe('Admini workspace');
    });
  });

  describe('postMessage bridge - outgoing', () => {
    it('sends userPayload on iframe load', () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      fireEvent.load(iframe);
      expect(mockPostMessage).toHaveBeenCalledWith(
        { userId: '123', name: 'Test' },
        '*'
      );
    });
  });

  describe('postMessage bridge - incoming', () => {
    it('calls onSignOut when receiving request-signout message', () => {
      const onSignOut = vi.fn();
      render(createElement(IframeFallback, defaultProps({ onSignOut })));

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', { data: { type: 'request-signout' } })
        );
      });

      expect(onSignOut).toHaveBeenCalledOnce();
    });

    it('calls onResetUserData when receiving reset-user-data message', () => {
      const onResetUserData = vi.fn();
      render(createElement(IframeFallback, defaultProps({ onResetUserData })));

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', { data: { type: 'reset-user-data' } })
        );
      });

      expect(onResetUserData).toHaveBeenCalledOnce();
    });

    it('handles JSON string messages', () => {
      const onSignOut = vi.fn();
      render(createElement(IframeFallback, defaultProps({ onSignOut })));

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'request-signout' }),
          })
        );
      });

      expect(onSignOut).toHaveBeenCalledOnce();
    });

    it('ignores non-object messages', () => {
      const onSignOut = vi.fn();
      render(createElement(IframeFallback, defaultProps({ onSignOut })));

      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: null }));
        window.dispatchEvent(new MessageEvent('message', { data: 42 }));
        window.dispatchEvent(new MessageEvent('message', { data: 'not-json' }));
      });

      expect(onSignOut).not.toHaveBeenCalled();
    });
  });

  describe('postMessage bridge - task CRUD', () => {
    it('handles tasks:list and posts result back', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'tasks:list', requestId: 'req-1' },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:list:result',
          requestId: 'req-1',
          ok: true,
          tasks: [{ id: '1', title: 'Task 1' }],
        }),
        '*'
      );
    });

    it('handles tasks:create and posts result back', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'tasks:create',
              requestId: 'req-2',
              task: { title: 'New Task' },
            },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:create:result',
          requestId: 'req-2',
          ok: true,
        }),
        '*'
      );
    });

    it('handles tasks:update-status and posts result back', async () => {
      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              type: 'tasks:update-status',
              requestId: 'req-3',
              id: 'task-1',
              status: 'completed',
            },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:update-status:result',
          requestId: 'req-3',
          ok: true,
        }),
        '*'
      );
    });

    it('posts error result when task operation fails', async () => {
      resetClient();
      const failClient = createMockClient({
        selectError: { message: 'DB connection failed' },
      });
      configureClient(failClient);

      const mockPostMessage = vi.fn();
      const { container } = render(createElement(IframeFallback, defaultProps()));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'tasks:list', requestId: 'req-err' },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks:list:result',
          requestId: 'req-err',
          ok: false,
          error: 'DB connection failed',
        }),
        '*'
      );
    });
  });

  describe('visibility transitions', () => {
    it('does not re-send payload when remaining visible', () => {
      const mockPostMessage = vi.fn();
      const props = defaultProps({ visible: true });
      const { container, rerender } = render(createElement(IframeFallback, props));
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      // Re-render with same visibility -- postMessage via the effect should not fire
      rerender(createElement(IframeFallback, { ...props, visible: true }));

      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('school name edit role restriction (REQ-16)', () => {
    it('blocks school name update from iframe when userRole is staff', async () => {
      const mockPostMessage = vi.fn();
      const onProfileUpdated = vi.fn();
      const { container } = render(
        createElement(IframeFallback, defaultProps({ userRole: 'staff', onProfileUpdated }))
      );
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'profile:update', field: 'school', value: 'Hacker School' },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      // Should NOT call onProfileUpdated
      expect(onProfileUpdated).not.toHaveBeenCalled();
      // Should send error back to iframe
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'profile:update:result',
          ok: false,
          field: 'school',
        }),
        '*'
      );
    });

    it('blocks school name update from iframe when userRole is teacher', async () => {
      const mockPostMessage = vi.fn();
      const onProfileUpdated = vi.fn();
      const { container } = render(
        createElement(IframeFallback, defaultProps({ userRole: 'teacher', onProfileUpdated }))
      );
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'profile:update', field: 'school', value: 'Hacker School' },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(onProfileUpdated).not.toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'profile:update:result',
          ok: false,
          field: 'school',
          error: expect.stringContaining('Admin only'),
        }),
        '*'
      );
    });

    it('allows school name update from iframe when userRole is admin', async () => {
      resetClient();
      const singleFn = vi.fn().mockResolvedValue({
        data: { organization_id: 'org-1' },
        error: null,
      });
      const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const selectFn = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) });
      const adminClient = {
        from: vi.fn().mockReturnValue({
          select: selectFn,
          update: updateFn,
        }),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
          updateUser: vi.fn().mockResolvedValue({ error: null }),
        },
      } as unknown as SupabaseClient;
      configureClient(adminClient);

      const mockPostMessage = vi.fn();
      const onProfileUpdated = vi.fn();
      const { container } = render(
        createElement(IframeFallback, defaultProps({ userRole: 'admin', onProfileUpdated }))
      );
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'profile:update', field: 'school', value: 'New School' },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      // Should call onProfileUpdated with the new value
      expect(onProfileUpdated).toHaveBeenCalledWith({ field: 'school', value: 'New School' });
    });

    it('allows school name update from iframe when userRole is principal', async () => {
      resetClient();
      const singleFn = vi.fn().mockResolvedValue({
        data: { organization_id: 'org-1' },
        error: null,
      });
      const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const selectFn = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleFn }) });
      const principalClient = {
        from: vi.fn().mockReturnValue({
          select: selectFn,
          update: updateFn,
        }),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
          updateUser: vi.fn().mockResolvedValue({ error: null }),
        },
      } as unknown as SupabaseClient;
      configureClient(principalClient);

      const mockPostMessage = vi.fn();
      const onProfileUpdated = vi.fn();
      const { container } = render(
        createElement(IframeFallback, defaultProps({ userRole: 'principal', onProfileUpdated }))
      );
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;

      Object.defineProperty(iframe, 'contentWindow', {
        value: { postMessage: mockPostMessage },
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'profile:update', field: 'school', value: 'New School' },
          })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(onProfileUpdated).toHaveBeenCalledWith({ field: 'school', value: 'New School' });
    });
  });

  describe('cleanup', () => {
    it('removes message event listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(createElement(IframeFallback, defaultProps()));

      unmount();

      expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });
});
