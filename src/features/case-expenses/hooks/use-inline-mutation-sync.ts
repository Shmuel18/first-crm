'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

const REFRESH_DEBOUNCE_MS = 1200;

type InlineMutationSync = {
  /** Render-safe in-flight mutation count — gate prop-resyncs on === 0. */
  pendingCount: number;
  /** True from refreshSoon() until the debounced refresh fires. While owed,
   *  arriving payloads predate a write — skip them; a fresh one follows. */
  refreshOwed: boolean;
  /** Call when a mutation starts / settles (in a finally). */
  beginOp: () => void;
  endOp: () => void;
  /** Debounced background router.refresh() — call after each mutation. */
  refreshSoon: () => void;
};

/**
 * Mutation bookkeeping for optimistic inline-edit surfaces (FE-1 pattern:
 * optimistic client state, no revalidatePath).
 *
 * That pattern leaves the Next.js router cache holding the PRE-mutation page
 * payload, so a back/forward navigation restored the case page without the
 * rows the user just saved — which read as "it didn't save" and caused
 * re-typed duplicates. refreshSoon() replaces the stale payload once
 * mutations quiet down, without blocking the input.
 */
export function useInlineMutationSync(): InlineMutationSync {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshOwed, setRefreshOwed] = useState(false);
  const pendingRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposed = useRef(false);

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        // Flush instead of drop: an armed timer at unmount means the user
        // navigated away right after a save — exactly the back/forward
        // moment the refresh exists for. Skipping it would leave the stale
        // pre-mutation payload in the router cache.
        router.refresh();
      }
    };
  }, [router]);

  const beginOp = (): void => {
    pendingRef.current += 1;
    setPendingCount((c) => c + 1);
  };

  const endOp = (): void => {
    pendingRef.current -= 1;
    setPendingCount((c) => c - 1);
  };

  const refreshSoon = (): void => {
    // LOAD-BEARING post-unmount path: a blur-save dispatched by the same
    // click that navigates away settles AFTER unmount and lands here. The
    // cache purge must still happen or the stale payload survives (the
    // original bug) — refresh immediately instead of arming a timer no
    // cleanup owns. Do not add an "isMounted" early-return here.
    if (disposed.current) {
      router.refresh();
      return;
    }
    setRefreshOwed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (pendingRef.current > 0) {
        refreshSoon();
        return;
      }
      setRefreshOwed(false);
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  };

  return { pendingCount, refreshOwed, beginOp, endOp, refreshSoon };
}
