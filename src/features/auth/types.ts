/**
 * Auth feature types and shared state shapes.
 *
 * Lives outside `actions/` because Next.js `'use server'` files
 * can only export async functions - no types, no constants.
 */

export type LoginErrorCode =
  | 'invalid_input'
  | 'invalid_credentials'
  | 'rate_limited'
  | 'unknown';

export type LoginState = { error: LoginErrorCode | null };

export const LOGIN_INITIAL_STATE: LoginState = { error: null };

export type SetPasswordErrorCode =
  | 'invalid_input'
  | 'mismatch'
  | 'unauthorized'
  | 'rate_limited'
  | 'unknown';

export type SetPasswordState = { error: SetPasswordErrorCode | null };

export const SET_PASSWORD_INITIAL_STATE: SetPasswordState = { error: null };

/**
 * Password reset request. Always reports `sent: true` to the UI when the form
 * is submitted (with or without a real account behind the address) — revealing
 * whether an email is registered is its own email-enumeration leak. Errors are
 * only surfaced on truly bad input (malformed email).
 */
export type RequestPasswordResetState =
  | { sent: false; error: 'invalid_input' | null }
  | { sent: true };

export const REQUEST_PASSWORD_RESET_INITIAL_STATE: RequestPasswordResetState = {
  sent: false,
  error: null,
};
