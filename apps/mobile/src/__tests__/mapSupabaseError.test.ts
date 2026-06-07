import { describe, it, expect } from 'vitest';
import { mapSupabaseError } from '@admini/shared';

describe('mapSupabaseError', () => {
  it('returns generic message for null/undefined', () => {
    expect(mapSupabaseError(null)).toBe('An unexpected error occurred. Please try again.');
    expect(mapSupabaseError(undefined)).toBe('An unexpected error occurred. Please try again.');
  });

  it('maps invalid credentials error', () => {
    const error = { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 };
    expect(mapSupabaseError(error)).toBe('Incorrect email or password. Please check your credentials and try again.');
  });

  it('maps user already exists error', () => {
    const error = { message: 'User already registered', code: 'user_already_exists' };
    expect(mapSupabaseError(error)).toBe('An account with this email already exists. Try signing in instead.');
  });

  it('maps email not confirmed error', () => {
    const error = { message: 'Email not confirmed', code: 'email_not_confirmed' };
    expect(mapSupabaseError(error)).toBe('Please confirm your email address before signing in. Check your inbox for the verification link.');
  });

  it('maps expired token error', () => {
    const error = { message: 'Token has expired', code: 'otp_expired' };
    expect(mapSupabaseError(error)).toBe('This link has expired. Please request a new one.');
  });

  it('maps session expired errors', () => {
    expect(mapSupabaseError({ code: 'session_not_found' })).toBe('Your session has expired. Please sign in again.');
    expect(mapSupabaseError({ message: 'Invalid Refresh Token' })).toBe('Your session has expired. Please sign in again.');
    expect(mapSupabaseError({ message: 'JWT expired', code: 'PGRST301' })).toBe('Your session has expired. Please sign in again.');
  });

  it('maps RLS policy violation (permission denied)', () => {
    const error = { message: 'new row violates row-level security policy', code: '42501' };
    expect(mapSupabaseError(error)).toBe("You don't have permission to perform this action. Contact your administrator if you believe this is an error.");
  });

  it('maps permission denied without Postgres code', () => {
    const error = { message: 'permission denied for table tasks' };
    expect(mapSupabaseError(error)).toBe("You don't have permission to perform this action. Contact your administrator if you believe this is an error.");
  });

  it('maps network errors (TypeError with fetch)', () => {
    const error = new TypeError('Failed to fetch');
    expect(mapSupabaseError(error)).toBe('Unable to connect. Please check your internet connection and try again.');
  });

  it('maps network connectivity issues', () => {
    const error = new TypeError('network request failed');
    expect(mapSupabaseError(error)).toBe('Network error. Please check your connection and try again.');
  });

  it('maps explicit status 0 as network error', () => {
    expect(mapSupabaseError({ status: 0, message: '' })).toBe('Unable to connect. Please check your internet connection and try again.');
  });

  it('maps service unavailable (500, 502, 503, 504)', () => {
    expect(mapSupabaseError({ status: 500, message: '' })).toBe('The service is temporarily unavailable. Please try again in a moment.');
    expect(mapSupabaseError({ status: 503, message: '' })).toBe('The service is temporarily unavailable. Please try again in a moment.');
  });

  it('maps rate limiting', () => {
    const error = { status: 429, message: 'rate limit exceeded', code: 'rate_limit_exceeded' };
    expect(mapSupabaseError(error)).toBe('Too many requests. Please wait a moment and try again.');
  });

  it('maps duplicate key constraint', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect(mapSupabaseError(error)).toBe('This record already exists. Please try a different value.');
  });

  it('maps foreign key constraint', () => {
    const error = { code: '23503', message: 'violates foreign key constraint' };
    expect(mapSupabaseError(error)).toBe('This action references data that no longer exists. Please refresh and try again.');
  });

  it('maps password validation error', () => {
    const error = { message: 'Password should be at least 6 characters' };
    expect(mapSupabaseError(error)).toBe('Password must be at least 6 characters long.');
  });

  it('maps email validation error', () => {
    const error = { message: 'Unable to validate email address: invalid format' };
    expect(mapSupabaseError(error)).toBe('Please enter a valid email address.');
  });

  it('maps expired invitation', () => {
    const error = { message: 'invitation has expired or is invalid' };
    expect(mapSupabaseError(error)).toBe('This invitation is no longer valid. Please ask your administrator to send a new one.');
  });

  it('maps already-accepted invitation', () => {
    const error = { message: 'invitation has already accepted' };
    expect(mapSupabaseError(error)).toBe('This invitation has already been accepted.');
  });

  it('hides raw Postgres error codes', () => {
    const error = { message: 'ABCDE: something internal happened' };
    expect(mapSupabaseError(error)).toBe('Something went wrong. Please try again or contact support if the problem persists.');
  });

  it('passes through short, readable messages', () => {
    const error = { message: 'Organization not found.' };
    expect(mapSupabaseError(error)).toBe('Organization not found.');
  });

  it('hides long or internal-looking messages', () => {
    const error = { message: 'a'.repeat(250) };
    expect(mapSupabaseError(error)).toBe('Something went wrong. Please try again or contact support if the problem persists.');
  });
});
