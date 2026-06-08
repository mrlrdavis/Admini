import { getClient } from './getClient';
import { mapSupabaseError } from '@admini/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Capture {
  id: string;
  text: string;
  mode: 'voice' | 'tap' | 'typed';
  status: 'queued' | 'synced' | 'failed';
  createdAt: string;
}

interface DbCapture {
  id: string;
  organization_id: string;
  created_by: string;
  source: string;
  mode: string;
  redacted_text: string;
  token_count: number;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

export async function saveCapture(input: {
  organizationId: string;
  userId: string;
  text: string;
  mode: 'voice' | 'tap' | 'typed';
}): Promise<Capture> {
  const client = getClient();

  const { data, error } = await client
    .from('captures')
    .insert({
      organization_id: input.organizationId,
      created_by: input.userId,
      source: 'desktop',
      mode: input.mode,
      redacted_text: input.text,
      token_count: input.text.split(/\s+/).length,
      status: 'synced',
    })
    .select()
    .single();

  if (error) throw new Error(mapSupabaseError(error));

  const row = data as DbCapture;
  return {
    id: row.id,
    text: row.redacted_text,
    mode: row.mode as Capture['mode'],
    status: row.status as Capture['status'],
    createdAt: row.created_at,
  };
}

export async function loadCaptures(organizationId: string): Promise<Capture[]> {
  const client = getClient();

  const { data, error } = await client
    .from('captures')
    .select('id, redacted_text, mode, status, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(mapSupabaseError(error));

  return (data as DbCapture[]).map((row) => ({
    id: row.id,
    text: row.redacted_text,
    mode: row.mode as Capture['mode'],
    status: row.status as Capture['status'],
    createdAt: row.created_at,
  }));
}

export async function deleteCapture(captureId: string): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from('captures')
    .delete()
    .eq('id', captureId);
  if (error) throw new Error(mapSupabaseError(error));
}
