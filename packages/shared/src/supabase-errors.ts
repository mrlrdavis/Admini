/**
 * Maps raw Supabase/Postgres errors into user-friendly messages.
 *
 * Covers:
 * - Auth errors (invalid credentials, expired tokens, email taken)
 * - RLS policy violations (row-level security denials)
 * - Network/connectivity errors
 * - Common Postgres error codes
 */

export type SupabaseErrorLike = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
  /** Supabase auth errors sometimes include this */
  __isAuthError?: boolean;
};

/**
 * Converts a raw Supabase or Postgres error into a user-friendly message.
 * Falls back to a generic message if the error isn't recognized.
 */
export function mapSupabaseError(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  // Handle network/fetch failures
  if (error instanceof TypeError && error.message?.includes('fetch')) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  if (error instanceof TypeError && error.message?.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Handle DOMException for aborted requests
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The request timed out. Please try again.';
  }

  // Normalize to SupabaseErrorLike
  const err = error as SupabaseErrorLike;
  const message = err.message ?? '';
  const code = err.code ?? '';
  const status = err.status ?? 0;

  // --- Auth errors ---
  if (code === 'invalid_credentials' || message.includes('Invalid login credentials')) {
    return 'Incorrect email or password. Please check your credentials and try again.';
  }

  if (code === 'user_already_exists' || message.includes('User already registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (code === 'email_not_confirmed' || message.includes('Email not confirmed')) {
    return 'Please confirm your email address before signing in. Check your inbox for the verification link.';
  }

  if (code === 'otp_expired' || message.includes('Token has expired')) {
    return 'This link has expired. Please request a new one.';
  }

  if (code === 'session_not_found' || message.includes('Session not found')) {
    return 'Your session has expired. Please sign in again.';
  }

  if (code === 'refresh_token_not_found' || message.includes('Invalid Refresh Token')) {
    return 'Your session has expired. Please sign in again.';
  }

  if (message.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }

  if (message.includes('Unable to validate email address')) {
    return 'Please enter a valid email address.';
  }

  if (status === 422 || code === 'validation_failed') {
    return 'Please check your input and try again.';
  }

  // --- RLS / permission errors ---
  if (code === '42501' || message.includes('permission denied') || message.includes('row-level security')) {
    return "You don't have permission to perform this action. Contact your administrator if you believe this is an error.";
  }

  if (code === 'PGRST301' || message.includes('JWT expired')) {
    return 'Your session has expired. Please sign in again.';
  }

  if (code === 'PGRST302' || (message.includes('role') && message.includes('cannot'))) {
    return "You don't have permission to perform this action.";
  }

  // --- Postgres constraint errors ---
  if (code === '23505' || message.includes('duplicate key') || message.includes('unique constraint')) {
    return 'This record already exists. Please try a different value.';
  }

  if (code === '23503' || message.includes('foreign key') || message.includes('violates foreign key')) {
    return 'This action references data that no longer exists. Please refresh and try again.';
  }

  if (code === '23502' || message.includes('not-null constraint')) {
    return 'A required field is missing. Please fill in all required fields.';
  }

  // --- Network / service errors ---
  if ((err.status !== undefined && err.status === 0) || message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return 'The service is temporarily unavailable. Please try again in a moment.';
  }

  if (status === 429 || code === 'rate_limit_exceeded') {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // --- Invitation-specific errors ---
  if (message.includes('invitation') && (message.includes('expired') || message.includes('invalid'))) {
    return 'This invitation is no longer valid. Please ask your administrator to send a new one.';
  }

  if (message.includes('invitation') && message.includes('already accepted')) {
    return 'This invitation has already been accepted.';
  }

  // --- Fallback ---
  // If we have a message that looks like a raw Postgres code, hide it
  if (/^[A-Z0-9]{5}:/.test(message) || message.startsWith('relation "')) {
    return 'Something went wrong. Please try again or contact support if the problem persists.';
  }

  // If the message is short and somewhat readable, use it (likely already user-friendly)
  if (message && message.length < 200 && !message.includes('pgp_') && !message.includes('pg_')) {
    return message;
  }

  return 'Something went wrong. Please try again or contact support if the problem persists.';
}

/**
 * Wraps an async function call and converts any thrown error to a user-friendly message.
 * Useful for wrapping individual Supabase operations that throw on error.
 */
export async function withFriendlyError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(mapSupabaseError(error));
  }
}
