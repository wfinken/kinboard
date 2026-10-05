import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { calendarEvents } from '../../../../db/schema';
import { and, eq } from 'drizzle-orm';
import { calendars, accounts, householdMembers } from '../../../../db/schema';
import { createGoogleCalendarEvent, listWritableFamilyCalendars } from '../../../../lib/google-calendar';
import { requirePermission } from '../../../../lib/permissions';
import { getDashboardSettings } from '../../../../lib/settings';
import { householdTimezone } from '../../../../lib/dates';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const denied = await requirePermission(locals, 'calendars', 'create');
  if (denied) return denied;
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const start = String(form.get('start') ?? '').trim();
  let end = String(form.get('end') ?? '').trim();
  const location = String(form.get('location') ?? '').trim().slice(0, 500);
  const description = String(form.get('description') ?? '').trim().slice(0, 5000);
  const memberId = String(form.get('memberId') ?? '').trim() || null;
  const settings = await getDashboardSettings(locals.familyId);
  const calendarId = String(form.get('calendarId') ?? '').trim() || settings.defaultEventCalendarId || 'local';
  const allDay = form.get('allDay') === 'on';
  const eventTimezone = settings.timezone === 'auto' ? householdTimezone() : settings.timezone;
  const familyId = locals.familyId;
  const returnTo = String(form.get('returnTo') ?? '/admin/calendars');
  if (allDay && !end) end = start;
  const validDates = allDay
    ? /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start
    : Boolean(start && end && end > start && !Number.isNaN(Date.parse(`${start}:00Z`)) && !Number.isNaN(Date.parse(`${end}:00Z`)));
  if (!title || title.length > 200 || !validDates) return new Response('Enter a title and valid event start/end dates.', { status: 400 });
  if (memberId && !await db.query.householdMembers.findFirst({ where: and(eq(householdMembers.id, memberId), eq(householdMembers.familyId, familyId!)) })) return new Response('Choose a member of this family.', { status: 400 });
  if (title && validDates && familyId) {
    if (calendarId && calendarId !== 'local') {
      // Calendars are owned per app-user, not per whoever is adding this
      // event — the family member creating it may not be the one who
      // connected the calendar, so look up the token via the calendar's own
      // owner rather than locals.session.
      const calendar = await db.query.calendars.findFirst({
        where: and(eq(calendars.id, calendarId), eq(calendars.familyId, familyId), eq(calendars.enabled, true)),
      });
      if (!calendar) return redirect(`${returnTo}?eventError=${encodeURIComponent('That calendar is no longer available.')}`);
      const writable = await listWritableFamilyCalendars(familyId);
      if (!writable.some((candidate) => candidate.id === calendar.id)) return redirect(`${returnTo}?eventError=${encodeURIComponent('That calendar is not enabled for event creation.')}`);
      const account = await db.query.accounts.findFirst({ where: and(eq(accounts.userId, calendar.userId), eq(accounts.provider, 'google')) });
      if (!account?.scope?.split(/\s+/).includes('https://www.googleapis.com/auth/calendar.events')) {
        return redirect(`${returnTo}?eventError=${encodeURIComponent('That calendar needs to reconnect Google event access from Family Admin.')}`);
      }
      try {
        await createGoogleCalendarEvent(calendar.userId, calendar.googleCalendarId, { title, start, end, allDay, location, description, timezone: eventTimezone, memberId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not create Google Calendar event.';
        return redirect(`${returnTo}?eventError=${encodeURIComponent(message)}`);
      }
    } else {
      await db.insert(calendarEvents).values({ familyId, title, start, end, memberId, allDay, location, description });
    }
  }
  return redirect(returnTo);
};
