/** `auto` means use the viewer's local timezone in the web portal. */
export function displayTimezone(timezone: string): string | undefined {
  if (!timezone || timezone === 'auto') return undefined;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return undefined;
  }
}
