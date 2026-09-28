import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { accounts, calendars, calendarEvents, householdMembers } from '../db/schema';

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  start: string; // ISO datetime, or YYYY-MM-DD for all-day events
  end: string;
  allDay: boolean;
  color: string;
  memberName?: string;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Google access token: ${res.status}`);
  }

  return (await res.json()) as { access_token: string; expires_in: number };
}

/** Returns a valid Google access token for the user, refreshing it if expired. */
export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, 'google')),
  });

  if (!account?.access_token) return null;

  const isExpired = account.expires_at != null && account.expires_at * 1000 < Date.now() + 60_000;

  if (!isExpired) return account.access_token;

  if (!account.refresh_token) return account.access_token;

  // Never let a refresh failure crash a caller (e.g. the public dashboard) —
  // callers that need to surface this to a user check for a null token
  // themselves (see listGoogleCalendars).
  try {
    const refreshed = await refreshAccessToken(account.refresh_token);
    const newExpiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;

    await db
      .update(accounts)
      .set({ access_token: refreshed.access_token, expires_at: newExpiresAt })
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'google')));

    return refreshed.access_token;
  } catch (error) {
    console.error('Google access token refresh failed:', error);
    return null;
  }
}

/** Fetches events in [timeMin, timeMax) across all enabled calendars for a user. */
export async function fetchUpcomingEvents(
  familyId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const localEvents = await db
    .select({ event: calendarEvents, member: householdMembers })
    .from(calendarEvents)
    .where(eq(calendarEvents.familyId, familyId))
    .leftJoin(householdMembers, eq(calendarEvents.memberId, householdMembers.id));
  const local: CalendarEvent[] = localEvents
    .filter(({ event }) => event.start < timeMax.toISOString().slice(0, 19) && event.end >= timeMin.toISOString().slice(0, 19))
    .map(({ event, member }) => ({
      id: event.id,
      calendarId: 'local',
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      color: member?.color ?? '#a78bfa',
      memberName: member?.name,
    }));

  const enabledCalendars = await db.query.calendars.findMany({
    where: and(eq(calendars.familyId, familyId), eq(calendars.enabled, true)),
  });

  const calendarsByUser = new Map<string, typeof enabledCalendars>();
  for (const calendar of enabledCalendars) {
    const userCalendars = calendarsByUser.get(calendar.userId) ?? [];
    userCalendars.push(calendar);
    calendarsByUser.set(calendar.userId, userCalendars);
  }

  const results = await Promise.all([...calendarsByUser].map(async ([userId, userCalendars]) => {
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) return [];
    return Promise.all(userCalendars.map(async (cal) => {
      try {
        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.googleCalendarId)}/events`,
        );
        url.searchParams.set('timeMin', timeMin.toISOString());
        url.searchParams.set('timeMax', timeMax.toISOString());
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('orderBy', 'startTime');

        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) {
          console.error(`Google events request failed for calendar ${cal.googleCalendarId}: ${res.status}`);
          return [];
        }

        const data = (await res.json()) as {
          items?: Array<{
            id: string;
            summary?: string;
            start?: { date?: string; dateTime?: string };
            end?: { date?: string; dateTime?: string };
          }>;
        };

        return (data.items ?? []).map((item): CalendarEvent => ({
          id: item.id,
          calendarId: cal.id,
          title: item.summary ?? '(No title)',
          start: item.start?.dateTime ?? item.start?.date ?? '',
          end: item.end?.dateTime ?? item.end?.date ?? '',
          allDay: Boolean(item.start?.date),
          color: cal.color,
        }));
      } catch (error) {
        console.error(`Google events request failed for calendar ${cal.googleCalendarId}:`, error);
        return [];
      }
    }));
  }));

  return [...local, ...results.flat(2)].sort((a, b) => a.start.localeCompare(b.start));
}

/** Lists the Google Calendars available to the user's account (for admin setup). */
export async function listGoogleCalendars(userId: string) {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) {
    throw new Error('No Google access token on file for this account — try signing in again.');
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`Google calendarList request failed: ${res.status} ${body}`);
    throw new Error(`Google Calendar API request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    items?: Array<{ id: string; summary: string; backgroundColor?: string }>;
  };

  return data.items ?? [];
}

/** Creates an event in a Google calendar using the user's existing token.
 *  The caller should only offer calendars owned by that user. */
export async function createGoogleCalendarEvent(
  userId: string,
  googleCalendarId: string,
  event: { title: string; start: string; end: string; allDay: boolean },
) {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) throw new Error('Google access is unavailable. Please reconnect your Google account.');

  const body = {
    summary: event.title,
    start: event.allDay ? { date: event.start.slice(0, 10) } : { dateTime: new Date(event.start).toISOString() },
    end: event.allDay ? { date: event.end.slice(0, 10) } : { dateTime: new Date(event.end).toISOString() },
  };
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.text().catch(() => '');
    throw new Error(`Google Calendar event creation failed (${res.status}): ${responseBody.slice(0, 300)}`);
  }
  return res.json();
}
