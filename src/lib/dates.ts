/** Parses a "YYYY-MM-DD" key as a local calendar date. Plain `new Date(key)`
 *  parses date-only strings as UTC midnight, so formatting the result in a
 *  timezone behind UTC (anywhere west of it) silently shifts the displayed
 *  weekday back by a day. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}
