import { describe, expect, it } from 'vitest';

import { isScheduledDelivery, resolveScheduledDelivery } from './scheduled-delivery';

describe('resolveScheduledDelivery', () => {
  const now = new Date('2026-07-16T09:00:00.000Z');

  it('treats an empty picker as "deliver now"', () => {
    expect(resolveScheduledDelivery(null, now)).toEqual({ ok: true, iso: null });
    expect(resolveScheduledDelivery('', now)).toEqual({ ok: true, iso: null });
    expect(resolveScheduledDelivery(undefined, now)).toEqual({ ok: true, iso: null });
  });

  // The office means 08:00 IN ISRAEL. Summer is UTC+3, winter UTC+2 — the
  // instant must shift with DST, or a scheduled task lands an hour off.
  it('reads the wall clock as Israel time across DST', () => {
    expect(resolveScheduledDelivery('2026-07-19T08:00', now)).toEqual({
      ok: true,
      iso: '2026-07-19T05:00:00.000Z',
    });
    expect(resolveScheduledDelivery('2026-12-20T08:00', now)).toEqual({
      ok: true,
      iso: '2026-12-20T06:00:00.000Z',
    });
  });

  it('rejects a past time', () => {
    expect(resolveScheduledDelivery('2026-07-16T08:00', now)).toEqual({ ok: false, error: 'past' });
  });

  // Submitting takes a few seconds; a time picked as "now" must not fail.
  it('allows a just-passed time within the grace window', () => {
    // 11:59 Israel (08:59Z) vs a 09:00Z now — 60s in the past.
    expect(resolveScheduledDelivery('2026-07-16T11:59', now)).toEqual({
      ok: true,
      iso: '2026-07-16T08:59:00.000Z',
    });
  });

  it('rejects malformed input', () => {
    expect(resolveScheduledDelivery('nope', now)).toEqual({ ok: false, error: 'invalid' });
    expect(resolveScheduledDelivery('2026-07-19T25:00', now)).toEqual({ ok: false, error: 'invalid' });
    expect(resolveScheduledDelivery('2026-13-19T08:00', now)).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('isScheduledDelivery', () => {
  const now = new Date('2026-07-16T09:00:00.000Z');

  // Mirrors the SQL guard in migration 218 — these must agree or the bell and
  // the email disagree about whether the assignee has been told.
  it('is true only for a snoozed task parked in the future', () => {
    expect(isScheduledDelivery('snoozed', '2026-07-19T05:00:00.000Z', now)).toBe(true);
  });

  it('is false once the parked time has passed (the cron is about to deliver)', () => {
    expect(isScheduledDelivery('snoozed', '2026-07-16T08:00:00.000Z', now)).toBe(false);
  });

  it('is false for any non-snoozed status', () => {
    expect(isScheduledDelivery('pending', '2026-07-19T05:00:00.000Z', now)).toBe(false);
    expect(isScheduledDelivery('completed', '2026-07-19T05:00:00.000Z', now)).toBe(false);
  });

  it('is false when there is no parked time or the value is junk', () => {
    expect(isScheduledDelivery('snoozed', null, now)).toBe(false);
    expect(isScheduledDelivery('snoozed', 'not-a-date', now)).toBe(false);
    expect(isScheduledDelivery(null, null, now)).toBe(false);
  });
});
