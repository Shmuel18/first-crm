import type { IntakeFormState } from './form-state';

/**
 * Local, browser-only draft persistence for the public wizard. A prospect can
 * close the tab and come back within 7 days (same browser) to a pre-filled form.
 * Nothing is sent anywhere until they submit — this is plain localStorage.
 */
const KEY = 'kaufman_intake_draft_v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Stored = { savedAt: number; state: IntakeFormState };

export function loadIntakeDraft(): IntakeFormState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || typeof parsed.savedAt !== 'number' || !parsed.state) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed.state;
  } catch {
    return null;
  }
}

export function saveIntakeDraft(state: IntakeFormState): void {
  if (typeof window === 'undefined') return;
  try {
    // Never persist the honeypot value.
    const payload: Stored = { savedAt: Date.now(), state: { ...state, website: '' } };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Storage full/disabled (private mode) — non-fatal; the form still works.
  }
}

export function clearIntakeDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
