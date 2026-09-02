'use client';

import { useCallback } from 'react';

import { useQueryState } from 'nuqs';

/**
 * The `?thread=<taskId>` search param — the deep link a mention / comment
 * notification lands on, which opens that task's conversation on arrival.
 *
 * Exposes the LIVE value, not a mount-time snapshot: the tasks page keeps its
 * client state across a search-param-only navigation, so a bell click made
 * while already on /tasks changes the URL without remounting anything. The
 * dialog's open state is derived from this param (see resolveThreadDialogTask)
 * — seeding it once with useState missed exactly that case.
 *
 * `clear` drops the param when the dialog closes so a reload or a Back
 * navigation doesn't reopen a thread the reader already left. Shallow on
 * purpose: closing is a client-only change, and a server round-trip here would
 * refetch the whole list for nothing.
 */
export function useThreadParam(): { threadId: string | null; clearThreadParam: () => void } {
  const [threadId, setThread] = useQueryState('thread');
  const clearThreadParam = useCallback(() => {
    void setThread(null);
  }, [setThread]);
  return { threadId, clearThreadParam };
}
