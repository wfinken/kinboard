import type { APIRoute } from 'astro';
import { getDashboardSettings, saveDashboardSettings } from '../../../../lib/settings';
import { listWritableFamilyCalendars } from '../../../../lib/google-calendar';
import { requirePermission } from '../../../../lib/permissions';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const denied = await requirePermission(locals, 'calendars', 'update');
  if (denied) return denied;
  const form = await request.formData();
  const selected = String(form.get('defaultEventCalendarId') ?? 'local');
  const writable = await listWritableFamilyCalendars(locals.familyId!);
  const defaultEventCalendarId = selected === 'local' || writable.some((calendar) => calendar.id === selected) ? selected : 'local';
  const settings = await getDashboardSettings(locals.familyId);
  await saveDashboardSettings({ ...settings, defaultEventCalendarId }, locals.familyId);
  return redirect('/admin/calendars?savedDefault=1');
};
