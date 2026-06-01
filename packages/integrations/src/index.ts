import type { IntegrationCatalogItem, IntegrationProvider, IntegrationStatus } from '@admini/shared';

export const integrationCatalog: IntegrationCatalogItem[] = [
  {
    provider: 'schoology',
    name: 'Schoology',
    category: 'lms',
    description: 'Courses, sections, assignments, and learning context.',
    authModes: ['oauth', 'api_key'],
    scopes: ['courses:read', 'sections:read', 'assignments:read'],
    persistenceTargets: ['indexeddb', 'supabase', 'worker_secret']
  },
  {
    provider: 'infinite_campus',
    name: 'Infinite Campus',
    category: 'sis',
    description: 'Roster, attendance, schedules, and student information context.',
    authModes: ['oauth', 'sso', 'api_key'],
    scopes: ['roster:read', 'attendance:read', 'schedule:read'],
    persistenceTargets: ['indexeddb', 'supabase', 'worker_secret']
  },
  {
    provider: 'google_workspace',
    name: 'Google Workspace',
    category: 'productivity',
    description: 'Calendar, Drive, and email context for admin workflows.',
    authModes: ['oauth', 'sso'],
    scopes: ['calendar:read', 'drive.metadata:read'],
    persistenceTargets: ['indexeddb', 'supabase', 'worker_secret']
  },
  {
    provider: 'microsoft_365',
    name: 'Microsoft 365 / Outlook',
    category: 'productivity',
    description: 'Outlook calendar, mail metadata, Teams, and Microsoft identity.',
    authModes: ['oauth', 'sso'],
    scopes: ['openid', 'email', 'profile', 'offline_access'],
    persistenceTargets: ['indexeddb', 'supabase', 'worker_secret']
  },
  {
    provider: 'apple_school_manager',
    name: 'Apple School Manager',
    category: 'identity',
    description: 'Apple identity and school roster handoff readiness.',
    authModes: ['sso', 'manual_import'],
    scopes: ['identity:read', 'roster:read'],
    persistenceTargets: ['indexeddb', 'supabase', 'worker_secret']
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
