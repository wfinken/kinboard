import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { calendarEvents } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const start = String(form.get('start') ?? '').trim();
  const end = String(form.get('end') ?? '').trim();
  const memberId = String(form.get('memberId') ?? '').trim() || null;
  const allDay = form.get('allDay') === 'on';
  if (title && start && end && end >= start) {
    await db.insert(calendarEvents).values({ title, start, end, memberId, allDay });
  }
  return redirect('/admin/calendars');
};
