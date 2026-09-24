import type { APIRoute } from 'astro';
import { getDashboardSettings, saveDashboardSettings } from '../../../../../lib/settings';
import type { DashboardWidgetId } from '../../../../../db/schema';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const widgetId = String(form.get('widgetId')) as DashboardWidgetId;
  const direction = form.get('direction') === 'up' ? -1 : 1;

  const settings = await getDashboardSettings();
  const order = [...settings.widgetOrder];
  const index = order.indexOf(widgetId);
  const swapWith = index + direction;

  if (index !== -1 && swapWith >= 0 && swapWith < order.length) {
    [order[index], order[swapWith]] = [order[swapWith], order[index]];
    await saveDashboardSettings({ ...settings, widgetOrder: order });
  }

  return redirect('/admin/layout');
};
