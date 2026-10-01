import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { dashboardSettings, userDashboardLayouts, DASHBOARD_WIDGETS, type DashboardWidgetId } from '../db/schema';

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  clock: 'Clock',
  weather: 'Weather',
  calendar: 'Calendar',
  meals: 'Meal Plan',
  chores: 'Chores',
  availability: 'Availability',
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
  defaultEventCalendarId: string;
}

const DEFAULTS: DashboardSettings = {
  widgetOrder: [...DASHBOARD_WIDGETS],
  refreshSeconds: 300,
  theme: 'dark',
  timezone: 'auto',
  widgetSizes: { clock: '1x1', weather: '2x1', calendar: '2x2', meals: '1x1', chores: '2x1', availability: '1x1', allowance: '1x1', notes: '1x1' },
  defaultEventCalendarId: 'local',
};

export async function getDashboardSettings(familyId?: string | null): Promise<DashboardSettings> {
  if (!familyId) return DEFAULTS;
  const row = await db.query.dashboardSettings.findFirst({
    where: eq(dashboardSettings.id, familyId),
  });
  if (!row) return DEFAULTS;

  // Guard against stale ids lingering after a code change that renamed/removed a widget.
  const widgetOrder = row.widgetOrder.filter((id) => DASHBOARD_WIDGETS.includes(id));
  return { widgetOrder, refreshSeconds: row.refreshSeconds, theme: row.theme, timezone: row.timezone, widgetSizes: { ...DEFAULTS.widgetSizes, ...row.widgetSizes }, defaultEventCalendarId: row.defaultEventCalendarId || 'local' };
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

export async function getUserDashboardLayout(userId: string, familyId: string, defaults: DashboardSettings) {
  const row = await db.query.userDashboardLayouts.findFirst({
    where: and(eq(userDashboardLayouts.userId, userId), eq(userDashboardLayouts.familyId, familyId)),
  });
  if (!row) return { widgetOrder: defaults.widgetOrder, widgetSizes: defaults.widgetSizes };
  const customOrder = row.widgetOrder.filter((id) => DASHBOARD_WIDGETS.includes(id));
  const widgetOrder = [...customOrder, ...defaults.widgetOrder.filter((id) => !customOrder.includes(id))];
  return {
    widgetOrder,
    widgetSizes: { ...defaults.widgetSizes, ...row.widgetSizes },
  };
}

export async function saveUserDashboardLayout(userId: string, familyId: string, widgetOrder: DashboardWidgetId[], widgetSizes: DashboardSettings['widgetSizes']) {
  await db.insert(userDashboardLayouts).values({ userId, familyId, widgetOrder, widgetSizes })
    .onConflictDoUpdate({
      target: [userDashboardLayouts.userId, userDashboardLayouts.familyId],
      set: { widgetOrder, widgetSizes },
    });
}
