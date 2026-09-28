import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { calendarEvents } from '../../../../db/schema';
import { and, eq } from 'drizzle-orm';
import { calendars, accounts } from '../../../../db/schema';
import { createGoogleCalendarEvent } from '../../../../lib/google-calendar';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const start = String(form.get('start') ?? '').trim();
  const end = String(form.get('end') ?? '').trim();
  const memberId = String(form.get('memberId') ?? '').trim() || null;
  const calendarId = String(form.get('calendarId') ?? '').trim();
  const allDay = form.get('allDay') === 'on';
  const familyId = locals.familyId;
  const userId = locals.session?.user?.id;
  const returnTo = String(form.get('returnTo') ?? '/admin/calendars');
  if (title && start && end && end >= start && familyId) {
    if (calendarId && userId) {
      const calendar = await db.query.calendars.findFirst({
        where: and(eq(calendars.id, calendarId), eq(calendars.familyId, familyId), eq(calendars.userId, userId), eq(calendars.enabled, true)),
      });
      const account = await db.query.accounts.findFirst({ where: and(eq(accounts.userId, userId), eq(accounts.provider, 'google')) });
      if (!calendar) return redirect(`${returnTo}?eventError=${encodeURIComponent('Choose a calendar connected to your Google account.')}`);
      if (!account?.scope?.split(/\s+/).includes('https://www.googleapis.com/auth/calendar.events')) {
        return redirect(`/api/admin/calendars/connect?returnTo=${encodeURIComponent(returnTo)}`);
      }
      try {
        await createGoogleCalendarEvent(userId, calendar.googleCalendarId, { title, start, end, allDay });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not create Google Calendar event.';
        return redirect(`${returnTo}?eventError=${encodeURIComponent(message)}`);
      }
    }
    await db.insert(calendarEvents).values({ familyId, title, start, end, memberId, allDay });
  }
  return redirect(returnTo);
};
