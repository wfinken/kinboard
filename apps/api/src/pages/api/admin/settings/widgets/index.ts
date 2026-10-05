import type { APIRoute } from 'astro';
import { saveDashboardSettings } from '../../../../../lib/settings';
import { DASHBOARD_WIDGETS, DASHBOARD_WIDGET_SIZES, type DashboardWidgetId, type DashboardWidgetSize } from '../../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();

  // FormData preserves document order, so the widget_* keys that made it
  // through (checked boxes only) arrive in the same order they were
  // rendered in — i.e. the display order set by the "move" endpoint.
  const widgetOrder: DashboardWidgetId[] = [];
  for (const key of form.keys()) {
    if (!key.startsWith('widget_')) continue;
    const id = key.slice('widget_'.length) as DashboardWidgetId;
    if (DASHBOARD_WIDGETS.includes(id)) widgetOrder.push(id);
  }

  const refreshSeconds = Number(form.get('refreshSeconds'));
  if (!Number.isInteger(refreshSeconds) || refreshSeconds < 30 || refreshSeconds > 86400) return new Response('Refresh interval must be 30–86400 seconds.', { status: 400 });
  const theme = form.get('theme') === 'light' ? 'light' : 'dark';
  const timezone = String(form.get('timezone') || 'auto');
  if (timezone !== 'auto') {
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
    catch { return new Response('Unsupported time zone.', { status: 400 }); }
  }
  const current = await (await import('../../../../../lib/settings')).getDashboardSettings(locals.familyId);
  const widgetSizes = { ...current.widgetSizes };
  for (const id of DASHBOARD_WIDGETS) {
    const size = form.get(`size_${id}`);
    if (typeof size === 'string' && (DASHBOARD_WIDGET_SIZES as readonly string[]).includes(size)) widgetSizes[id] = size as DashboardWidgetSize;
  }

  await saveDashboardSettings({ widgetOrder, refreshSeconds, theme, timezone, widgetSizes, defaultEventCalendarId: current.defaultEventCalendarId }, locals.familyId);

  return redirect('/admin/layout');
};
