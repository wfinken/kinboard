import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../db/client';
import { calendarEvents } from '../../../../../db/schema';
import { requirePermission } from '../../../../../lib/permissions';

// Only KinBoard-only events live in calendarEvents — Google-synced events
// are fetched live from Google's API (see fetchUpcomingEvents) and aren't
// deletable through this route.
export const POST: APIRoute = async ({ params, redirect, locals }) => {
  const denied = await requirePermission(locals, 'calendars', 'delete');
  if (denied) return denied;
  if (params.id) {
    await db.delete(calendarEvents).where(and(eq(calendarEvents.id, params.id), eq(calendarEvents.familyId, locals.familyId!)));
  }
  return redirect('/');
};
