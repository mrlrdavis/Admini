/**
 * Google Integration Service
 * 
 * Uses the Google OAuth provider_token from Supabase session to call
 * Google Calendar, Gmail, and Classroom APIs directly from the client.
 */

import { getClient } from './getClient';

// ---------------------------------------------------------------------------
// Token Management
// ---------------------------------------------------------------------------

/**
 * Get the Google OAuth provider token from the current Supabase session.
 * Returns null if not connected or token expired.
 */
export async function getGoogleToken(): Promise<string | null> {
  const client = getClient();
  const { data } = await client.auth.getSession();
  return data.session?.provider_token ?? null;
}

// ---------------------------------------------------------------------------
// Google Calendar API
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
}

/**
 * Fetch today's calendar events from Google Calendar.
 */
export async function getTodayCalendarEvents(): Promise<CalendarEvent[]> {
  const token = await getGoogleToken();
  if (!token) return [];

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay}&timeMax=${endOfDay}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data.items ?? []).map((e: any) => ({
      id: e.id,
      summary: e.summary ?? '(No title)',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      location: e.location,
    }));
  } catch { return []; }
}

/**
 * Fetch calendar events for a date range.
 */
export async function getCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
  const token = await getGoogleToken();
  if (!token) return [];

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startDate.toISOString()}&timeMax=${endDate.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data.items ?? []).map((e: any) => ({
      id: e.id,
      summary: e.summary ?? '(No title)',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      location: e.location,
    }));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Gmail API
// ---------------------------------------------------------------------------

export interface GmailContact {
  email: string;
  name?: string;
}

/**
 * Send an email via Gmail API.
 */
export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  const token = await getGoogleToken();
  if (!token) return false;

  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ].join('\r\n');

  const encoded = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encoded }),
    });
    return res.ok;
  } catch { return false; }
}

/**
 * Get contacts from Gmail (frequent contacts).
 */
export async function getContacts(query?: string): Promise<GmailContact[]> {
  const token = await getGoogleToken();
  if (!token) return [];

  try {
    const url = query
      ? `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(query)}&readMask=names,emailAddresses&pageSize=10`
      : `https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=20`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data: any = await res.json();
    const people = data.results?.map((r: any) => r.person) ?? data.connections ?? [];
    return people
      .filter((p: any) => p.emailAddresses?.length > 0)
      .map((p: any) => ({
        email: p.emailAddresses[0].value,
        name: p.names?.[0]?.displayName,
      }));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Google Classroom API
// ---------------------------------------------------------------------------

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
}

export interface ClassroomStudent {
  userId: string;
  name: string;
  email?: string;
}

/**
 * Get list of courses from Google Classroom.
 */
export async function getClassroomCourses(): Promise<ClassroomCourse[]> {
  const token = await getGoogleToken();
  if (!token) return [];

  try {
    const res = await fetch(
      'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=30',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data.courses ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      section: c.section,
    }));
  } catch { return []; }
}

/**
 * Get students in a course.
 */
export async function getClassroomStudents(courseId: string): Promise<ClassroomStudent[]> {
  const token = await getGoogleToken();
  if (!token) return [];

  try {
    const res = await fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/students?pageSize=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data.students ?? []).map((s: any) => ({
      userId: s.userId,
      name: s.profile?.name?.fullName ?? 'Unknown',
      email: s.profile?.emailAddress,
    }));
  } catch { return []; }
}