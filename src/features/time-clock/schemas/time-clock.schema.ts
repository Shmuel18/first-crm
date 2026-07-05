import { z } from 'zod';

/** A note attached on clock-out (optional). */
export const ClockOutSchema = z.object({
  note: z.string().trim().max(500).nullish(),
});
export type ClockOutInput = z.infer<typeof ClockOutSchema>;

/** Manager create/edit of a single entry. `id` null → create a new shift. */
export const UpsertEntrySchema = z
  .object({
    id: z.uuid().nullish(),
    userId: z.uuid(),
    /** ISO timestamps (the client converts its datetime-local inputs). */
    clockIn: z.string().min(1).refine((s) => !Number.isNaN(Date.parse(s)), 'invalid_date'),
    clockOut: z
      .string()
      .min(1)
      .refine((s) => !Number.isNaN(Date.parse(s)), 'invalid_date')
      .nullish(),
    note: z.string().trim().max(500).nullish(),
  })
  .refine(
    (v) => v.clockOut == null || Date.parse(v.clockOut) >= Date.parse(v.clockIn),
    { message: 'out_before_in', path: ['clockOut'] },
  );
export type UpsertEntryInput = z.infer<typeof UpsertEntrySchema>;

/** Manager toggles which staff are hourly-tracked / auto-clocked-in. */
export const SetTrackingSchema = z.object({
  userId: z.uuid(),
  timeTracked: z.boolean(),
  autoClockIn: z.boolean(),
});
export type SetTrackingInput = z.infer<typeof SetTrackingSchema>;
