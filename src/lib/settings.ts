import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { dashboardSettings, DASHBOARD_WIDGETS, type DashboardWidgetId } from '../db/schema';

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  clock: 'Clock',
  weather: 'Weather',
  calendar: 'Calendar',
  meals: 'Meal Plan',
  chores: 'Chores',
  allowance: 'Allowance',
  notes: 'Bulletin Board',
};

export type DashboardTheme = 'light' | 'dark';

export interface DashboardSettings {
  widgetOrder: DashboardWidgetId[];
  refreshSeconds: number;
  theme: DashboardTheme;
  timezone: string;
  widgetSizes: Partial<Record<DashboardWidgetId, '1x1' | '2x1' | '2x2'>>;
}

const DEFAULTS: DashboardSettings = {
  widgetOrder: [...DASHBOARD_WIDGETS],
  refreshSeconds: 300,
  theme: 'dark',
  timezone: 'auto',
  widgetSizes: { clock: '1x1', weather: '2x1', calendar: '2x2', meals: '1x1', chores: '2x1', allowance: '1x1', notes: '1x1' },
};

export async function getDashboardSettings(familyId?: string | null): Promise<DashboardSettings> {
  if (!familyId) return DEFAULTS;
  const row = await db.query.dashboardSettings.findFirst({
    where: eq(dashboardSettings.id, familyId),
  });
  if (!row) return DEFAULTS;

  // Guard against stale ids lingering after a code change that renamed/removed a widget.
  const widgetOrder = row.widgetOrder.filter((id) => DASHBOARD_WIDGETS.includes(id));
  return { widgetOrder, refreshSeconds: row.refreshSeconds, theme: row.theme, timezone: row.timezone, widgetSizes: { ...DEFAULTS.widgetSizes, ...row.widgetSizes } };
}

export async function saveDashboardSettings(settings: DashboardSettings, familyId?: string | null): Promise<void> {
  if (!familyId) return;
  await db
    .insert(dashboardSettings)
    .values({ id: familyId, ...settings })
    .onConflictDoUpdate({
      target: dashboardSettings.id,
      set: settings,
    });
}
