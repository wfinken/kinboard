import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { calendars } from '../../../../db/schema';
import { requirePermission } from '../../../../lib/permissions';

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const denied = await requirePermission(locals, 'calendars', 'update');
  if (denied) return denied;
  if (!params.id) return redirect('/admin/calendars');

  const form = await request.formData();
  const enabled = form.get('enabled') === 'on';
  const color = String(form.get('color') ?? '#a78bfa');

  await db.update(calendars).set({ enabled, color }).where(and(eq(calendars.id, params.id), eq(calendars.familyId, locals.familyId!)));

  return redirect('/admin/calendars');
};
