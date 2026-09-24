/**
 * Chores "reset" without any cron job: completions are keyed by period
 * (today's date for daily chores, this ISO week for weekly ones), so a new
 * period simply has no completion row yet.
 */
export function currentPeriodKey(frequency: 'daily' | 'weekly', now = new Date()): string {
  if (frequency === 'daily') {
    return now.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const weekNum =
    1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
