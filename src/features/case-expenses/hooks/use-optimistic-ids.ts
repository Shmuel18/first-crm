'use client';

import { useRef, useState } from 'react';

const OPTIMISTIC_PREFIX = 'optimistic-';

type OptimisticIds = {
  newTempId: () => string;
  /** Record the in-flight create for a temp row (promise of its real id, null on failure). */
  registerCreate: (tempId: string, realId: Promise<string | null>) => void;
  /** Translate a row id to its server id — waits for the row's create when needed. */
  resolveRealId: (id: string) => Promise<string | null>;
  /** Record the temp -> real mapping once the create lands. */
  markCreated: (tempId: string, realId: string) => void;
  /** Stable React key: a created row keeps its temp key forever, so the
   *  temp -> real id swap doesn't remount the row (which would wipe the
   *  cell the user is typing in mid-word and drop focus). */
  rowKey: (id: string) => string;
};

/**
 * Id bookkeeping for optimistic inline rows: hands out temp ids, lets
 * blur-saves/deletes that fire before the row's insert resolves await the
 * real id instead of PATCHing the optimistic id (a guaranteed 400), and
 * keeps React keys stable across the temp -> real swap.
 */
export function useOptimisticIds(): OptimisticIds {
  const seq = useRef(0);
  const creates = useRef(new Map<string, Promise<string | null>>());
  // real id -> the temp id it was born under. State (not a ref) because
  // rowKey is read during render for React keys.
  const [tempKeyByRealId, setTempKeyByRealId] = useState<ReadonlyMap<string, string>>(new Map());

  const newTempId = (): string => `${OPTIMISTIC_PREFIX}${seq.current++}`;

  const registerCreate = (tempId: string, realId: Promise<string | null>): void => {
    creates.current.set(tempId, realId);
  };

  const resolveRealId = (id: string): Promise<string | null> =>
    id.startsWith(OPTIMISTIC_PREFIX)
      ? (creates.current.get(id) ?? Promise.resolve(null))
      : Promise.resolve(id);

  const markCreated = (tempId: string, realId: string): void => {
    setTempKeyByRealId((prev) => new Map(prev).set(realId, tempId));
  };

  const rowKey = (id: string): string => tempKeyByRealId.get(id) ?? id;

  return { newTempId, registerCreate, resolveRealId, markCreated, rowKey };
}
