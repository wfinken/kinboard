const DEFAULT_TIMEZONE = 'America/New_York';

/** The household's IANA timezone, for deciding what day "today" is.
 *
 *  This matters because the server's own clock isn't the household's: the
 *  Cloudflare Worker runs in UTC regardless of where the household actually
 *  is, so `new Date()`'s own get*()/toISOString() reflect UTC, not the
 *  household's wall-clock date. Every evening (from whenever local time
 *  crosses into "tomorrow in UTC" - e.g. ~8pm Eastern, ~5pm Pacific) that
 *  mismatch silently rolled chores over early and showed the wrong day's
 *  meal plan. Compute "today" via this timezone (see zonedCalendarDate /
 *  zonedDateKey below) instead of the server's own local getters. */
export function householdTimezone(): string {
  return process.env.KINBOARD_TIMEZONE || DEFAULT_TIMEZONE;
}

/** Parses a "YYYY-MM-DD" key as a local calendar date. Plain `new Date(key)`
 *  parses date-only strings as UTC midnight, so formatting the result in a
 *  timezone behind UTC (anywhere west of it) silently shifts the displayed
 *  weekday back by a day. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The "YYYY-MM-DD" for `instant` — always UTC (Date.toISOString() is
 *  timezone-independent by spec). Only meaningful when `instant` is itself
 *  a calendar-only date already normalized to UTC midnight, as produced by
 *  zonedCalendarDate() below, not an arbitrary real-time instant. */
export function dateKeyUTC(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/** A Date holding `instant`'s calendar date *as observed in `timeZone`*,
 *  normalized to UTC midnight. Treat the result as a calendar date, not a
 *  real instant: read/modify it with the UTC-prefixed Date methods
 *  (getUTCDate, setUTCDate, ...) so the server's own timezone can't shift
 *  it again, and format it for display with `timeZone: 'UTC'`. */
export function zonedCalendarDate(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

/** The "YYYY-MM-DD" for `instant`'s calendar date as observed in `timeZone`
 *  — i.e. what day it actually is for the household right now. */
export function zonedDateKey(instant: Date, timeZone: string): string {
  return dateKeyUTC(zonedCalendarDate(instant, timeZone));
}
