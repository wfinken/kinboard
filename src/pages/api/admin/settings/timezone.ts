import type { APIRoute } from 'astro';
import { getDashboardSettings, saveDashboardSettings } from '../../../../lib/settings';

const SUPPORTED_TIMEZONES = new Set([
  'auto', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney',
]);

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const timezone = String(form.get('timezone') || 'auto');
  if (!SUPPORTED_TIMEZONES.has(timezone)) return new Response('Unsupported time zone', { status: 400 });
  const settings = await getDashboardSettings();
  await saveDashboardSettings({ ...settings, timezone });
  return redirect('/admin/account');
};
