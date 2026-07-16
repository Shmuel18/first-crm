'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Client copy of a server-provided list for optimistic inline-edit surfaces
 * (FE-1: optimistic client state, no revalidatePath). Reseeds from the server
 * payload when its signature changes, but with the load-bearing gate: it
 * ALWAYS advances past the payload, and APPLIES it only while idle — a
 * mid-mutation payload predates a write and would revert it. Pass `idle`
 * from useInlineMutationSync as `pendingCount === 0 && !refreshOwed`.
 */
export function useSyncedRows<T>(
  sig: string,
  seed: () => T[],
  idle: boolean,
): [T[], Dispatch<SetStateAction<T[]>>] {
  const [rows, setRows] = useState<T[]>(seed);
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    if (idle) setRows(seed());
  }
  return [rows, setRows];
}
