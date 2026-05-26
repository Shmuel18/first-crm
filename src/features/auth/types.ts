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
