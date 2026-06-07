import { describe, it, expect } from 'vitest';
import { mapSupabaseError, withFriendlyError } from '../supabase-errors';

describe('mapSupabaseError', () => {
  describe('falsy/null input', () => {
    it('returns generic message for null', () => {
      expect(mapSupabaseError(null)).toBe(
        'An unexpected error occurred. Please try again.'
      );
    });

    it('returns generic message for undefined', () => {
      expect(mapSupabaseError(undefined)).toBe(
        'An unexpected error occurred. Please try again.'
      );
    });

    it('returns generic message for empty string', () => {
      expect(mapSupabaseError('')).toBe(
        'An unexpected error occurred. Please try again.'
      );
    });
  });

  describe('network/fetch errors', () => {
    it('handles TypeError with fetch in message', () => {
      const error = new TypeError('Failed to fetch');
      expect(mapSupabaseError(error)).toBe(
        'Unable to connect. Please check your internet connection and try again.'
      );
    });

    it('handles TypeError with network in message', () => {
      const error = new TypeError('A network error occurred');
      expect(mapSupabaseError(error)).toBe(
        'Network error. Please check your connection and try again.'
      );
    });

    it('handles DOMException AbortError', () => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      expect(mapSupabaseError(error)).toBe(
        'The request timed out. Please try again.'
      );
    });
  });

  describe('auth errors', () => {
    it('handles invalid_credentials code', () => {
      expect(mapSupabaseError({ code: 'invalid_credentials' })).toBe(
        'Incorrect email or password. Please check your credentials and try again.'
      );
    });

    it('handles Invalid login credentials message', () => {
      expect(mapSupabaseError({ message: 'Invalid login credentials' })).toBe(
        'Incorrect email or password. Please check your credentials and try again.'
      );
    });

    it('handles user_already_exists code', () => {
      expect(mapSupabaseError({ code: 'user_already_exists' })).toBe(
        'An account with this email already exists. Try signing in instead.'
      );
    });

    it('handles User already registered message', () => {
      expect(mapSupabaseError({ message: 'User already registered' })).toBe(
        'An account with this email already exists. Try signing in instead.'
      );
    });

    it('handles email_not_confirmed code', () => {
      expect(mapSupabaseError({ code: 'email_not_confirmed' })).toBe(
        'Please confirm your email address before signing in. Check your inbox for the verification link.'
      );
    });

    it('handles otp_expired code', () => {
      expect(mapSupabaseError({ code: 'otp_expired' })).toBe(
        'This link has expired. Please request a new one.'
      );
    });

    it('handles Token has expired message', () => {
      expect(mapSupabaseError({ message: 'Token has expired or is invalid' })).toBe(
        'This link has expired. Please request a new one.'
      );
    });

    it('handles session_not_found code', () => {
      expect(mapSupabaseError({ code: 'session_not_found' })).toBe(
        'Your session has expired. Please sign in again.'
      );
    });

    it('handles refresh_token_not_found code', () => {
      expect(mapSupabaseError({ code: 'refresh_token_not_found' })).toBe(
        'Your session has expired. Please sign in again.'
      );
    });

    it('handles Invalid Refresh Token message', () => {
      expect(mapSupabaseError({ message: 'Invalid Refresh Token: Already Used' })).toBe(
        'Your session has expired. Please sign in again.'
      );
    });

    it('handles password too short message', () => {
      expect(mapSupabaseError({ message: 'Password should be at least 6 characters' })).toBe(
        'Password must be at least 6 characters long.'
      );
    });

    it('handles invalid email message', () => {
      expect(mapSupabaseError({ message: 'Unable to validate email address: invalid format' })).toBe(
        'Please enter a valid email address.'
      );
    });

    it('handles validation_failed code', () => {
      expect(mapSupabaseError({ code: 'validation_failed' })).toBe(
        'Please check your input and try again.'
      );
    });

    it('handles 422 status', () => {
      expect(mapSupabaseError({ status: 422, message: 'Unprocessable' })).toBe(
        'Please check your input and try again.'
      );
    });
  });

  describe('RLS / permission errors', () => {
    it('handles Postgres permission denied code 42501', () => {
      expect(mapSupabaseError({ code: '42501' })).toBe(
        "You don't have permission to perform this action. Contact your administrator if you believe this is an error."
      );
    });

    it('handles permission denied message', () => {
      expect(mapSupabaseError({ message: 'permission denied for table profiles' })).toBe(
        "You don't have permission to perform this action. Contact your administrator if you believe this is an error."
      );
    });

    it('handles row-level security message', () => {
      expect(mapSupabaseError({ message: 'new row violates row-level security policy' })).toBe(
        "You don't have permission to perform this action. Contact your administrator if you believe this is an error."
      );
    });

    it('handles PGRST301 JWT expired', () => {
      expect(mapSupabaseError({ code: 'PGRST301' })).toBe(
        'Your session has expired. Please sign in again.'
      );
    });

    it('handles JWT expired message', () => {
      expect(mapSupabaseError({ message: 'JWT expired' })).toBe(
        'Your session has expired. Please sign in again.'
      );
    });

    it('handles PGRST302 role error', () => {
      expect(mapSupabaseError({ code: 'PGRST302' })).toBe(
        "You don't have permission to perform this action."
      );
    });
  });

  describe('Postgres constraint errors', () => {
    it('handles unique constraint violation code 23505', () => {
      expect(mapSupabaseError({ code: '23505' })).toBe(
        'This record already exists. Please try a different value.'
      );
    });

    it('handles duplicate key message', () => {
      expect(mapSupabaseError({ message: 'duplicate key value violates unique constraint' })).toBe(
        'This record already exists. Please try a different value.'
      );
    });

    it('handles foreign key violation code 23503', () => {
      expect(mapSupabaseError({ code: '23503' })).toBe(
        'This action references data that no longer exists. Please refresh and try again.'
      );
    });

    it('handles not-null constraint violation code 23502', () => {
      expect(mapSupabaseError({ code: '23502' })).toBe(
        'A required field is missing. Please fill in all required fields.'
      );
    });

    it('handles not-null constraint message', () => {
      expect(mapSupabaseError({ message: 'null value in column violates not-null constraint' })).toBe(
        'A required field is missing. Please fill in all required fields.'
      );
    });
  });

  describe('network/service status errors', () => {
    it('handles status 0 (no connection)', () => {
      expect(mapSupabaseError({ status: 0, message: 'something' })).toBe(
        'Unable to connect. Please check your internet connection and try again.'
      );
    });

    it('handles Failed to fetch message', () => {
      expect(mapSupabaseError({ message: 'Failed to fetch', status: 200 })).toBe(
        'Unable to connect. Please check your internet connection and try again.'
      );
    });

    it('handles NetworkError message', () => {
      expect(mapSupabaseError({ message: 'NetworkError when attempting to fetch resource', status: 200 })).toBe(
        'Unable to connect. Please check your internet connection and try again.'
      );
    });

    it('handles 500 status', () => {
      expect(mapSupabaseError({ status: 500, message: 'Internal server error' })).toBe(
        'The service is temporarily unavailable. Please try again in a moment.'
      );
    });

    it('handles 502 status', () => {
      expect(mapSupabaseError({ status: 502, message: 'Bad gateway' })).toBe(
        'The service is temporarily unavailable. Please try again in a moment.'
      );
    });

    it('handles 503 status', () => {
      expect(mapSupabaseError({ status: 503, message: 'Service unavailable' })).toBe(
        'The service is temporarily unavailable. Please try again in a moment.'
      );
    });

    it('handles 504 status', () => {
      expect(mapSupabaseError({ status: 504, message: 'Gateway timeout' })).toBe(
        'The service is temporarily unavailable. Please try again in a moment.'
      );
    });

    it('handles 429 rate limit status', () => {
      expect(mapSupabaseError({ status: 429, message: 'Rate limited' })).toBe(
        'Too many requests. Please wait a moment and try again.'
      );
    });

    it('handles rate_limit_exceeded code', () => {
      expect(mapSupabaseError({ code: 'rate_limit_exceeded', status: 200 })).toBe(
        'Too many requests. Please wait a moment and try again.'
      );
    });
  });

  describe('invitation errors', () => {
    it('handles expired invitation', () => {
      expect(mapSupabaseError({ message: 'invitation has expired' })).toBe(
        'This invitation is no longer valid. Please ask your administrator to send a new one.'
      );
    });

    it('handles invalid invitation', () => {
      expect(mapSupabaseError({ message: 'invitation token is invalid' })).toBe(
        'This invitation is no longer valid. Please ask your administrator to send a new one.'
      );
    });

    it('handles already accepted invitation', () => {
      expect(mapSupabaseError({ message: 'invitation already accepted' })).toBe(
        'This invitation has already been accepted.'
      );
    });
  });

  describe('fallback behavior', () => {
    it('hides raw Postgres error codes', () => {
      expect(mapSupabaseError({ message: 'P0001: custom error from function' })).toBe(
        'Something went wrong. Please try again or contact support if the problem persists.'
      );
    });

    it('hides relation-based messages', () => {
      expect(mapSupabaseError({ message: 'relation "profiles" does not exist' })).toBe(
        'Something went wrong. Please try again or contact support if the problem persists.'
      );
    });

    it('hides messages containing pg_ internals', () => {
      expect(mapSupabaseError({ message: 'error in pg_catalog.pg_stat' })).toBe(
        'Something went wrong. Please try again or contact support if the problem persists.'
      );
    });

    it('passes through short readable messages', () => {
      expect(mapSupabaseError({ message: 'Custom readable error' })).toBe(
        'Custom readable error'
      );
    });

    it('hides very long messages', () => {
      const longMessage = 'x'.repeat(250);
      expect(mapSupabaseError({ message: longMessage })).toBe(
        'Something went wrong. Please try again or contact support if the problem persists.'
      );
    });
  });
});

describe('withFriendlyError', () => {
  it('returns the value on success', async () => {
    const result = await withFriendlyError(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('throws a friendly error message on failure', async () => {
    await expect(
      withFriendlyError(() =>
        Promise.reject({ code: 'invalid_credentials' })
      )
    ).rejects.toThrow(
      'Incorrect email or password. Please check your credentials and try again.'
    );
  });

  it('wraps network errors with friendly message', async () => {
    await expect(
      withFriendlyError(() =>
        Promise.reject(new TypeError('Failed to fetch'))
      )
    ).rejects.toThrow(
      'Unable to connect. Please check your internet connection and try again.'
    );
  });

  it('wraps unknown errors with generic message', async () => {
    await expect(
      withFriendlyError(() => Promise.reject(null))
    ).rejects.toThrow(
      'An unexpected error occurred. Please try again.'
    );
  });
});
