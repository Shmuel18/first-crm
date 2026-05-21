'use client';

import { useSyncExternalStore } from 'react';

export const ROW_DENSITIES = ['compact', 'normal', 'comfortable'] as const;
export type RowDensity = (typeof ROW_DENSITIES)[number];

// Personal display preference (not shareable filter state) → localStorage,
// shared across components via a tiny external store (no provider needed).
const KEY = 'kfg.rowDensity';
const listeners = new Set<() => void>();

function read(): RowDensity {
  if (typeof window === 'undefined') return 'normal';
  const v = window.localStorage.getItem(KEY);
  return v === 'compact' || v === 'comfortable' ? v : 'normal';
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setRowDensity(d: RowDensity): void {
  try {
    window.localStorage.setItem(KEY, d);
  } catch {
    // localStorage unavailable (private mode) — preference just won't persist.
  }
  listeners.forEach((l) => l());
}

export function useRowDensity(): RowDensity {
  return useSyncExternalStore(subscribe, read, () => 'normal');
}
