'use client';

import { createContext, useContext } from 'react';

import type { CaseBlockPreferences } from '../domain/case-block-preferences';

const CaseBlockPrefsContext = createContext<CaseBlockPreferences | null>(null);

/**
 * Provides the current user's saved case-block open/closed defaults
 * (Settings → Display) to the CaseBlock components below. The case detail page
 * fetches the prefs server-side and wraps its block grid in this provider;
 * each CaseBlock with a `blockKey` reads its initial open state from here.
 * No provider → null → CaseBlock falls back to its own `defaultOpen`.
 */
export function CaseBlockPrefsProvider({
  prefs,
  children,
}: {
  prefs: CaseBlockPreferences;
  children: React.ReactNode;
}) {
  return (
    <CaseBlockPrefsContext.Provider value={prefs}>{children}</CaseBlockPrefsContext.Provider>
  );
}

export function useCaseBlockPrefs(): CaseBlockPreferences | null {
  return useContext(CaseBlockPrefsContext);
}
