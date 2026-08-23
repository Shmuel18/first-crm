import { unstable_rethrow } from 'next/navigation';

/**
 * The failure a Server Action can NEVER report itself: the request didn't
 * complete. A dropped connection makes the action's promise REJECT — it does
 * not resolve to `{ ok: false }` — so a call site that only branches on
 * `result.ok` silently skips its rollback and its error toast. With optimistic
 * UI that reads as "saved" while nothing reached the server.
 */
export type ActionNetworkFailure = {
  ok: false;
  error: 'network';
  /**
   * Always absent — a request that never completed carries no server message.
   * Declared so `result.message` still typechecks at the call sites whose own
   * failure type has an optional `message`; those read `undefined` here and
   * fall through to their generic translated string.
   */
  message?: undefined;
};

/**
 * Wrap a Server Action call so a transport failure becomes a normal
 * `{ ok: false, error: 'network' }` result instead of an unhandled rejection.
 *
 *   const result = await callAction(() => updateThingAction(id, value));
 *   if (result.ok) { ... } else { rollback(); toast.error(...); }
 *
 * Framework control-flow errors (`redirect()`, `notFound()`, `forbidden()`)
 * are also thrown, and MUST keep propagating or navigation breaks — ten actions
 * in this codebase end in `redirect()`. `unstable_rethrow` is Next's supported
 * way to let those through; everything after it is a real failure.
 *
 * A server-side crash also rejects and is reported as 'network' here. That is
 * deliberate: both are "it didn't save, try again" to the user. The console
 * error (and Sentry, which picks console errors up) is what tells us which.
 */
export async function callAction<T extends { ok: boolean }>(
  invoke: () => Promise<T>,
): Promise<T | ActionNetworkFailure> {
  try {
    return await invoke();
  } catch (err) {
    unstable_rethrow(err);
    console.error('[action] request did not complete', err);
    return { ok: false, error: 'network' };
  }
}
