import { describe, it, expect } from 'vitest';
import { createMockConnector } from './index';

describe('createMockConnector', () => {
  describe('email provider', () => {
    it('health() returns status mock', async () => {
      const connector = createMockConnector('email');
      const health = await connector.health();
      expect(health.status).toBe('mock');
      expect(health.provider).toBe('email');
      expect(health.message).toContain('email');
      expect(health.checkedAt).toBeTruthy();
    });

    it('lookupRoster returns valid mock data without throwing', async () => {
      const connector = createMockConnector('email');
      const roster = await connector.lookupRoster({});
      expect(Array.isArray(roster)).toBe(true);
      expect(roster.length).toBeGreaterThan(0);
      for (const member of roster) {
        expect(member.externalId).toBeTruthy();
        expect(member.displayName).toBeTruthy();
        expect(['student', 'teacher', 'staff']).toContain(member.role);
      }
    });

    it('lookupCourses returns valid mock data without throwing', async () => {
      const connector = createMockConnector('email');
      const courses = await connector.lookupCourses({});
      expect(Array.isArray(courses)).toBe(true);
      expect(courses.length).toBeGreaterThan(0);
      for (const course of courses) {
        expect(course.externalId).toBeTruthy();
        expect(course.title).toBeTruthy();
      }
    });

    it('lookupAttendance returns valid mock data without throwing', async () => {
      const connector = createMockConnector('email');
      const attendance = await connector.lookupAttendance({
        externalStudentId: 'student_123',
        date: '2024-01-15',
      });
      expect(attendance.externalStudentId).toBe('student_123');
      expect(['present', 'absent', 'tardy', 'unknown']).toContain(attendance.status);
      expect(attendance.observedAt).toBeTruthy();
    });
  });

  describe('calendar provider', () => {
    it('health() returns status mock', async () => {
      const connector = createMockConnector('calendar');
      const health = await connector.health();
      expect(health.status).toBe('mock');
      expect(health.provider).toBe('calendar');
      expect(health.message).toContain('calendar');
      expect(health.checkedAt).toBeTruthy();
    });

    it('lookupRoster returns valid mock data without throwing', async () => {
      const connector = createMockConnector('calendar');
      const roster = await connector.lookupRoster({});
      expect(Array.isArray(roster)).toBe(true);
      expect(roster.length).toBeGreaterThan(0);
      for (const member of roster) {
        expect(member.externalId).toBeTruthy();
        expect(member.displayName).toBeTruthy();
        expect(['student', 'teacher', 'staff']).toContain(member.role);
      }
    });

    it('lookupCourses returns valid mock data without throwing', async () => {
      const connector = createMockConnector('calendar');
      const courses = await connector.lookupCourses({});
      expect(Array.isArray(courses)).toBe(true);
      expect(courses.length).toBeGreaterThan(0);
      for (const course of courses) {
        expect(course.externalId).toBeTruthy();
        expect(course.title).toBeTruthy();
      }
    });

    it('lookupAttendance returns valid mock data without throwing', async () => {
      const connector = createMockConnector('calendar');
      const attendance = await connector.lookupAttendance({
        externalStudentId: 'student_456',
        date: '2024-03-20',
      });
      expect(attendance.externalStudentId).toBe('student_456');
      expect(['present', 'absent', 'tardy', 'unknown']).toContain(attendance.status);
      expect(attendance.observedAt).toBeTruthy();
    });
  });
});
