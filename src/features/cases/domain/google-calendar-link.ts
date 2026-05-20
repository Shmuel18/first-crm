/**
 * Builds a Google Calendar "create event" template URL (no OAuth needed).
 * Opening it pre-fills a new event the user saves to their own calendar.
 */
type GoogleCalendarEvent = {
  title: string;
  start: Date;
  end: Date;
  details?: string;
  location?: string;
};

// Google's TEMPLATE format wants compact UTC: YYYYMMDDTHHMMSSZ.
function toCompactUtc(d: Date): string {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, '');
}

export function buildGoogleCalendarEventUrl(e: GoogleCalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${toCompactUtc(e.start)}/${toCompactUtc(e.end)}`,
  });
  if (e.details) params.set('details', e.details);
  if (e.location) params.set('location', e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
