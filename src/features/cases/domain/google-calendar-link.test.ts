import { describe, expect, it } from 'vitest';

import { buildGoogleCalendarEventUrl } from './google-calendar-link';

describe('buildGoogleCalendarEventUrl', () => {
  const start = new Date('2026-05-21T09:00:00.000Z');
  const end = new Date('2026-05-21T10:30:00.000Z');

  it('builds a TEMPLATE url with compact UTC dates', () => {
    const url = buildGoogleCalendarEventUrl({ title: 'Meeting', start, end });
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(
      'https://calendar.google.com/calendar/render',
    );
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('Meeting');
    expect(parsed.searchParams.get('dates')).toBe(
      '20260521T090000Z/20260521T103000Z',
    );
  });

  it('omits optional details and location when not provided', () => {
    const parsed = new URL(buildGoogleCalendarEventUrl({ title: 'X', start, end }));
    expect(parsed.searchParams.has('details')).toBe(false);
    expect(parsed.searchParams.has('location')).toBe(false);
  });

  it('includes details and location when provided', () => {
    const parsed = new URL(
      buildGoogleCalendarEventUrl({
        title: 'X',
        start,
        end,
        details: 'note',
        location: 'office',
      }),
    );
    expect(parsed.searchParams.get('details')).toBe('note');
    expect(parsed.searchParams.get('location')).toBe('office');
  });

  it('round-trips Hebrew titles and special characters via encoding', () => {
    const parsed = new URL(
      buildGoogleCalendarEventUrl({ title: 'פגישה & ייעוץ', start, end }),
    );
    expect(parsed.searchParams.get('text')).toBe('פגישה & ייעוץ');
  });
});
