// @ts-nocheck
import { google } from "googleapis";

const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
const calendarTimeZone = "America/Sao_Paulo";
const preReservationPrefix = "Pré-reserva — ";

/**
 * NOVA FUNÇÃO DE AUTENTICAÇÃO:
 * Lê o e-mail e a chave privada separadamente das variáveis de ambiente
 * e utiliza o JWT (JSON Web Token) para autenticar.
 */
function getCalendarClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  // O .replace garante que as quebras de linha (\n) da string sejam lidas corretamente
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error("As variáveis GOOGLE_CLIENT_EMAIL ou GOOGLE_PRIVATE_KEY não estão configuradas.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth: auth as any });
}

type CalendarEvent = {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  start?: { date?: string | null; dateTime?: string | null } | null;
  end?: { date?: string | null; dateTime?: string | null } | null;
};

function dateOnly(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: calendarTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function monthEndExclusive(year: number, month: number): string {
  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function eventStartDate(ev: CalendarEvent): string | undefined {
  if (ev.start?.date) return ev.start.date;
  return ev.start?.dateTime ? dateOnly(new Date(ev.start.dateTime)) : undefined;
}

function eventEndExclusiveDate(ev: CalendarEvent): string | undefined {
  if (ev.end?.date) return ev.end.date;
  if (!ev.end?.dateTime) return undefined;
  const end = dateOnly(new Date(ev.end.dateTime));
  const start = ev.start?.dateTime
    ? dateOnly(new Date(ev.start.dateTime))
    : undefined;
  return start && end <= start ? addDays(start, 1) : end;
}

async function listEvents(
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient();
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false,
      timeMin: `${timeMin}T00:00:00-03:00`,
      timeMax: `${timeMax}T00:00:00-03:00`,
      maxResults: 2500,
      pageToken,
    });
    events.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}

function occupiedDatesFromEvents(
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const occupied = new Set<string>();

  for (const ev of events) {
    if (
      ev.status === "cancelled" ||
      ev.summary?.startsWith(preReservationPrefix)
    ) {
      continue;
    }
    const start = eventStartDate(ev);
    const end = eventEndExclusiveDate(ev);
    if (!start || !end || end <= rangeStart || start >= rangeEnd) continue;

    let cur = start < rangeStart ? rangeStart : start;
    const last = end > rangeEnd ? rangeEnd : end;
    while (cur < last) {
      occupied.add(cur);
      cur = addDays(cur, 1);
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

  const calendar = getCalendarClient();
  const res = await calendar.events.insert({
    calendarId,
    sendUpdates: "none",
    requestBody: {
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
    },
  });

  const id = res.data.id;
  if (!id) throw new Error("Google Calendar did not return an event id");
  return id;
}