import { householdTimezone, zonedCalendarDate, zonedDateKey } from './dates';

/**
 * Chores "reset" without any cron job: completions are keyed by period
 * (today's date for daily chores, this ISO week for weekly ones), so a new
 * period simply has no completion row yet. Period keys are computed in the
 * household's own timezone (not the server's) — see dates.ts.
 */
export function currentPeriodKey(frequency: 'daily' | 'weekly', now = new Date()): string {
  const tz = householdTimezone();
  if (frequency === 'daily') {
    return zonedDateKey(now, tz);
  }

  const date = zonedCalendarDate(now, tz);
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const weekNum =
    1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
