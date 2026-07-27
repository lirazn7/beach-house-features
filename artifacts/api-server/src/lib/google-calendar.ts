import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();
const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
const calendarTimeZone = "America/Sao_Paulo";
const preReservationPrefix = "Pré-reserva — ";

type CalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

type CalendarEventsResponse = {
  items?: CalendarEvent[];
  nextPageToken?: string;
};

type CalendarEventInput = {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
};

function calendarPath(path: string): string {
  return `/calendar/v3/calendars/${encodeURIComponent(calendarId)}${path}`;
}

async function calendarRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await connectors.proxy("google-calendar", path, {
    method: options.method,
    headers: options.headers as Record<string, string> | undefined,
    body: options.body,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Calendar returned ${response.status}: ${detail}`);
  }
  return (await response.json()) as T;
}

function dateOnly(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: calendarTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function monthEndExclusive(year: number, month: number): string {
  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function eventStartDate(event: CalendarEvent): string | undefined {
  if (event.start?.date) return event.start.date;
  return event.start?.dateTime ? dateOnly(new Date(event.start.dateTime)) : undefined;
}

function eventEndExclusiveDate(event: CalendarEvent): string | undefined {
  if (event.end?.date) return event.end.date;
  if (!event.end?.dateTime) return undefined;

  const end = dateOnly(new Date(event.end.dateTime));
  const start = event.start?.dateTime
    ? dateOnly(new Date(event.start.dateTime))
    : undefined;

  // A timed event that starts and ends on the same calendar day still
  // occupies that day in a one-night booking calendar.
  return start && end <= start ? addDays(start, 1) : end;
}

async function listEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const query = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      timeMin: `${timeMin}T00:00:00-03:00`,
      timeMax: `${timeMax}T00:00:00-03:00`,
      maxResults: "2500",
    });
    if (pageToken) query.set("pageToken", pageToken);

    const result = await calendarRequest<CalendarEventsResponse>(
      `${calendarPath("/events")}?${query.toString()}`,
    );
    events.push(...(result.items ?? []));
    pageToken = result.nextPageToken;
  } while (pageToken);

  return events;
}

function occupiedDatesFromEvents(
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const occupied = new Set<string>();

  for (const event of events) {
    if (
      event.status === "cancelled" ||
      event.summary?.startsWith(preReservationPrefix)
    ) {
      continue;
    }

    const start = eventStartDate(event);
    const end = eventEndExclusiveDate(event);
    if (!start || !end || end <= rangeStart || start >= rangeEnd) continue;

    let current = start < rangeStart ? rangeStart : start;
    const last = end > rangeEnd ? rangeEnd : end;
    while (current < last) {
      occupied.add(current);
      current = addDays(current, 1);
    }
  }

  return [...occupied].sort();
}

export async function getOccupiedDates(
  year: number,
  month: number,
): Promise<string[]> {
  const rangeStart = monthStart(year, month);
  const rangeEnd = monthEndExclusive(year, month);
  const events = await listEvents(rangeStart, rangeEnd);
  return occupiedDatesFromEvents(events, rangeStart, rangeEnd);
}

export async function isRangeOccupied(
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  const events = await listEvents(checkIn, checkOut);
  return occupiedDatesFromEvents(events, checkIn, checkOut).length > 0;
}

export async function createPreReservation(input: {
  checkIn: string;
  checkOut: string;
  name: string;
  phone: string;
}): Promise<string> {
  const nights =
    (new Date(`${input.checkOut}T12:00:00Z`).getTime() -
      new Date(`${input.checkIn}T12:00:00Z`).getTime()) /
    86_400_000;

  const event = await calendarRequest<{ id?: string }>(
    `${calendarPath("/events")}?sendUpdates=none`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `${preReservationPrefix}${input.name}`,
        description: [
          "Pedido de pré-reserva pelo site Casa Juquehy.",
          `Nome: ${input.name}`,
          `Telefone: ${input.phone}`,
          `Check-in: ${input.checkIn}`,
          `Check-out: ${input.checkOut}`,
          `Noites: ${nights}`,
          "Confirmação pendente via WhatsApp.",
        ].join("\n"),
        start: { date: input.checkIn },
        end: { date: input.checkOut },
        extendedProperties: {
          private: { casaJuquehyPreReservation: "true" },
        },
      } satisfies CalendarEventInput & {
        extendedProperties: { private: { casaJuquehyPreReservation: string } };
      }),
    },
  );

  if (!event.id) {
    throw new Error("Google Calendar did not return an event id");
  }
  return event.id;
}