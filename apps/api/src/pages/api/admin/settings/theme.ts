import type { APIRoute } from 'astro';
import { getDashboardSettings, saveDashboardSettings } from '../../../../lib/settings';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();
  const theme = form.get('theme') === 'light' ? 'light' : 'dark';
  const settings = await getDashboardSettings(locals.familyId);
  await saveDashboardSettings({ ...settings, theme }, locals.familyId);
  return redirect(String(form.get('returnTo') ?? '/admin'));
};
