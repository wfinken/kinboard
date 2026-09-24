import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { calendars } from '../../../../db/schema';
import { listGoogleCalendars } from '../../../../lib/google-calendar';

export const POST: APIRoute = async ({ locals, redirect }) => {
  const userId = locals.session?.user?.id;
  if (!userId) return redirect('/admin/login');

  let googleCalendars: Awaited<ReturnType<typeof listGoogleCalendars>>;
  try {
    googleCalendars = await listGoogleCalendars(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return redirect(`/admin/calendars?error=${encodeURIComponent(message)}`);
  }

  for (const cal of googleCalendars) {
    const existing = await db.query.calendars.findFirst({
      where: and(eq(calendars.userId, userId), eq(calendars.googleCalendarId, cal.id)),
    });

    if (!existing) {
      await db.insert(calendars).values({
        userId,
        googleCalendarId: cal.id,
        name: cal.summary,
        color: cal.backgroundColor ?? '#a78bfa',
      });
    }
  }

  return redirect(`/admin/calendars?synced=${googleCalendars.length}`);
};
