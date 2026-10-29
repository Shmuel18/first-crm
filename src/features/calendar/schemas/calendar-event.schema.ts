import { z } from 'zod';

import { EVENT_KINDS } from '../types';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Minutes-before choices offered in the form; null = no reminder. */
export const REMINDER_CHOICES = [null, 60, 1440] as const;

export const CalendarEventSchema = z
  .object({
    id: z.uuid().nullable(),
    title: z.string().trim().min(1).max(200),
    kind: z.enum(EVENT_KINDS),
    /** Israel civil day. */
    date: z.string().regex(DAY),
    /** Israel wall-clock "HH:MM"; null = all-day event. */
    startTime: z.string().regex(TIME).nullable(),
    endTime: z.string().regex(TIME).nullable(),
    location: z.string().trim().max(200).nullable(),
    notes: z.string().trim().max(2000).nullable(),
    caseId: z.uuid().nullable(),
    reminderMinutes: z.union([z.literal(60), z.literal(1440)]).nullable(),
    participantIds: z.array(z.uuid()).max(30),
  })
  .refine((v) => !v.endTime || !v.startTime || v.endTime >= v.startTime, {
    path: ['endTime'],
    message: 'calendar.errors.endBeforeStart',
  });

export type CalendarEventInput = z.infer<typeof CalendarEventSchema>;
