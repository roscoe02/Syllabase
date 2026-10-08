import ical from "ical-generator";

export interface ExportableEvent {
  id: string;
  title: string;
  courseCode: string | null;
  description: string | null;
  url: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
}

/**
 * Build the student's subscribable feed (Google / Apple / Outlook "subscribe by URL").
 * Google re-polls roughly every 12-24h; Apple every 5-60 min. For instant updates later,
 * add Google Calendar API sync with the narrow `calendar.app.created` scope.
 */
export function buildIcs(events: ExportableEvent[], timezone: string): string {
  const cal = ical({ name: "Syllabase", prodId: "//Syllabase//Syllabase//EN", timezone, ttl: 60 * 60 });
  for (const e of events) {
    cal.createEvent({
      id: `${e.id}@syllabase`,
      summary: e.courseCode ? `${e.title} [${e.courseCode}]` : e.title,
      description: e.description,
      url: e.url,
      start: e.startsAt,
      end: e.endsAt ?? e.startsAt,
      allDay: e.allDay,
    });
  }
  return cal.toString();
}
