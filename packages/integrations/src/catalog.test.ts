import { describe, it, expect } from 'vitest';
import { integrationCatalog } from './index';

describe('integrationCatalog', () => {
  it('contains exactly 3 entries: google_classroom, email, calendar', () => {
    expect(integrationCatalog).toHaveLength(3);
    const providers = integrationCatalog.map(entry => entry.provider);
    expect(providers).toContain('google_classroom');
    expect(providers).toContain('email');
    expect(providers).toContain('calendar');
  });

  it('does NOT contain schoology', () => {
    const providers = integrationCatalog.map(entry => entry.provider);
    expect(providers).not.toContain('schoology');
  });

  it('does NOT contain infinite_campus', () => {
    const providers = integrationCatalog.map(entry => entry.provider);
    expect(providers).not.toContain('infinite_campus');
  });

  describe('email entry', () => {
    it('has correct scopes', () => {
      const email = integrationCatalog.find(e => e.provider === 'email');
      expect(email).toBeDefined();
      expect(email!.scopes).toEqual(['inbox:read', 'messages:send']);
    });

    it('has correct authModes', () => {
      const email = integrationCatalog.find(e => e.provider === 'email');
      expect(email).toBeDefined();
      expect(email!.authModes).toEqual(['oauth']);
    });

    it('has correct persistenceTargets', () => {
      const email = integrationCatalog.find(e => e.provider === 'email');
      expect(email).toBeDefined();
      expect(email!.persistenceTargets).toEqual(['indexeddb', 'supabase']);
    });
  });

  describe('calendar entry', () => {
    it('has correct scopes', () => {
      const calendar = integrationCatalog.find(e => e.provider === 'calendar');
      expect(calendar).toBeDefined();
      expect(calendar!.scopes).toEqual(['events:read', 'events:create']);
    });

    it('has correct authModes', () => {
      const calendar = integrationCatalog.find(e => e.provider === 'calendar');
      expect(calendar).toBeDefined();
      expect(calendar!.authModes).toEqual(['oauth']);
    });

    it('has correct persistenceTargets', () => {
      const calendar = integrationCatalog.find(e => e.provider === 'calendar');
      expect(calendar).toBeDefined();
      expect(calendar!.persistenceTargets).toEqual(['indexeddb', 'supabase']);
    });
  });

  describe('google_classroom entry is unchanged', () => {
    it('has category lms', () => {
      const gc = integrationCatalog.find(e => e.provider === 'google_classroom');
      expect(gc).toBeDefined();
      expect(gc!.category).toBe('lms');
    });

    it('has correct authModes', () => {
      const gc = integrationCatalog.find(e => e.provider === 'google_classroom');
      expect(gc).toBeDefined();
      expect(gc!.authModes).toEqual(['oauth', 'sso']);
    });

    it('has correct scopes', () => {
      const gc = integrationCatalog.find(e => e.provider === 'google_classroom');
      expect(gc).toBeDefined();
      expect(gc!.scopes).toEqual([
        'classroom.courses.readonly',
        'classroom.rosters.readonly',
        'classroom.coursework.students.readonly',
      ]);
    });

    it('has correct persistenceTargets', () => {
      const gc = integrationCatalog.find(e => e.provider === 'google_classroom');
      expect(gc).toBeDefined();
      expect(gc!.persistenceTargets).toEqual(['indexeddb', 'supabase', 'worker_secret']);
    });
  });
});