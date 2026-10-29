'use client';

import { useEffect, useState } from 'react';

import { CALENDAR_LAYERS, type CalendarLayer } from '../types';

const STORAGE_KEY = 'calendar:layers';

function isLayer(value: unknown): value is CalendarLayer {
  return typeof value === 'string' && (CALENDAR_LAYERS as readonly string[]).includes(value);
}

/**
 * Which layers are switched on, remembered per browser (spec: "the choice is
 * remembered for each user"). Storage can be unavailable (private mode) — the
 * calendar then simply starts with every layer on.
 */
export function useCalendarLayers(): {
  layers: ReadonlySet<CalendarLayer>;
  toggleLayer: (layer: CalendarLayer) => void;
} {
  const [layers, setLayers] = useState<ReadonlySet<CalendarLayer>>(() => new Set(CALENDAR_LAYERS));
  const [loaded, setLoaded] = useState(false);

  // Read after mount, not during render, so server and client markup agree.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
      if (Array.isArray(parsed)) setLayers(new Set(parsed.filter(isLayer)));
    } catch {
      // storage blocked or corrupt — keep the default
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...layers]));
    } catch {
      // storage blocked — the choice just isn't remembered
    }
  }, [layers, loaded]);

  const toggleLayer = (layer: CalendarLayer): void =>
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });

  return { layers, toggleLayer };
}
