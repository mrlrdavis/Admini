import { useEffect, useRef } from 'react';
import { listTasks, createTask, updateTaskStatus, type CreateTaskInput } from '../supabase';

// ---------------------------------------------------------------------------
// IframeFallback Component
// ---------------------------------------------------------------------------
// Renders a persistent iframe for unconverted workspace tabs.
// The iframe is NEVER unmounted - visibility is toggled via display style.
// Manages the postMessage bridge between the native shell and the iframe content.
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5

type TaskStatusInput = 'open' | 'in_progress' | 'completed' | 'archived';

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
