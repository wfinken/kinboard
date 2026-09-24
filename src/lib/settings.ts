import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { dashboardSettings, DASHBOARD_WIDGETS, type DashboardWidgetId } from '../db/schema';

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  clock: 'Clock',
  weather: 'Weather',
  calendar: 'Calendar',
  meals: 'Meal Plan',
  chores: 'Chores',
  notes: 'Bulletin Board',
};

export type DashboardTheme = 'light' | 'dark';

export interface DashboardSettings {
  widgetOrder: DashboardWidgetId[];
  refreshSeconds: number;
  theme: DashboardTheme;
}

const DEFAULTS: DashboardSettings = {
  widgetOrder: [...DASHBOARD_WIDGETS],
  refreshSeconds: 300,
  theme: 'dark',
};

export async function getDashboardSettings(): Promise<DashboardSettings> {
  const row = await db.query.dashboardSettings.findFirst({
    where: eq(dashboardSettings.id, 'default'),
  });
  if (!row) return DEFAULTS;

  // Guard against stale ids lingering after a code change that renamed/removed a widget.
  const widgetOrder = row.widgetOrder.filter((id) => DASHBOARD_WIDGETS.includes(id));
  return { widgetOrder, refreshSeconds: row.refreshSeconds, theme: row.theme };
}

export async function saveDashboardSettings(settings: DashboardSettings): Promise<void> {
  await db
    .insert(dashboardSettings)
    .values({ id: 'default', ...settings })
    .onConflictDoUpdate({
      target: dashboardSettings.id,
      set: settings,
    });
}
