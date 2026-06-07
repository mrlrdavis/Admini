import { useEffect, useRef } from 'react';
import { getClient } from '../services/getClient';
import type { ProfileUpdatePayload } from '../types';

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
  /** Current user's role - used to enforce admin/principal-only school name edits at the bridge level (REQ-16). */
  userRole?: string;
  onSignOut: () => void;
  onResetUserData: () => void;
  onProfileUpdated?: (payload: ProfileUpdatePayload) => void;
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
    .gt('expires_at', new Date().toISOString())
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
// Profile update via shared Supabase client
// ---------------------------------------------------------------------------
// Maps iframe field names to updateProfile logic:
//   'display-name' -> profiles.display_name + auth.users metadata
//   'school'       -> organizations.name + auth.users metadata

async function updateProfile(field: string, value: string): Promise<void> {
  const client = getClient();

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) throw new Error('Not authenticated');
  const userId = userData.user.id;

  if (field === 'display-name') {
    // Update auth metadata
    const { error: authErr } = await client.auth.updateUser({
      data: { display_name: value },
    });
    if (authErr) throw new Error(authErr.message);

    // Update profiles table
    const { error: profileErr } = await client
      .from('profiles')
      .update({ display_name: value })
      .eq('id', userId);
    if (profileErr) throw new Error(profileErr.message);
  } else if (field === 'school') {
    // Update auth metadata
    const { error: authErr } = await client.auth.updateUser({
      data: { school_name: value },
    });
    if (authErr) throw new Error(authErr.message);

    // Fetch user's organization_id, then update organization name
    const { data: profile, error: profileFetchErr } = await client
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();
    if (profileFetchErr) throw new Error(profileFetchErr.message);
    if (profile?.organization_id) {
      const { error: orgErr } = await client
        .from('organizations')
        .update({ name: value })
        .eq('id', profile.organization_id);
      if (orgErr) throw new Error(orgErr.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IframeFallback({
  src,
  visible,
  userPayload,
  userRole,
  onSignOut,
  onResetUserData,
  onProfileUpdated,
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

      if (data.type === 'profile:update') {
        const field = String(data.field ?? '');
        const value = String(data.value ?? '');

        // REQ-16: Enforce admin/principal-only restriction on school name edits
        // at the bridge level (defense-in-depth alongside UI-level checks).
        if (field === 'school') {
          const canEditSchool = userRole === 'admin' || userRole === 'principal';
          if (!canEditSchool) {
            frameRef.current?.contentWindow?.postMessage(
              { type: 'profile:update:result', ok: false, field, error: 'Admin only \u2014 only administrators or principals can change the school name.' },
              '*'
            );
            return;
          }
        }

        if (field && value) {
          void updateProfile(field, value)
            .then(() => {
              // Notify parent to refresh its state
              onProfileUpdated?.({ field: field as ProfileUpdatePayload['field'], value });
              // Send success back to iframe
              frameRef.current?.contentWindow?.postMessage(
                { type: 'profile:update:result', ok: true, field, value },
                '*'
              );
            })
            .catch((error: unknown) => {
              frameRef.current?.contentWindow?.postMessage(
                { type: 'profile:update:result', ok: false, field, error: getErrorMessage(error) },
                '*'
              );
            });
        }
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
  }, [onSignOut, onResetUserData, onProfileUpdated, userRole]);

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
