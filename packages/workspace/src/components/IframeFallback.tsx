import { useEffect, useRef } from 'react';
import { getClient } from '../services/getClient';

// ---------------------------------------------------------------------------
// IframeFallback Component
// ---------------------------------------------------------------------------
// Renders a persistent iframe for unconverted workspace tabs.
// The iframe is NEVER unmounted - visibility is toggled via display style.
// Manages the postMessage bridge between the native shell and the iframe content.
// Requirements: 6.1, 6.2, 6.3, 6.4

type TaskStatusInput = 'open' | 'in_progress' | 'completed' | 'archived';

interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  status?: TaskStatusInput;
  due_at?: string;
}

export interface IframeFallbackProps {
  src: string;
  visible: boolean;
  userPayload: Record<string, unknown>;
  onSignOut: () => void;
  onResetUserData: () => void;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Task CRUD operations via shared Supabase client
// ---------------------------------------------------------------------------

async function listTasks() {
  const client = getClient();
  const { data, error } = await client
    .from('tasks')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

async function createTask(input: CreateTaskInput) {
  const client = getClient();
  const { data, error } = await client
    .from('tasks')
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function updateTaskStatus(id: string, status: TaskStatusInput) {
  const client = getClient();
  const { data, error } = await client
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IframeFallback({
  src,
  visible,
  userPayload,
  onSignOut,
  onResetUserData,
}: IframeFallbackProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const prevVisibleRef = useRef<boolean>(visible);

  // Send userPayload on mount (iframe onLoad) and when visible transitions to true
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    // Send payload when transitioning from hidden to visible
    if (visible && !wasVisible) {
      frameRef.current?.contentWindow?.postMessage(userPayload, '*');
    }
  }, [visible, userPayload]);

  // Listen for incoming postMessage events from the iframe
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data =
        ev.data &&
        (typeof ev.data === 'string'
          ? (() => {
              try {
                return JSON.parse(ev.data);
              } catch {
                return ev.data;
              }
            })()
          : ev.data);

      if (!data || typeof data !== 'object') return;

      if (data.type === 'request-signout') {
        onSignOut();
      }

      if (data.type === 'reset-user-data') {
        onResetUserData();
      }

      if (data.type === 'tasks:list') {
        void listTasks()
          .then((tasks) => {
            frameRef.current?.contentWindow?.postMessage(
              { type: 'tasks:list:result', requestId: data.requestId, ok: true, tasks },
              '*'
            );
          })
          .catch((error: unknown) => {
            frameRef.current?.contentWindow?.postMessage(
              { type: 'tasks:list:result', requestId: data.requestId, ok: false, error: getErrorMessage(error) },
              '*'
            );
          });
      }

      if (data.type === 'tasks:create') {
        void createTask(data.task as CreateTaskInput)
          .then((task) => {
            frameRef.current?.contentWindow?.postMessage(
              { type: 'tasks:create:result', requestId: data.requestId, ok: true, task },
              '*'
            );
          })
          .catch((error: unknown) => {
            frameRef.current?.contentWindow?.postMessage(
              { type: 'tasks:create:result', requestId: data.requestId, ok: false, error: getErrorMessage(error) },
              '*'
            );
          });
      }

      if (data.type === 'tasks:update-status') {
        void updateTaskStatus(String(data.id), data.status as TaskStatusInput)
          .then((task) => {
            frameRef.current?.contentWindow?.postMessage(
              { type: 'tasks:update-status:result', requestId: data.requestId, ok: true, task },
              '*'
            );
          })
          .catch((error: unknown) => {
            frameRef.current?.contentWindow?.postMessage(
              { type: 'tasks:update-status:result', requestId: data.requestId, ok: false, error: getErrorMessage(error) },
              '*'
            );
          });
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSignOut, onResetUserData]);

  // Send userPayload when the iframe first loads
  function handleIframeLoad() {
    frameRef.current?.contentWindow?.postMessage(userPayload, '*');
  }

  return (
    <iframe
      ref={frameRef}
      onLoad={handleIframeLoad}
      src={src}
      title="Admini workspace"
      style={{
        display: visible ? 'block' : 'none',
        width: '100%',
        height: '100%',
        border: 'none',
      }}
    />
  );
}
