/** Calendar layers — each one a colour and an on/off toggle (spec 2026-10-29). */
export const CALENDAR_LAYERS = [
  'stage',
  'targetDate',
  'task',
  'event',
  'expiry',
  'agreement',
  'opened',
] as const;
export type CalendarLayer = (typeof CALENDAR_LAYERS)[number];

export const CALENDAR_VIEWS = ['month', 'week', 'day', 'agenda'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const EVENT_KINDS = [
  'client_meeting',
  'bank_meeting',
  'signing',
  'appraiser',
  'reminder',
  'other',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** What dragging / editing an item changes, if anything. */
export type CalendarEditable =
  | { kind: 'targetDate'; caseId: string }
  | { kind: 'task'; taskId: string }
  | { kind: 'event'; eventId: string }
  | null;

export type CalendarItem = {
  /** Unique across layers, e.g. "task:<id>". */
  key: string;
  layer: CalendarLayer;
  /** Israel civil day, YYYY-MM-DD. */
  day: string;
  /** Israel wall-clock "HH:MM" for timed items; null = all day. */
  time: string | null;
  /** Israel wall-clock "HH:MM" end, for timed events. */
  endTime: string | null;
  title: string;
  /** Sub-line: the client ("כהן משה"), or null. */
  caseLabel: string | null;
  /** Not shown — kept so the search still finds an item by its case number. */
  caseNumber: string | null;
  caseId: string | null;
  /** Responsible advisor of the case (or event participants) for the filter. */
  advisorIds: ReadonlyArray<string>;
  /** Layer-specific extra: stage direction, event kind, expiry subject… */
  detail: string | null;
  /** 'back' marks a stage change to an earlier stage. */
  direction?: 'forward' | 'back';
  /** Overdue target date / task (red). */
  overdue?: boolean;
  editable: CalendarEditable;
  href: string | null;
};

/** A calendar event as the edit dialog needs it. */
export type CalendarEventRecord = {
  id: string;
  title: string;
  kind: EventKind;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  caseId: string | null;
  reminderMinutes: number | null;
  participantIds: string[];
};
