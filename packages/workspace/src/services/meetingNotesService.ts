import { getClient } from './getClient';
import { mapSupabaseError } from '@admini/shared';

export interface MeetingNote {
  id: string;
  title: string;
  body: string;
  attendees: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface DbMeetingNote {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  body: string;
  attendees: string[];
  created_at: string;
  updated_at: string;
}

function mapNote(row: DbMeetingNote): MeetingNote {
  return {
    id: row.id,
    title: row.title,
    body: row.body || '',
    attendees: row.attendees || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export async function listMeetingNotes(organizationId: string, options?: { search?: string; limit?: number; offset?: number }): Promise<MeetingNote[]> {
  const client = getClient();
  let query = client
    .from('meeting_notes')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (options?.search) {
    query = query.ilike('title', `%${options.search}%`);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(mapSupabaseError(error));
  return (data as DbMeetingNote[]).map(mapNote);
}

export async function createMeetingNote(input: { organizationId: string; userId: string; title: string; body?: string; attendees?: string[] }): Promise<MeetingNote> {
  const client = getClient();
  const { data, error } = await client
    .from('meeting_notes')
    .insert({
      organization_id: input.organizationId,
      created_by: input.userId,
      title: input.title,
      body: input.body || '',
      attendees: input.attendees || [],
    })
    .select()
    .single();

  if (error) throw new Error(mapSupabaseError(error));
  return mapNote(data as DbMeetingNote);
}

export async function updateMeetingNote(noteId: string, input: { title?: string; body?: string; attendees?: string[] }): Promise<MeetingNote> {
  const client = getClient();
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.body !== undefined) payload.body = input.body;
  if (input.attendees !== undefined) payload.attendees = input.attendees;

  const { data, error } = await client
    .from('meeting_notes')
    .update(payload)
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw new Error(mapSupabaseError(error));
  return mapNote(data as DbMeetingNote);
}

export async function deleteMeetingNote(noteId: string): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from('meeting_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw new Error(mapSupabaseError(error));
}
