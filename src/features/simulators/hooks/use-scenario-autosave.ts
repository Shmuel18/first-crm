'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { saveScenarioAction } from '../actions/save-scenario';

import type { MixInput, PropertyKind } from '../types';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'blocked' | 'error';

type Snapshot = {
  scenarioId: string | null;
  caseId: string | null;
  primaryBorrowerId: string | null;
  title: string;
  propertyKind: PropertyKind;
  mix: MixInput;
  advisorConclusion: string;
  hasViolations: boolean;
};

type Params = Snapshot & {
  onCreated?: (scenarioId: string) => void;
  onSaved?: (title: string) => void;
};

const DEBOUNCE_MS = 1200;

const contentSignature = (s: Snapshot): string =>
  JSON.stringify({ t: s.title.trim(), p: s.propertyKind, m: s.mix, c: s.advisorConclusion.trim() });

/**
 * Debounced auto-save for a single mix scenario. Saves only after the content
 * changes from what is on the server (so opening a tab never creates junk),
 * only when valid (titled + no regulatory violations), and never two saves at
 * once (so the first create can't race into a duplicate). Adopts the created id
 * so later edits update in place. Debounce coalesces bursts, so a skipped
 * in-flight overlap is re-armed by the next edit.
 */
export function useScenarioAutosave(params: Params): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>('idle');

  const latest = useRef<Params>(params);
  useEffect(() => {
    latest.current = params;
  });

  const idRef = useRef<string | null>(params.scenarioId);
  const savedSigRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  // Seed signature captured once (state, not a ref → safe to read during render).
  const [seedSig] = useState(() => contentSignature(params));

  const save = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    const s = latest.current;
    if (s.title.trim().length === 0 || s.hasViolations) {
      setStatus('blocked');
      return;
    }
    const sig = contentSignature(s);
    if (sig === savedSigRef.current) {
      setStatus('saved');
      return;
    }
    inFlightRef.current = true;
    setStatus('saving');
    const result = await saveScenarioAction({
      scenarioId: idRef.current,
      caseId: s.caseId,
      primaryBorrowerId: s.primaryBorrowerId,
      kind: 'mix',
      title: s.title,
      propertyKind: s.propertyKind,
      mix: { ...s.mix, tracks: [...s.mix.tracks] },
      advisorConclusion: s.advisorConclusion || null,
    });
    inFlightRef.current = false;
    if (result.ok) {
      savedSigRef.current = sig;
      if (!idRef.current) {
        idRef.current = result.scenarioId;
        s.onCreated?.(result.scenarioId);
      }
      s.onSaved?.(s.title);
      setStatus('saved');
    } else {
      setStatus('error');
    }
  }, []);

  const signature = contentSignature(params);
  const dirty = signature !== seedSig;

  useEffect(() => {
    if (!dirty) return;
    const handle = setTimeout(save, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [signature, dirty, save]);

  return status;
}
