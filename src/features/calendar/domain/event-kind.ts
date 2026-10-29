import { EVENT_KINDS, type EventKind } from '../types';

export function isEventKind(value: string): value is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(value);
}
