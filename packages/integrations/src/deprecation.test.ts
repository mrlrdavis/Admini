import { describe, it, expect } from 'vitest';
import { isActiveProvider, isDeprecatedProvider } from './index';
import type { AnyIntegrationProvider } from '@admini/shared';

describe('isActiveProvider', () => {
  it('returns true for google_classroom', () => {
    expect(isActiveProvider('google_classroom' as AnyIntegrationProvider)).toBe(true);
  });

  it('returns true for email', () => {
    expect(isActiveProvider('email' as AnyIntegrationProvider)).toBe(true);
  });

  it('returns true for calendar', () => {
    expect(isActiveProvider('calendar' as AnyIntegrationProvider)).toBe(true);
  });

  it('returns false for schoology', () => {
    expect(isActiveProvider('schoology' as AnyIntegrationProvider)).toBe(false);
  });

  it('returns false for infinite_campus', () => {
    expect(isActiveProvider('infinite_campus' as AnyIntegrationProvider)).toBe(false);
  });
});

describe('isDeprecatedProvider', () => {
  it('returns true for schoology', () => {
    expect(isDeprecatedProvider('schoology' as AnyIntegrationProvider)).toBe(true);
  });

  it('returns true for infinite_campus', () => {
    expect(isDeprecatedProvider('infinite_campus' as AnyIntegrationProvider)).toBe(true);
  });

  it('returns false for google_classroom', () => {
    expect(isDeprecatedProvider('google_classroom' as AnyIntegrationProvider)).toBe(false);
  });

  it('returns false for email', () => {
    expect(isDeprecatedProvider('email' as AnyIntegrationProvider)).toBe(false);
  });

  it('returns false for calendar', () => {
    expect(isDeprecatedProvider('calendar' as AnyIntegrationProvider)).toBe(false);
  });
});
