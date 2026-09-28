import type { APIRoute } from 'astro';
import { getDashboardSettings, saveDashboardSettings } from '../../../../lib/settings';
import { DASHBOARD_WIDGETS, type DashboardWidgetId } from '../../../../db/schema';

export const POST: APIRoute = async ({ request, locals, url }) => {
  const body = await request.json().catch(() => null) as { order?: unknown } | null;
  if (!Array.isArray(body?.order)) return new Response('Invalid order', { status: 400 });
  const familyId = locals.familyId ?? url.searchParams.get('family');
  if (!familyId) return new Response('Family required', { status: 409 });
  const current = await getDashboardSettings(familyId);
  const requested = body.order.filter((id): id is DashboardWidgetId => typeof id === 'string' && DASHBOARD_WIDGETS.includes(id as DashboardWidgetId));
  const order = [...new Set(requested)].filter((id) => current.widgetOrder.includes(id));
  for (const id of current.widgetOrder) if (!order.includes(id)) order.push(id);
  await saveDashboardSettings({ ...current, widgetOrder: order }, familyId);
  return new Response(null, { status: 204 });
};
