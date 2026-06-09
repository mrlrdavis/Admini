import type { IntegrationCatalogItem, IntegrationProvider, IntegrationStatus, IntegrationConnection, AnyIntegrationProvider, DeprecatedIntegrationProvider } from '@admini/shared';

export const integrationCatalog: IntegrationCatalogItem[] = [
  {
    provider: 'google_classroom',
    name: 'Google Classroom',
    category: 'lms',
    description: 'Classes, coursework, announcements, and classroom learning context.',
    authModes: ['oauth', 'sso'],
    scopes: ['classroom.courses.readonly', 'classroom.rosters.readonly', 'classroom.coursework.students.readonly'],
    persistenceTargets: ['indexeddb', 'supabase', 'worker_secret']
  },
  {
    provider: 'email',
    name: 'Email',
    category: 'productivity',
    description: 'Read inbox messages and send emails for communication workflows.',
    authModes: ['oauth'],
    scopes: ['inbox:read', 'messages:send'],
    persistenceTargets: ['indexeddb', 'supabase']
  },
  {
    provider: 'calendar',
    name: 'Calendar',
    category: 'productivity',
    description: 'Read and create calendar events for scheduling workflows.',
    authModes: ['oauth'],
    scopes: ['events:read', 'events:create'],
    persistenceTargets: ['indexeddb', 'supabase']
  }
];

export type IntegrationHealth = {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  message: string;
  checkedAt: string;
};

export type RosterLookupInput = {
  query?: string;
  courseId?: string;
};

export type RosterMember = {
  externalId: string;
  displayName: string;
  role: 'student' | 'teacher' | 'staff';
};

export type CourseContext = {
  externalId: string;
  title: string;
  section?: string;
};

export type AttendanceContext = {
  externalStudentId: string;
  status: 'present' | 'absent' | 'tardy' | 'unknown';
  observedAt: string;
};

export interface StudentSystemConnector {
  provider: IntegrationProvider;
  health(): Promise<IntegrationHealth>;
  lookupRoster(input: RosterLookupInput): Promise<RosterMember[]>;
  lookupCourses(input: { query?: string }): Promise<CourseContext[]>;
  lookupAttendance(input: { externalStudentId: string; date: string }): Promise<AttendanceContext>;
}

export function createMockConnector(provider: IntegrationProvider): StudentSystemConnector {
  return {
    provider,
    async health() {
      return {
        provider,
        status: 'mock',
        message: `${provider} connector stub is ready for API credentials.`,
        checkedAt: new Date().toISOString()
      };
    },
    async lookupRoster() {
      return [
        { externalId: `${provider}_teacher_1`, displayName: 'Teacher One', role: 'teacher' },
        { externalId: `${provider}_student_1`, displayName: 'Student One', role: 'student' }
      ];
    },
    async lookupCourses() {
      return [
        { externalId: `${provider}_course_1`, title: 'Grade 3 Math', section: 'A' },
        { externalId: `${provider}_course_2`, title: 'Grade 4 ELA', section: 'B' }
      ];
    },
    async lookupAttendance(input) {
      return {
        externalStudentId: input.externalStudentId,
        status: 'unknown',
        observedAt: `${input.date}T00:00:00.000Z`
      };
    }
  };
}

export function getConnector(provider: IntegrationProvider): StudentSystemConnector {
  return createMockConnector(provider);
}

export function isActiveProvider(provider: AnyIntegrationProvider): provider is IntegrationProvider {
  const activeProviders: IntegrationProvider[] = ['google_classroom', 'email', 'calendar'];
  return activeProviders.includes(provider as IntegrationProvider);
}

export function isDeprecatedProvider(provider: AnyIntegrationProvider): provider is DeprecatedIntegrationProvider {
  const deprecated: DeprecatedIntegrationProvider[] = ['schoology', 'infinite_campus'];
  return deprecated.includes(provider as DeprecatedIntegrationProvider);
}

/**
 * Raw database row shape for integration connections.
 * The provider field may contain deprecated values from before catalog updates.
 */
export type RawIntegrationConnectionRow = {
  id: string;
  organization_id: string;
  provider: string;
  status: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Filters raw database connection rows to only include connections with active providers,
 * and maps them to the IntegrationConnection shape.
 */
export function getActiveConnections(rows: RawIntegrationConnectionRow[]): IntegrationConnection[] {
  return rows
    .filter(row => isActiveProvider(row.provider as AnyIntegrationProvider))
    .map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      provider: row.provider as IntegrationProvider,
      status: row.status as IntegrationStatus,
      lastSyncAt: row.last_sync_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
}