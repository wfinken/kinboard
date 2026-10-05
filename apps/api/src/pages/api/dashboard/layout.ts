import type { APIRoute } from 'astro';
import { DASHBOARD_WIDGETS, DASHBOARD_WIDGET_SIZES, type DashboardWidgetId, type DashboardWidgetSize } from '../../../db/schema';
import { getDashboardSettings, getUserDashboardLayout, saveUserDashboardLayout } from '../../../lib/settings';

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = locals.session?.user?.id;
  const familyId = locals.familyId;
  if (!userId || !familyId) return new Response('Unauthorized', { status: 401 });

  let input: unknown;
  try { input = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (!input || typeof input !== 'object') return new Response('Invalid layout', { status: 400 });
  const body = input as { widgetOrder?: unknown; widgetSizes?: unknown };
  if (!Array.isArray(body.widgetOrder) || !body.widgetSizes || typeof body.widgetSizes !== 'object') {
    return new Response('Invalid layout', { status: 400 });
  }

  const defaults = await getDashboardSettings(familyId);
  const current = await getUserDashboardLayout(userId, familyId, defaults);
  const order = body.widgetOrder.filter((id): id is DashboardWidgetId => typeof id === 'string' && DASHBOARD_WIDGETS.includes(id as DashboardWidgetId));
  const uniqueOrder = [...new Set(order)];
  const widgetOrder = [...uniqueOrder, ...current.widgetOrder.filter((id) => !uniqueOrder.includes(id))];
  const rawSizes = body.widgetSizes as Record<string, unknown>;
  const widgetSizes = { ...current.widgetSizes };
  for (const id of DASHBOARD_WIDGETS) {
    const value = rawSizes[id];
    if (typeof value === 'string' && (DASHBOARD_WIDGET_SIZES as readonly string[]).includes(value)) widgetSizes[id] = value as DashboardWidgetSize;
  }

  await saveUserDashboardLayout(userId, familyId, widgetOrder, widgetSizes);
  return new Response(null, { status: 204 });
};
