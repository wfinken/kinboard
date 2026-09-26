import type { APIRoute } from 'astro';
import { getDashboardSettings, saveDashboardSettings } from '../../../../lib/settings';
import { DASHBOARD_WIDGETS, type DashboardWidgetId } from '../../../../db/schema';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null) as { order?: unknown } | null;
  if (!Array.isArray(body?.order)) return new Response('Invalid order', { status: 400 });
  const current = await getDashboardSettings();
  const requested = body.order.filter((id): id is DashboardWidgetId => typeof id === 'string' && DASHBOARD_WIDGETS.includes(id as DashboardWidgetId));
  const order = [...new Set(requested)].filter((id) => current.widgetOrder.includes(id));
  for (const id of current.widgetOrder) if (!order.includes(id)) order.push(id);
  await saveDashboardSettings({ ...current, widgetOrder: order });
  return new Response(null, { status: 204 });
};
