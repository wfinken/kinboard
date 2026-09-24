import type { APIRoute } from 'astro';
import { saveDashboardSettings } from '../../../../../lib/settings';
import { DASHBOARD_WIDGETS, type DashboardWidgetId } from '../../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect }) => {
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

  const refreshSeconds = Math.max(30, Number(form.get('refreshSeconds')) || 300);
  const theme = form.get('theme') === 'light' ? 'light' : 'dark';

  await saveDashboardSettings({ widgetOrder, refreshSeconds, theme });

  return redirect('/admin/layout');
};
